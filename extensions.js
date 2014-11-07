'use strict';

var xServer = require ('xcraft-core-server');
xServer.fork (null, function (line) {
  console.log ('server ' + process.pid + ': ' + line);
}, function (line) {
  console.log ('server ' + process.pid + ': ' + line);
});

var busClient = require ('xcraft-core-busclient');

exports.register = function (callback) {
  busClient.connect (null, function (err) {
    var commands = [];

    var mainShutdown = function () {
      busClient.stop (function (done) { /* jshint ignore:line */
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
        console.log ('%s%s %s%s',
                     def.name,
                     new Array (40 - def.name.length).join (' '),
                     def.version,
                     new Array (15 - def.version.toString ().length).join (' '),
                     def.architecture.join (', '));
      });
    });

    var cmdList = busClient.getCommandsRegistry ();
    Object.keys (cmdList).forEach (function (cmd) {
      var options = cmdList[cmd].options || {};
      options.params = cmdList[cmd].params;

      commands.push ({
        name    : cmd,
        desc    : cmdList[cmd].desc,
        options : options,
        handler : function (callback, args) {
          var params = {};

          if (cmdList[cmd].params) {
            params[cmdList[cmd].params] = args[0];
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
        }
      });
    });

    callback (commands);
  });
};

exports.unregister = function () {
  busClient.command.send ('shutdown');
};
