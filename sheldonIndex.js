'use strict';
var path    = require ('path');
var xLog  = require ('xcraft-core-log') ('zog');
xLog.verbosity (1);
var xConfig = require ('xcraft-core-etc').load ('xcraft');

var boot = true;
var isExiting = false;


var shellStart = function (busClient) {
  var Shell        = require ('shell');
  var busCommands  = require('./zogBusCommands.js');
  var binsCommand  = require('xcraft-core-bin');
  var mainShutdown = function () {
    xLog.verb ('shutdown...');
    isExiting = true;
    busClient.stop (function (done) { /* jshint ignore:line */
      xLog.verb ('bus client stopped...');
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
  var args = [];
  var server = require ('child_process').fork (path.join (__dirname, './busServer.js'), args, {silent: true});


  server.stdout.on ('data', function (data) {
    data.toString ().replace (/\r/g, '').split ('\n').forEach (function (line) {
      if (line.trim ().length) {
        console.log ('BUS-SERVER::' + line);
      }
    });
  });

  server.stderr.on ('data', function (data) {
    data.toString ().replace (/\r/g, '').split ('\n').forEach (function (line) {
      if (line.trim ().length) {
        console.log ('BUS-SERVER::' + line);
      }
    });
  });


  var busClient    = require('xcraft-core-busclient');

  busClient.connect (null, function (err) {
    shellStart (busClient);
  });
}
