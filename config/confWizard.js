'use strict';

exports.chest = [{
  type: 'input',
  name: 'host',
  message: 'hostname or IP [client or server]:'
}, {
  type: 'input',
  name: 'port',
  message: 'listening port [client or server]:',
  validate: function (value) {
    return /^[0-9]{1,}$/.test (value);
  }
}, {
  type: 'input',
  name: 'pid',
  message: 'pid filename [server]:'
}, {
  type: 'input',
  name: 'log',
  message: 'log filename [server]:'
}, {
  type: 'input',
  name: 'repository',
  message: 'path to the repository [server]:'
}];

exports.bus = [{
  type: 'input',
  name: 'host',
  message: 'hostname or IP'
}, {
  type: 'input',
  name: 'commanderPort',
  message: 'commander port',
  validate: function (value) {
    return /^[0-9]{1,}$/.test (value);
  }
}, {
  type: 'input',
  name: 'notifierPort',
  message: 'notifier port',
  validate: function (value) {
    return /^[0-9]{1,}$/.test (value);
  }
}];
