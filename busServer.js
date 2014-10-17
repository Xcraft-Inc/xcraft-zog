'use strict';

var zogBoot = require ('./zogBoot.js');
var zogLog  = require ('xcraft-core-log') ('bus-server');
zogLog.verbosity (0);


var server = function () {
  /* TODO: Subscribe to the shutdown event, then call mainShutdown. */
  var mainShutdown = function () {
    zogLog.verb ('shutdown...');
    zogBoot.stop ();
  };

  zogBoot.bus.getCommander().registerAutoconnectHandler (function () {
    var commander = require ('xcraft-core-bus').getCommander ();
    var registry  = commander.getCommandsRegistry ();
    var connectedMsg = {
      token       : zogBoot.busClient.getToken(),
      cmdRegistry : registry
    };

    zogBoot.busClient.events.send ('connected', connectedMsg);
  });
};

zogBoot.start (server);
