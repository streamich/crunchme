# Crunchme

This utility compresses your `.js` into a self extracting file and appends minimal JavaScript required to decompress the file.

It uses several algorithms to find the best solution or even leave the file as is, if compression overhead will actually increase
the files size.

This file does not use minification tools like `uglify-js`, you have to apply that yourself before using this module.

For better compression rates use [this excellent tool](http://crunchme.bitsnbites.eu/) instead.

## Usage

Using command line:

    crunchme file.js file.bin.js

Programmatically:

```javascript
var crunchme = require("crunchme");
var output = crunchme(js_code);
```