'use strict';

var clc = require ('cli-color');

var xServer = require ('xcraft-core-server');
xServer.fork (null, function (line) {
  console.log ('[' + clc.magentaBright ('server') + ':' + clc.whiteBright.bold (process.pid) + ']: ' + line);
}, function (line) {
  console.log ('[' + clc.magentaBright ('server') + ':' + clc.whiteBright.bold (process.pid) + ']: ' + line);
});

var busClient       = require ('xcraft-core-busclient');
var xCraftMaterials = require ('xcraft-materials') ('tty', busClient);

/* Start tty components*/
xCraftMaterials.XcraftLogo ();
xCraftMaterials.ActivityList ();
xCraftMaterials.PackageList ();

var commandRegister = function (extension, callback) {
  var cmdList = busClient.getCommandsRegistry ();

  Object.keys (cmdList).forEach (function (cmd) {
    var options = cmdList[cmd].options || {};

    /* We consider that a command without description is only for internal
     * purposes.
     */
    if (!cmdList[cmd].desc) {
      return;
    }

    extension.command (cmd, cmdList[cmd].desc, options, function (callback, args) {
      var params = {};
      var key = '';

      /* Prepare the arguments for the command sends to the server. */
      if (cmdList[cmd].hasOwnProperty ('options') &&
          cmdList[cmd].options.hasOwnProperty ('params')) {
        if (cmdList[cmd].options.params.hasOwnProperty ('required')) {
          key = cmdList[cmd].options.params.required.replace (/[.]{3}$/, '');
          params[key] = args.shift ();
        }

        if (cmdList[cmd].options.params.hasOwnProperty ('optional')) {
          var isArray = /[.]{3}$/.test (cmdList[cmd].options.params.optional);
          key = cmdList[cmd].options.params.optional.replace (/[.]{3}$/, '');
          params[key] = isArray ? args : args[0];
        }
      }

      busClient.events.subscribe (cmdList[cmd].name + '.finished', function () {
        busClient.events.unsubscribe (cmdList[cmd].name + '.added');
        busClient.events.unsubscribe (cmdList[cmd].name + '.finished');

        /* Return to prompt. */
        callback ();
      });

      /* The added events are used when several wizards are chained. */
      busClient.events.subscribe (cmdList[cmd].name + '.added', function (msg) {
        var wizard = require (msg.data.wizardPath);

        /* Retrieve the current values. */
        var i = 0;
        wizard[msg.data.wizardName].forEach (function (input) {
          Object.keys (msg.data.wizardDefaults).some (function (name) {
            if (input.name === name) {
              wizard[msg.data.wizardName][i].default = msg.data.wizardDefaults[name];
              return true;
            }
            return false;
          });
          ++i;
        });

        /* Start the wizard. */
        callback (wizard[msg.data.wizardName], function (answers) {
          msg.data.wizardAnswers.push (answers);

          /* Continue? */
          if (msg.data.nextCommand) {
            busClient.command.send (msg.data.nextCommand, msg.data);
          }
          return false;
        });
      });

      /* Start the command on the server side. */
      busClient.command.send (cmdList[cmd].name, params);
    });
  });

  callback ();
};

var eventSubscriber = function (callback) {
  var mainShutdown = function () {
    busClient.stop (function (err) {
      if (err) {
        console.error (err);
      }
    });
  };

  busClient.events.subscribe ('disconnected', function (msg) { /* jshint ignore:line */
    mainShutdown ();
  });

  callback ();
};

exports.unregister = function (callback) {
  busClient.command.send ('shutdown');
  callback ();
};

exports.register = function (extension, callback) {
  busClient.connect (null, function (err) {
    if (err) {
      callback (err);
    }
    xCraftMaterials.Actions.displayLogo ();
    var processExit = process.exit;
    process.exit = function (code) {
      exports.unregister (function () {
        processExit (code);
      });
    };

    eventSubscriber (function (err) {
      if (err) {
        callback (err);
        return;
      }

      commandRegister (extension, callback);
    });
  });
};
