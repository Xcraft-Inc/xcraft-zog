'use strict';

var moduleName = 'zog';

var xLog = require('xcraft-core-log')(moduleName);

var shutdown = true;
var unregistered = false;
var busClient = null;
var alreayConnected = false;

var endPromise = null;

var commandRegister = function(extension, callback) {
  var cmdList = busClient.getCommandsRegistry();

  Object.keys(cmdList)
    .sort((cmdA, cmdB) => cmdA.localeCompare(cmdB))
    .forEach(function(cmd) {
      var options = cmdList[cmd].options || {};

      /* We consider that a command without description is only for internal
       * purposes.
       */
      if (!cmdList[cmd].desc) {
        return;
      }

      extension.command(cmd, cmdList[cmd].desc, options, function(
        callback,
        args
      ) {
        const which = busClient.getOrcName();

        if (!busClient.isConnected()) {
          xLog.warn('Sorry but the GreatHall is lost ...');
          callback();
        }

        let background = false;
        const lastArg = args[args.length - 1];
        if (typeof lastArg === 'object' && lastArg.op === '&') {
          args.pop();
          background = true;
        }

        const ops = args.some(arg => {
          return typeof arg === 'object';
        });
        if (ops) {
          xLog.warn(
            `You can't use bash-like operators; excepted '&' as last argument`
          );
          callback();
          return;
        }

        var params = {};

        /* Prepare the arguments for the command sends to the server. */
        if (
          cmdList[cmd].hasOwnProperty('options') &&
          cmdList[cmd].options.hasOwnProperty('params')
        ) {
          if (cmdList[cmd].options.params.hasOwnProperty('required')) {
            let reqList = cmdList[cmd].options.params.required;
            if (!Array.isArray(reqList)) {
              reqList = [reqList];
            }
            reqList.forEach(req => {
              params[req] = args.shift();
            });
          }

          if (cmdList[cmd].options.params.hasOwnProperty('optional')) {
            let optList = cmdList[cmd].options.params.optional;
            if (!Array.isArray(optList)) {
              optList = [optList];
            }
            optList.forEach(opt => {
              const isArray = /[.]{3}$/.test(opt);
              if (isArray) {
                params[opt.replace(/[.]{3}$/, '')] = args;
              } else {
                params[opt] = args.shift();
              }
            });
          }
        }

        const message = busClient.command.newMessage(cmdList[cmd].name, which);

        const unsub = () => {
          busClient.events.unsubscribeAll(
            `${which}::${cmdList[cmd].name}.added`
          );
          unsubscribe();

          /* Return to prompt. */
          if (!background) {
            callback();
          }
        };

        const unsubscribe = busClient.events.subscribe(
          `${which}::${cmdList[cmd].name}.${message.id}.(finished|error)`,
          unsub
        );

        /* The added events are used when several wizards are chained. */
        busClient.events.subscribe(
          `${which}::${cmdList[cmd].name}.added`,
          function(msg) {
            /* Compile the wizard provided by Xcraft. */
            var vm = require('vm');
            var sandbox = {
              wizard: {},
              busClient: busClient,
            };
            var context = new vm.createContext(sandbox);
            var script = new vm.Script('wizard = ' + msg.data.wizardImpl, {
              filename: 'wizard.js',
              displayErrors: true,
            });
            script.runInContext(context);

            /* Retrieve the current values. */
            var i = 0;
            sandbox.wizard[msg.data.wizardName].forEach(function(input) {
              Object.keys(msg.data.wizardDefaults).some(function(name) {
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
            callback(sandbox.wizard[msg.data.wizardName], function(answers) {
              msg.data.wizardAnswers.push(answers);

              /* Continue? */
              if (msg.data.nextCommand) {
                busClient.command.send(msg.data.nextCommand, msg.data);
              }
              return false;
            });
          }
        );

        /* Start the command on the server side. */
        message.data = params;
        busClient.command.send(cmdList[cmd].name, message);

        if (background) {
          callback();
        }
      });
    });

  callback(null, cmdList);
};

let eventUnsubscribe = null;
var eventSubscriber = function(resolve, reject) {
  const which = busClient.getOrcName();

  eventUnsubscribe = busClient.events.subscribe(
    `${which}::disconnect.finished`,
    function() {
      /* jshint ignore:line */
      if (shutdown) {
        busClient.command.send('shutdown');
      }

      busClient.stop(function(err) {
        var xCraftMaterials = require('xcraft-materials')(
          'tty',
          true,
          busClient
        );
        xCraftMaterials.Actions.displayGameOver();
        if (err) {
          reject(err);
          return;
        }

        resolve();
      });
    }
  );
};

var serverRegister = function(extension) {
  if (!process.env.hasOwnProperty('XCRAFT_ATTACH')) {
    process.env.XCRAFT_ATTACH = '1';
  }

  if (!process.env.hasOwnProperty('XCRAFT_LOGS')) {
    process.env.XCRAFT_LOGS = '0';
  }

  var attached = parseInt(process.env.XCRAFT_ATTACH) === 1;
  var logs = parseInt(process.env.XCRAFT_LOGS) === 1;

  if (parseInt(process.env.XCRAFT_LOGS) === 0) {
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

  var xServer = require('xcraft-core-server').runAsDaemon(options);
  xServer.start();

  if (!xServer.isOurDaemon()) {
    shutdown = false;
  }

  if (attached) {
    return;
  }

  var cmdList = {
    'server.daemonize': {
      desc: 'use Xcraft server as a detached process',
      handle: function(callback) {
        shutdown = false;
        callback();
      },
    },

    'server.exorcize': {
      desc: 'stop Xcraft server on exit (default with sHell mode)',
      handle: function(callback) {
        shutdown = true;
        callback();
      },
    },
  };

  Object.keys(cmdList).forEach(function(cmd) {
    extension.command(cmd, cmdList[cmd].desc, {}, cmdList[cmd].handle);
  });
};

exports.unregister = function(callback) {
  if (unregistered) {
    callback();
    return;
  }

  unregistered = true;

  if (busClient.isConnected()) {
    busClient.command.send('disconnect');
  }

  if (endPromise) {
    endPromise.then(() => callback()).catch(callback);
  } else {
    callback();
  }
};

exports.register = function(extension, callback) {
  let xHost = null;
  try {
    xHost = require('xcraft-core-host');
    process.env.XCRAFT_ROOT = xHost.appConfigPath;
    shutdown = false;
  } catch (ex) {
    /* ... */
  }

  if (!xHost) {
    const path = require('path');
    const dirArray = __dirname.split(path.sep);
    const pos = dirArray.indexOf('toolchain'); /* FIXME: remove this hack */
    process.env.XCRAFT_ROOT = path.resolve(
      __dirname,
      dirArray.slice(0, pos + 1).join(path.sep)
    );
  }

  const xBusClient = require('xcraft-core-busclient');

  if (!xHost) {
    serverRegister(extension);
    busClient = xBusClient.initGlobal();
  }

  if (xHost) {
    const busConfig = require('xcraft-core-etc')().load('xcraft-core-bus');
    busClient = new xBusClient.BusClient(busConfig);
  }

  var xCraftMaterials = require('xcraft-materials')('tty', false);

  /* Start tty components */
  xCraftMaterials.XcraftLogo();
  xCraftMaterials.GameOver();

  xCraftMaterials.Activity();
  xCraftMaterials.Motd();
  xCraftMaterials.PackageList();
  xCraftMaterials.Text();
  xCraftMaterials.Progress();

  xCraftMaterials.Actions.displayLogo();

  let cmdList = {};

  busClient.connect(
    'axon',
    null,
    function(err) {
      if (alreayConnected) {
        return;
      }

      busClient.command.send('motd');
      busClient.command.send('buslog.enable');

      alreayConnected = true;

      if (err) {
        callback(err);
      }

      xCraftMaterials = require('xcraft-materials')('tty', true, busClient);

      const which = busClient.getOrcName();
      endPromise = new Promise(eventSubscriber);

      commandRegister(extension, (err, cmds) => {
        cmdList = cmds;
        callback();
      });

      busClient.on('reconnect', () => {
        busClient.command.send('motd');

        eventUnsubscribe(which);
        endPromise = new Promise(eventSubscriber);

        commandRegister(extension, (err, cmds) => {
          cmdList = cmds;
          extension.reload();
        });
      });

      busClient.on('commands.registry', () => {
        Object.keys(cmdList).forEach(cmd => {
          extension.remove(cmd);
        });

        commandRegister(extension, (err, cmds) => {
          cmdList = cmds;
          extension.reload();
        });
      });
    }
  );
};
