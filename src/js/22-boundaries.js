/* ---------- field boundaries ----------
   Hedges, walls, fences and shelter belts running across the land. These are
   what turn an expanse into fields, and they fill the middle distance, which
   is otherwise nearly empty. Each is one instanced mesh along a seeded line. */
var BOUNDARY_KINDS = {
  hedge:    { biomes: ['meadow', 'farmland', 'hayfield', 'orchard', 'blossom', 'flowerfield', 'lavender', 'river', 'lakefront', 'autumn'], w: 5 },
  wall:     { biomes: ['moor', 'alpine', 'terraces', 'tundra', 'meadow', 'hayfield', 'cliffcoast', 'fjord'], w: 4 },
  fence:    { biomes: ['meadow', 'hayfield', 'farmland', 'savanna', 'oasis', 'river', 'moor', 'canyon'], w: 4 },
  shelter:  { biomes: ['farmland', 'hayfield', 'orchard', 'blossom', 'meadow', 'lavender'], w: 3 }
};
function boundaryPost(R) {
  var B = { pos: [], nor: [], idx: [], rib: [] };
  pushBox(B, 0, 0.55, 0, 0.055, 0.55, 0.055, 0);
  return finishGeo(B);
}
function boundaryRail(R) {
  var B = { pos: [], nor: [], idx: [], rib: [] };
  pushBox(B, 0, 0.72, 0, 1.0, 0.045, 0.03, 0);
  pushBox(B, 0, 0.44, 0, 1.0, 0.045, 0.03, 0);
  return finishGeo(B);
}
function boundaryStone(R) {
  var B = { pos: [], nor: [], idx: [], rib: [] };
  /* a course of rough stones, narrowing toward the top */
  for (var c = 0; c < 4; c++) {
    var y = 0.13 + c * 0.24, half = 0.30 - c * 0.045;
    var n = 3;
    for (var i = 0; i < n; i++) {
      var t = (i + 0.5) / n - 0.5;
      pushBox(B, t * 1.7 + R.range(-0.06, 0.06), y, R.range(-0.03, 0.03),
              0.9 / n * R.range(0.8, 1.05), 0.12, half, R.range(-0.12, 0.12));
    }
  }
  pushBox(B, 0, 1.06, 0, 0.9, 0.06, 0.18, 0);            /* the capping course */
  return finishGeo(B);
}
/* A length of hedge, one unit long along x (a little over, so neighbours
   overlap), one high, about half as deep: straight-sided, rounded on top,
   its surface pushed in and out by a lumpy noise that repeats along its
   length, so lengths laid end to end meet without a step. Light and leaf
   come from solidMat's foliage grain. */
function hedgeTemplate(R) {
  var B = { pos: [], nor: [], idx: [], rib: [] };
  var prof = [[-0.27, 0], [-0.30, 0.30], [-0.29, 0.62], [-0.22, 0.86], [-0.10, 0.98], [0, 1.0],
              [0.10, 0.98], [0.22, 0.86], [0.29, 0.62], [0.30, 0.30], [0.27, 0]];
  var rings = 9, L = 1.12, k, i;
  var ph = [], fr = [];
  for (k = 0; k < 4; k++) { ph.push(R.range(0, 6.283)); fr.push(R.int(1, 3)); }
  for (i = 0; i <= rings; i++) {
    var u = i / rings, x = (u - 0.5) * L;
    for (k = 0; k < prof.length; k++) {
      var a = k / (prof.length - 1);
      /* periodic in u, so both ends of every length carry the same bumps */
      var n = 0.07 * Math.sin(6.283 * fr[0] * u + ph[0] + a * 5.1) + 0.05 * Math.sin(6.283 * fr[1] * u + ph[1] + a * 9.7)
            + 0.03 * Math.sin(6.283 * (fr[2] + 2) * u + ph[2] + a * 17.3);
      var py = prof[k][1], pz = prof[k][0];
      var top = smoothstep(0.5, 1.0, py);
      B.pos.push(x, Math.max(py + n * top * 0.9, py > 0 ? 0.02 : 0), pz * (1 + n * 1.4));
      B.nor.push(0, pz === 0 ? 1 : 0.4, pz);
      B.rib.push(a);
    }
  }
  var m = prof.length;
  for (i = 0; i < rings; i++) for (k = 0; k < m - 1; k++) {
    var a0 = i * m + k, b0 = a0 + m;
    B.idx.push(a0, a0 + 1, b0, a0 + 1, b0 + 1, b0);
  }
  /* close the ends and the foot: a length at the end of a line, at a gate or
     where a path cuts it was an open tube, and showed through */
  var ringPts = function (r) { var o = []; for (var q = 0; q < m; q++) o.push(B.pos.slice((r * m + q) * 3, (r * m + q) * 3 + 3)); return o; };
  var e0 = ringPts(0), e1 = ringPts(rings), cut = B.pos.length;
  [[e0, -1], [e1, 1]].forEach(function (e) {
    /* a fan from the middle, each triangle wound to face out along x */
    var pts = e[0], sx = e[1], c0 = B.pos.length / 3, cy = 0, cz = 0;
    for (var q = 0; q < m; q++) { cy += pts[q][1] / m; cz += pts[q][2] / m; }
    B.pos.push(pts[0][0], cy, cz); B.nor.push(sx, 0, 0);
    for (q = 0; q < m; q++) { B.pos.push(pts[q][0], pts[q][1], pts[q][2]); B.nor.push(sx, 0, 0); }
    for (q = 0; q < m; q++) {
      var q1 = (q + 1) % m;
      var cr = (pts[q][1] - cy) * (pts[q1][2] - cz) - (pts[q][2] - cz) * (pts[q1][1] - cy);
      if (cr * sx > 0) B.idx.push(c0, c0 + 1 + q, c0 + 1 + q1); else B.idx.push(c0, c0 + 1 + q1, c0 + 1 + q);
    }
  });
  for (k = cut / 3; k < B.pos.length / 3; k++) B.rib.push(0.5);
  /* the foot wanders with the sides, so it is closed ring by ring */
  for (i = 0; i < rings; i++) {
    var f0 = ringPts(i), f1 = ringPts(i + 1);
    pushFace(B, [f0[0], f0[m - 1], f1[m - 1], f1[0]], [(f0[0][0] + f1[0][0]) * 0.5, 0.4, 0]);
  }
  for (k = cut / 3; k < B.rib.length; k++) B.rib[k] = 0.5;
  return finishGeo(B);
}
/* Hedges laid along lines as continuous lengths: lines is a list of
   {x, z, ca, sa, half} (a point, the direction, the half length). Their own
   stream, so they move nothing else. */
function buildHedgeLines(scene, P, U, H, lines, hgt, HR) {
  var forms = [hedgeTemplate(HR), hedgeTemplate(HR), hedgeTemplate(HR)], parts = [[], [], []];
  for (var L = 0; L < lines.length; L++) {
    var ln = lines[L], h = hgt * HR.range(0.85, 1.15), step = h * 0.98;
    var gapAt = HR.range(0, 1), gapW = HR.range(0.02, 0.06);     /* a gate */
    var ang = Math.atan2(ln.sa, ln.ca);
    for (var t = -ln.half; t <= ln.half; t += step) {
      var x = ln.x + ln.ca * t, z = ln.z + ln.sa * t;
      if (z > -6) continue;
      var d = Math.sqrt(x * x + z * z);
      if (d < 12 || d > 430) continue;
      if (Math.abs((t + ln.half) / (2 * ln.half) - gapAt) < gapW) continue;
      if (P.waterY != null && H(x, z) < P.waterY + 0.3) continue;
      if (pathBlocked(P, x, z, 0.3, step * 0.5)) continue;
      if (P.clearKind && clearAt(P, x, z + 1.5) > 0) continue;
      if (slopeAt(H, x, z) > 0.55) continue;
      if (!ln.garden && inTown(P, x, z, step * 0.5)) continue;
      var y = Math.min(H(x - ln.ca * step * 0.5, z - ln.sa * step * 0.5), H(x + ln.ca * step * 0.5, z + ln.sa * step * 0.5)) - 0.08;
      /* the height wanders slowly along the line; whole lengths are dealt
         from a few forms, turned end for end */
      var sy = 1 + 0.12 * Math.sin(t * 0.045 + L * 1.7) + HR.range(-0.04, 0.04);
      parts[HR.int(0, 2)].push([x, y, z, h, ang + (HR.f() < 0.5 ? Math.PI : 0), sy, 1]);
      if (d < 240) App._shadows.push([x, y, z, h * 0.45, 0.7, h * 0.9]);
    }
  }
  var col = new THREE.Color(P.seasonKey === 'winter' ? '#3f4430' : (P.seasonKey === 'autumn' ? '#4c4a2a' : '#34482a')).multiplyScalar(P.treeTint || 1);
  var mat = solidMat(U, '#' + col.getHexString(), { rib: 0, grain: 3, spines: 0, aoH: 0.5,
    body2: P.seasonKey === 'autumn' ? '#7a5a2c' : '#5b6e3a' });
  for (var f = 0; f < 3; f++) if (parts[f].length) instanceSolid(scene, forms[f], parts[f], mat);
}
function buildBoundaries(scene, P, R, U, H) {
  if (P.waterY != null && P.biome.terrain === 'cascade') return;
  var opts = [];
  for (var k in BOUNDARY_KINDS) if (BOUNDARY_KINDS[k].biomes.indexOf(P.biomeKey) >= 0) {
    for (var w = 0; w < BOUNDARY_KINDS[k].w; w++) opts.push(k);
  }
  if (!opts.length || R.f() > 0.78) return;
  var kind = R.pick(opts);
  P.boundaryKind = kind;

  /* two or three roughly parallel lines, plus one crossing them, so the land
     reads as divided into fields rather than striped */
  var mainA = R.range(-1.3, 1.3);
  var lines = [];
  var nMain = R.int(2, 4);
  for (var i = 0; i < nMain; i++) lines.push({ a: mainA + R.range(-0.14, 0.14), d: R.range(35, 300) * (R.f() < 0.5 ? -1 : 1) });
  if (R.f() < 0.7) for (var j = 0; j < R.int(1, 2); j++)
    lines.push({ a: mainA + Math.PI / 2 + R.range(-0.22, 0.22), d: R.range(30, 240) * (R.f() < 0.5 ? -1 : 1) });

  var posts = [], rails = [], stones = [], trees = [], hedges = [];
  for (var L = 0; L < lines.length; L++) {
    var ln = lines[L], ca = Math.cos(ln.a), sa = Math.sin(ln.a);
    /* the line's own origin, offset sideways from the window */
    var ox = -sa * ln.d, oz = ca * ln.d;
    var step = kind === 'fence' ? 2.6 : (kind === 'wall' ? 1.7 : (kind === 'shelter' ? 7.5 : 2.1));
    var half = R.range(120, 340);
    /* a hedge is laid along the line by buildHedgeLines, which walks it itself */
    if (kind === 'hedge') { hedges.push({ x: ox, z: oz, ca: ca, sa: sa, half: half }); continue; }
    var gapAt = R.range(0, 1), gapW = R.range(0.03, 0.09);   /* a gate or a gap */
    for (var t = -half; t <= half; t += step) {
      var x = ox + ca * t, z = oz + sa * t;
      if (z > -6) continue;
      var d = Math.sqrt(x * x + z * z);
      if (d < 12 || d > 420) continue;
      var u = (t + half) / (2 * half);
      if (Math.abs(u - gapAt) < gapW) continue;
      if (P.waterY != null && H(x, z) < P.waterY + 0.3) continue;
      if (P.pathKind && onPathAt(P, x, z) > 0.4) continue;
      if (P.clearKind && clearAt(P, x, z + 1.5) > 0) continue;
      /* nobody fences a cliff: a line stops where the ground gets steep */
      if (slopeAt(H, x, z) > 0.55) continue;
      var y = H(x, z);
      /* a canyon's fences keep to the rim: none down the benches and walls */
      if (P.biomeKey === 'canyon' && (y < -6 || slopeAt(H, x, z) > 0.25)) continue;
      /* and a gap is left where a track passes, ruts and crown */
      if (pathBlocked(P, x, z, 0.4, step * 0.5)) continue;
      var jx = x + R.gauss() * 0.12, jz = z + R.gauss() * 0.12;
      if (kind === 'fence') {
        posts.push([jx, y, jz, R.range(0.85, 1.1), ln.a, 1, 1]);
        rails.push([x + ca * step * 0.5, H(x + ca * step * 0.5, z + sa * step * 0.5), z + sa * step * 0.5,
                    step * 0.52, ln.a, 1, 1]);
      } else if (kind === 'wall') {
        stones.push([jx, y - 0.05, jz, R.range(0.92, 1.12), ln.a + R.range(-0.05, 0.05), R.range(0.9, 1.1), 1]);
      } else {
        trees.push([jx, jz, R.range(6, 13)]);
      }
      if (d < 240 && kind !== 'fence')
        App._shadows.push([x, y, z, kind === 'shelter' ? 2.6 : 1.0, 0.7, kind === 'shelter' ? 8 : 1.6]);
    }
  }
  var woodCols = ['#6b5842', '#7a6549', '#5e4d3a'];
  if (posts.length) {
    var wm = solidMat(U, R.pick(woodCols), { rib: 0, grain: 1, spines: 0, barkN: 24, barkPlate: 8 });
    instanceSolid(scene, boundaryPost(R), posts, wm);
    if (rails.length) instanceSolid(scene, boundaryRail(R), rails, wm);
  }
  if (stones.length) {
    /* one wall template stamped every 1.7 m read as a pattern: deal the
       lengths out from four, turned end for end at random */
    var WR = RNG(P.base + '/build/walls' + (P.nonce ? '/' + P.nonce : ''));
    var stoneTpl = boundaryStone(R), wforms = [stoneTpl, boundaryStone(WR), boundaryStone(WR), boundaryStone(WR)];
    var wparts = [[], [], [], []];
    for (var si = 0; si < stones.length; si++) {
      var st = stones[si];
      if (WR.f() < 0.5) st[4] += Math.PI;
      wparts[WR.int(0, 3)].push(st);
    }
    var wmat = solidMat(U, R.pick(['#8b8578', '#7d7a70', '#948d7e', '#6f6a60']), { rib: 0, grain: 2, spines: 0, body2: '#9a9488', lichen: '#9aa15a' });
    for (var wf = 0; wf < 4; wf++) if (wparts[wf].length) instanceSolid(scene, wforms[wf], wparts[wf], wmat);
  }
  if (hedges.length) {
    /* a hedge is a continuous bank of leaves, not bushes in a row */
    var HRb = RNG(P.base + '/build/hedges' + (P.nonce ? '/' + P.nonce : ''));
    buildHedgeLines(scene, P, U, H, hedges, HRb.range(1.5, 2.6), HRb);
  }
  if (trees.length) boundaryBillboards(scene, P, R, U, H, trees, P.seasonKey === 'winter' ? 'broadleaf' : (R.f() < 0.5 ? 'pine' : 'broadleaf'));
}
/* A low stone wall along the far edge of a gravel terrace: the line where
   the kept ground stops and the country starts, with a gap where a path
   goes through. Its own stream, so it moves nothing else. */
function buildTerraceWall(scene, P, U, H) {
  if (!P.clearWall) return;
  var WR = RNG(P.base + '/build/terrace' + (P.nonce ? '/' + P.nonce : ''));
  var items = [], step = 1.7, half = P.clearD * 2.6, z = -P.clearD - 0.25;
  for (var x = -half; x <= half; x += step) {
    if (pathBlocked(P, x, z, 0.05, step * 0.5)) continue;
    if (P.waterY != null && H(x, z) < P.waterY + 0.3) continue;
    var y = Math.min(H(x - step * 0.5, z), H(x + step * 0.5, z)) - 0.06;
    items.push([x + WR.range(-0.04, 0.04), y, z + WR.range(-0.03, 0.03), 1, WR.range(-0.02, 0.02),
                P.clearWall / 1.12 * WR.range(0.94, 1.06), 1.25]);
  }
  if (!items.length) return;
  instanceSolid(scene, boundaryStone(WR), items,
    solidMat(U, WR.pick(['#8b8578', '#7d7a70', '#948d7e', '#8a7f6e']), { rib: 0, grain: 2, spines: 0, body2: '#9a9488', lichen: '#9aa15a' }));
}

function boundaryBillboards(scene, P, R, U, H, items, kind) {
  var quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  var iPos = new Float32Array(items.length * 3), iAttr = new Float32Array(items.length * 2);
  for (var i = 0; i < items.length; i++) {
    iPos[i * 3] = items[i][0];
    iPos[i * 3 + 1] = H(items[i][0], items[i][1]) - items[i][2] * 0.06;
    iPos[i * 3 + 2] = items[i][1];
    iAttr[i * 2] = items[i][2];
    iAttr[i * 2 + 1] = R.range(0, 6.283);
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 2));
  geo.instanceCount = items.length;
  var mat = propBillboardMat(U, makePropTexture(kind, P, R, { far: true }), 0.03, spriteAspect(kind), kind);
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.userData.noTrim = true;              /* a thinned shelter belt comes out dashed */
  scene.add(m);
  App.propMeshes.push(m);
}

/* a plain lit billboard, for things that only need to stand there and sway */
function propBillboardMat(U, map, sway, aspect, kind) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uWind: U.uWind, uGust: U.uGust, uWindDir: U.uWindDir,
      uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol, uFogCol: U.uFogCol,
      uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow,
      uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
      uSnow: U.uSnow, uCamPos: U.uCamPos,
      uMap: { value: map }, uSway: { value: sway }, uAspect: { value: aspect || 1.0 },
      uCrown: { value: spriteCrown(kind) }
    },
    alphaToCoverage: true, alphaTest: 0.25, side: THREE.DoubleSide,
    vertexShader: [
      'attribute vec3 iPos; attribute vec2 iAttr;',
      'uniform float uTime, uWind, uGust, uFogDensity, uShadow, uSnow, uSway, uAspect;',
      'uniform vec2 uWindDir; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;',
      'varying vec2 vUv; varying float vFog; varying vec3 vHaze;',
      'varying vec2 vQ; varying float vFlip, vSh; varying vec3 vJit, vRight, vToCam, vAmb;',
      GLSL_COMMON,
      GLSL_SPRITE_V,
      'void main(){',
      '  float size = iAttr.x;',
      '  vec3 toCam = normalize(vec3(uCamPos.x - iPos.x, 0.0, uCamPos.z - iPos.z));',
      '  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));',
      '  vec3 lp = right * position.x * size * uAspect + vec3(0.0, position.y * size, 0.0);',
      '  float sway = sin(uTime * 0.8 + iAttr.y) * 0.5 + sin(uTime * 0.33 + iAttr.y * 1.6) * 0.5;',
      '  lp.xz += uWindDir * sway * uWind * (0.3 + 0.7 * uGust) * size * uSway * position.y * position.y;',
      '  vec3 wp = iPos + lp;',
      '  vec2 bk = bakedRG(wp.xz);',
      '  vSh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);',
      '  vAmb = uAmbCol * 0.95 * mix(1.0, bk.y, 0.5);',
      '  vQ = uv; vRight = right; vToCam = toCam;',
      '  vUv = spriteUv(uv, iAttr.y, vFlip, vJit);',
      '  vJit *= 1.0 - uSnow * 0.25;',
      '  vec4 mv = modelViewMatrix * vec4(wp, 1.0);',
      '  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);',
      '  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform sampler2D uMap; uniform vec3 uSunDir, uSunCol; uniform vec4 uCrown;',
      'varying vec2 vUv; varying float vFog; varying vec3 vHaze;',
      'varying vec2 vQ; varying float vFlip, vSh; varying vec3 vJit, vRight, vToCam, vAmb;',
      GLSL_COMMON,
      GLSL_SPRITE_F,
      'void main(){',
      '  vec4 t = texture2D(uMap, vUv);',
      '  if (t.a < 0.25) discard;',
      '  vec3 light = spriteLight(vQ, uCrown, vFlip, vRight, vToCam, t.a, vAmb, vSh);',
      '  gl_FragColor = vec4(mix(t.rgb * vJit * light, vHaze, vFog), smoothstep(0.3, 0.7, t.a));',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
  });
}

