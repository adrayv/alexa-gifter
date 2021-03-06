var Alexa = require('alexa-sdk');
var rp = require('request-promise');
var AWS = require('aws-sdk');
var s3 = new AWS.S3({apiVersion: '2006-03-01'});
var sns = new AWS.SNS({apiVersion: '2010-03-31'});
var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var docClient = new AWS.DynamoDB.DocumentClient();

// ----- basic giphy API build -----
const base = "https://api.giphy.com/v1/";
const endpt_search = "gifs/search?";
var api_key = "api_key=";

// ------ Paramters for searching giphy -------
var param_query = "&q=";
const param_limit = "&limit=12";
const param_offset = "&offset=0";
const param_rating = "&rating=PG-13";
const param_lang = "&lang=en";

// ----- variables -----
var response = undefined;
var numGifs = -1;
var statusCode = -1;
var slotVal = undefined;
var alexa = undefined;
var userId = undefined;
var verboseNum = undefined;

// ---- getting API keys ----
var config = undefined;
var s3_params = {
	Bucket: "adrayv-bucket",
	Key: "alexa-GIFter/config.json",
};

// ----- DB Parameters -----
var db_get_params = {
	TableName: "alexaGifData",
	Key: {
		"userId": ""
	}
};

var db_put_params = {
	TableName: "alexaGifData",
	Item: {
		userId: "",
		phone: ""
	}
};

// ----- SNS Parameters -----
var sns_params = {
	Message: "",
	MessageAttributes: {
		"msg" : {
			DataType: "String",
			StringValue: "gifGuru"
		}
	},
	PhoneNumber: ""
};

// ----- greeting messages -----
var newWelcome = "Hi! I am the Gif Guru. If you need help using this skill, just say, I need help. ";
var returnerWelcome = "Hi! Nice to hear from you again. ";

// ----- error messages -----
var apiErr = "Sorry, something odd happened. Please try again later.";
var textErr = "Hmm, I can't text you that gif right now. Try searching for something else. ";
var errorMsg = "Hmm, I couldn't find that gif";
var generalErr = "Sorry, I didn't get that. ";
var giphyErr = "Sorry, I can't access giphy right now. Try again later.";

// ----- help messages -----
var generalHelpMsg = "Gif Guru will find the gifs you're looking for, and deliver them to your mobile phone. If you would like me to forget your phone number, please disable, then re-enable this skill on your Alexa App. ";
var bestQueryUsage = "Here's an example to help you out. If I wanted a gif about a particular celebrity, I would say, Send me something about Kim Kardashian. ";
var confirmNumUsage = "I need to confirm your number before we continue. Your number is ";

// ----- prompt messages ------
var phoneNonExist = "According to my records, I don't have your mobile phone number. ";
var phoneUsage = "I need your number in order to text you the gifs that I find. ";
var phoneAsk = "Starting with your area code, please briefly tell me your ten-digit phone number. ";
var confirmNum1 = "Let me make sure I got that. Your number is, "; 
var confirmNum2 = "Is this correct?";
var promptQuery = "What gif should I send to you? ";

// ----- other messages -----
var goodbyeMsg = "Ok, see you next time!";
var confirmText = "I sent you a text with a few gifs you might like. This skill is powered by giphy. ";

// ----- states -----
var states = {
	QUERYMODE: '_QUERYMODE',
	CONFIGPHONE: '_CONFIGPHONE',
	CONFIRMPHONE: '_CONFIRMPHONE'
};

// ----- register handlers -----
exports.handler = function (event, context, callback) {
	alexa = Alexa.handler(event, context);
	alexa.registerHandlers(newSessionHandler, configPhoneHandler, confirmPhoneHandler, queryModeHandler);
	alexa.execute();
};

var newSessionHandler = {
	'LaunchRequest': function () {
		// ----- Find if user phone num exists -----
		userId = this.event.session.user.userId;
		db_get_params.Key.userId = userId;
		var THIS = this;
		docClient.get(db_get_params).promise()
		.then(function(data) {
			if(data.Item) {
				sns_params.PhoneNumber = data.Item.phone;
				console.log("SNS.phone: " + sns_params.PhoneNumber);
				THIS.handler.state = states.QUERYMODE;
				THIS.emit(':ask', returnerWelcome + promptQuery);
			}
			else {
				console.log("DB GET: user was not found");
				THIS.handler.state = states.CONFIGPHONE;
				THIS.emit(':ask', newWelcome + phoneNonExist + phoneUsage + phoneAsk);
			}
		}, function(error) {
			console.log("DB GET ERR: " + error);
			THIS.emit(':tell', apiErr); 
		})
		.catch(function(err) {
			console.log("DB GET CATCH: " + err);
			THIS.emit(':tell', apiErr);
		});
	},
	'getGifIntent': function() { 
		resetVars();
		// ----- Find if user phone num exists -----
		userId = this.event.session.user.userId;
		db_get_params.Key.userId = userId;
		var THIS = this;
		docClient.get(db_get_params).promise()
		.then(function(data) {
			if(data.Item) {
				sns_params.PhoneNumber = data.Item.phone;
				console.log("SNS.phone: " + sns_params.PhoneNumber);
				// ----- User is verified -----
				slotVal = getSlotVal(THIS.event.request.intent.slots); // get the response from a matched slot
				if(slotVal == null) { // user response did not resolve to a intent
					THIS.emit(':ask', generalErr + promptQuery);
				}
				param_query += slotVal;
				console.log(slotVal);
				return s3.getObject(s3_params).promise() // retrieve giphy api key
			}
			else {
				console.log("DB GET: user was not found");
				THIS.handler.state = states.CONFIGPHONE;
				THIS.emit(':ask', phoneNonExist + phoneUsage + phoneAsk);
			}
		}, function(error) {
			console.log("DB GET ERR: " + error);
			THIS.emit(':tell', apiErr); 
		})
		.then(function(data) { 
			config = JSON.parse(data.Body.toString('ascii')); 
			if(!(config.giphy)) {
				throw "Unable to resolve config URL";
			}
			api_key += config.giphy;
			return rp(getRequest());
		}, function(error) { // called if the promise is rejected
			console.log("GIPHY ERROR: " + error);
			throw giphyErr;
		})
		.then(function(r) { // called if giphy API promise is fulfilled
			response = JSON.parse(r);
			numGifs = response.pagination.count;
			statusCode = response.meta.status;
			if(numGifs <= 0 || statusCode != 200) {
				throw errorMsg;
			}
			/* at this point we have successfully gotten a gif */
			setMessage(response.data);
			return sns.publish(sns_params).promise(); // send a text to the user with the gifs
		})
		.then(function(data) {
			THIS.emit(':tell', confirmText);
		}, function(error) {
			console.log("SNS ERROR: " + error);
			THIS.emit(':tell', textErr);
		})
		.catch(function(err) {
			console.log("newGetGifIntentError: " + err);
			THIS.emit(':tell', apiErr);
		});
	},
	'AMAZON.HelpIntent': function () {
		this.emit(':ask', generalHelpMsg + promptQuery);
	},
	'Unhandled': function () {
		this.emit(':ask', generalErr + bestQueryUsage + promptQuery);
	},
	'AMAZON.StopIntent': function() {
		this.emit(':tell', goodbyeMsg);
	},
	'AMAZON.CancelIntent': function() {
		this.emit(':tell', goodbyeMsg);
	}
};

var queryModeHandler = Alexa.CreateStateHandler(states.QUERYMODE, {
	'getGifIntent': function() {
		resetVars();
		slotVal = getSlotVal(this.event.request.intent.slots); // get the response from a matched slot
		if(slotVal == null) { // user response did not resolve to a intent
			this.emit(':ask', generalErr + promptQuery);
		}
		param_query += slotVal;
		console.log(slotVal);
		var THIS = this;

		s3.getObject(s3_params).promise() // retrieve giphy api key
		.then(function(data) { 
			config = JSON.parse(data.Body.toString('ascii')); 
			if(!(config.giphy)) {
				throw "Unable to resolve config URL";
			}
			api_key += config.giphy;
			return rp(getRequest());
		}, function(error) { // called if the promise is rejected
			console.log("GIPHY ERROR: " + error);
			throw giphyErr;
		})
		.then(function(r) { // called if giphy API promise is fulfilled
			response = JSON.parse(r);
			numGifs = response.pagination.count;
			statusCode = response.meta.status;
			if(numGifs <= 0 || statusCode != 200) {
				throw errorMsg;
			}
			/* at this point we have successfully gotten a gif */
			setMessage(response.data);
			return sns.publish(sns_params).promise(); // send a text to the user with the gifs
		})
		.then(function(data) {
			THIS.emit(':tell', confirmText);
		}, function(error) {
			console.log("SNS ERROR: " + error);
			THIS.emit(':tell', textErr);
		})
		.catch(function(err) {
			console.log(err);
			THIS.emit(':tell', apiErr);
		});
	},
	'AMAZON.HelpIntent': function () {
		this.emit(':ask', generalHelpMsg + promptQuery);
	},
	'Unhandled': function() {
		this.emit(':ask', generalErr + bestQueryUsage + promptQuery);
	},
	'AMAZON.StopIntent': function() {
		this.emit(':tell', goodbyeMsg);
	},
	'AMAZON.CancelIntent': function() {
		this.emit(':tell', goodbyeMsg);
	}
});

var configPhoneHandler = Alexa.CreateStateHandler(states.CONFIGPHONE, {
	'getPhoneIntent': function() {
		var phoneSlot = undefined;
		phoneSlot = this.event.request.intent.slots.PHONE.value;
		if(phoneIsValid(phoneSlot)) {
			sns_params.PhoneNumber = "+1" + phoneSlot;
			verboseNum = verbosifyNum(phoneSlot);
			this.handler.state = states.CONFIRMPHONE;
			this.emit(':ask', confirmNum1 + verboseNum + confirmNum2);
		}
		else {
			this.emit(':ask', "Sorry, that phone number is invalid. " + phoneAsk);
		}
	},
	'AMAZON.HelpIntent': function() {
		this.emit(':ask', generalHelpMsg + phoneUsage + phoneAsk);
	},
	'Unhandled': function() {
		this.emit(':ask', generalErr + phoneAsk);
	},
	'AMAZON.StopIntent': function() {
		this.emit(':tell', goodbyeMsg);
	},
	'AMAZON.CancelIntent': function() {
		this.emit(':tell', goodbyeMsg);
	}
});

var confirmPhoneHandler = Alexa.CreateStateHandler(states.CONFIRMPHONE, {
	'AMAZON.YesIntent': function() {
		this.emit('customYesIntent');
	},
	'customYesIntent': function() { // included because Amazon NLP can't resolve "yes" to AMAZON.YesIntent
		// ----- Store the phone number in dynamoDB Table -----
		db_put_params.Item.userId = userId;
		db_put_params.Item.phone = sns_params.PhoneNumber;
		var THIS = this;
		docClient.put(db_put_params).promise()
		.then(function(data) {
			THIS.handler.state = states.QUERYMODE;
			THIS.emit(':ask', "Ok, I've saved you number for future use! " + promptQuery);
		}, function(error) {
			console.log("ERROR PUTTING TO DB: " + error);
			THIS.emit(':tell', apiErr);
		})
		.catch(function() {
			console.log("CAUGHT SOMETHING FROM DB PUT");
			THIS.emit(':tell', apiErr);
		});
	},
	'AMAZON.NoIntent': function() {
		this.handler.state = states.CONFIGPHONE;
		this.emit(':ask', phoneAsk);
	},
	'AMAZON.HelpIntent': function() {
		this.emit(':ask', confirmNumUsage + verboseNum + confirmNum2);
	},
	'Unhandled': function() {
		this.emit(':ask', generalErr + confirmNumUsage + verboseNum + confirmNum2);
	},
	'AMAZON.StopIntent': function() {
		this.emit(':tell', goodbyeMsg);
	},
	'AMAZON.CancelIntent': function() {
		this.emit(':tell', goodbyeMsg);
	}
});

// ----- Helper Functions -----

function setMessage(gifs) {
	var msg = "";
	var len = gifs.length;
	var i, i1, i2, i3;
	if(len <= 0) {
		sns_params.Message = "";
	}
	else if(len >= 3) { // choose a random gif and pick the adjacent two
		i1 = Math.floor(Math.random() * len);
		i2 = i1 + 1;
		i3 = i2 + 1;
		if(i2 >= len) i2 -= len; // circular wrapping 
		if(i3 >= len) i3 -= len; // circular wrapping 
		// ----- only attach url's if they exist -----
		if(gifs[i1].bitly_url) {
			msg += (gifs[i1].bitly_url + "\n");
		}
		if(gifs[i2].bitly_url) {
			msg += (gifs[i2].bitly_url + "\n");
		}
		if(gifs[i3].bitly_url) {
			msg += (gifs[i3].bitly_url + "\n");
		}
	}
	else { // returns one gif if there are less than 3 results
		console.log("SEARCH FOUND LESS THAN 3 RESULTS");
		i = Math.floor(Math.random() * len);
		if(gifs[i].bitly_url) {
			msg += (gifs[i].bitly_url + "\n");
		}
	}
	sns_params.Message = msg;
	return;
}

function verbosifyNum(n) {
	return "<say-as interpret-as='telephone'>" + n + "</say-as>. ";
}

function phoneIsValid(n) {
	if(!n) return false;
	if(n.length != 10) return false;
	for(i = 0; i < n.length; i++) {
		if(n[i] < '0' || n[i] > '9') {
			return false;
		}
	}
	return true;
}

function getSlotVal(slots) { // linear search through slots to find captured user input
	for(i in slots) {
		if(slots[i].value != null) {
			console.log(slots[i].name + ": " + slots[i].value);
			return slots[i].value
		}
	}
	console.log("RETURNED NULL");
	return null;
}

function getRequest() { // build the request handled by rp
	return base + endpt_search + api_key + param_query + param_limit + param_offset + param_rating + param_lang;
}

function resetVars() {
	param_query = "&q=";
	api_key = "api_key=";
	response = undefined;
	numGifs = -1; 
	statusCode = -1;
	slotVal = undefined;
}
