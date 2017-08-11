var Alexa = require('alexa-sdk');
var rp = require('request-promise');
var config = require('../config.js');

var giphy = {
	key : config.giphy_key;
}

// ----- basic API build -----
const base = "https://api.giphy.com/v1/";
const endpt_search = "gifs/search?";
const api_key = "api_key=" + giphy.key;

// ------ Paramters for searching -------
var param_query = "&q=";
var param_limit = "&limit=";
const param_offset = "&offset=0";
const param_rating = "&rating=PG-13";
const param_lang = "&lang=en";

// ----- variables -----
var response = undefined;
var numGifs = undefined; // how many gifs were returned
var statusCode = undefined;
var slotVal = undefined;

// ----- messages -----
var misunderstand = "Sorry I didn't understand you that time";
var error_msg = "Hmm, I couldn't find that gif";

exports.handler = function (event, context, callback) {
	var alexa = Alexa.handler(event, context);
	alexa.registerHandlers(newSessionHandler);
	alexa.execute();
};

//param_query += "family guy";
param_limit += 10;

var newSessionHandler = {
	'LaunchRequest': function () {
		this.emit(':tell', "I am GIFter");
	},
	'getGifIntent': function() {
		resetVars();
		slotVal = getSlotVal(this.event.request.intent.slots); // get the response from a matched slot
		if(slotVal == null) { // user response did not resolve to a intent
			this.emit(':tell', misunderstand); // send error and end session
		}
		param_query += slotVal;
		var THIS = this;
		rp(getRequest())
		.then(function(r) {
			response = JSON.parse(r);
			numGifs = response.pagination.count;
			statusCode = response.meta.status;
			if(numGifs == 0 || statusCode != 200) {
				throw error_msg;
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
	return null;
}

function getRequest() { // build the request handled by rp
	return base + endpt_search + api_key + param_query + param_limit + param_offset + param_rating + param_lang;
}

function resetVars() {
	var param_query = "&q=";
	var param_limit = "&limit=";
	var response = undefined;
	var numGifs = undefined; // how many gifs were returned
	var statusCode = undefined;
	var slotVal = undefined;
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
