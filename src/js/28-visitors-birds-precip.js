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
    vertexShader: [
      'attribute vec4 iAttr;',
      'uniform float uTime, uFogDensity, uSize, uDist, uHeight, uPeriod, uCross, uGround, uWalks;',
      'uniform vec3 uCamPos;',
      'varying vec2 vUv; varying float vFade;',
      GLSL_COMMON,
      'void main(){',
      '  float cyc = fract(uTime / uPeriod + iAttr.x + iAttr.z * 0.004);',
      '  float span = uCross;',
      '  float u = cyc / span;',
      '  vFade = step(cyc, span) * smoothstep(0.0, 0.10, u) * smoothstep(1.0, 0.88, u);',
      '  float side = iAttr.w > 0.0 ? 1.0 : -1.0;',
      '  float travel = mix(-1.15, 1.15, u) * side;',
      '  float d = uDist * iAttr.y + iAttr.z * 2.0;',
      '  vec3 wp = vec3(travel * d * 0.75 + iAttr.z, uGround + uHeight + sin(uTime * 0.07 + iAttr.x * 6.0) * uHeight * 0.05, -d);',
      '  float bob = uWalks * abs(sin(uTime * 1.6 + iAttr.x * 9.0)) * uSize * 0.045;',
      '  wp.y += bob;',
      '  vec3 toCam = normalize(vec3(uCamPos.x - wp.x, 0.0, uCamPos.z - wp.z));',
      '  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));',
      '  vec3 up = uWalks > 0.5 ? vec3(0.0,1.0,0.0) : normalize(cross(toCam, right));',
      '  vec3 p = wp + right * position.x * uSize * side + up * position.y * uSize;',
      '  vUv = uv;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  vFade *= 1.0 - fogAmt(-mv.z, uFogDensity) * 0.9;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform sampler2D uMap; uniform vec3 uFogCol, uAmbCol, uSunCol;',
      'varying vec2 vUv; varying float vFade;',
      'void main(){',
      '  vec4 t = texture2D(uMap, vUv);',
      '  if (t.a < 0.05 || vFade <= 0.001) discard;',
      '  vec3 c = t.rgb * (uAmbCol * 0.9 + uSunCol * 0.55);',
      '  gl_FragColor = vec4(mix(c, uFogCol, 0.25), t.a * vFade);',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
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
    vertexShader: [
      'attribute vec4 iAttr;',
      'uniform float uTime, uFogDensity, uDrift; uniform vec3 uCamPos, uFogCol, uSunDir, uSunCol;',
      'varying vec2 vUv; varying float vFog; varying vec3 vHaze;',
      GLSL_COMMON,
      'void main(){',
      '  vec3 wp; float flap;',
      '  if (iAttr.w < 0.0) {',
      '    float ang = uTime * 0.045 * abs(iAttr.w) + iAttr.x;',
      '    float orbit = 34.0 + 46.0 * fract(iAttr.x * 0.37);',
      '    wp = vec3(sin(ang) * orbit, iAttr.y + sin(ang * 0.7) * 5.0,',
      '              -95.0 - 60.0 * fract(iAttr.x * 0.61) + cos(ang) * orbit);',
      '    flap = 0.86 + 0.14 * sin(uTime * 1.6 + iAttr.x);',
      '  } else {',
      '    float t = uTime * 0.05 * iAttr.w + iAttr.x;',
      '    float loop = 300.0;',
      '    float px = mod(t * 250.0, loop) - loop * 0.5;',
      '    float pz = -120.0 - 70.0 * sin(iAttr.x) - 30.0 * sin(t * 0.7);',
      '    wp = vec3(px * (uDrift > 0.0 ? 1.0 : -1.0), iAttr.y + sin(t * 1.7) * 4.0, pz);',
      '    flap = 0.55 + 0.45 * sin(uTime * 7.0 + iAttr.x * 5.0);',
      '  }',
      '  vec3 toCam = normalize(uCamPos - wp);',
      '  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));',
      '  vec3 up = normalize(cross(toCam, right));',
      '  vec3 p = wp + right * position.x * iAttr.z + up * position.y * iAttr.z * flap;',
      '  vUv = uv;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  vFog = fogAmtH(-mv.z, uFogDensity, p.y);',
      '  vHaze = hazeAt(uFogCol, normalize(p - cameraPosition), uSunDir, uSunCol, vFog);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform sampler2D uMap;',
      'varying vec2 vUv; varying float vFog; varying vec3 vHaze;',
      'void main(){',
      '  vec4 t = texture2D(uMap, vUv);',
      '  gl_FragColor = vec4(mix(t.rgb, vHaze, vFog), t.a * (1.0 - vFog) * 0.85);',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
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
      vertexShader: [
        'attribute vec3 iPos; attribute vec3 iAttr;',
        'uniform float uTime, uWind, uGust, uFogDensity, uIntensity;',
        'uniform vec2 uWindDir; uniform vec3 uCamPos;',
        'varying float vA;',
        GLSL_COMMON,
        'void main(){',
        '  float speed = 15.0 + iAttr.z * 12.0 + uGust * 6.0;',
        '  float range = 34.0;',
        '  float y = mod(iPos.y - uTime * speed, range);',
        '  float slant = uWind * (0.35 + 0.5 * uGust) * 0.5;',
        '  vec3 wp = vec3(iPos.x + uWindDir.x * (range - y) * slant * 0.35, y, iPos.z + uWindDir.y * (range - y) * slant * 0.35);',
        /* an on-shore wind must not blow a drop through the glass: wrap the
           drift back into the outdoor band, as the flakes do */
        '  wp.z = mod(wp.z + 58.0, 56.5) - 58.0;',
        '  vec3 dir = normalize(vec3(uWindDir.x * slant, -1.0, uWindDir.y * slant));',
        '  vec3 toCam = normalize(uCamPos - wp);',
        '  vec3 right = normalize(cross(dir, toCam));',
        '  float dr = length(wp - cameraPosition);',
        '  float grow = 1.0 + smoothstep(6.0, 40.0, dr) * 3.2;',
        '  vec3 p = wp + right * position.x * iAttr.y * grow + dir * position.y * iAttr.x * 2.2;',
        '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
        '  float d = -mv.z;',
        '  vA = (1.0 - fogAmt(d, uFogDensity)) * uIntensity * (0.30 + 0.5 * smoothstep(2.0, 16.0, d)) * 0.75',
        '     / grow * (1.0 - smoothstep(30.0, 46.0, dr));',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
      GLSL_TONE,
        'varying float vA;',
        'uniform vec3 uAmbCol, uSunCol;',
        'void main(){',
        '  vec3 lit = vec3(0.80, 0.85, 0.92) * clamp(uAmbCol * 1.6 + uSunCol * 0.5, 0.10, 1.0);',
        '  gl_FragColor = vec4(lit, vA);',
        '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
      ].join('\n')
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
    vertexShader: [
      'attribute vec3 iPos; attribute vec3 iAttr;',
      'uniform float uTime, uWind, uGust, uFogDensity, uIntensity, uSway, uSpin;',
      'uniform vec2 uWindDir; uniform vec3 uCamPos;',
      'varying vec2 vUv; varying float vA;',
      GLSL_COMMON,
      'void main(){',
      '  float range = 30.0;',
      '  float fall = iAttr.z;',
      '  float y = mod(iPos.y - uTime * fall, range);',
      '  float age = range - y;',
      '  float drift = uWind * (0.4 + 0.6 * uGust);',
      '  vec3 wp = vec3(iPos.x, y, iPos.z);',
      '  wp.x += sin(uTime * 0.45 * uSway + iAttr.y) * 0.9 * uSway + uWindDir.x * age * drift * 0.42;',
      '  wp.z += cos(uTime * 0.37 * uSway + iAttr.y * 1.7) * 0.9 * uSway + uWindDir.y * age * drift * 0.42;',
      '  wp.x = mod(wp.x + 45.0, 90.0) - 45.0;',
      '  wp.z = mod(wp.z + 57.0, 56.0) - 57.0;',
      '  vec3 toCam = normalize(uCamPos - wp);',
      '  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));',
      '  vec3 up = normalize(cross(toCam, right));',
      '  float sp = uSpin * (uTime * 2.1 + iAttr.y * 4.0);',
      '  vec2 q = vec2(position.x * cos(sp) - position.y * sin(sp),',
      '               position.x * sin(sp) + position.y * cos(sp));',
      '  float squash = mix(1.0, 0.35 + 0.65 * abs(sin(uTime * 1.7 + iAttr.y)), uSpin);',
      '  float df = length(wp - cameraPosition);',
      '  float grow = 1.0 + smoothstep(6.0, 36.0, df) * 2.2;',
      '  vec3 p = wp + right * q.x * iAttr.x * grow + up * q.y * iAttr.x * squash * grow;',
      '  vUv = uv;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  float d = -mv.z;',
      '  vA = (1.0 - fogAmt(d, uFogDensity)) * uIntensity * smoothstep(1.2, 5.0, d)',
      '     / (0.6 + 0.4 * grow) * (1.0 - smoothstep(28.0, 44.0, df));',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform sampler2D uMap; uniform vec3 uColour, uAmbCol, uSunCol;',
      'uniform float uSpin;',
      'varying vec2 vUv; varying float vA;',
      'void main(){',
      '  float a = texture2D(uMap, vUv).a;',
      '  if (uSpin > 0.5) a = smoothstep(0.25, 0.6, a);',
      '  vec3 c = uColour * clamp(uAmbCol * 1.5 + uSunCol * 0.6, 0.12, 1.0);',
      '  gl_FragColor = vec4(c, a * vA * 0.9);',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
  });
  var mesh = new THREE.Mesh(g2, m2);
  mesh.frustumCulled = false;
  mesh.renderOrder = 3;
  scene.add(mesh);
  if (o.snow) App.snow = mesh; else App.leaves = mesh;
}

