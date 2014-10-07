'use strict';

var moduleName = 'zog-boot';

var zogConfig  = require ('./zogConfig.js') ();
var busBoot    = require ('xcraft-core-bus');
var busClient  = require ('xcraft-core-busclient');
var zogLog     = require ('xcraft-core-log') (moduleName);


var bootEnv = function () {
  var path = require ('path');
  var fs   = require ('fs');

  var zogPlatform = require ('xcraft-core-platform');

  var list = process.env.PATH.split (path.delimiter);

  /* With Windows, we must find cmd.exe or the exec() function fails.
   * It should not be necessary on Unix because it is always related to
   * /bin/sh which is absolute.
   */
  if (zogPlatform.getOs () === 'win') {
    var systemDir = path.dirname (process.env.COMSPEC).replace (/\\/g, '\\\\');

    if (systemDir.length) {
      var regex = new RegExp ('^' + systemDir, 'i');

      list = list.filter (function (location) {
        return regex.test (location);
      });
    }
  }

  var zogrc = {};
  try {
    zogrc = JSON.parse (fs.readFileSync (zogConfig.zogRc, 'utf8'));
    if (zogrc.hasOwnProperty ('path')) {
      zogrc.path.reverse ().forEach (function (location) {
        list.unshift (location);
      });
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
  }

  list.unshift (path.resolve ('./usr/bin'));
  list.unshift (path.join (zogConfig.pkgTargetRoot, 'usr/bin'));
  list.unshift (path.join (zogConfig.pkgTargetRoot, 'bin'));

  process.env.PATH = list.join (path.delimiter);
  zogLog.verb ('zog env ready');
};

busBoot.getEmitter.on ('stop', function () {
  zogLog.verb ('Bus stop event received');
});

exports.start = function (callbackDone) {
  var path = require ('path');
  bootEnv ();

  busBoot.getEmitter.on ('ready', function () {
    busClient.configure (zogConfig);
    busClient.connect (busBoot.getToken (), callbackDone);
  });

  var commandHandlers = [];
  commandHandlers.push ({
    path: zogConfig.scriptsRoot,
    pattern: /zog.+\.js$/
  });


  commandHandlers.push ({
    path: path.join (zogConfig.nodeModules, '/xcraft-contrib-pacman/'),
    pattern: /zogManager\.js$/
  });

  commandHandlers.push ({
    path: zogConfig.libPkgRoot,
    pattern: /pkg.+\.js$/
  });

  commandHandlers.push ({
    path: path.join (zogConfig.nodeModules, '/xcraft-contrib-chest/'),
    pattern: /zogChest\.js$/
  });

  busBoot.boot (zogConfig.bus, commandHandlers);
};

exports.stop = function () {
  busBoot.stop ();
};
