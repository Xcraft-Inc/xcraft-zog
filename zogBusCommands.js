'use strict';
/* xcraft-zog busclient shell extensions */

exports.load = function (settings) {
  if (settings.shell !== undefined && settings.busClient !== undefined) {

    var registry = settings.busClient.getCommandsRegistry ();

    Object.keys (registry).forEach (function (action) {
      var cmdAndParams = action;
      if (registry[action].params) {
        cmdAndParams += ' ' + registry[action].params;
      }

      settings.shell.cmd (cmdAndParams, registry[action].desc, function (req, res, next) {
        settings.busClient.command.send (action, req.params, function () {
          res.prompt();
        });
      });
    });
  }
};
