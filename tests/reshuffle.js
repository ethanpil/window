/* A reshuffle (seed -> seed#3) must keep the scene's identity: the
   description in #note (biome, season, weather, time, ...) is the same.
   Metre values are masked because a reshuffle may nudge them.

     node reshuffle.js [--count 30]      (or WINDOW_COUNT) */
'use strict';
var lib = require('./lib');
lib.parse('node reshuffle.js [--count N]', ['count'], []);
var N = lib.count('count', 30);

(async function () {
  var srv = await lib.serve();
  var browser = await lib.launch();
  var page = await browser.newPage({ viewport: { width: 640, height: 480 } });
  async function note(seed) {
    await page.goto(srv.url('?seed=' + encodeURIComponent(seed)), { waitUntil: 'load' });
    await page.waitForFunction(function () {
      var c = document.getElementById('curtain');
      return c && c.classList.contains('gone') && document.getElementById('note').textContent.length > 5;
    }, null, { timeout: 30000 });
    return (await page.evaluate(function () { return document.getElementById('note').textContent; })).replace(/\d+ ?m\b/g, 'Nm');
  }
  var ok = 0, bad = [];
  for (var i = 0; i < N; i++) {
    var seed = ((i * 2654435761) >>> 0).toString(16).padStart(8, '0');
    var a = await note(seed), b = await note(seed + '#3');
    if (a === b) ok++; else bad.push(seed + '\n   plain: ' + a + '\n   #3:    ' + b);
  }
  bad.forEach(function (x) { console.log('FAIL ' + x); });
  console.log('reshuffle: ' + ok + '/' + N + ' identical');
  await browser.close(); srv.close();
  process.exit(bad.length ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
