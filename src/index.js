var rp = require('request-promise');

// ----- basic URL build -----
const base = "https://api.giphy.com/v1/";
const endpt_search = "gifs/search?";
const api_key = "api_key=76bbb6e4dd874ca481aefb45a84a2991";

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

param_query += "family guy";
param_limit += 11;
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

function getRequest() {
	return base + endpt_search + api_key + param_query + param_limit + param_offset + param_rating + param_lang;
}
