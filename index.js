'use strict';
var zogLog  = require ('xcraft-core-log') ('zog');
zogLog.verbosity (0);
var zogBoot      = require ('./zogBoot.js');
var xConfig = require ('xcraft-core-etc').load ('xcraft');

var boot = true;
var isExiting = false;

var main = function () {
  var Shell        = require ('shell');
  var busClient    = require('xcraft-core-busclient');
  var busCommands  = require('./zogBusCommands.js');
  var binsCommand  = require('xcraft-core-bin');
  var mainShutdown = function () {
    zogLog.verb ('shutdown...');
    isExiting = true;
    busClient.stop (function (done) { /* jshint ignore:line */
      zogBoot.stop ();
    });
  };
  var app = new Shell ({
              chdir: xConfig.xcraftRoot,
              prompt: 'z0g>'
            });
  /* Middleware registration */
  app.configure(function () {
    app.use(Shell.history({
      shell: app
    }));
    app.use(Shell.completer({
      shell: app
    }));
    app.use(Shell.router({
      shell: app
    }));
    app.use(binsCommand({shell: app}));
    app.use(busCommands.load({
      shell: app,
      busClient: busClient
    }));
    app.use(Shell.help({
      shell: app,
      introduction: true
    }));
  });

  // Event notification
  app.on('quit', function () {
    if (!isExiting) {
      mainShutdown ();
    }
  });
};

if (boot) {
  zogBoot.start (main);
}
