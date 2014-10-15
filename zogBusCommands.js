'use strict';
/* xcraft-zog busclient shell extensions */

exports.load = function (settings) {
  if (settings.shell !== undefined && settings.busClient !== undefined) {
    var commander = require ('xcraft-core-bus').getCommander();
    var registry  = commander.getCommandsRegistry ();
    Object.keys (registry).forEach (function (action) {
      settings.shell.cmd (action, registry[action].desc, function (req, res, next) {
        settings.busClient.command.send (action, null, null);
        return res.prompt();
      });
    });
  }
};
