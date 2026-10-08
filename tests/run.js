/* Runs the checks in order and prints a summary.
     node run.js            static, then the browser tests
     node run.js static     build check, syntax, lint
     node run.js browser    scenes, reshuffle, determinism (needs a GPU or SwiftShader)
   Extra arguments after the group name are not forwarded; run a script directly for those. */
'use strict';
var cp = require('child_process'), path = require('path');

var GROUPS = {
  static: ['static.js'],
  browser: ['scenes.js', 'reshuffle.js', 'determinism.js']
};
var which = process.argv[2];
if (which && !GROUPS[which]) { console.error('usage: node run.js [static|browser]'); process.exit(2); }
var scripts = which ? GROUPS[which] : GROUPS.static.concat(GROUPS.browser);

var results = [];
for (var i = 0; i < scripts.length; i++) {
  console.log('\n=== ' + scripts[i] + ' ===');
  var t0 = Date.now();
  var r = cp.spawnSync(process.execPath, [path.join(__dirname, scripts[i])], { stdio: 'inherit' });
  if (r.error || r.signal) console.log('could not run ' + scripts[i] + ': ' + (r.error ? r.error.message : 'killed by ' + r.signal));
  results.push({ name: scripts[i], ok: r.status === 0, secs: Math.round((Date.now() - t0) / 1000) });
}

console.log('\n=== summary ===');
results.forEach(function (r) { console.log((r.ok ? 'PASS ' : 'FAIL ') + r.name + ' (' + r.secs + 's)'); });
process.exit(results.every(function (r) { return r.ok; }) ? 0 : 1);
