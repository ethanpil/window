/* Shared helpers for the browser tests: argument parsing, a tiny static
   server, a browser launcher that copes with machines without Playwright's
   own Chromium, and the "scene is up" wait. */
'use strict';
var fs = require('fs'), path = require('path'), http = require('http');

var ROOT = path.resolve(__dirname, '..');
var INDEX = path.join(ROOT, 'index.html');

/* ---- arguments ----
   Every value option is --name value or --name=value, with the env var
   WINDOW_NAME as its default; every flag is --name. Anything else (a typo, a
   missing value) prints the usage and exits 2, so a mistyped option can never
   quietly run the default. */
var cli = { values: {}, flags: {} };

function usage(msg, text) {
  if (msg) console.error(msg);
  console.error('usage: ' + (text || cli.usage));
  process.exit(2);
}

/* parse(usageText, ['seeds', ...value options], ['quick', ...flags]); --browser is always accepted */
function parse(usageText, valueNames, flagNames) {
  cli = { usage: usageText, values: {}, flags: {} };
  valueNames = (valueNames || []).concat('browser');
  flagNames = flagNames || [];
  var argv = process.argv.slice(2);
  for (var i = 0; i < argv.length; i++) {
    var m = /^--([a-z0-9-]+)(?:=([\s\S]*))?$/.exec(argv[i]);
    if (!m) usage('unexpected argument: ' + argv[i]);
    if (flagNames.indexOf(m[1]) >= 0) {
      if (m[2] != null) usage('--' + m[1] + ' takes no value');
      cli.flags[m[1]] = true;
    } else if (valueNames.indexOf(m[1]) >= 0) {
      var v = m[2];
      if (v == null) {
        v = argv[i + 1];
        if (v == null || /^--/.test(v)) usage('--' + m[1] + ' needs a value');
        i++;
      }
      if (v === '') usage('--' + m[1] + ' needs a value');
      cli.values[m[1]] = v;
    } else usage('unknown option: ' + argv[i]);
  }
}

/* the option's value: --name, else env WINDOW_NAME, else def */
function option(name, def) {
  if (cli.values[name] != null) return cli.values[name];
  var env = process.env['WINDOW_' + name.toUpperCase().replace(/-/g, '_')];
  return env != null && env !== '' ? env : def;
}

function flag(name) { return !!cli.flags[name]; }

/* a positive integer option, or the usage message */
function count(name, def) {
  var v = option(name, String(def));
  if (!/^[1-9]\d*$/.test(v)) usage('--' + name + ' must be a positive integer, got "' + v + '"');
  return +v;
}

/* a positive number option (milliseconds, ...), or the usage message */
function number(name, def) {
  var v = option(name, String(def));
  if (!/^(\d+\.?\d*|\.\d+)$/.test(v) || !(+v > 0)) usage('--' + name + ' must be a positive number, got "' + v + '"');
  return +v;
}

/* ---- what the page declares, read from the file under test ---- */

/* the top-level keys of  var NAME = { ... };  that the page's table declares */
function tableKeys(name, keep) {
  var lines = fs.readFileSync(INDEX, 'utf8').split('\n'), at = lines.indexOf('var ' + name + ' = {');
  if (at < 0) throw new Error('cannot find "var ' + name + ' = {" in index.html');
  var keys = [];
  for (var i = at + 1; i < lines.length && !/^\};/.test(lines[i]); i++) {
    var m = keep.exec(lines[i]);
    if (m) keys.push(m[1]);
  }
  if (!keys.length) throw new Error('no keys found in ' + name);
  return keys;
}

/* every biome the page can build, so a new one is tested without editing the tests */
function biomes() { return tableKeys('BIOMES', /^  ([a-z][a-z0-9]*): \{/); }

/* biomes that never get a winter season (a season lock of winter is re-picked there) */
function noWinter() {
  var line = /^var NO_WINTER = \{(.*)\};/m.exec(fs.readFileSync(INDEX, 'utf8'));
  if (!line) throw new Error('cannot find NO_WINTER in index.html');
  var out = [], re = /(\w+): *([1-9])/g, m;
  while ((m = re.exec(line[1]))) out.push(m[1]);
  return out;
}

/* ---- server ---- */

/* Serve one html file (default index.html) on 127.0.0.1. With expose, the
   served copy has `var App = {};` rewritten so tests can reach window.__App;
   transform(html) may rewrite the page further. Resolves to { port, url(query), close() }. */
function serve(opts) {
  opts = opts || {};
  var file = opts.file || INDEX;
  var html = fs.readFileSync(file, 'utf8');
  if (opts.expose) {
    if (html.indexOf('var App = {};') < 0) throw new Error('cannot expose App: "var App = {};" not found in ' + file);
    html = html.replace('var App = {};', 'var App = window.__App = {};');
  }
  if (opts.transform) html = opts.transform(html);
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

/* ---- browser ---- */

/* $WINDOW_BROWSER (an executable path) first if set, then Playwright's msedge
   and chrome channels, then its bundled chromium. extraArgs are added to the
   launch arguments (--disable-webgl2 for the WebGL1 run). */
async function launch(extraArgs) {
  var chromium = require('playwright-core').chromium;
  var args = (process.platform === 'win32'
    ? ['--use-angle=d3d11', '--ignore-gpu-blocklist']
    : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']).concat(extraArgs || []);
  var tries = [];
  var exe = option('browser');
  if (exe) tries.push({ executablePath: exe });
  tries.push({ channel: 'msedge' }, { channel: 'chrome' }, {});
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
  throw new Error('no usable browser (set WINDOW_BROWSER to an executable path):\n  ' + errors.join('\n  '));
}

/* the curtain lifts (class "gone") once the first scene is built */
function waitForScene(page, timeout) {
  return page.waitForFunction(function () {
    var c = document.getElementById('curtain');
    return !c || c.classList.contains('gone');
  }, null, { timeout: timeout || 30000 });
}

module.exports = {
  ROOT: ROOT, INDEX: INDEX, parse: parse, usage: usage, option: option, flag: flag, count: count, number: number,
  biomes: biomes, noWinter: noWinter, serve: serve, launch: launch, waitForScene: waitForScene
};
