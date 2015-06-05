var fs = require('fs');


function run_algo(algo, data) {
    var compressor = require('./algo/' + algo + '.js');
    var compressed = compressor(data);

    var template = fs.readFileSync(__dirname + '/algo/' + algo + '.tpl.js').toString();

    var output = template.replace('__DATA__', compressed);
    return output;
}

function pack(js_code, algos) {
    if(!algos) {
        algos = [
            'deflate',
            'gzip',
            'lz77',
            'lzw'
        ];
    }

    var best_result = js_code;
    var best_size = js_code.length;

    algos.forEach(function(algo) {
        var output = run_algo(algo, js_code);
        var size = new Buffer(output).length;

        if(size < best_size) {
            best_size = size;
            best_result = output;
        }
    });

    return best_result;
}

module.exports = pack;