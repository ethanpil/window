/* ---------- visitors ----------
   One thing at a time, crossing slowly, minutes apart. The reward is catching
   it, so nothing here is frequent enough to become scenery. */
function makeVisitorTexture(kind, R) {
  var S = 256, c = cnv(S, S), g = c.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'balloon') {
    var band = [R.pick(['#c8443a', '#d98b2b', '#e0d15a', '#3f7fae', '#7a4b8e']), '#f2ece0'];
    var cx = S / 2, cy = S * 0.40, rx = S * 0.27, ry = S * 0.31;
    for (var i = 0; i < 7; i++) {
      g.fillStyle = band[i % 2];
      g.beginPath();
      g.moveTo(cx, cy + ry);
      g.bezierCurveTo(cx - rx + i * rx * 2 / 7, cy + ry * 0.4, cx - rx + i * rx * 2 / 7, cy - ry, cx, cy - ry);
      g.bezierCurveTo(cx - rx + (i + 1) * rx * 2 / 7, cy - ry, cx - rx + (i + 1) * rx * 2 / 7, cy + ry * 0.4, cx, cy + ry);
      g.fill();
    }
    g.strokeStyle = '#5a4a38'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(cx - S * 0.06, cy + ry * 0.96); g.lineTo(cx - S * 0.045, S * 0.80);
    g.moveTo(cx + S * 0.06, cy + ry * 0.96); g.lineTo(cx + S * 0.045, S * 0.80); g.stroke();
    g.fillStyle = '#7a5a34';
    g.fillRect(cx - S * 0.055, S * 0.80, S * 0.11, S * 0.075);
  } else if (kind === 'boat') {
    g.fillStyle = '#f4f1e8';
    g.beginPath(); g.moveTo(S * 0.50, S * 0.18); g.lineTo(S * 0.50, S * 0.62);
    g.lineTo(S * 0.26, S * 0.62); g.closePath(); g.fill();
    g.fillStyle = '#e6e0d2';
    g.beginPath(); g.moveTo(S * 0.52, S * 0.24); g.lineTo(S * 0.52, S * 0.62);
    g.lineTo(S * 0.70, S * 0.62); g.closePath(); g.fill();
    g.strokeStyle = '#4a4038'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(S * 0.51, S * 0.16); g.lineTo(S * 0.51, S * 0.64); g.stroke();
    g.fillStyle = R.pick(['#39424c', '#5c4632', '#2f4a44']);
    g.beginPath();
    g.moveTo(S * 0.22, S * 0.64); g.lineTo(S * 0.78, S * 0.64);
    g.lineTo(S * 0.70, S * 0.72); g.lineTo(S * 0.30, S * 0.72); g.closePath(); g.fill();
  } else if (kind === 'deer') {
    g.fillStyle = 'rgba(74,56,38,0.94)';
    g.beginPath(); g.ellipse(S * 0.50, S * 0.56, S * 0.19, S * 0.10, 0, 0, 6.283); g.fill();
    g.fillRect(S * 0.36, S * 0.62, S * 0.035, S * 0.20);
    g.fillRect(S * 0.44, S * 0.62, S * 0.035, S * 0.20);
    g.fillRect(S * 0.57, S * 0.62, S * 0.035, S * 0.20);
    g.fillRect(S * 0.64, S * 0.62, S * 0.035, S * 0.20);
    g.beginPath(); g.moveTo(S * 0.64, S * 0.52); g.lineTo(S * 0.74, S * 0.36);
    g.lineTo(S * 0.79, S * 0.38); g.lineTo(S * 0.70, S * 0.53); g.closePath(); g.fill();
    g.beginPath(); g.ellipse(S * 0.78, S * 0.35, S * 0.055, S * 0.035, -0.4, 0, 6.283); g.fill();
    g.strokeStyle = 'rgba(74,56,38,0.94)'; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(S * 0.79, S * 0.32); g.lineTo(S * 0.83, S * 0.22); g.moveTo(S * 0.80, S * 0.27); g.lineTo(S * 0.87, S * 0.25);
    g.moveTo(S * 0.75, S * 0.32); g.lineTo(S * 0.73, S * 0.21); g.stroke();
  } else { /* geese: a skein */
    g.strokeStyle = 'rgba(38,40,46,0.9)'; g.lineWidth = 4; 
    for (var b = 0; b < 7; b++) {
      var t = b / 6;
      var bx = S * (0.14 + t * 0.72), by = S * (0.32 + Math.abs(t - 0.5) * 0.36);
      g.beginPath();
      g.moveTo(bx - S * 0.045, by + S * 0.02);
      g.quadraticCurveTo(bx, by - S * 0.03, bx + S * 0.045, by + S * 0.02);
      g.stroke();
    }
  }
  return tex(c, false);
}

function buildVisitors(scene, P, R, U, H) {
  var kinds = [];
  var wet = P.waterY != null;
  var calm = P.weather.rain < 0.5 && P.weather.snow < 0.5;
  if (wet && calm && P.biomeKey !== 'saltflat' && P.biomeKey !== 'marsh') kinds.push('boat');
  if (calm && P.weather.cover > 0.3 && !wet) kinds.push('balloon');
  if (['meadow','autumn','moor','alpine','farmland','orchard','blossom','lakefront','river','tundra'].indexOf(P.biomeKey) >= 0) kinds.push('deer');
  if (calm) kinds.push('geese');
  if (!kinds.length || !R.chance(0.72)) return;
  var kind = R.pick(kinds);
  P.visitor = kind;

  var quad = new THREE.PlaneGeometry(1, 1);
  /* Where the card hangs from its own origin. A deer stands on the ground and
     a balloon or a goose hangs by its middle, but a boat was hanging by its
     middle too, and the hull is drawn near the foot of its card: that put the
     bottom of the hull about a fifth of the card below the origin, which for
     a boat eight metres long is nearly two metres under the water. Hang it by
     its waterline instead. */
  quad.translate(0, kind === 'deer' ? 0.5 : (kind === 'boat' ? 0.19 : 0), 0);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  var n = kind === 'deer' ? R.int(2, 4) : 1;
  var iAttr = new Float32Array(n * 4);
  for (var i = 0; i < n; i++) {
    iAttr[i * 4] = R.range(0, 1);                       /* start of its own crossing */
    iAttr[i * 4 + 1] = R.range(0.9, 1.15) + i * 0.04;   /* stagger within a group */
    iAttr[i * 4 + 2] = i * R.range(3, 9);
    iAttr[i * 4 + 3] = R.range(-0.35, 0.35);
  }
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
  geo.instanceCount = n;

  var cfg = {
    balloon: { size: R.range(11, 20), dist: R.range(180, 420), height: R.range(45, 110), period: R.range(300, 620), cross: 0.42 },
    boat:    { size: R.range(5, 12),  dist: R.range(70, 260),  height: 0,                period: R.range(280, 560), cross: 0.45 },
    deer:    { size: R.range(1.1, 1.7), dist: R.range(38, 120), height: 0,               period: R.range(240, 520), cross: 0.30 },
    geese:   { size: R.range(9, 17),  dist: R.range(130, 320), height: R.range(55, 130), period: R.range(260, 540), cross: 0.24 }
  }[kind];
  var groundY = kind === 'boat' ? (P.waterY || 0) - 0.1 : 0;
  App.visitorInfo = { kind: kind, period: cfg.period, phase: iAttr[0], cross: cfg.cross, side: iAttr[3] > 0 ? 1 : -1 };

  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uCamPos: U.uCamPos, uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK,
      uAmbCol: U.uAmbCol, uSunCol: U.uSunCol, uWindDir: U.uWindDir,
      uMap: { value: makeVisitorTexture(kind, R) },
      uSize: { value: cfg.size }, uDist: { value: cfg.dist }, uHeight: { value: cfg.height },
      uPeriod: { value: cfg.period }, uCross: { value: cfg.cross },
      uGround: { value: groundY }, uWalks: { value: kind === 'deer' ? 1 : 0 }
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: GLSL['visitors.vert'],
    fragmentShader: GLSL['visitors.frag']
  });
  mat.uniforms.uFogCol = U.uFogCol;
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  scene.add(m);
  App.visitor = m;
}

/* ---------- birds ---------- */
function buildBirds(scene, P, R, U) {
  if (!P.birds) return;
  var COUNT = P.birds;
  var quad = new THREE.PlaneGeometry(1, 1);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  var iAttr = new Float32Array(COUNT * 4);
  for (var i = 0; i < COUNT; i++) {
    iAttr[i * 4] = R.range(0, 6.283);          /* phase */
    iAttr[i * 4 + 1] = R.range(28, 95);        /* height */
    iAttr[i * 4 + 2] = R.range(1.4, 3.4);      /* size */
    /* a negative speed marks a bird that circles rather than crosses */
    iAttr[i * 4 + 3] = (P.biome.raptors && R.chance(0.75)) ? -R.range(0.5, 0.9) : R.range(0.6, 1.5);
  }
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
  geo.instanceCount = COUNT;
  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK,
      uSunDir: U.uSunDir, uSunCol: U.uSunCol,
      uMap: { value: makeBirdTexture() }, uCamPos: U.uCamPos,
      uDrift: { value: R.range(-1, 1) }
    },
    transparent: true, depthWrite: false,
    vertexShader: GLSL['birds.vert'],
    fragmentShader: GLSL['birds.frag']
  });
  mat.uniforms.uFogCol = U.uFogCol;
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  scene.add(m);
  App.birdMesh = m;
}

/* ---------- rain & snow ---------- */
function buildPrecip(scene, P, R, U) {
  var W = P.weather;
  if (W.rain > 0) {
    var COUNT = Math.round((2600 * W.rain + 700) * Q().precipMul);
    var quad = new THREE.PlaneGeometry(1, 1);
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    var iPos = new Float32Array(COUNT * 3);
    var iAttr = new Float32Array(COUNT * 3);
    for (var i = 0; i < COUNT; i++) {
      iPos[i * 3] = R.range(-45, 45);
      iPos[i * 3 + 1] = R.range(0, 34);
      iPos[i * 3 + 2] = R.range(-58, -1.5);
      iAttr[i * 3] = R.range(0.35, 1.05) * (0.6 + W.rain * 0.8);
      iAttr[i * 3 + 1] = R.range(0.008, 0.019);
      iAttr[i * 3 + 2] = R.range(0.6, 1.5);
    }
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 3));
    geo.instanceCount = COUNT;
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime, uWindDir: U.uWindDir, uWind: U.uWind, uGust: U.uGust,
        uCamPos: U.uCamPos, uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK,
        uAmbCol: U.uAmbCol, uSunCol: U.uSunCol,
        uIntensity: { value: W.rain }
      },
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: GLSL['precip.vert'],
      fragmentShader: GLSL['precip.frag']
    });
    var rain = new THREE.Mesh(geo, mat);
    rain.frustumCulled = false;
    rain.renderOrder = 3;
    scene.add(rain);
    App.rain = rain;
  }

  if (P.leafFall) buildFlakes(scene, P, R, U, {
    count: Math.round(P.leafFall * Q().precipMul), colour: P.fallCol,
    size: [0.05, 0.13], fall: [0.28, 0.6], sway: 1.8, intensity: 0.85
  });
  if (W.snow > 0) buildFlakes(scene, P, R, U, {
    count: Math.round((2000 * W.snow + 600) * Q().precipMul),
    colour: '#f5f8ff', size: [0.025, 0.075], fall: [0.55, 1.4],
    sway: 1.0, intensity: W.snow, snow: true
  });
}

/* anything that drifts down: snow, autumn leaves, blossom */
function buildFlakes(scene, P, R, U, o) {
  var CN = o.count;
  if (!CN) return;
  var q2 = new THREE.PlaneGeometry(1, 1);
  var g2 = new THREE.InstancedBufferGeometry();
  g2.index = q2.index;
  g2.setAttribute('position', q2.attributes.position);
  g2.setAttribute('uv', q2.attributes.uv);
  var sPos = new Float32Array(CN * 3);
  var sAttr = new Float32Array(CN * 3);
  for (var j = 0; j < CN; j++) {
    sPos[j * 3] = R.range(-40, 40);
    sPos[j * 3 + 1] = R.range(0, 30);
    sPos[j * 3 + 2] = R.range(-52, -1.5);
    sAttr[j * 3] = R.range(o.size[0], o.size[1]);
    sAttr[j * 3 + 1] = R.range(0, 6.283);
    sAttr[j * 3 + 2] = R.range(o.fall[0], o.fall[1]);
  }
  g2.setAttribute('iPos', new THREE.InstancedBufferAttribute(sPos, 3));
  g2.setAttribute('iAttr', new THREE.InstancedBufferAttribute(sAttr, 3));
  g2.instanceCount = CN;
  var m2 = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uWindDir: U.uWindDir, uWind: U.uWind, uGust: U.uGust,
      uCamPos: U.uCamPos, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uFogCol: U.uFogCol,
      uAmbCol: U.uAmbCol, uSunCol: U.uSunCol,
      uMap: { value: makeSoftDot() },
      uColour: { value: new THREE.Color(o.colour) },
      uSway: { value: o.sway },
      uSpin: { value: o.snow ? 0.0 : 1.0 },
      uIntensity: { value: o.intensity }
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: GLSL['flakes.vert'],
    fragmentShader: GLSL['flakes.frag']
  });
  var mesh = new THREE.Mesh(g2, m2);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  scene.add(mesh);
  if (o.snow) App.snow = mesh; else App.leaves = mesh;
}

