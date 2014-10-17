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
  var xProcess = require ('xcraft-core-process');
  xProcess.fork (path.join (__dirname, './busServer.js'), args, {silent: true}, null, function (line) {
    console.log ('server: ' + line);
  }, function (line) {
    console.log ('server: ' + line);
  });

  var busClient = require ('xcraft-core-busclient');
  busClient.connect (null, function (err) {
    shellStart (busClient);
  });
};

serverStart ();
