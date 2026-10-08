/* The same seed builds the same world at any window size: the clock, the wet
   ground and every mesh's instance count must match. Serves a copy of the
   page that exposes the app as window.__App. */
'use strict';
var lib = require('./lib');

var CASES = [
  ['urban', '8badf00d'], ['urban', '31415926'], ['penthouse', '8badf00d'], ['penthouse', '1234abcd'],
  ['desert', '8badf00d'], ['meadow', '8badf00d'], ['canyon', '31415926'], ['farmland', '8badf00d']
];
var SIZES = [[1600, 900], [2560, 1080]];

/* what the world is made of, in a form that compares with === (runs in the page).
   The window frame (App.room) is cut to the window's shape on purpose, so it is left out. */
function describe() {
  var A = window.__App, meshes = [];
  A.scene.traverse(function (o) {
    var g = o.geometry;
    if (!g) return;
    for (var p = o; p; p = p.parent) if (p === A.room) return;
    var n = g.isInstancedBufferGeometry ? g.instanceCount : (g.attributes.position ? g.attributes.position.count : 0);
    meshes.push(o.type + ':' + (o.name || '') + ':' + n);
  });
  return { t: Math.round((A.t - A.elapsed) * 1e4) / 1e4, wetness: A.wetness, meshes: meshes };
}

(async function () {
  var srv = await lib.serve({ expose: true });
  var browser = await lib.launch();
  var page = await browser.newPage();
  var bad = 0;
  for (var i = 0; i < CASES.length; i++) {
    var results = [];
    for (var s = 0; s < SIZES.length; s++) {
      await page.setViewportSize({ width: SIZES[s][0], height: SIZES[s][1] });
      await page.goto(srv.url('?seed=' + CASES[i][1] + '@b=' + CASES[i][0]), { waitUntil: 'load' });
      await lib.waitForScene(page);
      results.push(await page.evaluate(describe));
    }
    var a = results[0], b = results[1], diffs = [];
    if (a.t !== b.t) diffs.push('App.t ' + a.t + ' vs ' + b.t);
    if (a.wetness !== b.wetness) diffs.push('App.wetness ' + a.wetness + ' vs ' + b.wetness);
    if (a.meshes.length !== b.meshes.length) diffs.push('mesh count ' + a.meshes.length + ' vs ' + b.meshes.length);
    for (var k = 0; k < Math.min(a.meshes.length, b.meshes.length); k++) {
      if (a.meshes[k] !== b.meshes[k]) diffs.push('mesh ' + k + ': ' + a.meshes[k] + ' vs ' + b.meshes[k]);
    }
    if (diffs.length) bad++;
    console.log((diffs.length ? 'FAIL ' : 'ok   ') + CASES[i][0] + ' ' + CASES[i][1] + ' (' + a.meshes.length + ' meshes)' +
      (diffs.length ? '\n   ' + diffs.slice(0, 10).join('\n   ') : ''));
  }
  await browser.close(); srv.close();
  console.log('determinism: ' + (CASES.length - bad) + '/' + CASES.length + ' stable, ' +
    SIZES.map(function (s) { return s.join('x'); }).join(' vs '));
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
