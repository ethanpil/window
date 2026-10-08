/* ---------- grazing herds ----------
   Animals in the middle distance, drifting slowly and pausing to graze. The
   whole path is a function of time in the vertex shader, so a hundred sheep
   cost one draw call and nothing per frame. */
var HERDS = {
  /* size is the card height in metres; foot is where the hooves are on the
     card, as a fraction up from its bottom edge. The sizes were 0.6 of life:
     a sheep is about 1.3 m long, a cow 2.4 m. */
  sheep:  { biomes: ['moor', 'meadow', 'hayfield', 'alpine', 'terraces', 'tundra'], n: [8, 34], size: [1.2, 1.6], foot: 0.14, col: '#ddd8cc', dark: '#3a352e', graze: 0.75, speed: 0.05 },
  cattle: { biomes: ['meadow', 'farmland', 'hayfield', 'river', 'lakefront'], n: [5, 16], size: [2.4, 3.0], foot: 0.12, col: '#8a6b4a', dark: '#2e2822', graze: 0.7, speed: 0.04 },
  goat:   { biomes: ['canyon', 'alpine', 'terraces', 'moor', 'oasis'], n: [4, 12], size: [1.1, 1.5], foot: 0.15, col: '#a8967c', dark: '#4a4036', graze: 0.6, speed: 0.07 },
  deer:   { biomes: ['autumn', 'orchard', 'blossom', 'cascade', 'river', 'meadow'], n: [3, 8], size: [1.9, 2.4], foot: 0.14, col: '#9c7852', dark: '#4a3826', graze: 0.55, speed: 0.08 },
  camel:  { biomes: ['oasis', 'desert', 'saltflat'], n: [3, 9], size: [3.0, 3.7], foot: 0.12, col: '#bda078', dark: '#6b5940', graze: 0.5, speed: 0.045 }
};
function makeHerdTexture(kind, H) {
  var S = 96, c = cnv(S, S), g = c.getContext('2d');
  var body = H.col, dark = H.dark;
  g.fillStyle = body;
  if (kind === 'sheep') {
    g.beginPath(); g.ellipse(S * 0.50, S * 0.50, S * 0.27, S * 0.20, 0, 0, 6.283); g.fill();
    g.fillStyle = dark;
    g.beginPath(); g.ellipse(S * 0.76, S * 0.44, S * 0.085, S * 0.075, 0, 0, 6.283); g.fill();
    g.fillRect(S * 0.34, S * 0.66, S * 0.055, S * 0.20);
    g.fillRect(S * 0.60, S * 0.66, S * 0.055, S * 0.20);
  } else if (kind === 'cattle') {
    g.beginPath(); g.ellipse(S * 0.48, S * 0.46, S * 0.30, S * 0.18, 0, 0, 6.283); g.fill();
    g.fillStyle = '#e6e0d4';
    g.beginPath(); g.ellipse(S * 0.38, S * 0.50, S * 0.11, S * 0.09, 0.3, 0, 6.283); g.fill();
    g.fillStyle = body;
    g.beginPath(); g.ellipse(S * 0.78, S * 0.42, S * 0.10, S * 0.085, 0, 0, 6.283); g.fill();
    g.fillStyle = dark;
    for (var i = 0; i < 4; i++) g.fillRect(S * (0.28 + i * 0.13), S * 0.62, S * 0.05, S * 0.26);
    g.fillRect(S * 0.17, S * 0.40, S * 0.06, S * 0.16);
  } else if (kind === 'goat') {
    g.beginPath(); g.ellipse(S * 0.48, S * 0.50, S * 0.24, S * 0.15, 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(S * 0.75, S * 0.42, S * 0.085, S * 0.07, 0, 0, 6.283); g.fill();
    g.strokeStyle = dark; g.lineWidth = S * 0.03; g.lineCap = 'round';
    g.beginPath(); g.moveTo(S * 0.79, S * 0.36); g.lineTo(S * 0.86, S * 0.24); g.stroke();
    g.fillStyle = dark;
    for (var j = 0; j < 4; j++) g.fillRect(S * (0.30 + j * 0.115), S * 0.63, S * 0.042, S * 0.22);
  } else if (kind === 'camel') {
    g.beginPath(); g.ellipse(S * 0.46, S * 0.48, S * 0.26, S * 0.14, 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(S * 0.40, S * 0.36, S * 0.11, S * 0.10, 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(S * 0.58, S * 0.37, S * 0.09, S * 0.085, 0, 0, 6.283); g.fill();
    g.strokeStyle = body; g.lineWidth = S * 0.055; g.lineCap = 'round';
    g.beginPath(); g.moveTo(S * 0.70, S * 0.46); g.quadraticCurveTo(S * 0.84, S * 0.40, S * 0.83, S * 0.22); g.stroke();
    g.fillStyle = body;
    g.beginPath(); g.ellipse(S * 0.85, S * 0.19, S * 0.065, S * 0.05, 0.4, 0, 6.283); g.fill();
    g.fillStyle = dark;
    for (var k = 0; k < 4; k++) g.fillRect(S * (0.30 + k * 0.11), S * 0.60, S * 0.04, S * 0.28);
  } else { /* deer */
    g.beginPath(); g.ellipse(S * 0.46, S * 0.48, S * 0.24, S * 0.14, 0, 0, 6.283); g.fill();
    g.strokeStyle = body; g.lineWidth = S * 0.05; g.lineCap = 'round';
    g.beginPath(); g.moveTo(S * 0.66, S * 0.44); g.quadraticCurveTo(S * 0.78, S * 0.38, S * 0.79, S * 0.26); g.stroke();
    g.fillStyle = body;
    g.beginPath(); g.ellipse(S * 0.81, S * 0.23, S * 0.07, S * 0.05, 0.5, 0, 6.283); g.fill();
    g.strokeStyle = dark; g.lineWidth = S * 0.022;
    g.beginPath(); g.moveTo(S * 0.83, S * 0.19); g.lineTo(S * 0.90, S * 0.07); g.moveTo(S * 0.86, S * 0.13); g.lineTo(S * 0.94, S * 0.14); g.stroke();
    g.fillStyle = dark;
    for (var m = 0; m < 4; m++) g.fillRect(S * (0.30 + m * 0.105), S * 0.60, S * 0.035, S * 0.26);
  }
  return tex(c, false);
}
function buildHerd(scene, P, R, U, H) {
  if (P.weather.rain > 0.5 || P.timeA === 'night') return;
  var opts = [];
  for (var k in HERDS) if (HERDS[k].biomes.indexOf(P.biomeKey) >= 0) opts.push(k);
  if (!opts.length || R.f() > 0.62) return;
  var kind = R.pick(opts), Hd = HERDS[kind];
  var n = R.int(Hd.n[0], Hd.n[1]);
  /* the herd keeps together: one centre, animals scattered around it */
  var hlim = featureHalfAngle(P) * 0.85;
  var ha = R.range(-hlim, hlim), hr = R.range(45, 210);
  var hx = Math.sin(ha) * hr, hz = -Math.cos(ha) * hr;
  if (P.waterY != null && H(hx, hz) < P.waterY + 0.6) return;
  var spread = R.range(9, 30);
  var quad = new THREE.PlaneGeometry(1, 1);
  quad.translate(0, 0.5, 0);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  var iPos = new Float32Array(n * 3), iAttr = new Float32Array(n * 4), iGrad = new Float32Array(n * 2), made = 0;
  for (var i = 0; i < n; i++) {
    var a = R.range(0, 6.283), rr = Math.sqrt(R.f()) * spread;
    var x = hx + Math.cos(a) * rr, z = hz + Math.sin(a) * rr;
    if (P.waterY != null && H(x, z) < P.waterY + 0.3) continue;
    if (!plantable(P, H, x, z)) continue;
    iPos[made * 3] = x; iPos[made * 3 + 1] = H(x, z); iPos[made * 3 + 2] = z;
    /* the slope here, so an animal wandering a few metres keeps its feet on
       the ground instead of its height at the spot it started from */
    iGrad[made * 2] = (H(x + 2, z) - H(x - 2, z)) / 4;
    iGrad[made * 2 + 1] = (H(x, z + 2) - H(x, z - 2)) / 4;
    iAttr[made * 4] = R.range(Hd.size[0], Hd.size[1]) * (R.f() < 0.18 ? 0.62 : 1);   /* the odd youngster */
    iAttr[made * 4 + 1] = R.range(0, 6.283);
    iAttr[made * 4 + 2] = R.range(0.7, 1.3);
    iAttr[made * 4 + 3] = R.f() < 0.5 ? 1 : -1;                                       /* which way it faces */
    made++;
  }
  if (!made) return;
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
  geo.setAttribute('iGrad', new THREE.InstancedBufferAttribute(iGrad, 2));
  geo.instanceCount = made;
  /* src/shaders/wander.glsl */
  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uCamPos: U.uCamPos, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
      uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow,
      uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
      uMap: { value: makeHerdTexture(kind, Hd) },
      uGraze: { value: Hd.graze }, uSpeed: { value: Hd.speed }, uFoot: { value: Hd.foot }
    },
    alphaToCoverage: true, alphaTest: 0.25, side: THREE.DoubleSide,
    vertexShader: GLSL['herd.vert'],
    fragmentShader: GLSL['herd.frag']
  });
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  scene.add(m);
  App.propMeshes.push(m);
  /* A soft shadow on the ground under each animal, walking with it: a baked
     caster would stay where the animal started. Flat on the ground and seen
     at a grazing angle, so it blends rather than dithering. */
  var sq = new THREE.PlaneGeometry(1, 1);
  sq.rotateX(-Math.PI / 2);
  var sgeo = new THREE.InstancedBufferGeometry();
  sgeo.index = sq.index;
  sgeo.setAttribute('position', sq.attributes.position);
  sgeo.setAttribute('uv', sq.attributes.uv);
  sgeo.setAttribute('iPos', geo.attributes.iPos);
  sgeo.setAttribute('iAttr', geo.attributes.iAttr);
  sgeo.setAttribute('iGrad', geo.attributes.iGrad);
  sgeo.instanceCount = made;
  var smat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uCamPos: U.uCamPos, uSunDir: U.uSunDir, uShadow: U.uShadow,
      uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
      uFogDensity: U.uFogDensity, uSpeed: { value: Hd.speed }
    },
    transparent: true, depthWrite: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    vertexShader: GLSL['herd-shadow.vert'],
    fragmentShader: GLSL['herd-shadow.frag']
  });
  var sm = new THREE.Mesh(sgeo, smat);
  sm.frustumCulled = false;
  scene.add(sm);
  App.propMeshes.push(sm);
  P.herdKind = kind;
  P.herdCount = made;
}

/* ---------- life on the water ----------
   A moored boat, ducks paddling, a heron standing still in the shallows. Water
   surfaces were completely bare. */
function makeWaterLifeTexture(kind) {
  var S = 96, c = cnv(S, S), g = c.getContext('2d');
  if (kind === 'duck') {
    g.fillStyle = '#4a4038';
    g.beginPath(); g.ellipse(S * 0.48, S * 0.58, S * 0.22, S * 0.12, 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(S * 0.70, S * 0.44, S * 0.085, S * 0.09, 0, 0, 6.283); g.fill();
    g.fillStyle = '#2e5a3e';
    g.beginPath(); g.ellipse(S * 0.70, S * 0.42, S * 0.075, S * 0.078, 0, 0, 6.283); g.fill();
    g.fillStyle = '#c8a233';
    g.beginPath(); g.ellipse(S * 0.80, S * 0.47, S * 0.055, S * 0.028, 0.2, 0, 6.283); g.fill();
    g.fillStyle = '#6e6055';
    g.beginPath(); g.ellipse(S * 0.38, S * 0.55, S * 0.13, S * 0.07, -0.2, 0, 6.283); g.fill();
  } else { /* heron: tall, still, patient */
    g.strokeStyle = '#8e9298'; g.lineWidth = S * 0.035; g.lineCap = 'round';
    g.beginPath(); g.moveTo(S * 0.46, S * 0.95); g.lineTo(S * 0.47, S * 0.62); g.stroke();
    g.beginPath(); g.moveTo(S * 0.54, S * 0.95); g.lineTo(S * 0.53, S * 0.62); g.stroke();
    g.fillStyle = '#a9adb2';
    g.beginPath(); g.ellipse(S * 0.50, S * 0.56, S * 0.15, S * 0.11, -0.1, 0, 6.283); g.fill();
    g.strokeStyle = '#a9adb2'; g.lineWidth = S * 0.055;
    g.beginPath(); g.moveTo(S * 0.53, S * 0.50); g.quadraticCurveTo(S * 0.62, S * 0.36, S * 0.56, S * 0.22); g.stroke();
    g.fillStyle = '#b6babf';
    g.beginPath(); g.ellipse(S * 0.56, S * 0.19, S * 0.055, S * 0.045, 0, 0, 6.283); g.fill();
    g.fillStyle = '#d8b03a';
    g.beginPath(); g.moveTo(S * 0.60, S * 0.18); g.lineTo(S * 0.78, S * 0.21); g.lineTo(S * 0.60, S * 0.22); g.fill();
    g.fillStyle = '#3a4048';
    g.beginPath(); g.ellipse(S * 0.44, S * 0.55, S * 0.09, S * 0.06, 0.2, 0, 6.283); g.fill();
  }
  return tex(c, false);
}
function boatGeo(R) {
  var B = { pos: [], nor: [], idx: [], rib: [] };
  var len = R.range(1.5, 2.2);
  /* a hull as a shallow shell, pointed at both ends */
  var segs = 9;
  for (var i = 0; i < segs; i++) {
    var t = i / (segs - 1) - 0.5;
    var w = (1 - t * t * 3.4) * 0.42;
    if (w < 0.04) continue;
    pushBox(B, t * len, 0.12, 0, len / segs * 0.6, 0.13, w, 0);
  }
  pushBox(B, 0, 0.26, 0, len * 0.16, 0.04, 0.36, 0);        /* a thwart */
  pushBox(B, len * 0.30, 0.26, 0, len * 0.12, 0.04, 0.30, 0);
  return finishGeo(B);
}
function buildWaterLife(scene, P, R, U, H) {
  if (P.waterY == null || !P.biome.water) return;
  if (P.biome.water === 'sea' || P.biome.water === 'mirror') return;
  var wy = P.waterY;
  /* find open water somewhere ahead */
  var spots = [], guard = 0;
  while (spots.length < 40 && guard < 1200) {
    guard++;
    var wlim = visibleHalfAngle(P) * 0.88;
    var a = R.range(-wlim, wlim), rr = R.range(14, 130);
    var x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
    if (H(x, z) < wy - 0.35) spots.push([x, z]);
  }
  if (spots.length < 6) return;

  /* a boat, moored or drifting */
  if (R.f() < 0.5) {
    /* moored where a narrow window still sees it (featureHalfAngle) */
    var bLim = featureHalfAngle(P) * 0.85, bSpots = spots.filter(function (q) { return Math.abs(Math.atan2(q[0], -q[1])) < bLim; });
    if (bSpots.length) {
      var bs = bSpots[R.int(0, bSpots.length - 1)];
      var bmat = solidMat(U, R.pick(['#7a6448', '#8d6f4e', '#5f5a54', '#a8452f', '#3f5a72']), { rib: 0, grain: 1, spines: 0, barkN: 26, barkPlate: 9 });
      var bGeo = boatGeo(R);
      instanceSolid(scene, bGeo, [[bs[0], wy - 0.10, bs[1], R.range(1.6, 2.6), R.range(0, 6.283), 1, 1]], bmat);
      P.hasBoat = true;
      App._features.push(['boat', bs[0], bs[1]]);
    }
  }

  var kinds = [];
  if (R.f() < 0.7) kinds.push('duck');
  if (/marsh|lakefront|river|oasis/.test(P.biomeKey) && R.f() < 0.55) kinds.push('heron');
  for (var ki = 0; ki < kinds.length; ki++) {
    var kind = kinds[ki];
    var n = kind === 'duck' ? R.int(3, 9) : R.int(1, 2);
    var quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    var iPos = new Float32Array(n * 3), iAttr = new Float32Array(n * 4), made = 0;
    /* ducks keep loosely together; herons stand alone at the edge */
    var cen = spots[R.int(0, spots.length - 1)];
    for (var i = 0; i < n; i++) {
      var s2 = kind === 'duck'
        ? [cen[0] + R.gauss() * 4.5, cen[1] + R.gauss() * 4.5]
        : spots[R.int(0, spots.length - 1)];
      if (kind === 'heron' && H(s2[0], s2[1]) < wy - 1.1) continue;   /* it needs to stand */
      iPos[made * 3] = s2[0];
      iPos[made * 3 + 1] = kind === 'heron' ? Math.max(H(s2[0], s2[1]), wy - 0.5) : wy - 0.04;
      iPos[made * 3 + 2] = s2[1];
      iAttr[made * 4] = kind === 'duck' ? R.range(0.30, 0.42) : R.range(1.0, 1.25);
      iAttr[made * 4 + 1] = R.range(0, 6.283);
      iAttr[made * 4 + 2] = kind === 'duck' ? R.range(0.5, 1.0) : R.range(0.05, 0.12);
      iAttr[made * 4 + 3] = R.f() < 0.5 ? 1 : -1;
      made++;
    }
    if (!made) continue;
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
    geo.instanceCount = made;
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime, uCamPos: U.uCamPos, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
        uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK,
        uMap: { value: makeWaterLifeTexture(kind) },
        uSwim: { value: kind === 'duck' ? 1.0 : 0.0 }
      },
      alphaTest: 0.25, side: THREE.DoubleSide,
      vertexShader: GLSL['waterlife.vert'],
      fragmentShader: GLSL['waterlife.frag']
    });
    var m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    scene.add(m);
    App.propMeshes.push(m);
    P.waterLife = (P.waterLife || '') + kind + ' ';
  }
}

