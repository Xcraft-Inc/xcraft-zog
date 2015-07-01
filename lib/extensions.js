'use strict';

var moduleName = 'zog';

var clone = require ('clone');

var xLog = require ('xcraft-core-log') (moduleName);


var shutdown  = true;
var unregistered = false;
var busClient = null;
var alreayConnected = false;

var endPromise = null;

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
      if (!busClient.isConnected ()) {
        xLog.warn ('Sorry but the GreatHall is lost ...');
        callback ();
      }

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
        var wizard = clone (require (msg.data.wizardPath), false);

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

var eventSubscriber = function (resolve, reject) {
  busClient.events.subscribe ('disconnect.finished', function (msg) { /* jshint ignore:line */
    if (shutdown) {
      busClient.command.send ('shutdown');
    }

    busClient.stop (function (err) {
      var xCraftMaterials = require ('xcraft-materials') ('tty', busClient);
      xCraftMaterials.Actions.displayGameOver ();
      if (err) {
        reject (err);
        return;
      }

      resolve ();
    });
  });
};

var serverRegister = function (extension) {
  if (!process.env.hasOwnProperty ('XCRAFT_ATTACH')) {
    process.env.XCRAFT_ATTACH = '1';
  }

  if (!process.env.hasOwnProperty ('XCRAFT_LOGS')) {
    process.env.XCRAFT_LOGS = '0';
  }

  var attached = parseInt (process.env.XCRAFT_ATTACH) === 1;
  var logs     = parseInt (process.env.XCRAFT_LOGS) === 1;

  var xServer = require ('xcraft-core-server') (!attached, logs);
  xServer.start ();

  if (!xServer.isOurDaemon ()) {
    shutdown = false;
  }

  if (attached) {
    return;
  }

  var cmdList = {
    'server.daemonize': {
      desc: 'use Xcraft server as a detached process',
      handle: function (callback) {
        shutdown = false;
        callback ();
      }
    },

    'server.exorcize': {
      desc: 'stop Xcraft server on exit (default with sHell mode)',
      handle: function (callback) {
        shutdown = true;
        callback ();
      }
    }
  };

  Object.keys (cmdList).forEach (function (cmd) {
    extension.command (cmd, cmdList[cmd].desc, {}, cmdList[cmd].handle);
  });
};

exports.unregister = function (callback) {
  if (unregistered) {
    callback ();
    return;
  }

  unregistered = true;

  if (busClient.isConnected ()) {
    busClient.command.send ('disconnect');
  }

  if (endPromise) {
    endPromise.then (callback);
  } else {
    callback ();
  }
};

exports.register = function (extension, callback) {
  serverRegister (extension);

  busClient = require ('xcraft-core-busclient').initGlobal ();
  var xCraftMaterials = require ('xcraft-materials') ('tty', busClient);

  /* Start tty components */
  xCraftMaterials.XcraftLogo ();
  xCraftMaterials.GameOver ();

  /* xCraftMaterials.ActivityList (); */
  xCraftMaterials.Motd ();
  xCraftMaterials.PackageList ();
  xCraftMaterials.Text ();
  xCraftMaterials.Progress ();

  xCraftMaterials.Actions.displayLogo ();

  busClient.connect (null, function (err) {
    if (alreayConnected) {
      return;
    }

    busClient.command.send ('motd');

    alreayConnected = true;

    if (err) {
      callback (err);
    }

    endPromise = new Promise (eventSubscriber);
    commandRegister (extension, callback);
  });
};
