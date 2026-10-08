/* Every landscape loads clean: the requested biome (and any locked weather,
   time and season) is what got built, and there is no page error, console
   error/warning or on-screen error strip (#err). A few frames must render, at
   a median frame time under --max-frame.

     node scenes.js [--quick] [--webgl1] [--biomes a,b] [--seeds s1,s2] [--locks "x;y"]
                    [--max-frame ms] [--shots dir]
   or the env vars WINDOW_BIOMES, WINDOW_SEEDS, WINDOW_LOCKS, WINDOW_MAX_FRAME, WINDOW_SHOTS.
   Lock sets are separated by ';'. --quick: the first seed and the first two
   lock sets (unless you name them). --webgl1: launch with WebGL2 disabled and
   check that the page really ran on WebGL1. */
'use strict';
var fs = require('fs'), path = require('path');
var lib = require('./lib');

lib.parse('node scenes.js [--quick] [--webgl1] [--biomes a,b] [--seeds s1,s2] [--locks "x;y"] [--max-frame ms] [--shots dir]',
  ['biomes', 'seeds', 'locks', 'max-frame', 'shots'], ['quick', 'webgl1']);

var quick = lib.flag('quick'), webgl1 = lib.flag('webgl1');
var ALL = lib.biomes(), NO_WINTER = lib.noWinter();
var biomes = lib.option('biomes', 'all') === 'all' ? ALL : lib.option('biomes').split(',');
var seeds = lib.option('seeds') ? lib.option('seeds').split(',') : ['8badf00d', '31415926'].slice(0, quick ? 1 : 2);
var locks = lib.option('locks') ? lib.option('locks').split(';') : [
  't=afternoon,w=clear,v=bare', 't=night,w=rainstorm,v=bare', 't=golden,w=fair', 's=winter,w=snowfall,v=bare'
].slice(0, quick ? 2 : 4);
var maxFrame = lib.number('max-frame', 400);
var shots = lib.option('shots', '');

/* driver chatter is not the page's; the 96x96 resize warning is WebGL1's own */
var NOISE = /GPU stall|GroupMarkerNotSet|Automatic fallback/;
var NOISE_WEBGL1 = /Texture has been resized from \(96x96\)/;

var LOCK_FIELD = { b: 'biomeKey', w: 'weatherKey', t: 'timeA', s: 'seasonKey' };

/* lock text -> {field: wanted}; a winter lock is not honoured in the biomes that have no winter */
function wanted(biome, lock) {
  var want = { biomeKey: biome };
  lock.split(',').forEach(function (part) {
    var eq = part.indexOf('='), field = LOCK_FIELD[part.slice(0, eq)];
    if (field && field !== 'biomeKey') want[field] = part.slice(eq + 1);
  });
  if (want.seasonKey === 'winter' && NO_WINTER.indexOf(biome) >= 0) { delete want.seasonKey; want.notWinter = true; }
  return want;
}

/* ten animation frames; the median gap between them, or null if they stall */
function frames() {
  return new Promise(function (res) {
    var gaps = [], last = null, timer = setTimeout(function () { res(null); }, 10000);
    (function f(t) {
      if (last != null) gaps.push(t - last);
      last = t;
      if (gaps.length < 10) requestAnimationFrame(f);
      else { clearTimeout(timer); gaps.sort(function (a, b) { return a - b; }); res((gaps[4] + gaps[5]) / 2); }
    })(performance.now());
  });
}

(async function () {
  if (shots) fs.mkdirSync(shots, { recursive: true });
  var srv = await lib.serve({ expose: true });
  var browser = await lib.launch(webgl1 ? ['--disable-webgl2'] : []);
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
    var want = wanted(biomes[b], locks[l]);
    var t0 = Date.now();
    await page.goto(srv.url('?seed=' + encodeURIComponent(seeds[s] + '@b=' + biomes[b] + ',' + locks[l])), { waitUntil: 'load' });
    await lib.waitForScene(page).catch(function () { errs.push('curtain never lifted'); });
    var loadMs = Date.now() - t0;

    var got = await page.evaluate(function () {
      var A = window.__App, P = A && A.P;
      return {
        keys: P ? { biomeKey: P.biomeKey, weatherKey: P.weatherKey, timeA: P.timeA, seasonKey: P.seasonKey } : null,
        webgl2: A && A.renderer ? A.renderer.capabilities.isWebGL2 : null
      };
    });
    if (!got.keys) errs.push('no scene: App.P is not set');
    else {
      Object.keys(want).forEach(function (k) {
        if (k === 'notWinter') { if (got.keys.seasonKey === 'winter') errs.push('seasonKey is winter in a biome with no winter'); }
        else if (got.keys[k] !== want[k]) errs.push('asked for ' + k + ' ' + want[k] + ', got ' + got.keys[k]);
      });
    }
    if (webgl1 && got.webgl2 !== false) errs.push('--webgl1: renderer.capabilities.isWebGL2 is ' + got.webgl2 + ', not false');

    var frameMs = await page.evaluate(frames);
    if (frameMs == null) errs.push('animation frames stalled (10 frames took over 10 s)');
    else if (frameMs > maxFrame) errs.push('median frame time ' + frameMs.toFixed(1) + 'ms is over --max-frame ' + maxFrame + 'ms');

    var strip = await page.evaluate(function () { var e = document.getElementById('err'); return e && !e.hidden ? e.textContent : ''; });
    if (strip) errs.push('strip: ' + strip.slice(0, 600));
    if (shots) {
      await page.evaluate(function () { var h = document.getElementById('hud'); if (h) h.style.display = 'none'; });
      await page.screenshot({ path: path.join(shots, biomes[b] + '-' + seeds[s] + '-' + l + '.jpg'), type: 'jpeg', quality: 80 });
    }
    var real = Array.from(new Set(errs)).filter(function (e) { return !NOISE.test(e) && !(webgl1 && NOISE_WEBGL1.test(e)); });
    total++;
    if (real.length) bad++;
    console.log((real.length ? 'FAIL ' : 'ok   ') + label + ' load ' + loadMs + 'ms frame ' + (frameMs == null ? '-' : frameMs.toFixed(1)) + 'ms' +
      (real.length ? '\n   ' + real.join('\n   ') : ''));
  }
  await browser.close(); srv.close();
  console.log('\nscenes' + (webgl1 ? ' (WebGL1)' : '') + ': ' + (total - bad) + '/' + total + ' clean');
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
