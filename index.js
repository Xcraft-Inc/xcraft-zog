'use strict';

var inquirer = require ('inquirer');
var async    = require ('async');
var path     = require ('path');
var xLog     = require ('xcraft-core-log') ('zog');
xLog.verbosity (0);


var shellStart = function (busClient) {
  var shell = [{
    type    : 'input',
    name    : 'command',
    message : 'z0g>'
  }];

  var mainShutdown = function () {
    busClient.stop (function (done) { /* jshint ignore:line */
      xLog.verb ('bus client stopped...');
    });
  };

  async.forever (function (next) {
    inquirer.prompt (shell, function (answers) {
      next ();
    });
  }, function (err) {
    if (err) {
      xLog.err (err);
    }

    mainShutdown ();
  });
};

var serverStart = function () {
  var args = [];
  var server = require ('child_process').fork (path.join (__dirname, './busServer.js'), args, {silent: true});

  server.stdout.on ('data', function (data) {
    data.toString ().replace (/\r/g, '').split ('\n').forEach (function (line) {
      if (line.trim ().length) {
        xLog.verb ('BUS-SERVER: ' + line);
      }
    });
  });

  server.stderr.on ('data', function (data) {
    data.toString ().replace (/\r/g, '').split ('\n').forEach (function (line) {
      if (line.trim ().length) {
        xLog.verb ('BUS-SERVER: ' + line);
      }
    });
  });

  var busClient = require ('xcraft-core-busclient');
  busClient.connect (null, function (err) {
    shellStart (busClient);
  });
};

serverStart ();
