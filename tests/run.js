/* Runs the checks in order and prints a summary.
     node run.js [--quick]            static, then the browser tests
     node run.js static               build check, syntax, lint
     node run.js browser [--quick]    scenes, reshuffle, determinism, shaders (needs a GPU or SwiftShader)
   --quick is passed to scenes.js and shaders.js (one seed / two lock sets); no other
   argument is forwarded - run a script directly for its other options. */
'use strict';
var cp = require('child_process'), path = require('path');

var GROUPS = {
  static: ['static.js'],
  browser: ['scenes.js', 'reshuffle.js', 'determinism.js', 'shaders.js']
};
var QUICK = ['scenes.js', 'shaders.js'];
var args = process.argv.slice(2), quick = args.indexOf('--quick') >= 0;
args = args.filter(function (a) { return a !== '--quick'; });
var which = args[0];
if (args.length > 1 || (which && !GROUPS[which]) || (quick && which === 'static')) {
  console.error('usage: node run.js [static|browser] [--quick]'); process.exit(2);
}
var scripts = which ? GROUPS[which] : GROUPS.static.concat(GROUPS.browser);

var results = [];
for (var i = 0; i < scripts.length; i++) {
  console.log('\n=== ' + scripts[i] + ' ===');
  var t0 = Date.now();
  var extra = quick && QUICK.indexOf(scripts[i]) >= 0 ? ['--quick'] : [];
  var r = cp.spawnSync(process.execPath, [path.join(__dirname, scripts[i])].concat(extra), { stdio: 'inherit' });
  if (r.error || r.signal) console.log('could not run ' + scripts[i] + ': ' + (r.error ? r.error.message : 'killed by ' + r.signal));
  results.push({ name: scripts[i], ok: r.status === 0, secs: Math.round((Date.now() - t0) / 1000) });
}

console.log('\n=== summary ===');
results.forEach(function (r) { console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + ' (' + r.secs + 's)'); });
process.exit(results.every(function (r) { return r.ok; }) ? 0 : 1);
