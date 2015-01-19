'use strict';

var clc = require ('cli-color');

var xServer = require ('xcraft-core-server');
xServer.fork (null, function (line) {
  console.log ('[' + clc.magentaBright ('server') + ':' + clc.whiteBright.bold (process.pid) + ']: ' + line);
}, function (line) {
  console.log ('[' + clc.magentaBright ('server') + ':' + clc.whiteBright.bold (process.pid) + ']: ' + line);
});

var busClient = require ('xcraft-core-busclient');

var commandRegister = function (extension, callback) {
  var cmdList = busClient.getCommandsRegistry ();

  /* FIXME: it's a hack, it should be done with three commands
   *        start, stop and restart.
   */
  extension.command ('daemon', 'launch zog as service', {}, function () {});

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
        callback ();
      });

      busClient.events.subscribe (cmdList[cmd].name + '.added', function (msg) {
        var wizard = require (msg.data.wizardPath);

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

        callback (wizard[msg.data.wizardName], function (answers) {
          msg.data.wizardAnswers.push (answers);
          if (msg.data.nextCommand) {
            busClient.command.send (msg.data.nextCommand, msg.data);
          }
          return false;
        });
      });

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

  busClient.events.subscribe ('pacman.list', function (msg) {
    var util = require ('util');

    var list = msg.data;
    var header = util.format ('name%s version%s architectures',
                              new Array (40 - 'name'.length).join (' '),
                              new Array (15 - 'version'.length).join (' '));
    console.log (header);
    console.log (new Array (header.length + 1).join ('-'));

    list.forEach (function (def) {
      var version = def.version.toString ();
      if (def.version.toString ().length > 14) {
        version = version.substr (0, 11) + '...';
      }

      console.log ('%s%s %s%s',
                   def.name,
                   new Array (40 - def.name.length).join (' '),
                   version,
                   new Array (15 - version.length).join (' '),
                   def.architecture.join (', '));
    });
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