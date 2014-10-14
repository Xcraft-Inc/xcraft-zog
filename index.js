'use strict';

var Shell = require('shell');
var zogBoot    = require ('./zogBoot.js');
var boot = true;


var main = function () {
  var app = new Shell ({
              chdir: __dirname,
              prompt: '\xb4>'
            });
  /* Middleware registration */
  app.configure(function () {
    app.use(Shell.history({
      shell: app
    }));
    app.use(Shell.completer({
      shell: app
    }));
    app.use(require('xcraft-core-bin')({
      shell: app
    }));
    app.use(require('xcraft-core-busclient').shellExt({
      shell: app
    }));
    app.use(Shell.router({
      shell: app
    }));
    app.use(Shell.help({
      shell: app,
      introduction: true
    }));
  });

  // Event notification
  app.on('quit', function () {
  });


};


if (boot) {
  zogBoot.start (main);
}
