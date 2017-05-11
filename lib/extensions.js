'use strict';

var moduleName = 'zog';

var xLog = require ('xcraft-core-log') (moduleName);

var shutdown = true;
var unregistered = false;
var busClient = null;
var alreayConnected = false;

var endPromise = null;

var commandRegister = function (extension, callback) {
  var cmdList = busClient.getCommandsRegistry ();

  Object.keys (cmdList)
    .sort ((cmdA, cmdB) => cmdA.localeCompare (cmdB))
    .forEach (function (cmd) {
      var options = cmdList[cmd].options || {};

      /* We consider that a command without description is only for internal
       * purposes.
       */
      if (!cmdList[cmd].desc) {
        return;
      }

      extension.command (cmd, cmdList[cmd].desc, options, function (
        callback,
        args
      ) {
        const which = busClient.getOrcName ();

        if (!busClient.isConnected ()) {
          xLog.warn ('Sorry but the GreatHall is lost ...');
          callback ();
        }

        let background = false;
        const lastArg = args[args.length - 1];
        if (typeof lastArg === 'object' && lastArg.op === '&') {
          args.pop ();
          background = true;
        }

        const ops = args.some (arg => {
          return typeof arg === 'object';
        });
        if (ops) {
          xLog.warn (
            `You can't use bash-like operators; excepted '&' as last argument`
          );
          callback ();
          return;
        }

        var params = {};
        var key = '';

        /* Prepare the arguments for the command sends to the server. */
        if (
          cmdList[cmd].hasOwnProperty ('options') &&
          cmdList[cmd].options.hasOwnProperty ('params')
        ) {
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

        const unsubscribeFinished = busClient.events.subscribe (
          `${which}::${cmdList[cmd].name}.finished`,
          function () {
            busClient.events.unsubscribeAll (
              `${which}::${cmdList[cmd].name}.added`
            );
            unsubscribeFinished ();

            /* Return to prompt. */
            if (!background) {
              callback ();
            }
          }
        );

        /* The added events are used when several wizards are chained. */
        busClient.events.subscribe (
          `${which}::${cmdList[cmd].name}.added`,
          function (msg) {
            /* Compile the wizard provided by Xcraft. */
            var vm = require ('vm');
            var sandbox = {
              wizard: {},
              busClient: busClient,
            };
            var context = new vm.createContext (sandbox);
            var script = new vm.Script ('wizard = ' + msg.data.wizardImpl, {
              filename: 'wizard.js',
              displayErrors: true,
            });
            script.runInContext (context);

            /* Retrieve the current values. */
            var i = 0;
            sandbox.wizard[msg.data.wizardName].forEach (function (input) {
              Object.keys (msg.data.wizardDefaults).some (function (name) {
                if (input.name === name) {
                  sandbox.wizard[msg.data.wizardName][i].default =
                    msg.data.wizardDefaults[name];
                  return true;
                }
                return false;
              });
              ++i;
            });

            /* Start the wizard. */
            callback (sandbox.wizard[msg.data.wizardName], function (answers) {
              msg.data.wizardAnswers.push (answers);

              /* Continue? */
              if (msg.data.nextCommand) {
                busClient.command.send (msg.data.nextCommand, msg.data);
              }
              return false;
            });
          }
        );

        /* Start the command on the server side. */
        busClient.command.send (cmdList[cmd].name, params);

        if (background) {
          callback ();
        }
      });
    });

  callback (null, cmdList);
};

let eventUnsubscribe = null;
var eventSubscriber = function (resolve, reject) {
  const which = busClient.getOrcName ();

  eventUnsubscribe = busClient.events.subscribe (
    `${which}::disconnect.finished`,
    function () {
      /* jshint ignore:line */
      if (shutdown) {
        busClient.command.send ('shutdown');
      }

      busClient.stop (function (err) {
        var xCraftMaterials = require ('xcraft-materials') (
          'tty',
          true,
          busClient
        );
        xCraftMaterials.Actions.displayGameOver ();
        if (err) {
          reject (err);
          return;
        }

        resolve ();
      });
    }
  );
};

var serverRegister = function (extension) {
  if (!process.env.hasOwnProperty ('XCRAFT_ATTACH')) {
    process.env.XCRAFT_ATTACH = '1';
  }

  if (!process.env.hasOwnProperty ('XCRAFT_LOGS')) {
    process.env.XCRAFT_LOGS = '0';
  }

  var attached = parseInt (process.env.XCRAFT_ATTACH) === 1;
  var logs = parseInt (process.env.XCRAFT_LOGS) === 1;

  if (parseInt (process.env.XCRAFT_LOGS) === 0) {
    /* Only errors */
    process.env.XCRAFT_LOG = '3';
  }

  const options = {
    detached: !attached,
    logs: logs,
    response: {
      log: xLog,
    },
  };

  var xServer = require ('xcraft-core-server').runAsDaemon (options);
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
      },
    },

    'server.exorcize': {
      desc: 'stop Xcraft server on exit (default with sHell mode)',
      handle: function (callback) {
        shutdown = true;
        callback ();
      },
    },
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
    endPromise.then (() => callback ()).catch (callback);
  } else {
    callback ();
  }
};

exports.register = function (extension, callback) {
  const path = require ('path');
  const xBusClient = require ('xcraft-core-busclient');

  let xHost = null;
  try {
    xHost = require ('xcraft-core-host');
    shutdown = false;
  } catch (ex) {
    serverRegister (extension);
    busClient = xBusClient.initGlobal ();
  }

  if (xHost) {
    const etcPath = path.join (xHost.appConfigPath, 'etc');
    const busConfig = require ('xcraft-core-etc') (etcPath).load (
      'xcraft-core-bus'
    );
    busClient = new xBusClient.BusClient (busConfig);
  }

  var xCraftMaterials = require ('xcraft-materials') ('tty', false);

  /* Start tty components */
  xCraftMaterials.XcraftLogo ();
  xCraftMaterials.GameOver ();

  xCraftMaterials.Activity ();
  xCraftMaterials.Motd ();
  xCraftMaterials.PackageList ();
  xCraftMaterials.Text ();
  xCraftMaterials.Progress ();

  xCraftMaterials.Actions.displayLogo ();

  let cmdList = {};

  busClient.connect (null, function (err) {
    if (alreayConnected) {
      return;
    }

    busClient.command.send ('motd');

    alreayConnected = true;

    if (err) {
      callback (err);
    }

    xCraftMaterials = require ('xcraft-materials') ('tty', true, busClient);

    const which = busClient.getOrcName ();
    endPromise = new Promise (eventSubscriber);

    commandRegister (extension, (err, cmds) => {
      cmdList = cmds;
      callback ();
    });

    busClient.on ('reconnect', () => {
      busClient.command.send ('motd');

      eventUnsubscribe (which);
      endPromise = new Promise (eventSubscriber);

      commandRegister (extension, (err, cmds) => {
        cmdList = cmds;
        extension.reload ();
      });
    });

    busClient.on ('commands.registry', () => {
      Object.keys (cmdList).forEach (cmd => {
        extension.remove (cmd);
      });

      commandRegister (extension, (err, cmds) => {
        cmdList = cmds;
        extension.reload ();
      });
    });
  });
};
