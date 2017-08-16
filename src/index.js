var Alexa = require('alexa-sdk');
var rp = require('request-promise');
var AWS = require('aws-sdk');
var s3 = new AWS.S3({apiVersion: '2006-03-01'});

// ---- getting API keys ----
var config = undefined;
var s3_params = {
	Bucket: "adrayv-bucket",
	Key: "alexa-GIFter/config.json",
};
s3.getObject(s3_params, beginSesh); 

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

// ----- messages -----
var misunderstand = "Sorry I didn't understand you that time";
var errorMsg = "Hmm, I couldn't find that gif";
//var giphyErr = "Sorry I can't access giphy right now. Try again later.";

// ----- register handlers -----
exports.handler = function (event, context, callback) {
	alexa = Alexa.handler(event, context);
	alexa.registerHandlers(newSessionHandler);
};

// ----- execute session -----
function beginSesh(err, data) {
	if(err) console.log("ERROR BEFORE EXECUTING");
	else {
		config = JSON.parse(data.Body.toString('ascii')); 
		api_key += config.giphy;
		alexa.execute();
	}
}

var newSessionHandler = {
	'LaunchRequest': function () {
		if(config && config.giphy) console.log("THE GOOD STUFF");
		else console.log("THE BAD STUFF");
		this.emit(':tell', "I am GIFter");
	},
	'getGifIntent': function() {
		console.log("CHECK 1");
		resetVars();
		slotVal = getSlotVal(this.event.request.intent.slots); // get the response from a matched slot
		console.log("CHECK 2");
		if(slotVal == null) { // user response did not resolve to a intent
			this.emit(':tell', misunderstand); // send error and end session
		}
		console.log("CHECK 3");
		param_query += slotVal;
		console.log(slotVal);
		param_limit += 10;
		var THIS = this;
		rp(getRequest())
		.then(function(r) {
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
			console.log(err);
			THIS.emit(':tell', err);
		});
	}
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
	response = undefined;
	numGifs = -1; 
	statusCode = -1;
	slotVal = undefined;
}

/*
rp(getRequest())
.then(function(r) {
	response = JSON.parse(r);
	numGifs = response.pagination.count;
	statusCode = response.meta.status;
	if(numGifs == 0 || statusCode != 200) {
		throw "Error Getting Response";
	}
	console.log(response.data[0].url); // url of the gif
	console.log(response.data[0].images.preview.mp4); // image of the gif
})
.catch(function(err) {
	console.log(err);
});
*/
