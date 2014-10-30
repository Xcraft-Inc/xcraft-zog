'use strict';

var path       = require ('path');
var shellcraft = require ('shellcraft');

var zogLog = require ('xcraft-core-log') ('bus-server');
zogLog.verbosity (0);

var options = {
  prompt: 'z0g>'
};

shellcraft.registerExtension (path.join (__dirname, 'extensions.js'), function () {
  shellcraft.begin (options, function (msg) {
    if (msg) {
      console.log (msg);
    }
  });
});
