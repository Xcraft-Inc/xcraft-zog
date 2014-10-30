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
