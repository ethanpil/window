/* Snapshot of every shader the page runs. For each scene in a fixed matrix
   (every biome x seed 8badf00d x the four lock sets) the vertex and fragment
   source of every THREE.ShaderMaterial is hashed - those built (the
   constructor is wrapped right after three.min.js loads) and those found in
   App.scene - and compared with tests/shader-hashes.json. A change to a
   shader, or to the JavaScript that fills one in, shows up as the scenes it
   touches.

     node shaders.js [--quick] [--biomes a,b]   compare (--quick: the first two lock sets)
     node shaders.js --update                   rewrite shader-hashes.json from the full matrix */
'use strict';
var fs = require('fs'), path = require('path'), crypto = require('crypto');
var lib = require('./lib');

lib.parse('node shaders.js [--quick] [--biomes a,b] | node shaders.js --update', ['biomes'], ['quick', 'update']);

var SNAPSHOT = path.join(__dirname, 'shader-hashes.json');
var SEED = '8badf00d';
var LOCKS = ['t=afternoon,w=clear,v=bare', 't=night,w=rainstorm,v=bare', 't=golden,w=fair', 's=winter,w=snowfall,v=bare'];
var quick = lib.flag('quick'), update = lib.flag('update');
if (update && (quick || lib.option('biomes'))) lib.usage('--update writes the full matrix: do not combine it with --quick or --biomes');
var all = lib.biomes();
var biomes = lib.option('biomes') ? lib.option('biomes').split(',') : all;
var locks = quick ? LOCKS.slice(0, 2) : LOCKS;

/* record every ShaderMaterial the page constructs, even ones thrown away */
var HOOK = '<script>(function () {' +
  'var O = THREE.ShaderMaterial; window.__SH = [];' +
  'function S(p) { if (p) window.__SH.push([p.vertexShader || "", p.fragmentShader || ""]); return new O(p); }' +
  'S.prototype = O.prototype; THREE.ShaderMaterial = S;' +
  '})();</script>';
function hook(html) {
  var tag = 'three.min.js"></script>';
  if (html.indexOf(tag) < 0) throw new Error('cannot find the three.min.js script tag to hook ShaderMaterial');
  return html.replace(tag, tag + '\n' + HOOK);
}

function sha1(s) { return crypto.createHash('sha1').update(s).digest('hex').slice(0, 12); }

function collect() {
  var A = window.__App, seen = [];
  function add(m) { if (m && m.isShaderMaterial) seen.push([m.vertexShader || '', m.fragmentShader || '']); }
  A.scene.traverse(function (o) { (Array.isArray(o.material) ? o.material : [o.material]).forEach(add); });
  for (var k in A) add(A[k]);
  return seen.concat(window.__SH);
}

(async function () {
  var srv = await lib.serve({ expose: true, transform: hook });
  var browser = await lib.launch();
  var page = await browser.newPage({ viewport: { width: 960, height: 600 } });
  var errs = [];
  page.on('pageerror', function (e) { errs.push(e.message); });

  var got = {};
  for (var l = 0; l < locks.length; l++) for (var b = 0; b < biomes.length; b++) {
    var key = SEED + '@b=' + biomes[b] + ',' + locks[l];
    errs = [];
    await page.goto(srv.url('?seed=' + encodeURIComponent(key)), { waitUntil: 'load' });
    var lifted = await lib.waitForScene(page, 45000).then(function () { return true; }, function () { return false; });
    var list = lifted ? await page.evaluate(collect) : [];
    got[key] = Array.from(new Set(list.map(function (p) { return sha1('//VERT\n' + p[0] + '\n//FRAG\n' + p[1]); }))).sort();
    if (!lifted || errs.length || !got[key].length) {
      console.log('FAIL ' + key + ' ' + (!lifted ? 'curtain never lifted' : errs.length ? errs[0] : 'no shaders seen'));
      process.exit(1);
    }
    process.stdout.write('.');
  }
  console.log();
  await browser.close(); srv.close();

  if (update) {
    var ordered = {};
    Object.keys(got).sort().forEach(function (k) { ordered[k] = got[k]; });
    fs.writeFileSync(SNAPSHOT, JSON.stringify(ordered, null, 1) + '\n');
    var distinct = new Set([].concat.apply([], Object.keys(got).map(function (k) { return got[k]; })));
    console.log('wrote shader-hashes.json: ' + Object.keys(got).length + ' scenes, ' + distinct.size + ' distinct shader sources');
    process.exit(0);
  }

  if (!fs.existsSync(SNAPSHOT)) { console.log('FAIL no shader-hashes.json: run node shaders.js --update'); process.exit(1); }
  var want = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8')), bad = 0;
  Object.keys(got).forEach(function (k) {
    if (!want[k]) { bad++; console.log('FAIL ' + k + ' is not in shader-hashes.json (run --update if the matrix changed)'); return; }
    var gone = want[k].filter(function (h) { return got[k].indexOf(h) < 0; });
    var fresh = got[k].filter(function (h) { return want[k].indexOf(h) < 0; });
    if (gone.length || fresh.length) {
      bad++;
      console.log('FAIL ' + k + ': ' + gone.length + ' shader source(s) gone, ' + fresh.length + ' new' +
        '\n   gone ' + gone.join(' ') + '\n   new  ' + fresh.join(' '));
    }
  });
  var stale = Object.keys(want).filter(function (k) { return !quick && !lib.option('biomes') && !got[k]; });
  stale.forEach(function (k) { bad++; console.log('FAIL ' + k + ' is in shader-hashes.json but was not run (run --update if the matrix changed)'); });
  console.log('shaders: ' + (Object.keys(got).length - bad) + '/' + Object.keys(got).length + ' scenes unchanged' +
    (bad ? ' (intended? node shaders.js --update, and say so in the commit)' : ''));
  process.exit(bad ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
