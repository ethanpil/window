/* Every landscape loads clean: no page error, console error/warning or
   on-screen error strip (#err), and a sane frame time.

     node scenes.js [--biomes a,b] [--seeds s1,s2] [--locks "x;y"] [--shots dir]
   or the env vars BIOMES, SEEDS, LOCKS, SHOTS. Lock sets are separated by ';'. */
'use strict';
var fs = require('fs'), path = require('path');
var lib = require('./lib');

var ALL = ['meadow', 'coast', 'desert', 'alpine', 'savanna', 'lavender', 'penthouse', 'bridge', 'hayfield', 'cascade',
  'canyon', 'oasis', 'lakefront', 'river', 'flowerfield', 'marsh', 'cliffcoast', 'terraces', 'orchard', 'autumn', 'moor',
  'tundra', 'saltflat', 'blossom', 'farmland', 'urban', 'fjord'];
var biomes = lib.option('biomes', 'all') === 'all' ? ALL : lib.option('biomes').split(',');
var seeds = lib.option('seeds', '8badf00d,31415926').split(',');
var locks = lib.option('locks', 't=afternoon,w=clear,v=bare;t=night,w=rainstorm,v=bare').split(';');
var shots = lib.option('shots', '');

/* driver chatter and the WebGL1-only resize warning are not the page's */
var NOISE = /GPU stall|GroupMarkerNotSet|Automatic fallback|Texture has been resized from \(96x96\)/;

(async function () {
  if (shots) fs.mkdirSync(shots, { recursive: true });
  var srv = await lib.serve();
  var browser = await lib.launch();
  var page = await browser.newPage({ viewport: { width: 960, height: 720 } });
  var errs = [];
  page.on('pageerror', function (e) { errs.push('pageerror: ' + e.message); });
  page.on('console', function (m) {
    if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 400));
  });

  var bad = 0, total = 0;
  for (var l = 0; l < locks.length; l++) for (var s = 0; s < seeds.length; s++) for (var b = 0; b < biomes.length; b++) {
    errs = [];
    var label = biomes[b] + ' ' + seeds[s] + ' [' + locks[l] + ']';
    var t0 = Date.now();
    await page.goto(srv.url('?seed=' + seeds[s] + '@b=' + biomes[b] + ',' + locks[l]), { waitUntil: 'load' });
    await lib.waitForScene(page).catch(function () { errs.push('curtain never lifted'); });
    var loadMs = Date.now() - t0;
    await page.waitForTimeout(1200);
    var frameMs = await page.evaluate(function () {
      return new Promise(function (res) {
        var n = 0, t0 = performance.now();
        (function f(t) { if (++n < 30) requestAnimationFrame(f); else res((t - t0) / n); })(t0);
      });
    });
    var strip = await page.evaluate(function () { var e = document.getElementById('err'); return e && !e.hidden ? e.textContent : ''; });
    if (strip) errs.push('strip: ' + strip.slice(0, 600));
    if (shots) {
      await page.evaluate(function () { var h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
      await page.screenshot({ path: path.join(shots, biomes[b] + '-' + seeds[s] + '-' + l + '.jpg'), type: 'jpeg', quality: 80 });
    }
    var real = Array.from(new Set(errs)).filter(function (e) { return !NOISE.test(e); });
    total++;
    if (real.length) bad++;
    console.log((real.length ? 'FAIL ' : 'ok   ') + label + ' load ' + loadMs + 'ms frame ' + frameMs.toFixed(1) + 'ms' +
      (real.length ? '\n   ' + real.join('\n   ') : ''));
  }
  await browser.close(); srv.close();
  console.log('\nscenes: ' + (total - bad) + '/' + total + ' clean');
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
