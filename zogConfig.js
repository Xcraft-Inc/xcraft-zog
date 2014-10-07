'use strict';

var moduleName = 'config';

var path       = require ('path');
var confWizard = require ('./config/confWizard.js');
var zogLog     = require ('xcraft-core-log') (moduleName);

//process.chdir (path.join (__dirname, '/..'));

module.exports = function () {
  var yaml     = require ('js-yaml');
  var fs       = require ('fs');
  var inquirer = require ('inquirer');

  var zogPlatform = require ('xcraft-core-platform');

  var userYaml    = './zog.yaml';
  var defaultYaml = './node_modules/xcraft-zog/zog.yaml';

  var data = '';
  var dataOrig = fs.readFileSync (defaultYaml, 'utf8');

  try {
    /* Try with the user config file if possible. */
    data = fs.readFileSync (userYaml, 'utf8');
  } catch (err) {
    /* Else, we use the default config file. */
    data = dataOrig;
  }

  var conf = yaml.safeLoad (data);
  var confOrig = yaml.safeLoad (dataOrig);

  var runWizard = function (wizName, callbackDone) {
    var alwaysSave = false;

    if (!conf.hasOwnProperty (wizName)) {
      conf[wizName] = {};
      alwaysSave = true;
    }

    confWizard[wizName].forEach (function (item) {
      if (!conf[wizName].hasOwnProperty (item.name)) {
        conf[wizName][item.name] = confOrig[wizName][item.name];
      }

      item.default = conf[wizName][item.name];
    });

    inquirer.prompt (confWizard[wizName], function (answers) {
      var hasChanged = false;

      zogLog.verb ('JSON output:\n' + JSON.stringify (answers, null, '  '));

      Object.keys (answers).forEach (function (item) {
        if (conf[wizName][item] !== answers[item]) {
          conf[wizName][item] = answers[item];
          hasChanged = true;
        }
      });

      if (alwaysSave || hasChanged) {
        data = yaml.safeDump (conf);
        fs.writeFileSync (userYaml, data);
      }

      if (callbackDone) {
        callbackDone ();
      }
    });
  };

  return {
    configure: function () {
      var async = require ('async');

      var wizards = [];
      Object.keys (confOrig).forEach (function (item) {
        wizards.push (item);
      });

      async.eachSeries (wizards, function (wiz, callback) {
        zogLog.info ('configure zog (%s)', wiz);
        runWizard (wiz, callback);
      });
    },

    architectures: [
      'mswindows-i386',
      'mswindows-amd64',
      'linux-i386',
      'linux-amd64',
      'darwin-i386',
      'darwin-amd64',
      'solaris-i386',
      'solaris-amd64',
      'freebsd-i386',
      'freebsd-amd64'
    ],

    bus  : conf.bus,
    chest: conf.chest,

    /* FIXME: must have a better handling. */
    pkgCfgFileName   : 'config.yaml',
    pkgScript        : 'script' + zogPlatform.getShellExt (),
    pkgPostinst      : 'postinst' + zogPlatform.getShellExt (),
    pkgPrerm         : 'prerm' + zogPlatform.getShellExt (),
    pkgWPKG          : 'WPKG',
    pkgRepository    : 'toolchain/',
    pkgIndex         : 'index.tar.gz',

    /* Path helpers. */
    toolchainRoot    : path.resolve ('./'),
    scriptsRoot      : path.resolve ('./scripts/'),
    libPkgRoot       : path.resolve ('./node_modules/xcraft-contrib-pacman/manager/'),
    zogRc            : path.resolve ('./.zogrc'),
    npmRc            : path.resolve ('./.npmrc'),
    zogBoot          : path.resolve ('./scripts/zogBoot.js'),
    loktharRoot      : path.resolve ('./lokthar/'),
    nodeModulesRoot  : path.resolve ('./node_modules/'),
    tempRoot         : path.resolve ('./var/tmp/'),
    pkgTempRoot      : path.resolve ('./var/tmp/wpkg/'),
    pkgDebRoot       : path.resolve ('./var/wpkg/'),
    pkgBaseRoot      : path.resolve ('./packages/base/'),
    pkgProductsRoot  : path.resolve ('./packages/products/'),
    pkgTemplatesRoot : path.resolve ('./templates/wpkg/'),
    pkgTargetRoot    : path.resolve ('./var/devroot/'),
    busBoot          : path.resolve ('./scripts/bus/busBoot.js'),
    confWizard       : path.resolve ('./scripts/config/confWizard.js'),
    confDefaultFile  : path.resolve ('./scripts/zog.yaml'),
    confUserFile     : path.resolve ('./zog.yaml'),
    nodeModules      : path.resolve ('./node_modules/'),

    /* Lib helpers. */
    libPkgCreate     : path.resolve ('./node_modules/xcraft-contrib-pacman/manager/pkgCreate.js'),
    libPkgDefinition : path.resolve ('./node_modules/xcraft-contrib-pacman/manager/pkgDefinition.js'),
    libPkgList       : path.resolve ('./node_modules/xcraft-contrib-pacman/manager/pkgList.js'),
    libPkgWizard     : path.resolve ('./node_modules/xcraft-contrib-pacman/manager/pkgWizard.js'),
    libPkgControl    : path.resolve ('./node_modules/xcraft-contrib-pacman/manager/pkgControl.js'),
    libPkgChangelog  : path.resolve ('./node_modules/xcraft-contrib-pacman/manager/pkgChangelog.js'),
    libPkgMake       : path.resolve ('./node_modules/xcraft-contrib-pacman/manager/pkgMake.js'),
    libPkgCmd        : path.resolve ('./node_modules/xcraft-contrib-pacman/manager/pkgCmd.js'),

    /* Bin helpers. */
    binGrunt         : path.join ('./node_modules/', 'grunt-cli/bin/grunt')
  };
};
