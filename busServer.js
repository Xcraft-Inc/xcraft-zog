'use strict';

var zogBoot = require ('./zogBoot.js');
var zogLog  = require ('xcraft-core-log') ('bus-server');
zogLog.verbosity (0);


var server = function () {
  var commander = zogBoot.bus.getCommander();

  commander.registerShutdownHandler (function () {
    zogBoot.busClient.events.send ('disconnected');
    zogLog.verb ('shutdown...');
    zogBoot.stop ();
  });

  commander.registerAutoconnectHandler (function () {
    var registry  = commander.getCommandsRegistry ();
    var connectedMsg = {
      token       : zogBoot.busClient.getToken(),
      cmdRegistry : registry
    };

    zogBoot.busClient.events.send ('connected', connectedMsg);
  });
};

zogBoot.start (server);
