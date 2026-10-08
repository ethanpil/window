/* The same seed builds the same world at any window size: the clock, the wet
   ground (to 3 decimals), the window frame's child count, and for every mesh
   its instance count and a hash of each vertex / instance attribute array
   (positions, iPos, ...) must match. Serves a copy of the page that exposes
   the app as window.__App.

     node determinism.js */
'use strict';
var lib = require('./lib');
lib.parse('node determinism.js', [], []);

var CASES = [
  ['urban', '8badf00d'], ['urban', '31415926'], ['penthouse', '8badf00d'], ['penthouse', '1234abcd'],
  ['desert', '8badf00d'], ['meadow', '8badf00d'], ['canyon', '31415926'], ['farmland', '8badf00d']
];
var SIZES = [[1600, 900], [2560, 1080]];

/* what the world is made of, in a form that compares with === (runs in the page).
   The window frame (App.room) is cut to the window's shape on purpose, so its
   meshes are left out; its child count is kept. */
function describe() {
  var A = window.__App, meshes = [];
  /* FNV-1a over the 32-bit words of a typed array's bytes */
  function hash(arr, len) {
    var u = new Uint32Array(arr.buffer, arr.byteOffset, Math.floor(len * arr.BYTES_PER_ELEMENT / 4)), h = 0x811c9dc5;
    for (var i = 0; i < u.length; i++) h = Math.imul(h ^ u[i], 0x01000193);
    return (h >>> 0).toString(16);
  }
  A.scene.traverse(function (o) {
    var g = o.geometry;
    if (!g) return;
    for (var p = o; p; p = p.parent) if (p === A.room) return;
    var inst = g.isInstancedBufferGeometry, n = inst ? g.instanceCount : (g.attributes.position ? g.attributes.position.count : 0);
    var attrs = {};
    Object.keys(g.attributes).sort().forEach(function (name) {
      var a = g.attributes[name];
      /* an instanced attribute counts only up to what was filled */
      var len = a.isInstancedBufferAttribute && isFinite(n) ? Math.min(a.array.length, n * a.itemSize) : a.array.length;
      attrs[name] = a.array.length + ':' + hash(a.array, len);
    });
    meshes.push({ id: o.type + ':' + (o.name || '') + ':' + n, attrs: attrs });
  });
  return {
    t: Math.round((A.t - A.elapsed) * 1e4) / 1e4,
    wetness: Math.round(A.wetness * 1e3) / 1e3,
    room: A.room ? A.room.children.length : -1,
    meshes: meshes
  };
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
      await page.goto(srv.url('?seed=' + encodeURIComponent(CASES[i][1] + '@b=' + CASES[i][0])), { waitUntil: 'load' });
      await lib.waitForScene(page);
      results.push(await page.evaluate(describe));
    }
    var a = results[0], b = results[1], diffs = [];
    if (!a.meshes.length || !b.meshes.length) diffs.push('no meshes in the scene (' + a.meshes.length + ' vs ' + b.meshes.length + ')');
    if (a.t !== b.t) diffs.push('App.t ' + a.t + ' vs ' + b.t);
    if (a.wetness !== b.wetness) diffs.push('App.wetness ' + a.wetness + ' vs ' + b.wetness);
    if (a.room !== b.room) diffs.push('App.room children ' + a.room + ' vs ' + b.room);
    if (a.meshes.length !== b.meshes.length) diffs.push('mesh count ' + a.meshes.length + ' vs ' + b.meshes.length);
    for (var k = 0; k < Math.min(a.meshes.length, b.meshes.length); k++) {
      var x = a.meshes[k], y = b.meshes[k];
      if (x.id !== y.id) { diffs.push('mesh ' + k + ': ' + x.id + ' vs ' + y.id); continue; }
      Object.keys(Object.assign({}, x.attrs, y.attrs)).forEach(function (name) {
        if (x.attrs[name] !== y.attrs[name]) diffs.push('mesh ' + k + ' ' + x.id + ' attribute ' + name + ': ' + x.attrs[name] + ' vs ' + y.attrs[name]);
      });
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
