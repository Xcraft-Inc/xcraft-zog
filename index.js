'use strict';

var inquirer = require("inquirer");
var async    = require ('async');

var shell = [{
  type: 'input',
  name: 'command',
  message: 'z0g> '
}];

async.forever (function (next) {
  inquirer.prompt (shell, function (answers) {
    //TODO:xxx
    next();
  });
},function (err) {

});
