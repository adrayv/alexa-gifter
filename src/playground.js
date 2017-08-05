var rp = require('request-promise');

var err = "Error mesage";

rp('http://taco-randomizer.herokuapp.com/random/?full-taco=true')
.then(function(response) {
	body = JSON.parse(response);
	console.log(body.name);
	throw err; // how to explicitly call the catch function
})
.catch(function(err) {
	console.log(err);
});
