/* Shared helpers for the browser tests: a tiny static server, a browser
   launcher that copes with machines without Playwright's own Chromium, and
   the "scene is up" wait. */
'use strict';
var fs = require('fs'), path = require('path'), http = require('http');

var ROOT = path.resolve(__dirname, '..');
var INDEX = path.join(ROOT, 'index.html');

/* --name value, --name=value, or env NAME; falls back to def */
function option(name, def) {
  var argv = process.argv.slice(2), env = process.env[name.toUpperCase()];
  for (var i = 0; i < argv.length; i++) {
    if (argv[i] === '--' + name) return argv[i + 1];
    if (argv[i].indexOf('--' + name + '=') === 0) return argv[i].slice(name.length + 3);
  }
  return env != null && env !== '' ? env : def;
}

/* Serve one html file (default index.html) on 127.0.0.1. With expose, the
   served copy has `var App = {};` rewritten so tests can reach window.__App.
   Resolves to { port, url(query), close() }. */
function serve(opts) {
  opts = opts || {};
  var file = opts.file || INDEX;
  var html = fs.readFileSync(file, 'utf8');
  if (opts.expose) {
    if (html.indexOf('var App = {};') < 0) throw new Error('cannot expose App: "var App = {};" not found in ' + file);
    html = html.replace('var App = {};', 'var App = window.__App = {};');
  }
  var srv = http.createServer(function (req, res) {
    var p = req.url.split('?')[0];
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); }
    else if (p === '/favicon.ico') { res.writeHead(204); res.end(); }
    else { res.writeHead(404); res.end(); }
  });
  return new Promise(function (resolve) {
    srv.listen(0, '127.0.0.1', function () {
      var port = srv.address().port;
      resolve({
        port: port,
        url: function (query) { return 'http://127.0.0.1:' + port + '/' + (query || ''); },
        close: function () { srv.close(); }
      });
    });
  });
}

/* $BROWSER (an executable path), else Playwright's msedge then chrome
   channels, else its bundled chromium. */
async function launch() {
  var chromium = require('playwright-core').chromium;
  var args = process.platform === 'win32'
    ? ['--use-angle=d3d11', '--ignore-gpu-blocklist']
    : ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'];
  var tries = [];
  if (process.env.BROWSER) tries.push({ executablePath: process.env.BROWSER });
  else tries.push({ channel: 'msedge' }, { channel: 'chrome' }, {});
  var errors = [];
  for (var i = 0; i < tries.length; i++) {
    try {
      var browser = await chromium.launch(Object.assign({ headless: true, args: args }, tries[i]));
      console.log('browser: ' + (tries[i].executablePath || tries[i].channel || 'bundled chromium') + ' ' + browser.version());
      return browser;
    } catch (e) {
      errors.push((tries[i].executablePath || tries[i].channel || 'bundled chromium') + ': ' + e.message.split('\n')[0]);
    }
  }
  throw new Error('no usable browser (set BROWSER to an executable path):\n  ' + errors.join('\n  '));
}

/* the curtain lifts (class "gone") once the first scene is built */
function waitForScene(page, timeout) {
  return page.waitForFunction(function () {
    var c = document.getElementById('curtain');
    return !c || c.classList.contains('gone');
  }, null, { timeout: timeout || 30000 });
}

module.exports = { ROOT: ROOT, INDEX: INDEX, option: option, serve: serve, launch: launch, waitForScene: waitForScene };
