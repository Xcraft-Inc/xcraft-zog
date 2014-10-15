'use strict';

var moduleName = 'zog-boot';

var busBoot    = require ('xcraft-core-bus');
var busClient  = require ('xcraft-core-busclient');
var zogLog     = require ('xcraft-core-log') (moduleName);
var xcraftConfig = require ('xcraft-core-etc').load ('xcraft');

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
    zogrc = JSON.parse (fs.readFileSync (xcraftConfig.zogRc, 'utf8'));
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
  list.unshift (path.join (xcraftConfig.pkgTargetRoot, 'usr/bin'));
  list.unshift (path.join (xcraftConfig.pkgTargetRoot, 'bin'));

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
    busClient.connect (busBoot.getToken (), callbackDone);
  });

  var commandHandlers = [];
  commandHandlers.push ({
    path: xcraftConfig.scriptsRoot,
    pattern: /zog.+\.js$/
  });

  var xFs = require ('xcraft-core-fs');
  xFs.ls (xcraftConfig.nodeModules, /^xcraft-(core|contrib).*/).forEach (function (item) {
    commandHandlers.push ({
      path: path.join (path.join (xcraftConfig.nodeModules, item)),
      pattern: /.*\.js$/
    });
  });

  busBoot.boot (commandHandlers);
};

exports.stop = function () {
  busBoot.stop ();
};
