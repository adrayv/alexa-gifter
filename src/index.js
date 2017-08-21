var Alexa = require('alexa-sdk');
var rp = require('request-promise');
var AWS = require('aws-sdk');
var s3 = new AWS.S3({apiVersion: '2006-03-01'});
var sns = new AWS.SNS({apiVersion: '2010-03-31'});
var dynamodb = new AWS.DynamoDB({apiVersion: '2012-08-10'});
var docClient = new AWS.DynamoDB.DocumentClient();

// ----- basic API build -----
const base = "https://api.giphy.com/v1/";
const endpt_search = "gifs/search?";
var api_key = "api_key=";

// ------ Paramters for searching giphy -------
var param_query = "&q=";
var param_limit = "&limit=";
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

// ----- SNS Parameters -----
var sns_params = {
	Message: "http://gph.is/1MLPDWK\nhttp://gph.is/2gcICEP",
	MessageAttributes: {
		"msg" : {
			DataType: "String",
			StringValue: "gifGuru"
		}
	},
	PhoneNumber: ""
};

// ----- messages -----
var newWelcome = "Hi! I am the Gif Guru. If you need help using this skill, just say, I need help. ";
var misunderstand = "Sorry I didn't understand you that time";
var errorMsg = "Hmm, I couldn't find that gif";
var generalErr = "Sorry, I didn't get that. ";
var giphyErr = "Sorry, I can't access giphy right now. Try again later.";
var phoneNonExist = "According to my records, I don't have your mobile phone number. ";
var phoneUsage = "I need your number in order to text you the gifs that I find. ";
var phoneAsk = "Starting with your area code, please tell me your ten-digit phone number. ";
var confirmNum1 = "Let me make sure I got that. Your number is, "; 
var confirmNum2 = "Is this correct?";
var confirmNumUsage = "I need to confirm your number before we continue. Your number is ";
var generalHelpMsg = "Gif Guru will find and deliver the gif's you're looking for right to your mobile phone. ";
var goodbyeMsg = "Ok, see you next time!";

// ----- states -----
var states = {
	QUERYMODE: '_QUERYMODE',
	CONFIGPHONE: '_CONFIGPHONE',
	CONFIRMPHONE: '_CONFIRMPHONE'
};

// ----- register handlers -----
exports.handler = function (event, context, callback) {
	alexa = Alexa.handler(event, context);
	alexa.registerHandlers(newSessionHandler, configPhoneHandler, confirmPhoneHandler);
	alexa.execute();
};

var newSessionHandler = {
	/*
	'LaunchRequest': function () {
		var THIS = this;
		sns.publish(sns_params).promise()
		.then(function(data) {
			THIS.emit(':tell', "I sent you a text");
		}, function(error) {
			console.log(error);
			THIS.emit(':tell', "I could not send you a text");
		})
		.catch(function(err) {
			console.log(err);
			THIS.emit(':tell', "Something went wrong");
		});
	},
	*/
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
				THIS.emit(':tell', "Got Data");
			}
			else {
				console.log("DATA: was not found");
				THIS.handler.state = states.CONFIGPHONE;
				THIS.emit(':ask', newWelcome + phoneNonExist + phoneUsage + phoneAsk);
			}
		}, function(error) {
			console.log("ERROR: " + error);
			THIS.emit(':tell', "Got Error");
		})
		.catch(function() {
			THIS.emit(':tell', "Something Weird Happened");
		});
	},
	'getGifIntent': function() { // FIX THIS TO ADAPT NEW STATES
		resetVars();
		slotVal = getSlotVal(this.event.request.intent.slots); // get the response from a matched slot
		if(slotVal == null) { // user response did not resolve to a intent
			this.emit(':tell', misunderstand); // send error and end session
		}
		param_query += slotVal;
		console.log(slotVal);
		param_limit += 10;
		var THIS = this;

		//var request = s3.getObject(s3_params);
		//var result = request.promise();
		s3.getObject(s3_params).promise()
		.then(function(data) { // called if the promise is fulfilled
			console.log("THEN 1");
			config = JSON.parse(data.Body.toString('ascii')); 
			if(!(config.giphy)) {
				throw "Unable to resolve config URL";
			}
			api_key += config.giphy;
			return rp(getRequest());
		}, function(error) { // called if the promise is rejected
			console.log("THEN ERR");
			console.log("ERROR: " + error);
			throw giphyErr;
		})
		.then(function(r) { // called if giphy API promise is fulfilled
			console.log("THEN 2");
			response = JSON.parse(r);
			numGifs = response.pagination.count;
			statusCode = response.meta.status;
			if(numGifs <= 0 || statusCode != 200) {
				throw errorMsg;
			}
			/* at this point we have successfully gotten a gif */
			console.log(response.data[0].url);
			console.log(response.data[0].images.preview.mp4);
			THIS.emit(':tellWithCard', "check the alexa app", "numGifs: " + numGifs, "Status Code: " + statusCode);
		})
		.catch(function(err) {
			console.log("CATCH");
			console.log(err);
			THIS.emit(':tell', err);
		});

		console.log("THIS WAS REACHED");
	},
	'AMAZON.StopIntent': function() {
		this.emit(':tell', goodbyeMsg);
	},
	'AMAZON.CancelIntent': function() {
		this.emit(':tell', goodbyeMsg);
	}
}

var configPhoneHandler = Alexa.CreateStateHandler(states.CONFIGPHONE, {
	'getPhoneIntent': function() {
		var phoneSlot = undefined;
		phoneSlot = this.event.request.intent.slots.PHONE.value;
		if(phoneIsValid(phoneSlot)) {
			sns_params.PhoneNumber = phoneSlot;
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
		this.emit(':tell', "Great! Let's get started.");
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

function verbosifyNum(n) {
	var v = ""
	for(i = 0; i < n.length; ++i) {
		v += (n[i] + ". ");
	}
	return v;
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
	param_limit = "&limit=";
	api_key = "api_key=";
	response = undefined;
	numGifs = -1; 
	statusCode = -1;
	slotVal = undefined;
}
