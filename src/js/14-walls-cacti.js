/* ---------- drystone walls along field edges ---------- */
function buildWalls(scene, P, R, U, H, spec) {
  var box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  var tpl = new THREE.BufferGeometry();
  tpl.setAttribute('position', box.attributes.position);
  tpl.setAttribute('normal', box.attributes.normal);
  tpl.setAttribute('rib', new THREE.Float32BufferAttribute(box.attributes.uv.array.length / 2 > 0
    ? Array.prototype.slice.call(box.attributes.uv.array).filter(function (_, i) { return i % 2 === 0; })
    : [], 1));
  tpl.setIndex(box.index);
  var mat = solidMat(U, R.pick(['#8b8578', '#7d7a70', '#948d7e']), { rib: 0, grain: 1 });
  var items = [];
  var lines = R.int(2, 5);
  for (var l = 0; l < lines; l++) {
    var ang = R.range(-1.2, 1.2);
    var dist = R.range(25, 150);
    var dirA = ang + Math.PI / 2 + R.range(-0.5, 0.5);
    var cx = Math.sin(ang) * dist, cz = -Math.cos(ang) * dist;
    var segs = R.int(14, 40);
    var step = R.range(1.6, 2.6);
    for (var q = 0; q < segs; q++) {
      var off = (q - segs / 2) * step;
      var wx = cx + Math.cos(dirA) * off, wz = cz + Math.sin(dirA) * off;
      if (!plantable(P, H, wx, wz)) continue;
      /* long, low, and only a couple of stones thick */
      items.push([wx, H(wx, wz) - 0.1, wz, step * 1.02, dirA,
                  R.range(0.5, 0.85) / (step * 1.02), R.range(0.32, 0.5) / (step * 1.02)]);
    }
  }
  if (items.length) instanceSolid(scene, tpl, items, mat);
}
function buildCacti(scene, P, R, U, H, spec) {
  var kinds = Object.keys(CACTI), pairs = [];
  for (var ki = 0; ki < kinds.length; ki++) pairs.push([kinds[ki], CACTI[kinds[ki]].w]);
  var buckets = {};
  var guard = 0, placed = 0;
  var lim = scatterLim(P);
  /* a saguaro's height from its drawn size: young ones about, a few giants */
  var sagH = function (sz) { return 1.5 + Math.pow(clamp((sz - spec.size[0]) / Math.max(spec.size[1] - spec.size[0], 0.01), 0, 1), 1.25) * 11.5; };
  while (placed < spec.count && guard < spec.count * 60) {
    guard++;
    var a = R.range(-lim, lim);
    var rr = spec.r[0] + Math.pow(R.f(), 1.35) * (spec.r[1] - spec.r[0]);
    var x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
    if (!plantable(P, H, x, z, 0.4)) continue;
    var kind = R.weighted(pairs);
    var sz = R.range(spec.size[0], spec.size[1]) * ({ saguaro: 1, ocotillo: 0.72, barrel: 0.15, pear: 0.30, agave: 0.28, cholla: 0.30 }[kind] || 0.3);
    (buckets[kind] = buckets[kind] || []).push([x, z, sz, R.range(0.85, 1.15)]);
    /* near the window a cactus casts its own shape (bakeNear); the coarse
       map keeps it only for the shade at its foot */
    var nr = inNear(x, z) ? 1 : 0, gy = H(x, z);
    if (kind === 'saguaro') App._shadows.push([x, gy, z, 0.4, 1.0, sagH(sz), nr]);
    else {
      App._shadows.push([x, gy, z, sz * 0.3, 1.0, sz, nr]);
      var CK = { barrel: [0.25, 0.6, 0.95], pear: [0.3, 0.5, 0.8], agave: [0.3, 0.32, 0.85], ocotillo: [0.16, 0.95, 0.35], cholla: [0.25, 0.45, 0.65] }[kind];
      if (nr && CK) App._casters.push([x, gy, z, x, gy + sz * CK[1], z, sz * CK[0], CK[2], 1]);
    }
    placed++;
  }
  /* the saguaros' shapes come from a stream of their own */
  var CR = RNG(P.base + '/build/cacti' + (P.nonce ? '/' + P.nonce : ''));
  var SAG = [2.6, 5.4, 9.6];   /* spear, young, old: template heights */
  for (var kind2 in buckets) {
    var items = buckets[kind2], C = CACTI[kind2];
    var mat = solidMat(U, C.body, { rib: C.ribs ? 1 : 0, ribN: C.ribs || 16, spineCol: C.spine, spines: C.spines, tipCol: C.tip,
      /* the ocotillo flowers red at its tips in spring, and only then */
      tipMix: kind2 === 'ocotillo' && P.seasonKey !== 'spring' ? 0 : (C.tipMix || 0), aoH: 0.3 });
    for (var t = 0; t < 2; t++) {
      var part = items.filter(function (_, idx) { return idx % 2 === t; });
      if (!part.length) continue;
      var solids = [];
      for (var i = 0; i < part.length; i++)
        solids.push([part[i][0], H(part[i][0], part[i][1]) - 0.03, part[i][1], part[i][2], R.range(0, 6.283), part[i][3], 1]);
      if (kind2 !== 'saguaro') { instanceSolid(scene, cactusTemplate(R, kind2), solids, mat); continue; }
      for (var cl = 0; cl < 3; cl++) {
        var mine = [];
        for (i = 0; i < part.length; i++) {
          var hs = sagH(part[i][2]), c2 = hs < 3.6 ? 0 : (hs < 7 ? 1 : 2);
          if (c2 !== cl) continue;
          var sol = solids[i];
          mine.push([sol[0], sol[1] - 0.1, sol[2], 1, sol[4], hs / SAG[cl], 1]);
        }
        if (!mine.length) continue;
        var stpl = saguaroTemplate(CR, SAG[cl]);
        instanceSolid(scene, stpl, mine, mat);
        /* each one's trunk and arms, turned and stretched as the shader does */
        for (i = 0; i < mine.length; i++) {
          var m0 = mine[i];
          if (!inNear(m0[0], m0[2])) continue;
          var mc = Math.cos(m0[4]), ms = Math.sin(m0[4]), caps = stpl.userData.caps;
          for (var ci = 0; ci < caps.length; ci++) {
            var cp = caps[ci];
            App._casters.push([m0[0] + cp[0] * mc - cp[2] * ms, m0[1] + cp[1] * m0[5], m0[2] + cp[0] * ms + cp[2] * mc,
                               m0[0] + cp[3] * mc - cp[5] * ms, m0[1] + cp[4] * m0[5], m0[2] + cp[3] * ms + cp[5] * mc, cp[6], 1, 1]);
          }
        }
      }
    }
  }
}

/* The street grid a city is laid out on. The ground draws its streets from
   it (buildTerrain) and the buildings stand on its blocks, so it is worked out
   once, before either, from the params and a stream of its own. Blocks are
   bw square, centred on multiples of the pitch in the grid's frame; a street
   sw wide runs between them, a pavement sk wide down each side of it.
   start/end: the ring of the city proper (the skyline seen from outside it
   has a park, houses or a river in front). */
