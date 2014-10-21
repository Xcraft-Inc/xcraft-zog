'use strict';

var inquirer = require ('inquirer');
var program  = require ('commander');
var async    = require ('async');
var xLog     = require ('xcraft-core-log') ('zog');
xLog.verbosity (0); /* FIXME: make a builtin command */

/* TODO: we must use commander in order to handle the non-shell side of
 *       zogShell.
 */

var shellCommands = function (cmdList, busClient) {
  /* Builtin shell commands */
  var list = {
    help: {
      params  : null,
      desc    : 'list of commands',
      handler : null
    },
    exit: {
      params  : null,
      desc    : 'exit zogShell',
      handler : null
    }
  };

  Object.keys (cmdList).forEach (function (cmd) {
    list[cmd] = {
      params  : cmdList[cmd].params,
      desc    : cmdList[cmd].desc,
      handler : function () {
        /* TODO: data and finishHandler */
        busClient.command.send (cmdList[cmd].name, null, null);
      }
    };
  });

  return list;
};

var shellStart = function (busClient) {
  var shell = [{
    type    : 'input',
    name    : 'command',
    message : 'z0g>'
  }];

  var cmdList = busClient.getCommandsRegistry ();
  var shellCmdList = shellCommands (cmdList, busClient);

  shellCmdList.help.handler = function () {
    Object.keys (shellCmdList).forEach (function (cmd) {
      /* TODO: show desc and params */
      console.log (cmd);
    });
  };

  var exitShell = false;
  shellCmdList.exit.handler = function () {
    exitShell = true;
  };

  async.forever (function (next) {
    inquirer.prompt (shell, function (answers) {
      try {
        shellCmdList[answers.command].handler ();
      } catch (ex) {
        if (answers.command.length) {
          console.log ('command ' + answers.command + ' unknown');
        }
      }
      next (exitShell ? 'good bye' : null);
    });
  }, function (err) {
    if (err) {
      xLog.info (err);
    }

    busClient.command.send ('shutdown');
  });
};

var serverStart = function () {
  var xServer = require ('xcraft-core-server');
  xServer.fork (null, function (line) {
    console.log ('server: ' + line);
  }, function (line) {
    console.log ('server: ' + line);
  });

  var busClient = require ('xcraft-core-busclient');

  busClient.connect (null, function (err) {
    var mainShutdown = function () {
      busClient.stop (function (done) { /* jshint ignore:line */
        xLog.verb ('bus client stopped...');
      });
    };

    var shellExecute = function (command) {
      busClient.command.send (command);
      busClient.command.send ('shutdown');
    };

    busClient.events.subscribe ('disconnected', function (msg) {
      mainShutdown ();
    });

    program
      .version ('0.1.0')
      .option ('-v, --verbosity <level>', 'change the verbosity level [0..3] (default: 1)', xLog.verbosity)
      .option ('-n, --nocolor', 'disable the color output\n');

    var cmdList = busClient.getCommandsRegistry ();
    Object.keys (cmdList).forEach (function (cmd) {
      program.option (cmd, cmdList[cmd].desc, function () {
        shellExecute (cmd);
      });
    });

    program.on ('--help', function () {
      console.log ('  Informations:');
      console.log ('');
      console.log ('    Please be careful when using `zog clean` because the installed packages');
      console.log ('    are not removed properly. For example, if a MSI was installed by a package,');
      console.log ('    it will remains in the system. The reason is that only the devroot/ is');
      console.log ('    deleted regardless of wpkg.');
      console.log ('');
      console.log ('  Examples:');
      console.log ('');
      console.log ('    $ zog lokthar install');
      console.log ('    $ zog -n lokthar run');
      console.log ('    $ zog edit libfoobar');
      console.log ('    $ zog -v 0 make');
      console.log ('');
    });

    program.parse (process.argv);

    if (process.argv.length === 2) {
      shellStart (busClient);
    }
  });
};

serverStart ();
