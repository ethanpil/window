function cityPlan(P) {
  if (P._city !== undefined) return P._city;
  var pent = P.biomeKey === 'penthouse';
  if (!pent && P.biomeKey !== 'urban') { P._city = null; return null; }
  var CR = RNG(P.base + '/city' + (P.nonce ? '/' + P.nonce : ''));
  var ubw = CR.range(46, 72), usw = CR.range(15, 22), uga = CR.range(-0.6, 0.6);
  var ustart = CR.range(230, 330), udepth = CR.range(380, 560);
  var bw = pent ? P.blockW : ubw, sw = pent ? P.streetW : usw, ga = pent ? P.gridAngle : uga;
  var C = { pent: pent, bw: bw, sw: sw, pitch: bw + sw, ga: ga, ca: Math.cos(ga), sa: Math.sin(ga),
            sk: clamp(sw * 0.2, 3, 5), start: pent ? 0 : ustart, end: pent ? 1600 : ustart + udepth };
  /* streets reach out past the city proper: a ring road round the park, or
     two rings of suburban streets lined with houses */
  C.streetStart = pent ? -1e4 : C.start - C.pitch * (P.cityFront === 'houses' ? 2.6 : 0.6);
  /* grid frame <-> world */
  C.toWorld = function (gx, gz) { return [gx * C.ca - gz * C.sa, gx * C.sa + gz * C.ca]; };
  C.toGrid = function (x, z) { return [x * C.ca + z * C.sa, -x * C.sa + z * C.ca]; };
  P._city = C;
  return C;
}

/* Facade families. A building's face is drawn from what it is: 0 a glass
   curtain wall, 1 brick with punched windows, 2 precast concrete with ribbon
   glazing, 3 stone, 4 a plant room (louvres, no windows). Storey heights in
   metres; cityMesh draws the windows to the same numbers, and every box is
   cut to a whole number of storeys (plus a lobby on the street and a parapet
   on top) so no window is cut off at a roofline. */
var CITY_FLOOR = [3.8, 3.2, 3.6, 3.4, 4.0];
var CITY_LOBBY = 5.2, CITY_PARAPET = 1.2;
/* Street lamps stand every CITY_LAMP metres down each pavement, staggered by
   half that across the street, CITY_LAMP_IN in from the kerb: cityStreets
   plants them and the ground draws their pools of light to the same numbers. */
var CITY_LAMP = 26, CITY_LAMP_IN = 0.7;
var CITY_WALLS = [
  ['#4f6470', '#3d4a52', '#5e6262', '#465a66', '#5a5448'],
  ['#8a4e3a', '#9a5c44', '#b8a07f', '#7c6c5e', '#6e3f33', '#a46a4c'],
  ['#a9a59c', '#918e88', '#b7b0a3', '#9d968a'],
  ['#bcb19a', '#a99f8b', '#c6bda9', '#8f897d'],
  ['#7d7f80', '#6c6e70', '#8a8984']
];
var CITY_GLASS = [
  ['#3a5c6a', '#2e4f4b', '#5a5045', '#7a8790', '#30465c', '#44606e'],
  ['#273036', '#2c3236'], ['#2d363d', '#33393e'], ['#2a3036', '#2f3337'], ['#2b2f33']
];
function cityHeight(type, h, onStreet) {
  var lob = onStreet ? CITY_LOBBY : 0, fh = CITY_FLOOR[type];
  return lob + Math.max(1, Math.round((h - lob - CITY_PARAPET) / fh)) * fh + CITY_PARAPET;
}

/* One block of a city, filled. A tall block is a tower: a podium built out
   to the pavement, a shaft set back from it, a setback or two near the top
   and a crown of plant. Otherwise the block is cut into two to six lots, each
   built to its lot line at its own height, now and then one left open as a
   plaza. Boxes go to out (see cityMesh), roofs that carry plant and tanks to
   roofs, and every box into App._boxes for the shadow bake.
   gx, gz: the block's centre in the grid frame; y(gx, gz, hx, hz): street
   level under a footprint, or null where it may not be built (water). */
function cityBlock(C, R, gx, gz, hgt, y, out, roofs) {
  var half = C.bw * 0.5;
  var tower = hgt > 55 && R.f() < 0.85, whole = R.f() < 0.5;
  var lotsX = R.int(1, 3), lotsZ = R.int(1, 2);
  var cuts = function (n) {
    var w = [], s = 0, i;
    for (i = 0; i < 3; i++) { w.push(R.range(0.7, 1.3)); }
    for (i = 0; i < n; i++) s += w[i];
    var e = [-half], a = -half;
    for (i = 0; i < n; i++) { a += w[i] / s * C.bw; e.push(a); }
    return e;
  };
  var ex = cuts(lotsX), ez = cuts(lotsZ);
  var lots = [];
  if (tower) {
    if (whole) lots.push([gx, gz, half, half, 1]);
    else {
      /* the tower on half the block, a lot or two of lower building beside it */
      var sx = R.f() < 0.5 ? -1 : 1, split = R.range(0.48, 0.62) * C.bw;
      lots.push([gx + sx * (half - split * 0.5), gz, split * 0.5, half, 1]);
      var rest = C.bw - split, nz2 = R.int(1, 2);
      for (var q = 0; q < nz2; q++)
        lots.push([gx - sx * (half - rest * 0.5), gz - half + C.bw * (q + 0.5) / nz2, rest * 0.5, half / nz2, 0]);
    }
  } else {
    for (var ix = 0; ix < lotsX; ix++) for (var iz = 0; iz < lotsZ; iz++)
      lots.push([gx + (ex[ix] + ex[ix + 1]) * 0.5, gz + (ez[iz] + ez[iz + 1]) * 0.5, (ex[ix + 1] - ex[ix]) * 0.5, (ez[iz + 1] - ez[iz]) * 0.5, 0]);
  }
  for (var li = 0; li < lots.length; li++) {
    var lt = lots[li], open = R.f() < 0.07;
    var base = y(lt[0], lt[1], lt[2], lt[3]);
    if (base == null || (open && !lt[4])) continue;
    cityBuilding(C, R, lt, base, lt[4] ? hgt : Math.max(9, Math.min(hgt * R.range(0.45, 1.25), 72)), out, roofs);
  }
}

function cityBuilding(C, R, lt, y, hgt, out, roofs) {
  var seed = R.f(), tower = lt[4] && hgt > 55;
  var wt = tower ? R.weighted([[0, 6], [2, 2], [3, 1.2], [1, 0.6]]) : R.weighted([[1, 4.5], [3, 2], [2, 2.5], [0, 1]]);
  var pt = R.weighted([[3, 3], [0, 3], [1, 2], [2, 2]]);
  var cWall = function (t) { var c = new THREE.Color(R.pick(CITY_WALLS[t])); return c.multiplyScalar(R.range(0.9, 1.1)); };
  var cGlass = function (t) { return new THREE.Color(R.pick(CITY_GLASS[t])); };
  var box = function (hx, hz, y0, h, t, wall, glass, top) {
    var w = C.toWorld(lt[0], lt[1]);
    var it = [w[0], y + y0, w[1], hx * 2, C.ga, h / (hx * 2), hz / hx, seed, t, y0, wall, glass];
    out.push(it);
    App._boxes.push([w[0], w[1], hx, hz, C.ga, y + y0 + h]);
    if (top) roofs.push(it);
    return it;
  };
  /* built to the lot line, less a hand's width so neighbours do not share a face */
  var hx = lt[2] - 0.15, hz = lt[3] - 0.15;
  var ins = R.range(2, 6), nSet = R.int(1, 2), fTop = R.range(0.15, 0.25), crownH = R.range(4, 9), spire = R.f() < 0.2;
  var sbIn = [R.range(1.5, 4), R.range(1.5, 4)], pod = R.range(14, 26), pent = R.f() < 0.35;
  if (!tower) {
    var h = cityHeight(wt, hgt, true), wl = cWall(wt), gl = cGlass(wt);
    var b0 = box(hx, hz, 0, h, wt, wl, gl, !pent || h < 18);
    /* a set-back top storey */
    if (pent && h >= 18 && hx > 6 && hz > 6) box(hx - 2.5, hz - 2.5, h, CITY_FLOOR[wt] + CITY_PARAPET, wt, wl, gl, true);
    return b0;
  }
  /* podium, shaft, setbacks, crown */
  var hp = cityHeight(pt, pod, true);
  box(hx, hz, 0, hp, pt, cWall(pt), cGlass(pt), true);
  /* no pencils: a shaft at least a fourteenth as wide each way as it is tall */
  var sx = Math.max(Math.min(hx - ins, R.range(13, 24)), 7), sz = Math.max(Math.min(hz - ins, R.range(13, 24)), 7);
  hgt = Math.min(hgt, Math.min(sx, sz) * 14);
  var rise = Math.max(hgt - hp, 20);
  var sw = cWall(wt), sg = cGlass(wt);
  var hMain = cityHeight(wt, rise * (1 - fTop), false), at = hp;
  box(sx, sz, at, hMain, wt, sw, sg, false);
  at += hMain;
  for (var k = 0; k < nSet; k++) {
    var nx = sx - sbIn[k], nz = sz - sbIn[k];
    if (nx < 5 || nz < 5) break;
    sx = nx; sz = nz;
    var hs = cityHeight(wt, rise * fTop / nSet, false);
    box(sx, sz, at, hs, wt, sw, sg, false);
    at += hs;
  }
  /* the crown: a plant room set in from the top, or a spire */
  var cx = Math.max(sx - R.range(2, 5), 3), cz = Math.max(sz - R.range(2, 5), 3);
  var crown = box(cx, cz, at, crownH, 4, cWall(4), cGlass(4), false);
  /* a spire goes to buildRoofs with the roofs, which gives it no plant */
  if (spire) { crown.spire = Math.min(cx, cz); roofs.push(crown); }
  crown.beacon = at + crownH > 90;                  /* metres above its street */
  return crown;
}

/* Houses at their real size: two storeys, eaves at five and a half metres,
   the ridge at eight to ten. Four kinds: a gabled house, a hipped one, an L
   with a wing to the back, a short terrace of three. Built in metres, front
   (an eaves side) toward +z; roofs and chimneys are trim (rib 1) for the
   two-tone roof colour. */
function houseTemplates() {
  var mk = function (fn) {
    var B = { pos: [], nor: [], idx: [], rib: [] }, trims = [];
    fn(B, function (f) { var a = B.rib.length; f(); trims.push([a, B.rib.length]); });
    for (var t = 0; t < trims.length; t++) for (var k = trims[t][0]; k < trims[t][1]; k++) B.rib[k] = 1;
    return finishGeo(B);
  };
  return [
    { w: 10, d: 8, top: 9.0, g: mk(function (B, roof) {
      pushBox(B, 0, 2.7, 0, 5, 2.7, 4, 0);
      pushGableEnds(B, 0, 5.4, 0, 5, 4.45, 3.6);
      roof(function () { pushGableRoof(B, 0, 5.4, 0, 5, 4, 3.6, 0.45); pushBox(B, 2.6, 8.3, -1.0, 0.35, 1.1, 0.5, 0); });
    }) },
    { w: 11, d: 9, top: 8.6, g: mk(function (B, roof) {
      pushBox(B, 0, 2.8, 0, 5.5, 2.8, 4.5, 0);
      roof(function () { pushHipRoof(B, 0, 5.6, 0, 5.5, 4.5, 3.0, 0.5); pushBox(B, -2.2, 7.9, 0.8, 0.35, 1.0, 0.5, 0); });
    }) },
    { w: 10, d: 13.5, top: 8.8, g: mk(function (B, roof) {
      pushBox(B, 0, 2.7, 2.75, 5, 2.7, 3.75, 0);
      pushGableEnds(B, 0, 5.4, 2.75, 5, 4.15, 3.4);
      pushBox(B, -2, 2.7, -3.5, 3, 2.7, 3.2, 0);
      roof(function () {
        pushGableRoof(B, 0, 5.4, 2.75, 5, 3.75, 3.4, 0.4);
        pushHipRoof(B, -2, 5.4, -3.5, 3, 3.2, 2.6, 0.4);
      });
    }) },
    { w: 19.5, d: 9, top: 9.4, g: mk(function (B, roof) {
      pushBox(B, 0, 3.0, 0, 9.75, 3.0, 4.5, 0);
      pushGableEnds(B, 0, 6.0, 0, 9.75, 4.85, 3.4);
      roof(function () {
        pushGableRoof(B, 0, 6.0, 0, 9.75, 4.5, 3.4, 0.35);
        pushBox(B, -3.25, 9.0, 0, 0.5, 0.9, 0.35, 0); pushBox(B, 3.25, 9.0, 0, 0.5, 0.9, 0.35, 0);
      });
    }) }
  ];
}

/* The neighbourhood in front of the city: houses on the blocks short of it,
   set back five to eight metres from the pavement and facing the street,
   with gardens behind. */
function buildCityHouses(scene, P, U, H, C) {
  var HR = RNG(P.base + '/build/houses' + (P.nonce ? '/' + P.nonce : ''));
  var T = houseTemplates();
  var roofCol = HR.pick(['#3d3d42', '#55392e', '#4a4643', '#5b4033']);
  /* three finishes: render, brick, painted boards */
  var mats = [
    solidMat(U, HR.pick(['#d6cbb8', '#cbbfa8', '#e0d8c8', '#c9c2b4']), { rib: 0, grain: 0, spines: 0, twoTone: 1, body2: roofCol, aoH: 0.4, facade: { kind: 2, win: 0.85, bay: 2.6, roof: 0, doorW: 1.0, doorH: 2.1 } }),
    solidMat(U, HR.pick(['#8f5a44', '#7d4c3a', '#9a6a52']), { rib: 0, grain: 0, spines: 0, twoTone: 1, body2: roofCol, aoH: 0.4, facade: { kind: 4, win: 0.85, bay: 2.6, roof: 0, doorW: 1.0, doorH: 2.1 } }),
    solidMat(U, HR.pick(['#b7c0bf', '#c9c3b2', '#a9b4ae']), { rib: 0, grain: 0, spines: 0, twoTone: 1, body2: roofCol, aoH: 0.4, facade: { kind: 0, win: 0.8, bay: 2.4, roof: 0, doorW: 1.0, doorH: 2.1 } })
  ];
  var groups = {};
  /* a front hedge to most gardens, along the lot line at the pavement, cut
     for the gate in front of the door: their own stream */
  var GR = RNG(P.base + '/build/gardens' + (P.nonce ? '/' + P.nonce : '')), hedges = [];
  var sides = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  var nb = Math.ceil(C.start / C.pitch) + 1, lim = Math.max(visibleHalfAngle(P) * 1.25, 0.9);
  for (var bx = -nb; bx <= nb; bx++) for (var bz = -nb; bz <= 0; bz++) {
    var gx = bx * C.pitch, gz = bz * C.pitch, w0 = C.toWorld(gx, gz), d0 = Math.sqrt(w0[0] * w0[0] + w0[1] * w0[1]);
    if (d0 < C.streetStart || d0 >= C.start || Math.abs(Math.atan2(w0[0], -w0[1])) > lim) continue;
    var L = Math.max(C.bw * 0.5 - 14, 6);
    /* the rows round a block meet at its corners: a house that would stand
       in one already placed (a metre's gap kept) is left out. Footprints in
       the grid frame, where they are square to the axes. */
    var placed = [];
    for (var si = 0; si < 4; si++) {
      var n = sides[si], t = [-n[1], n[0]];
      var a = -L;
      while (true) {
        var ti = HR.int(0, 3), tp = T[ti], sb = HR.range(5, 8);
        if (a + tp.w > L) break;
        var ac = a + tp.w * 0.5, inn = C.bw * 0.5 - sb - tp.d * 0.5;
        var cx = gx + n[0] * inn + t[0] * ac, cz = gz + n[1] * inn + t[1] * ac;
        a += tp.w + HR.range(3, 7);
        var fx = n[0] ? tp.d * 0.5 : tp.w * 0.5, fz = n[0] ? tp.w * 0.5 : tp.d * 0.5, hit = false;
        for (var pi = 0; pi < placed.length && !hit; pi++)
          hit = Math.abs(cx - placed[pi][0]) < fx + placed[pi][2] + 1 && Math.abs(cz - placed[pi][1]) < fz + placed[pi][3] + 1;
        if (hit) continue;
        var w = C.toWorld(cx, cz), rot = Math.atan2(-n[0], n[1]) + C.ga;
        var c = Math.cos(rot), s = Math.sin(rot), lo = 1e9, wet = false;
        for (var q = 0; q < 4; q++) {
          var lx = (q & 1 ? 0.5 : -0.5) * tp.w, lz = (q & 2 ? 0.5 : -0.5) * tp.d;
          var y = H(w[0] + lx * c - lz * s, w[1] + lx * s + lz * c);
          if (P.waterY != null && y < P.waterY + 0.8) wet = true;
          lo = Math.min(lo, y);
        }
        if (wet) continue;
        placed.push([cx, cz, fx, fz]);
        if (GR.f() < 0.6) {
          var hn = C.bw * 0.5 - 0.6, hf = tp.w * 0.5 + 1.2, hd = C.toWorld(t[0], t[1]);
          for (var hs = -1; hs <= 1; hs += 2) {
            var ht = ac + hs * (hf + 0.8) * 0.5, hw = C.toWorld(gx + n[0] * hn + t[0] * ht, gz + n[1] * hn + t[1] * ht);
            hedges.push({ x: hw[0], z: hw[1], ca: hd[0], sa: hd[1], half: (hf - 0.8) * 0.5, garden: true });
          }
        }
        var mi = HR.int(0, 2), key = ti + '_' + mi;
        (groups[key] = groups[key] || []).push([w[0], lo - 0.3, w[1], 1, rot, 1, 1]);
        App._boxes.push([w[0], w[1], tp.w * 0.5, tp.d * 0.5, rot, lo + tp.top * 0.8]);
      }
    }
  }
  for (var k in groups) {
    var parts = k.split('_');
    instanceSolid(scene, T[+parts[0]].g, groups[k], mats[+parts[1]]);
  }
  if (hedges.length) buildHedgeLines(scene, P, U, H, hedges, GR.range(1.0, 1.4), GR);
}

/* ---------- a city ----------
   The skyline seen from outside it: blocks on the grid inside the city's
   ring, each filled by cityBlock, drawn by cityMesh with a window grid
   computed per face. At night the lit windows carry the whole scene. */
function buildCity(scene, P, R, U, H) {
  var C = cityPlan(P);
  /* the near neighbourhood: houses and gardens before the city proper */
  if (P.cityFront === 'houses') buildCityHouses(scene, P, U, H, C);
  /* how wide across the view the city runs: no wider than can be seen, or
     most of it stands behind the wall, but never under 0.9 rad a side (like
     scatterLim, and the houses and poles), so a narrow opening's city still
     fills a wide screen */
  var spread = Math.min(R.range(0.9, 1.25), Math.max(visibleHalfAngle(P) * 1.2, 0.9));
  var items = [], roofs = [];
  /* the lowest ground under a footprint, or null if any of it is in water */
  var footY = function (gx, gz, hx, hz) {
    var lo = 1e9;
    for (var q = 0; q < 5; q++) {
      var lx = q === 4 ? 0 : (q & 1 ? hx : -hx), lz = q === 4 ? 0 : (q & 2 ? hz : -hz);
      var w = C.toWorld(gx + lx, gz + lz), y = H(w[0], w[1]);
      if (P.waterY != null && y < P.waterY + 1) return null;
      lo = Math.min(lo, y);
    }
    return lo - 0.6;
  };
  /* Block by block on the grid, inside the city's ring: the middle of the
     ring carries the towers; its near and far edges stay lower. */
  var nb = Math.ceil(C.end / C.pitch) + 1;
  for (var bx = -nb; bx <= nb; bx++) for (var bz = -nb; bz <= 1; bz++) {
    var gx = bx * C.pitch, gz = bz * C.pitch, w = C.toWorld(gx, gz);
    var d = Math.sqrt(w[0] * w[0] + w[1] * w[1]);
    if (d < C.start || d > C.end || Math.abs(Math.atan2(w[0], -w[1])) > spread) continue;
    var f = (d - C.start) / (C.end - C.start), mid = 1.0 - Math.abs(f - 0.55) * 1.6;
    var tall = R.f() < (0.08 + mid * 0.42);
    var hgt = tall ? R.range(90, 260) * (0.6 + mid * 0.5) : R.range(18, 60);
    cityBlock(C, R, gx, gz, hgt, footY, items, roofs);
  }
  cityMesh(scene, P, R, U, items);
  buildRoofs(scene, P, R, U, roofs);
  /* street lamps through the city, and red lights on its tall roofs */
  cityStreets(scene, P, R, U, H, C, { reach: C.end, treeReach: C.start, trees: 0.7, beacons: cityBeacons(items) });
}

/* Red obstacle lights on the corners of every roof over 90 m. */
function cityBeacons(items) {
  var out = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    if (!it.beacon) continue;
    var top = it[1] + it[3] * it[5], hx = it[3] * 0.5 - 0.4, hz = it[3] * it[6] * 0.5 - 0.4;
    var c = Math.cos(it[4]), s = Math.sin(it[4]);
    for (var q = 0; q < 2; q++) {
      var lx = q ? hx : -hx, lz = q ? hz : -hz;
      out.push([it[0] + lx * c - lz * s, top + 0.6, it[2] + lx * s + lz * c, 2.0, 3.0, 0.24, 0.12, 1, 0]);
    }
  }
  return out;
}

/* the instanced block mesh, shared by the distant skyline and the view down
   from a tower. items[i] = [x, y, z, width, rot, h/w, d/w, seed, family,
   height of its base above the street, wall colour, glass colour] */
function cityMesh(scene, P, R, U, items) {
  var box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  if (!items.length) return;

  var geo = new THREE.InstancedBufferGeometry();
  geo.index = box.index;
  geo.setAttribute('position', box.attributes.position);
  geo.setAttribute('normal', box.attributes.normal);
  /* Nearest first: the view never moves, so drawn front to back the depth
     test throws away the hidden faces of everything behind before they are
     shaded. Unsorted, each pixel of a dense city was shaded several times. */
  items = items.slice().sort(function (p, q) { return (p[0] * p[0] + p[2] * p[2]) - (q[0] * q[0] + q[2] * q[2]); });
  var n = items.length;
  var iPos = new Float32Array(n * 3), iAttr = new Float32Array(n * 4), iInfo = new Float32Array(n * 4);
  var iCol = new Float32Array(n * 3), iGlass = new Float32Array(n * 3);
  for (var k = 0; k < n; k++) {
    var it = items[k];
    iPos[k * 3] = it[0]; iPos[k * 3 + 1] = it[1]; iPos[k * 3 + 2] = it[2];
    iAttr[k * 4] = it[3]; iAttr[k * 4 + 1] = it[4]; iAttr[k * 4 + 2] = it[5]; iAttr[k * 4 + 3] = it[6];
    iInfo[k * 4] = it[7]; iInfo[k * 4 + 1] = it[8]; iInfo[k * 4 + 2] = it[9]; iInfo[k * 4 + 3] = 0;
    iCol[k * 3] = it[10].r; iCol[k * 3 + 1] = it[10].g; iCol[k * 3 + 2] = it[10].b;
    iGlass[k * 3] = it[11].r; iGlass[k * 3 + 1] = it[11].g; iGlass[k * 3 + 2] = it[11].b;
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
  geo.setAttribute('iInfo', new THREE.InstancedBufferAttribute(iInfo, 4));
  geo.setAttribute('iCol', new THREE.InstancedBufferAttribute(iCol, 3));
  geo.setAttribute('iGlass', new THREE.InstancedBufferAttribute(iGlass, 3));
  geo.instanceCount = n;

  var S = App.skyU;
  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
      uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
      uNight: S.uNight, uZenith: S.uZenith, uCloudL: S.uCloudL, uCloudD: S.uCloudD,
      uLit: { value: new THREE.Color(R.pick(['#ffd9a0', '#ffe6bd', '#ffcf8a'])) },
      uCitySeed: { value: R.range(0, 100) }
    },
    extensions: { derivatives: true },
    vertexShader: [
      'attribute vec3 iPos; attribute vec4 iAttr; attribute vec4 iInfo; attribute vec3 iCol; attribute vec3 iGlass;',
      'uniform float uFogDensity;',
      'varying vec3 vN; varying vec3 vL; varying float vFog; varying vec3 vSize; varying vec3 vW;',
      'varying vec4 vInfo; varying vec3 vCol; varying vec3 vGlass;',
      GLSL_COMMON,
      'void main(){',
      '  float w = iAttr.x, rot = iAttr.y;',
      '  vec3 sz = vec3(w, w * iAttr.z, w * iAttr.w);',
      '  vec3 lp = position * sz;',
      '  float c = cos(rot), s2 = sin(rot);',
      '  vec3 wp = iPos + vec3(lp.x * c - lp.z * s2, lp.y, lp.x * s2 + lp.z * c);',
      '  vN = normalize(vec3(normal.x * c - normal.z * s2, normal.y, normal.x * s2 + normal.z * c));',
      '  vL = position; vSize = sz; vW = wp;',
      '  vInfo = iInfo; vCol = iCol; vGlass = iGlass;',
      '  vec4 mv = modelViewMatrix * vec4(wp, 1.0);',
      '  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform vec3 uSunDir, uSunCol, uAmbCol, uFogCol, uLit, uZenith, uCloudL, uCloudD;',
      'uniform float uNight, uTime, uShadow, uCitySeed;',
      'varying vec3 vN; varying vec3 vL; varying float vFog; varying vec3 vSize; varying vec3 vW;',
      'varying vec4 vInfo; varying vec3 vCol; varying vec3 vGlass;',
      'float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }',
      GLSL_COMMON,
      /* the sky in a pane: skyMirror's gradient with a single cloud tap,
         which is all a window can show and half the fetches over a city
         that fills the view */
      'vec3 skyRefl(vec3 r, vec3 sd){',
      '  float h = max(r.y, 0.0);',
      '  vec3 hor = horizonAt(r, uFogCol, sd);',
      '  vec3 s = mix(hor, uZenith, pow(h, 0.45));',
      '  float n = texture2D(uSkyCloud, r.xz / max(h, 0.08) * uSkyScale * 0.55 + uSkyOff).r;',
      '  float cov = smoothstep(uSkyCover, uSkyCover + uSkySoft, n) * uSkyOp * (1.0 - 0.6 * smoothstep(0.22, 0.03, h));',
      '  return mix(s, mix(uCloudL, uCloudD, 0.35), cov);',
      '}',
      'void main(){',
      '  vec3 sd = normalize(uSunDir), N = normalize(vN);',
      '  float isTop = step(0.5, N.y), wallK = 1.0 - isTop;',
      '  float seed = vInfo.x, type = vInfo.y, base = vInfo.z;',
      /* Sun and shadow. The bake stores, for each column of ground, the height
         below which the sun is hidden there (alpha), so a wall is lit from
         the top down as the shadow of the tower across the street climbs it.
         A wall reads the column just outside itself. */
      '  vec2 suv = (vW.xz + N.xz * 2.6 - uShadowOrigin) * uShadowScale;',
      '  float hsh = texture2D(uShadowMap, suv).a * 640.0 - 160.0;',
      '  vec2 se = smoothstep(vec2(0.0), vec2(0.02), suv) * (1.0 - smoothstep(vec2(0.98), vec2(1.0), suv));',
      '  float sunVis = mix(smoothstep(hsh - 1.5, hsh + 1.5, vW.y), smoothstep(hsh - 3.0, hsh - 0.8, vW.y), isTop);',
      '  sunVis = mix(1.0, sunVis, se.x * se.y);',
      '  float diff = max(dot(N, sd), 0.0);',
      '  float sh = mix(1.0 - uShadow, 1.0, cloudShade(vW.xz, uTime)) * mix(0.03, 1.0, sunVis);',
      /* the face: u across it, v up it, in metres */
      '  float side = step(abs(N.z), abs(N.x));',
      '  float u = mix(vL.x * vSize.x, vL.z * vSize.z, side), span = mix(vSize.x, vSize.z, side);',
      '  float v = vL.y * vSize.y, vs = v + base;',
      /* the family: storey, bay, glass width (half, of a bay), sill and head
         (of a storey), how much the glass reflects, corner margin. Storeys,
         lobby and parapet are the script's (CITY_FLOOR...), as cut. */
      '  float fh = ' + CITY_FLOOR[0].toFixed(2) + ', bay = 1.5, gx = 0.46, gy0 = 0.03, gy1 = 0.72, refl = 1.0, mar = 0.25;',
      '  if (type > 0.5 && type < 1.5) { fh = ' + CITY_FLOOR[1].toFixed(2) + '; bay = 2.7; gx = 0.25; gy0 = 0.28; gy1 = 0.87; refl = 0.30; mar = 0.8; }',
      '  else if (type > 1.5 && type < 2.5) { fh = ' + CITY_FLOOR[2].toFixed(2) + '; bay = 1.6; gx = 0.47; gy0 = 0.36; gy1 = 0.90; refl = 0.55; mar = 0.6; }',
      '  else if (type > 2.5 && type < 3.5) { fh = ' + CITY_FLOOR[3].toFixed(2) + '; bay = 2.9; gx = 0.21; gy0 = 0.24; gy1 = 0.86; refl = 0.28; mar = 1.0; }',
      '  else if (type > 3.5) fh = ' + CITY_FLOOR[4].toFixed(2) + ';',
      '  float plant = step(3.5, type);',
      /* storeys over a lobby on the street, under a parapet; a whole number
         of bays across, so the corners are solid */
      '  float lob = base < 0.5 ? ' + CITY_LOBBY.toFixed(2) + ' : 0.0;',
      '  float fv = (v - lob) / fh, fl = floor(fv), fy = fract(fv);',
      '  float inF = step(0.0, v - lob) * step(v, vSize.y - ' + CITY_PARAPET.toFixed(2) + ');',
      '  float usable = span - 2.0 * mar, nb = max(1.0, floor(usable / bay));',
      '  float cu = (u + 0.5 * span - mar) / usable * nb, ci = floor(cu), fx = fract(cu);',
      '  float inC = step(0.0, cu) * step(cu, nb);',
      '  float fwc = fwidth(cu), fwv = fwidth(fv);',
      '  float kW = 1.0 - smoothstep(0.35, 0.9, max(fwc, fwv));',
      '  float gM = bandAA(fx, 0.5 - gx, 0.5 + gx, fwc) * bandAA(fy, gy0, gy1, fwv) * inF * inC;',
      /* the lobby: shopfronts glazed nearly floor to ceiling, or a stone base
         with smaller openings */
      '  float lb = step(v, lob);',
      '  float lcu = (u + 0.5 * span) / 4.2, lv = v / max(lob, 0.1);',
      '  float stone = step(2.5, type) * (1.0 - plant);',
      '  float lG = bandAA(fract(lcu), mix(0.07, 0.22, stone), mix(0.93, 0.78, stone), fwidth(lcu)) * bandAA(lv, 0.04, mix(0.82, 0.70, stone), fwidth(lv));',
      '  gM = mix(gM, lG, lb) * (1.0 - plant);',
      /* the wall itself */
      '  vec3 wc = vCol;',
      '  wc *= 1.0 - 0.16 * bandAA(fract(vs / 0.62), 0.0, 0.07, fwidth(vs) / 0.62) * stone;',
      '  wc *= 1.0 + 0.10 * bandAA(fy, 0.0, 0.08, fwv) * inF * (1.0 - plant);',
      '  float su = u * 1.3 + seed * 17.0;',
      '  wc *= 1.0 + (0.10 * h21(vec2(floor(su), seed)) - 0.05) * (1.0 - smoothstep(0.3, 0.85, fwidth(su)));',
      '  wc *= 1.0 - 0.28 * plant * bandAA(fract(v / 0.25), 0.55, 0.92, fwidth(v) / 0.25);',
      '  wc *= mix(1.0, 0.78, lb * stone);',
      /* a pale sill under each punched window */
      '  float punched = step(0.5, type) * step(type, 1.5) + stone;',
      '  wc *= 1.0 + 0.32 * punched * bandAA(fy, gy0 - 0.05, gy0 - 0.005, fwv) * bandAA(fx, 0.5 - gx - 0.04, 0.5 + gx + 0.04, fwc) * inF * inC;',
      '  wc *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.6, vs));',          /* the damp foot */
      '  wc *= 1.0 + 0.22 * step(vSize.y - 0.35, v);',                   /* coping on the parapet */
      /* the roof: membrane or gravel, darker toward the parapet */
      '  vec2 rq = vL.xz * vSize.xz;',
      '  float edge = min(0.5 * vSize.x - abs(rq.x), 0.5 * vSize.z - abs(rq.y));',
      '  vec3 roof = mix(vec3(0.34, 0.34, 0.33), vec3(0.23, 0.24, 0.25), h21(vec2(seed * 31.0, 2.0))) * (0.78 + 0.22 * smoothstep(0.2, 1.6, edge));',
      '  vec3 alb = mix(wc, roof, isTop) * (1.0 - 0.22 * uWet * (1.0 + isTop));',
      /* lit by the sky and the ground's bounce; a street between tall walls
         sees less sky */
      '  float canyon = mix(mix(0.62, 1.0, smoothstep(0.0, 30.0, vs)), 1.0, isTop);',
      '  vec3 cW = alb * (hemi(N, uAmbCol * 1.15) * canyon + uSunCol * diff * 1.05 * sh);',
      /* Glass. Fresnel on the face's own normal; it mirrors the sky (gradient
         and clouds) along the reflected ray, below that the towers across the
         way as a band of hazy dark shapes, and the street; a glint of sun.
         A curtain wall is coated and reflects at any angle, a punched window
         much less. */
      '  vec3 V = normalize(cameraPosition - vW), Rf = reflect(-V, N);',
      '  float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);',
      '  float F0 = mix(0.05, 0.34, refl), Fk = F0 + (1.0 - F0) * F * mix(0.6, 1.0, refl);',
      '  vec3 sky = skyRefl(Rf, sd);',
      '  float az = atan(Rf.z, Rf.x) * 22.0 + seed * 40.0;',
      '  float kA = 1.0 - smoothstep(0.3, 0.9, fwidth(az));',
      '  float bh = mix(0.12, 0.03 + 0.20 * h21(vec2(floor(az), 7.0)), kA);',
      /* the towers across the way: lit faces and shaded ones, hazed */
      '  float shade = mix(0.75, 0.45 + 0.8 * h21(vec2(floor(az), 3.0)), kA);',
      '  vec3 across = mix(hemi(vec3(0.0, 0.3, 0.0), uAmbCol) * 0.55 + uSunCol * 0.18, uFogCol * 0.8, 0.40) * shade;',
      '  vec3 rfl = mix(sky, across, (1.0 - smoothstep(bh - 0.02, bh + 0.02, Rf.y)) * 0.85);',
      '  rfl = mix(rfl, uGroundCol * 0.6 + uFogCol * 0.12, smoothstep(-0.25, -0.55, Rf.y));',
      '  rfl += uSunCol * pow(max(dot(Rf, sd), 0.0), 240.0) * 6.0 * sh;',
      /* behind the glass: a dark room, blinds drawn part way on some panes,
         lighter low down where the floor takes the daylight */
      '  vec2 cell = vec2(ci + side * 517.0, fl) + floor(seed * 911.0);',
      '  float r1 = h21(cell + uCitySeed), r2 = h21(cell * 1.71 + 3.1 + uCitySeed), r3 = h21(cell * 0.37 + 9.7);',
      '  float iy = clamp((fy - gy0) / max(gy1 - gy0, 0.05), 0.0, 1.0);',
      '  float aL = dot(uAmbCol, vec3(0.3, 0.59, 0.11));',
      '  float blind = r2 < 0.55 ? r2 * 1.1 : 0.0;',
      '  float onBlind = step(1.0 - blind, iy) * (1.0 - lb);',
      '  vec3 room = vGlass * aL * (0.30 + 0.45 * (1.0 - iy)) + vec3(0.04, 0.042, 0.045) * aL;',
      '  room = mix(room, vec3(0.62, 0.60, 0.56) * aL * 0.55, onBlind);',
      '  room = mix(vGlass * aL * 0.5 + vec3(0.04) * aL + vec3(0.62, 0.60, 0.56) * aL * 0.15, room, kW);',
      /* At night the rooms light up: offices a floor at a time, mostly
         fluorescent white; homes window by window, warm, now and then the
         blue of a television. A few change over the hour. Past the band
         limit, the share lit at the average colour. */
      '  float office = step(type, 0.5) + step(1.5, type) * step(type, 2.5);',
      '  float rF = h21(vec2(fl + side * 31.0, seed * 13.0) + uCitySeed);',
      '  float flick = step(0.5, fract(r1 * 91.0 + floor(uTime / 47.0 + r1 * 13.0) * 0.5));',
      '  float litW = mix(step(0.62, r1) * mix(1.0, flick, 0.35), step(0.55, rF) * step(0.12, r1), office);',
      '  litW = mix(litW, step(0.3, r1), lb);',
      '  vec3 lc = office > 0.5 ? (r3 < 0.68 ? vec3(0.86, 0.93, 1.0) : (r3 < 0.9 ? vec3(0.96, 0.98, 1.0) : vec3(1.0, 0.80, 0.55)))',
      '                        : (r3 < 0.55 ? vec3(1.0, 0.64, 0.34) : (r3 < 0.86 ? vec3(1.0, 0.78, 0.52) : vec3(0.88, 0.93, 1.0)));',
      '  float tv = (1.0 - office) * step(0.965, r2) * (1.0 - lb);',
      '  lc = mix(lc, vec3(0.45, 0.58, 1.0) * (0.65 + 0.35 * sin(uTime * 7.3 + r1 * 40.0) * sin(uTime * 2.9 + r2 * 17.0)), tv);',
      '  lc *= (0.6 + 0.6 * r2) * mix(1.0, 0.7, onBlind);',
      '  float share = mix(0.36, 0.40, office);',
      '  vec3 lAvg = mix(vec3(1.0, 0.74, 0.48), vec3(0.9, 0.94, 1.0), office) * 0.9;',
      '  litW = mix(share, litW, kW); lc = mix(lAvg, lc, kW);',
      '  float dim = 1.0 - smoothstep(0.25, 0.80, dot(uSunCol, vec3(0.30, 0.59, 0.11)));',
      '  float glow = max(uNight, dim * 0.30);',
      '  vec3 inside = mix(room, lc * 1.5, litW * glow);',
      '  vec3 glass = inside * (1.0 - Fk) + rfl * Fk;',
      /* a curtain wall's spandrels are glass too, with nothing lit behind */
      '  cW = mix(cW, cW * 0.6 + rfl * Fk * 0.8, step(type, 0.5) * wallK);',
      '  vec3 c = mix(cW, glass, gM * wallK);',
      /* lamps in the street wash the foot of the walls with warm light */
      '  c += alb * uLit * 0.30 * uNight * (1.0 - smoothstep(0.0, 10.0, vs)) * wallK;',
      '  gl_FragColor = vec4(mix(c, hazeAt(uFogCol, normalize(vW - cameraPosition), sd, uSunCol, vFog), vFog), 1.0);',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
  });
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.userData.noTrim = true;              /* nearest first: trimming dropped the far towers whole */
  scene.add(m);
  App.propMeshes.push(m);
}


