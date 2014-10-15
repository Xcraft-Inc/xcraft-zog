'use strict';
/* xcraft-zog busclient shell extensions */
var xLog   = require ('xcraft-core-log')('zog-buscmdloader');
exports.load = function (settings) {
  if (settings.shell !== undefined && settings.busClient !== undefined) {
    var commander = require ('xcraft-core-bus').getCommander();
    var registry  = commander.getCommandsRegistry ();
    Object.keys (registry).forEach (function (action) {
      var cmdAndParams = action;
      if (registry[action].params) {
        cmdAndParams += ' ' + registry[action].params;
      }
      
      settings.shell.cmd (cmdAndParams, registry[action].desc, function (req, res, next) {
        settings.busClient.command.send (action, req.params, function () { settings.shell.set('stdout', process.stdout); res.prompt(); });
      });
    });
  }
};
