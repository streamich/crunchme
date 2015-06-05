var zlib = require('zlib');

module.exports = function(str) {
    return zlib.deflateSync(new Buffer(str)).toString('base64');
};
