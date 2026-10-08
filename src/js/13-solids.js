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
    vertexShader: [
      'attribute vec3 iPos; attribute vec4 iAttr; attribute float rib;',
      'uniform float uTime, uFogDensity, uShadow, uSpin, uAoH, uLift;',
      'uniform vec3 uSunDir, uSunCol, uAmbCol, uBody, uFogCol;',
      'varying vec3 vCol; varying float vRib; varying float vUp; varying float vSeed; varying vec3 vLocal; varying vec3 vNrm;',
      'varying vec3 vWp; varying vec3 vHaze; varying float vFogF; varying vec3 vMet; varying vec3 vNl; varying vec2 vToCam;',
      GLSL_COMMON,
      'void main(){',
      '  float sc = iAttr.x, rot = iAttr.y;',
      '  float c = cos(rot), s = sin(rot);',
      '  vec3 lp = position * vec3(sc, sc * iAttr.z, sc * iAttr.w);',
      '  float hM = lp.y;',                   /* metres above the object's base */
      '  vec3 nl = normal;',
      /* a turning part spins about its own z before it is placed, so a set of
         windmill sails keeps its hub while it goes round */
      '  if (uSpin != 0.0) {',
      '    float sa = uSpin * uTime, cs = cos(sa), ss = sin(sa);',
      '    lp.xy = vec2(lp.x * cs - lp.y * ss, lp.x * ss + lp.y * cs);',
      '    nl.xy = vec2(nl.x * cs - nl.y * ss, nl.x * ss + nl.y * cs);',
      '  }',
      '  vec3 wp = iPos + vec3(lp.x * c - lp.z * s, lp.y, lp.x * s + lp.z * c);',
      '  vec3 n = normalize(vec3(nl.x * c - nl.z * s, nl.y, nl.x * s + nl.z * c));',
      '  vec2 bk = bakedRG(wp.xz);',
      /* contact darkening at the foot, in metres, so a house and a cactus get
         the same thin band instead of a third of their height. It is the sky
         that the ground hides, so it dims the ambient only, never the sun. */
      '  float ao = (uSpin != 0.0 || uAoH <= 0.0) ? 1.0 : mix(0.55, 1.0, smoothstep(0.0, uAoH, hM));',
      /* Ambient light carried no direction, so anything the sun did not reach
         came out evenly lit: a trunk read as a flat plank. Sky above, the
         ground's bounce below: a shaded side is lit cool from the sky, an
         underside dimly by the ground, and no sun reaches round the back. */
      /* the sun and its shadows are worked out per pixel (fragment), so a
         big wall or roof is not lit from its corners */
      '  vCol = uBody * hemi(n, uAmbCol * 1.1) * ao * mix(1.0, bk.y, 0.6 * (1.0 - uLift));',
      '  vCol *= 1.0 - 0.25 * uWet;',
      '  vRib = rib; vUp = position.y; vSeed = iAttr.y; vLocal = position; vNrm = n; vWp = wp; vMet = lp; vNl = nl;',
      /* which way the camera lies in the object's own frame: a round wall
         measures its courses round from there, so the seam where the angle
         wraps is on the far side */
      '  vec2 tc = cameraPosition.xz - iPos.xz;',
      '  vToCam = normalize(vec2(tc.x * c + tc.y * s, tc.y * c - tc.x * s) + vec2(1e-5, 0.0));',
      '  vec4 mv = modelViewMatrix * vec4(wp, 1.0);',
      '  float fH = fogAmtH(-mv.z, uFogDensity, wp.y);',
      '  vFogF = fH; vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, fH);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform vec3 uSpine, uTipCol, uBody2, uLichen, uBody; uniform float uRib, uNodes, uGrain, uRibN, uSpines, uTipMix, uBarkN, uBarkPlate, uTwoTone, uVarn;',
      'uniform vec3 uSunDir, uSunCol; uniform float uShadow, uTime, uLift, uThin;',
      GLSL_COMMON,
      /* A computed pattern has no mip chain, so once its stripes are finer than
         a pixel it turns to moire. This measures how fast the pattern's own
         coordinate moves per pixel and fades the pattern out as it nears that
         limit, which is what a mip-map would have done for a texture. */
      'float bandLimit(float x, float freq){ float w = fwidth(x) * freq; return 1.0 - smoothstep(0.30, 0.85, w); }',
      'varying vec3 vCol; varying float vRib; varying float vUp; varying float vSeed; varying vec3 vLocal; varying vec3 vNrm;',
      'varying vec3 vWp; varying vec3 vHaze; varying float vFogF; varying vec3 vMet; varying vec3 vNl; varying vec2 vToCam;',
      'uniform vec4 uFac; uniform vec3 uFac2;',
      'float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }',
      /* smooth value noise: a hash alone is constant across its cell, which
         is what made lichen come out as flat squares */
      'float vn3(vec3 p){',
      '  vec3 i = floor(p), f = fract(p);',
      '  f = f * f * (3.0 - 2.0 * f);',
      '  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),',
      '             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);',
      '}',
      'void main(){',
      '  float diff = max(dot(normalize(vNrm), normalize(uSunDir)), 0.0);',
      '  float sh = mix(1.0 - uShadow, 1.0, cloudShade(vWp.xz, uTime)) * mix(0.03, 1.0, bakedSun(vWp, uLift));',
      '  vec3 c = mix(vCol + uBody * uSunCol * diff * 1.15 * sh * (1.0 - 0.25 * uWet), vHaze, vFogF);',
      '  vec3 litC = c;',
      /* a roof, a cap, a set of tyres: parts marked as trim take the second
         colour, keeping the light already worked out for them */
      '  if (uTwoTone > 0.5) c *= mix(vec3(1.0), uBody2 / max(uBody, vec3(0.02)), step(0.5, vRib));',
      '  if (uThin > 0.0) c *= mix(uBody2 / max(uBody, vec3(0.02)), vec3(1.0), clamp(uThin / max(fwidth(vWp.z), 1e-4), 0.0, 1.0));',
      '  float rr = vRib * 6.2832 * uRibN;',
      '  float kRib = bandLimit(vRib, uRibN);',
      '  if (uRib > 0.01) c *= 1.0 + 0.16 * uRib * cos(rr) * kRib;',
      '  if (uSpines > 0.01) {',
      '    float kSpine = min(kRib, bandLimit(vUp, 26.0 * uSpines));',
      /* An areole sits on the crest of a rib, at steps up the plant, and the
         steps of one rib do not line up with those of the next. A band across
         a band gave a grid of squares instead, and with nothing seeded into
         it every plant wore the same one. Stagger the steps per rib and carry
         the instance seed into both coordinates. */
      '    float crest = uRib > 0.01 ? smoothstep(0.55, 1.0, abs(cos(rr))) : smoothstep(0.7, 1.0, fract(sin(floor(vRib * 40.0) * 7.1 + vSeed) * 43758.5));',
      '    float ribIdx = floor(vRib * uRibN + 0.5);',
      '    float stepUp = fract(vUp * 26.0 * uSpines + vSeed * 0.62 + fract(sin(ribIdx * 12.9 + vSeed) * 4375.5));',
      '    float areole = smoothstep(0.32, 0.5, stepUp) * smoothstep(0.68, 0.5, stepUp);',
      /* past the limit the spines average into a slight overall paleness
         rather than vanishing or crawling */
      '    float amt = clamp(crest * areole * 0.70 * uSpines, 0.0, 0.85);',
      '    c = mix(c, uSpine * (0.35 + 0.65 * length(litC)), mix(0.09 * uSpines, amt, kSpine));',
      '  }',
      '  c = mix(c, uTipCol * (0.4 + 0.6 * length(litC)), uTipMix * smoothstep(0.72, 1.0, vUp));',
      '  if (uNodes > 0.5) {',
      '    float seg = fract(vUp * 7.0 + vSeed * 0.3);',
      '    c *= 0.78 + 0.22 * smoothstep(0.02, 0.13, seg);',
      '    c *= 1.0 + 0.10 * cos(vRib * 25.13) * bandLimit(vRib, 4.0);',
      '  }',
      '  if (uGrain > 3.5) {',
      /* A building: its walls clad (boards, logs, render, coursed stone, brick
         or corrugated sheet), windows in bays with dark glass and a pale frame,
         a door on the side facing the window, roof courses or corrugation, and
         a damp, darker foot. Measured in metres in the object's frame, so the
         courses are the same size on a cabin and a barn. Every pattern fades
         to its mean once it is finer than a pixel. */
      '    vec3 m = vMet, nl = normalize(vNl);',
      '    float wall = (1.0 - step(0.5, vRib)) * (1.0 - smoothstep(0.35, 0.6, abs(nl.y)));',
      '    float rnd = uFac2.z;',
      '    float rad = length(m.xz);',
      '    float u = abs(nl.x) > abs(nl.z) ? m.z : m.x;',
      '    if (rnd > 0.5) u = atan(dot(m.xz, vec2(-vToCam.y, vToCam.x)), dot(m.xz, vToCam) + 1e-5) * rad;',
      '    float v = m.y;',
      '    float wu = fwidth(u), wv = fwidth(v);',
      '    float kd = uFac.x, g = 1.0;',
      '    if (kd < 0.5) {',
      '      float bu = u / 0.22, kb = 1.0 - smoothstep(0.30, 0.85, wu / 0.22);',
      '      g = (1.0 - 0.32 * smoothstep(0.84, 1.0, abs(fract(bu) - 0.5) * 2.0) * kb) * (1.0 + 0.12 * (h3(vec3(floor(bu), vSeed, 2.0)) - 0.5) * kb);',
      '    } else if (kd < 1.5) {',
      '      float bv = v / 0.27, kl = 1.0 - smoothstep(0.30, 0.85, wv / 0.27);',
      '      g = mix(0.86, 0.60 + 0.48 * sin(fract(bv) * 3.1416), kl) * (1.0 + 0.10 * (h3(vec3(floor(bv), vSeed, 4.0)) - 0.5) * kl);',
      '    } else if (kd < 2.5) {',
      '      g = 0.92 + 0.16 * vn3(m * 0.8 + vSeed);',
      '    } else if (kd < 4.5) {',
      '      vec2 bs = kd < 3.5 ? vec2(0.55, 0.32) : vec2(0.23, 0.075);',
      '      float row = floor(v / bs.y), bu = u / bs.x + row * 0.5;',
      '      float kS = 1.0 - smoothstep(0.30, 0.85, max(wv / bs.y, wu / bs.x));',
      '      float jn = max(smoothstep(0.84, 1.0, abs(fract(v / bs.y) - 0.5) * 2.0), smoothstep(0.90, 1.0, abs(fract(bu) - 0.5) * 2.0));',
      '      g = (1.0 + (kd < 3.5 ? -0.32 : 0.22) * jn * kS) * (1.0 + 0.18 * (h3(vec3(floor(bu), row, vSeed)) - 0.5) * kS);',
      '    } else {',
      '      float kc = 1.0 - smoothstep(0.30, 0.85, wu / 0.076);',
      '      g = 1.0 + 0.14 * cos(u / 0.076 * 6.2832) * kc;',
      '    }',
      '    c *= mix(1.0, g, wall);',
      /* the roof: tile courses up the slope, or the ribs of a tin roof down it */
      '    float roofK = step(0.5, vRib) * smoothstep(0.15, 0.4, abs(nl.y));',
      '    float kR = 1.0 - smoothstep(0.30, 0.85, (uFac.w > 0.5 ? wu / 0.076 : wv / 0.2));',
      '    c *= 1.0 - roofK * kR * (uFac.w > 0.5 ? 0.12 * (0.5 + 0.5 * cos(u / 0.076 * 6.2832)) : 0.26 * smoothstep(0.72, 1.0, fract(v / 0.2)));',
      /* the door, on whichever wall faces the window */
      '    vec3 toC = cameraPosition - vWp; vec2 tc = normalize(toC.xz + vec2(1e-4, 0.0));',
      '    float facing = dot(normalize(vNrm.xz + vec2(1e-4, 0.0)), tc);',
      '    float halfD = uFac2.x * 0.5;',
      '    float onDoor = mix(step(0.55, facing) * step(abs(u), halfD), step(cos(min(halfD / max(rad, 0.5), 1.4)), facing), rnd);',
      '    float door = onDoor * step(v, uFac2.y) * step(0.0, v) * step(0.01, uFac2.x) * wall;',
      /* windows: a sill a metre up each storey, in some of the bays */
      '    float cu = u / uFac.z, cv = (v - 0.9) / 2.9;',
      '    vec2 wc = vec2(floor(cu + 0.5), floor(cv));',
      '    vec2 wf = vec2(fract(cu + 0.5) - 0.5, fract(cv));',
      '    float has = step(h3(vec3(wc, vSeed + floor(nl.x * 2.0 + nl.z * 3.0 + 7.0))), uFac.y) * step(0.0, cv) * (1.0 - onDoor * step(v, uFac2.y + 0.6));',
      '    float hw = 0.46 / uFac.z, ex = wu / uFac.z, ey = wv / 2.9;',
      '    float inner = (1.0 - smoothstep(hw - ex, hw + ex, abs(wf.x))) * smoothstep(0.10 - ey, 0.10 + ey, wf.y) * (1.0 - smoothstep(0.52 - ey, 0.52 + ey, wf.y));',
      '    float outer = (1.0 - smoothstep(hw + 0.07 / uFac.z - ex, hw + 0.07 / uFac.z + ex, abs(wf.x))) * smoothstep(0.075 - ey, 0.075 + ey, wf.y) * (1.0 - smoothstep(0.545 - ey, 0.545 + ey, wf.y));',
      '    float kW = 1.0 - smoothstep(0.30, 0.85, max(wu, wv) * 2.5);',
      '    vec3 glass = mix(vec3(0.05, 0.06, 0.07) + vHaze * 0.25 * pow(1.0 - abs(dot(normalize(vNrm), normalize(toC))), 2.0), vHaze, vFogF);',
      '    vec3 frameC = mix(length(litC) * vec3(0.55, 0.54, 0.51), vHaze, vFogF * 0.5);',
      '    c = mix(c, frameC, (outer - inner) * has * wall * kW);',
      '    c = mix(c, glass, inner * has * wall * kW);',
      '    c *= 1.0 - wall * (1.0 - kW) * uFac.y * 0.14;',
      '    c = mix(c, c * vec3(0.42, 0.38, 0.34), door * kW);',
      '    c *= 1.0 - 0.18 * wall * (1.0 - smoothstep(0.0, 0.7, v));',
      '  } else if (uGrain > 2.5) {',
      /* foliage (a hedge): clumps of leaves at two scales with dark gaps
         between them, new growth paler, each faded out as it nears a pixel */
      '    vec3 q = vLocal * vec3(7.0, 9.0, 9.0) + vSeed * 3.1;',
      '    float w = max(fwidth(q.x), max(fwidth(q.y), fwidth(q.z)));',
      '    float k1 = 1.0 - smoothstep(0.30, 0.85, w), k2 = 1.0 - smoothstep(0.30, 0.85, w * 2.8);',
      '    float leaf = mix(0.5, vn3(q), k1) * 0.6 + mix(0.5, vn3(q * 2.8 + 5.3), k2) * 0.4;',
      '    c *= 0.58 + 0.80 * leaf;',
      '    c = mix(c, c * uBody2 / max(uBody, vec3(0.02)), smoothstep(0.62, 0.92, leaf) * 0.45 * k1);',
      '  } else if (uGrain > 1.5) {',
      /* stone: two tones mottled at two scales, a fine speckle, dark seams,
         and lichen on the faces that see the sky */
      '    vec3 q = vLocal + vSeed;',
      '    float w = max(fwidth(vLocal.x), fwidth(vLocal.z));',
      '    float k9 = 1.0 - smoothstep(0.30, 0.85, w * 9.0);',
      '    float k31 = 1.0 - smoothstep(0.30, 0.85, w * 31.0);',
      '    float kSeam = 1.0 - smoothstep(0.30, 0.85, w * 20.0);',
      '    float m1 = h3(floor(q * 3.2)), m2 = h3(floor(q * 9.0)), m3 = h3(floor(q * 31.0));',
      '    float mottle = m1 * 0.55 + mix(0.5, m2, k9) * 0.45;',
      '    vec3 ratio = uBody2 / max(uBody, vec3(0.02));',
      '    c = mix(c, c * ratio, mottle);',
      '    c *= 1.0 + 0.28 * (m3 - 0.5) * k31;',
      /* a product of two sines is a woven grid, which reads as banding. Cracks
         are the borders between irregular cells instead: pick the two nearest
         of a set of jittered points and darken where they are equally close. */
      '    vec2 cp = vLocal.xz * 13.0 + vLocal.y * 4.2;',
      '    vec2 cell = floor(cp);',
      '    float d1 = 8.0, d2 = 8.0;',
      '    for (int oy = -1; oy <= 1; oy++) for (int ox = -1; ox <= 1; ox++) {',
      '      vec2 g2 = cell + vec2(float(ox), float(oy));',
      '      vec2 jit = vec2(h3(vec3(g2, 3.1)), h3(vec3(g2, 7.7)));',
      '      float dd = length(g2 + jit - cp);',
      '      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }',
      '    }',
      '    float crack = 1.0 - smoothstep(0.02, 0.14, d2 - d1);',
      '    c *= 1.0 - 0.30 * crack * kSeam;',
      '    c *= 1.0 + 0.12 * (h3(vec3(cell, 1.7)) - 0.5) * kSeam;',   /* each facet its own shade */
      '    float upFace = smoothstep(0.35, 0.8, vNrm.y);',
      /* Lichen was a hard step on a grid about three cells wide on a boulder,
         so it read as yellow squares painted on the stone. Grow it on smooth
         noise at two scales instead, and thin the fine one with distance. */
      '    float lf = vn3(q * 3.4) * 0.66 + mix(0.5, vn3(q * 9.0), k9) * 0.34;',
      '    if (uVarn > 0.5) {',
      /* Dry rock is laid in beds, each its own shade with a darker parting
         between, dipping a little; and its weathered skin is desert varnish,
         a dark brown-black film in streaks and patches, missing from the
         sand-blasted foot and from fresh breaks. Faded by footprint. */
      '      float bv = (vMet.y + 0.12 * sin(vMet.x * 1.3 + vSeed) + 0.06 * sin(vMet.z * 2.1)) / 0.24;',
      '      float kBd = 1.0 - smoothstep(0.30, 0.85, fwidth(bv));',
      '      c *= 1.0 + (0.16 * (h3(vec3(floor(bv), vSeed, 5.0)) - 0.5) - 0.22 * smoothstep(0.80, 1.0, abs(fract(bv) - 0.5) * 2.0)) * kBd;',
      '      float vm = smoothstep(0.42, 0.66, lf + 0.25 * vn3(vec3(vLocal.xz * 1.5, vLocal.y * 9.0) + vSeed)) * smoothstep(0.08, 0.45, vMet.y);',
      '      c = mix(c, vec3(0.11, 0.075, 0.055) * (0.5 + 0.9 * length(litC) / max(length(uBody), 0.05)), vm * 0.55);',
      '    } else {',
      '    float lich = smoothstep(0.54, 0.78, lf);',
      '    c = mix(c, uLichen * (0.4 + 0.6 * length(litC) / max(length(uBody), 0.05)), lich * upFace * 0.70);',
      '    }',
      '  } else if (uGrain > 0.5) {',
      /* Bark is not a comb. This was a triangle wave at one fixed pitch with
         a slow wobble laid over it, every ridge the same width and the same
         depth as its neighbour, and only four bands of variation over the
         whole height. A trunk therefore came out as a fluted column of even
         stripes. Let the ridges wander, let each carry its own depth along
         its length, and break the trunk across them. */
      '    float wander = (vn3(vec3(vRib * 4.0, vUp * 9.0, vSeed)) - 0.5) * 1.6;',
      '    float u = vRib * uBarkN + wander + vSeed * 2.6;',
      '    float kB = bandLimit(u, 1.0);',
      '    float ridge = abs(fract(u) - 0.5) * 2.0;',
      '    float deep = vn3(vec3(floor(u) * 1.7, vUp * 4.0, 11.0));',
      '    c *= 1.0 - (0.16 + 0.34 * deep) * smoothstep(0.34, 1.0, ridge) * kB;',
      '    float plate = h3(vec3(floor(u), floor(vUp * uBarkPlate * 4.0 + vSeed), 1.0));',
      '    c *= 1.0 + 0.22 * (plate - 0.5) * min(kB, bandLimit(vUp, uBarkPlate * 4.0));',
      '    float gn = h3(vec3(floor(u * 3.0), floor(vUp * 70.0), 3.0));',
      '    c *= 1.0 + 0.14 * (gn - 0.5) * bandLimit(vUp, 70.0);',
      '  }',
      '  gl_FragColor = vec4(c, 1.0);',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
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

