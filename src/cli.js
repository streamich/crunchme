var path = require('path');
var fs = require('fs');
var pack = require('./pack');


var source = process.argv[2];
if(!source) return console.log('Error: Source file not specified.');
source = path.resolve(source);

var destination = process.argv[3];
if(!destination) return console.log('Error: Destination file not specified.');
destination = path.resolve(destination);


var jsdata = fs.readFileSync(source).toString();
var output = pack(jsdata);
fs.writeFileSync(destination, output);


