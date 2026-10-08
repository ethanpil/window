/* ---------- cacti, built as actual geometry ----------
   A saguaro is a ribbed column with arms that elbow out and turn up. Painted on
   a flat billboard it always reads as cardboard, so these are real tubes. */
/* Mark the vertices from start on as a round surface, for finishGeo's weld. */
function markSmooth(B, start) { (B.sm || (B.sm = [])).push(start, B.pos.length / 3); }
function pushTube(B, path, radii, seg, ribs) {
  var start = B.pos.length / 3, i, j;
  var rn = ribs ? ribs.n : 0, ra = ribs ? ribs.amp : 0;
  /* A flute the ring cannot resolve aliases into a coarser, faceted one: 16
     ribs read round a ring of 24 come back as 8 hard lobes. Carry enough
     samples for the ribs asked for. */
  if (rn) seg = Math.min(64, Math.max(seg, rn * 4));
  var ref = new THREE.Vector3(1, 0, 0);
  var T = new THREE.Vector3(), N = new THREE.Vector3(), Bi = new THREE.Vector3(), prev = null;
  for (i = 0; i < path.length; i++) {
    var a = path[Math.max(i - 1, 0)], b = path[Math.min(i + 1, path.length - 1)];
    T.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    if (T.lengthSq() < 1e-9) T.set(0, 1, 0);
    T.normalize();
    if (prev) {
      /* Carry the frame along the path. Built afresh from a fixed axis it
         swings through 140 degrees in one ring where a limb turns from level
         to upright, which shears the tube apart at the elbow. */
      N.copy(prev).addScaledVector(T, -prev.dot(T));
      if (N.lengthSq() < 1e-10) { ref.set(Math.abs(T.y) > 0.94 ? 1 : 0, Math.abs(T.y) > 0.94 ? 0 : 1, 0); N.crossVectors(ref, T); }
    } else {
      ref.set(Math.abs(T.y) > 0.94 ? 1 : 0, Math.abs(T.y) > 0.94 ? 0 : 1, 0);
      N.crossVectors(ref, T);
    }
    N.normalize();
    Bi.crossVectors(T, N).normalize();
    prev = (prev || new THREE.Vector3()).copy(N);
    /* the ring closes on a repeated vertex, as pushCyl does, so the stripe
       coordinate can reach 1 instead of falling back to 0 across the last
       face and running the whole bark pattern backwards down one seam */
    for (j = 0; j <= seg; j++) {
      var ang = (j / seg) * 6.283185;
      var cx = Math.cos(ang), sy = Math.sin(ang);
      var nx = N.x * cx + Bi.x * sy, ny = N.y * cx + Bi.y * sy, nz = N.z * cx + Bi.z * sy;
      var rr = radii[i] * (rn ? (1 + ra * Math.cos(rn * ang)) : 1);
      B.pos.push(path[i][0] + nx * rr, path[i][1] + ny * rr, path[i][2] + nz * rr);
      B.nor.push(nx, ny, nz);
      B.rib.push(j / seg);
    }
  }
  var ring = seg + 1;
  for (i = 0; i < path.length - 1; i++) {
    for (j = 0; j < seg; j++) {
      var j2 = j + 1;
      var r0 = start + i * ring, r1 = start + (i + 1) * ring;
      B.idx.push(r0 + j, r1 + j, r0 + j2);
      B.idx.push(r0 + j2, r1 + j, r1 + j2);
    }
  }
  markSmooth(B, start);
}

/* a straight or curved limb with a domed top */
function limbPath(from, to, ctrl, radius, steps) {
  var path = [], radii = [], i;
  for (i = 0; i <= steps; i++) {
    var t = i / steps, mt = 1 - t;
    path.push([
      mt * mt * from[0] + 2 * mt * t * ctrl[0] + t * t * to[0],
      mt * mt * from[1] + 2 * mt * t * ctrl[1] + t * t * to[1],
      mt * mt * from[2] + 2 * mt * t * ctrl[2] + t * t * to[2]
    ]);
    radii.push(radius * (1 - 0.12 * t));
  }
  /* dome the tip */
  var tip = path[path.length - 1], prev = path[path.length - 2];
  var dx = tip[0] - prev[0], dy = tip[1] - prev[1], dz = tip[2] - prev[2];
  var dl = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
  dx /= dl; dy /= dl; dz /= dl;
  var rEnd = radii[radii.length - 1];
  for (i = 1; i <= 4; i++) {
    var u = i / 4;
    path.push([tip[0] + dx * rEnd * u, tip[1] + dy * rEnd * u, tip[2] + dz * rEnd * u]);
    radii.push(rEnd * Math.sqrt(Math.max(1 - u * u, 0.0001)));
  }
  return { path: path, radii: radii };
}

function finishGeo(B) {
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
  geo.setAttribute('rib', new THREE.Float32BufferAttribute(B.rib, 1));
  geo.setIndex(B.idx);
  geo.computeVertexNormals();
  /* A ring closes on a repeated vertex, so its seam carried two normals, one
     from the faces either side, and the light creased down every trunk,
     lighthouse and silo along it. Average the normals of vertices that share
     a position where they nearly agree -- but only on round surfaces (B.sm:
     the vertex ranges pushTube, pushCyl and a many-sided pushCone mark).
     Welding by angle alone rounded off the hips of a roof, a pagoda's eaves
     and a barn's ridge, which meet at under sixty degrees. */
  var nor = geo.attributes.normal.array, src = nor.slice(), pos = B.pos, groups = {}, i, a, b;
  var sm = new Uint8Array(pos.length / 3), rs = B.sm || [];
  for (i = 0; i < rs.length; i += 2) for (a = rs[i]; a < rs[i + 1]; a++) sm[a] = 1;
  for (i = 0; i < pos.length; i += 3) {
    if (!sm[i / 3]) continue;
    var key = Math.round(pos[i] * 2e4) + ',' + Math.round(pos[i + 1] * 2e4) + ',' + Math.round(pos[i + 2] * 2e4);
    (groups[key] || (groups[key] = [])).push(i);
  }
  for (var k in groups) {
    var g = groups[k];
    if (g.length < 2) continue;
    for (a = 0; a < g.length; a++) {
      var ia = g[a], sx = 0, sy = 0, sz = 0;
      for (b = 0; b < g.length; b++) {
        var ib = g[b];
        if (src[ia] * src[ib] + src[ia + 1] * src[ib + 1] + src[ia + 2] * src[ib + 2] < 0.5) continue;
        sx += src[ib]; sy += src[ib + 1]; sz += src[ib + 2];
      }
      var l = Math.sqrt(sx * sx + sy * sy + sz * sz) || 1;
      nor[ia] = sx / l; nor[ia + 1] = sy / l; nor[ia + 2] = sz / l;
    }
  }
  return geo;
}

/* Five things that actually grow in a desert, each with its own shape: the
   pleated column, the squat barrel, the flat pads, the rosette of blades, the
   whip-stemmed ocotillo. The ribs are geometry, so light catches them. */
var CACTI = {
  /* Grey-olive, as cacti are in a dry land: a waxy bloom and dust over the
     green. Saturated green read as plastic. */
  saguaro:  { body: '#6b7a5c', spine: '#e6dcbc', ribs: 18, spines: 1.0, tip: null, w: 5 },
  barrel:   { body: '#76804c', spine: '#d29a3c', ribs: 20, spines: 1.6, tip: '#b8662f', tipMix: 0.35, w: 3 },
  pear:     { body: '#6a7c5b', spine: '#e6dcbc', ribs: 0,  spines: 0.7, tip: null, w: 4 },
  agave:    { body: '#768f86', spine: '#bfa88a', ribs: 0,  spines: 0.0, tip: '#4a2f22', tipMix: 0.55, w: 3 },
  ocotillo: { body: '#6a6150', spine: '#a89878', ribs: 0,  spines: 0.4, tip: '#c9402a', tipMix: 0.7, w: 2 },
  cholla:   { body: '#9a9b7c', spine: '#efe8d2', ribs: 6,  spines: 2.2, tip: null, w: 2 }
};
/* A saguaro in metres, Hs tall. It is a column a third to two thirds of a
   metre thick whatever its height (so a young one is stout and an old one
   slender), a lone spear until it is three or four metres tall, then one or
   two arms, and an old giant two to five; arms never start lower than about
   two and a half metres. */
/* is x, z inside the near caster map (NEAR), with room for a shadow? */
function inNear(x, z) { return x > NEAR.x0 + 3 && x < NEAR.x1 - 3 && z > NEAR.z0 + 6 && z < NEAR.z1; }
function saguaroTemplate(S, Hs) {
  var B = { pos: [], nor: [], idx: [], rib: [] }, k, caps = [];
  var r = clamp(0.15 + Hs * 0.011, 0.16, 0.3) * S.range(0.9, 1.1);
  var lean = S.range(-0.03, 0.03) * Hs;
  var trunk = limbPath([0, -0.15, 0], [lean, Hs - r, 0], [lean * 0.2, Hs * 0.5, 0], r, 9);
  for (k = 0; k < 10; k++) { var t = k / 9; trunk.radii[k] *= (1 + 0.16 * Math.exp(-t * 12)) * (1 + 0.06 * Math.sin(t * 3.14)); }
  pushTube(B, trunk.path, trunk.radii, 32, { n: 18, amp: 0.05 });
  caps.push([0, 0, 0, lean, Hs - r * 0.5, 0, r]);
  var arms = Hs < 3.6 ? 0 : (Hs < 7 ? S.int(1, 2) : S.int(2, 5)), az = S.range(0, 6.283);
  for (var a = 0; a < arms; a++) {
    var th = az + a * (6.283 / Math.max(arms, 2)) + S.range(-0.6, 0.6);
    var y0 = Math.min(S.range(Math.max(2.5, Hs * 0.36), Math.max(2.6, Hs * 0.66)), Hs - 1.4);
    var reach = S.range(0.35, 0.7), rise = S.range(0.9, Math.max(1.0, Math.min(3.4, Hs - y0 + 0.6)));
    var ex = Math.cos(th) * reach, ez = Math.sin(th) * reach, ar = r * S.range(0.66, 0.82);
    var path = [], radii = [];
    for (k = 0; k <= 5; k++) { var u = k / 5; path.push([ex * 0.15 + ex * 0.85 * Math.sin(u * 1.5708), y0 + reach * 0.45 * (1 - Math.cos(u * 1.5708)), ez * 0.15 + ez * 0.85 * Math.sin(u * 1.5708)]); radii.push(ar); }
    var up = limbPath([ex, y0 + reach * 0.45, ez], [ex * 1.05, y0 + reach * 0.45 + rise, ez * 1.05], [ex, y0 + reach * 0.45 + rise * 0.5, ez], ar, 5);
    for (k = 1; k < up.path.length; k++) { path.push(up.path[k]); radii.push(up.radii[k]); }
    pushTube(B, path, radii, 24, { n: 14, amp: 0.05 });
    caps.push([ex * 0.15, y0, ez * 0.15, ex, y0 + reach * 0.45, ez, ar]);
    caps.push([ex, y0 + reach * 0.45, ez, ex * 1.05, y0 + reach * 0.45 + rise, ez * 1.05, ar]);
  }
  var geo = finishGeo(B);
  geo.userData.caps = caps;     /* its limbs as capsules, for the near shadows */
  return geo;
}
function cactusTemplate(R, kind) {
  var B = { pos: [], nor: [], idx: [], rib: [] };
  var a, th, k;
  if (kind === 'saguaro') {
    var h = R.range(0.72, 1.0), r = R.range(0.058, 0.082);
    var trunk = limbPath([0, -0.06, 0], [0, h, 0], [R.range(-0.02, 0.02), h * 0.5, 0], r, 7);
    for (k = 0; k < trunk.radii.length; k++) { var t = k / (trunk.radii.length - 1); trunk.radii[k] *= (1 + 0.35 * Math.exp(-t * 10)) * (1 + 0.12 * Math.sin(t * 3.14)); }
    pushTube(B, trunk.path, trunk.radii, 24, { n: 16, amp: 0.085 });
    var arms = R.int(0, 4), az = R.range(0, 6.283);
    for (a = 0; a < arms; a++) {
      th = az + a * (6.283 / Math.max(arms, 2)) + R.range(-0.5, 0.5);
      var y0 = h * R.range(0.28, 0.58), reach = R.range(0.14, 0.24), rise = R.range(0.22, 0.46);
      var ex = Math.cos(th) * reach, ez = Math.sin(th) * reach;
      var ar = r * R.range(0.62, 0.82);
      /* a rounded elbow out, then straight up, then a dome */
      var path = [], radii = [];
      for (k = 0; k <= 5; k++) { var u = k / 5; path.push([ex * 0.15 + (ex - ex * 0.15) * Math.sin(u * 1.5708), y0 + reach * 0.35 * (1 - Math.cos(u * 1.5708)), ez * 0.15 + (ez - ez * 0.15) * Math.sin(u * 1.5708)]); radii.push(ar); }
      var up = limbPath([ex, y0 + reach * 0.35, ez], [ex, y0 + reach * 0.35 + rise, ez], [ex, y0 + reach * 0.35 + rise * 0.5, ez], ar, 4);
      for (k = 1; k < up.path.length; k++) { path.push(up.path[k]); radii.push(up.radii[k]); }
      pushTube(B, path, radii, 20, { n: 13, amp: 0.085 });
    }
  } else if (kind === 'barrel') {
    var bh = R.range(0.42, 0.7), br = R.range(0.22, 0.34);
    var bp = [], brd = [];
    for (k = 0; k <= 8; k++) { var t2 = k / 8; bp.push([0, -0.04 + bh * t2, 0]); brd.push(br * Math.sin(0.25 + t2 * 2.55) * (t2 < 0.15 ? 0.75 + t2 * 1.7 : 1)); }
    brd[8] = br * 0.18;
    pushTube(B, bp, brd, 26, { n: 20, amp: 0.10 });
  } else if (kind === 'pear') {
    var pads = R.int(4, 9);
    var padAt = function (x, y, z, ang, tilt, size) {
      var pth = [], prd = [];
      for (k = 0; k <= 6; k++) {
        var t3 = k / 6;
        pth.push([x + Math.cos(ang) * Math.sin(tilt) * t3 * size, y + Math.cos(tilt) * t3 * size, z + Math.sin(ang) * Math.sin(tilt) * t3 * size]);
        prd.push(size * 0.42 * Math.sin(t3 * 3.14159) + 0.012);
      }
      pushTube(B, pth, prd, 18, { n: 2, amp: 0.62 });
      return pth[pth.length - 1];
    };
    for (a = 0; a < pads; a++) {
      var pa = R.range(0, 6.283), sz = R.range(0.22, 0.34);
      var tip = padAt(0, 0.02, 0, pa, R.range(0.25, 0.75), sz);
      if (R.f() < 0.55) padAt(tip[0], tip[1], tip[2], pa + R.range(-0.9, 0.9), R.range(0.1, 0.6), sz * R.range(0.7, 0.95));
    }
  } else if (kind === 'agave') {
    var blades = R.int(12, 20);
    for (a = 0; a < blades; a++) {
      th = a * 6.283 / blades + R.range(-0.15, 0.15);
      var lean = R.range(0.35, 1.05), len = R.range(0.36, 0.56);
      var pth2 = [], prd2 = [];
      for (k = 0; k <= 6; k++) {
        var t4 = k / 6;
        pth2.push([Math.cos(th) * Math.sin(lean) * t4 * len, 0.03 + Math.cos(lean) * t4 * len - t4 * t4 * 0.05, Math.sin(th) * Math.sin(lean) * t4 * len]);
        prd2.push(0.058 * (1 - t4) * (1 - t4 * 0.3) + 0.003);
      }
      pushTube(B, pth2, prd2, 10, { n: 2, amp: 0.45 });
    }
  } else if (kind === 'ocotillo') {
    var stems = R.int(7, 13);
    for (a = 0; a < stems; a++) {
      th = a * 6.283 / stems + R.range(-0.3, 0.3);
      var splay = R.range(0.18, 0.42), tall = R.range(0.9, 1.4);
      var wh = limbPath([Math.cos(th) * 0.04, -0.02, Math.sin(th) * 0.04], [Math.cos(th) * splay, tall, Math.sin(th) * splay],
        [Math.cos(th) * splay * 0.35, tall * 0.55, Math.sin(th) * splay * 0.35], 0.014, 8);
      pushTube(B, wh.path, wh.radii, 6);
    }
  } else {
    var ct = limbPath([0, -0.04, 0], [0, 0.42, 0], [0, 0.2, 0], 0.045, 4);
    pushTube(B, ct.path, ct.radii, 10, { n: 6, amp: 0.15 });
    var joints = R.int(9, 16);
    for (a = 0; a < joints; a++) {
      th = R.range(0, 6.283);
      var jy = R.range(0.22, 0.42), jr = R.range(0.12, 0.26), jl = R.range(0.14, 0.26);
      var jp = limbPath([Math.cos(th) * 0.03, jy, Math.sin(th) * 0.03],
        [Math.cos(th) * jr, jy + jl, Math.sin(th) * jr], [Math.cos(th) * jr * 0.5, jy + jl * 0.3, Math.sin(th) * jr * 0.5], 0.035, 4);
      pushTube(B, jp.path, jp.radii, 8, { n: 6, amp: 0.18 });
    }
  }
  return finishGeo(B);
}

function solidMat(U, colour, opts) {
  opts = opts || {};
  /* opts.facade = { kind, win, bay, roof, doorW, doorH, round }: walls drawn as
     a building's. kind 0 vertical boards, 1 log courses, 2 render, 3 coursed
     stone, 4 brick, 5 corrugated sheet. Lengths in metres in the object's own
     frame; the trim part (rib 1) is the roof. See the grain 4 branch below. */
  var fac = opts.facade || {};
  return new THREE.ShaderMaterial({
    extensions: { derivatives: true },
    uniforms: {
      uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
      uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
      uBody: { value: new THREE.Color(colour) },
      uSpine: { value: new THREE.Color(opts.spineCol || '#e8dfb4') },
      uRib: { value: opts.rib == null ? 1 : opts.rib },
      uRibN: { value: opts.ribN || 16 },
      uSpines: { value: opts.spines || 0 },
      uTipCol: { value: new THREE.Color(opts.tipCol || '#000000') },
      uTipMix: { value: opts.tipMix || 0 },
      uBody2: { value: new THREE.Color(opts.body2 || colour) },
      uBarkN: { value: opts.barkN || 18 },
      uBarkPlate: { value: opts.barkPlate || 5.0 },
      uLichen: { value: new THREE.Color(opts.lichen || '#8f9a3c') },
      /* dry country: desert varnish and bedding instead of lichen */
      uVarn: { value: opts.varnish ? 1 : 0 },
      uNodes: { value: opts.nodes || 0 },
      uGrain: { value: opts.facade ? 4 : (opts.grain || 0) },
      uSpin: { value: opts.spin || 0 },
      uAoH: { value: opts.aoH == null ? 0.35 : opts.aoH },
      uTwoTone: { value: opts.twoTone ? 1 : 0 },
      /* 1: stands high above the ground under it (a bridge): see bakedSun */
      uLift: { value: opts.lift ? 1 : 0 },
      /* a painted line this many metres wide across z: it fades toward body2
         (the surface it is painted on) as it narrows past a pixel */
      uThin: { value: opts.thin || 0 },
      /* facade (grain 4): [cladding, share of bays with a window, bay width m,
         roof 0 tiles / 1 corrugated] and [door width m, door height m, round] */
      uFac: { value: new THREE.Vector4(fac.kind || 0, fac.win || 0, fac.bay || 2.6, fac.roof || 0) },
      uFac2: { value: new THREE.Vector3(fac.doorW || 0, fac.doorH || 2.1, fac.round ? 1 : 0) }
    },
    vertexShader: GLSL['solid.vert'],
    fragmentShader: GLSL['solid.frag']
  });
}

function instanceSolid(scene, tpl, items, mat) {
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = tpl.index;
  geo.setAttribute('position', tpl.attributes.position);
  geo.setAttribute('normal', tpl.attributes.normal);
  geo.setAttribute('rib', tpl.attributes.rib);
  var iPos = new Float32Array(items.length * 3);
  var iAttr = new Float32Array(items.length * 4);
  for (var i = 0; i < items.length; i++) {
    iPos[i * 3] = items[i][0]; iPos[i * 3 + 1] = items[i][1]; iPos[i * 3 + 2] = items[i][2];
    iAttr[i * 4] = items[i][3];
    iAttr[i * 4 + 1] = items[i][4];
    iAttr[i * 4 + 2] = items[i][5] == null ? 1 : items[i][5];
    iAttr[i * 4 + 3] = items[i][6] == null ? 1 : items[i][6];
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
  geo.instanceCount = items.length;
  geo.userData.tips = tpl.userData && tpl.userData.tips;
  geo.userData.shape = tpl.userData && tpl.userData.shape;
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  /* never thinned by the quality governor (applyQuality): a house, a pole,
     a wall's stone, a tower's tank, a rock each has its shadow baked and
     often a partner mesh (the pole's wires, the trunk's crown), so dropping
     the tail of the list left wires on nothing and shadows of nothing */
  m.userData.noTrim = true;
  scene.add(m);
  App.propMeshes.push(m);
  return m;
}

