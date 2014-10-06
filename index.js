'use strict';

var shell = require('shell');
var app = new shell({
            chdir: __dirname,
            prompt: '★>'
          });
/* Middleware registration */
app.configure(function () {
  app.use(shell.history({
    shell: app
  }));
  app.use(shell.completer({
    shell: app
  }));
  app.use(require('xcraft-core-bin')({
    shell: app
  }));
  app.use(require('xcraft-core-busclient').shellExt({
    shell: app
  }));
  app.use(shell.router({
    shell: app
  }));
  app.use(shell.help({
    shell: app,
    introduction: true
  }));
});

// Event notification
app.on('quit', function () {
});
