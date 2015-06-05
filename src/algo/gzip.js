var zlib = require('zlib');

module.exports = function(str) {
    return zlib.gzipSync(new Buffer(str)).toString('base64');
};
