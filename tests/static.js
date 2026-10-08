/* Static checks: index.html is what src/ builds, its script parses, and
   ESLint finds no real bugs in it (undefined names, duplicate keys, ...). */
'use strict';
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');
var ESLint = require('eslint').ESLint;
var lib = require('./lib');

var failed = false;
function step(name, ok, detail) {
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (detail ? ' - ' + detail : ''));
  if (!ok) failed = true;
}

(async function () {
  /* 1. the shipped page is current */
  var b = cp.spawnSync(process.execPath, [path.join(lib.ROOT, 'build.js'), '--check'], { encoding: 'utf8' });
  step('build --check', b.status === 0, (b.stdout + b.stderr).trim());

  /* 2. the inline app script is the last plain <script> in the page */
  var html = fs.readFileSync(lib.INDEX, 'utf8');
  var scripts = Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g));
  if (!scripts.length) { step('extract app script', false, 'no inline <script> in index.html'); process.exit(1); }
  var code = scripts[scripts.length - 1][1];

  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'window-app-'));
  var file = path.join(dir, 'app.js');
  fs.writeFileSync(file, code);
  var s = cp.spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
  fs.rmSync(dir, { recursive: true, force: true });
  step('node --check app script', s.status === 0, s.status === 0 ? '' : s.stderr.trim());

  /* 3. lint */
  var eslint = new ESLint({ useEslintrc: false, overrideConfigFile: path.join(__dirname, 'eslint.json') });
  var res = (await eslint.lintText(code, { filePath: 'index.html.app.js' }))[0];
  /* eslint-known.json lists findings already in the code (rule: message -> count).
     They are reported but do not fail; anything beyond them does. */
  var known = JSON.parse(fs.readFileSync(path.join(__dirname, 'eslint-known.json'), 'utf8'));
  var errors = [], baselined = 0;
  res.messages.filter(function (m) { return m.severity === 2; }).forEach(function (m) {
    var key = m.ruleId + ': ' + m.message;
    if (known[key] > 0) { known[key]--; baselined++; } else errors.push(m);
  });
  var warns = res.messages.length - errors.length - baselined;
  step('eslint', errors.length === 0, errors.length + ' new errors, ' + baselined + ' known (eslint-known.json), ' + warns + ' warnings');
  errors.slice(0, 20).forEach(function (m) { console.log('   app:' + m.line + ':' + m.column + ' ' + m.ruleId + ' ' + m.message); });

  process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
