/* ---------- motes: specks turning in the light just outside the glass ----------
   These used to be drawn on the overlay above everything, which put them in
   front of the frame and made them look like they were in the room. As part of
   the scene they are occluded by the mullions like anything else. */
function buildMotes(scene, P, R, U, H) {
  if (App.reduceMotion) return;
  var N = Math.round(90 * (Q().precipMul || 1));
  var quad = new THREE.PlaneGeometry(1, 1);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
  var iPos = new Float32Array(N * 3), iAttr = new Float32Array(N * 4);
  for (var i = 0; i < N; i++) {
    var a = R.range(-1.15, 1.15), r = 4.5 + Math.pow(R.f(), 1.4) * 16;
    var x = Math.sin(a) * r, z = -Math.cos(a) * r;
    iPos[i * 3] = x;
    iPos[i * 3 + 1] = H(x, z) + R.range(0.2, 3.4);
    iPos[i * 3 + 2] = z;
    iAttr[i * 4] = R.range(0.012, 0.030);       /* size */
    iAttr[i * 4 + 1] = R.range(0, 6.283);       /* phase */
    iAttr[i * 4 + 2] = R.range(0.10, 0.34);     /* drift speed */
    iAttr[i * 4 + 3] = R.range(0.5, 1.0);       /* brightness */
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
  geo.instanceCount = N;
  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uCamPos: U.uCamPos, uWind: U.uWind, uWindDir: U.uWindDir,
      uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
      uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uFogCol: U.uFogCol
    },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: [
      'attribute vec3 iPos; attribute vec4 iAttr;',
      'uniform float uTime, uWind, uFogDensity;',
      'uniform vec2 uWindDir; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;',
      'varying vec2 vUv; varying float vA;',
      GLSL_COMMON,
      'void main(){',
      '  float t = uTime * iAttr.z + iAttr.y;',
      '  vec3 wp = iPos;',
      '  wp.x += sin(t * 0.7) * 0.5 + sin(t * 0.23 + iAttr.y) * 0.9;',
      '  wp.y += sin(t * 0.41 + iAttr.y * 1.7) * 0.35;',
      '  wp.z += cos(t * 0.53) * 0.6;',
      '  wp.xz += uWindDir * uWind * 0.3;',
      '  wp.z = min(wp.z, -3.0);',
      '  vec3 toCam = normalize(uCamPos - wp);',
      '  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));',
      '  vec3 up = normalize(cross(toCam, right));',
      '  float size = iAttr.x;',
      '  vec3 p = wp + right * position.x * size + up * position.y * size;',
      /* a speck only shows when it catches the light nearly edge-on to the sun */
      '  float glint = pow(max(dot(toCam, normalize(uSunDir)), 0.0), 3.0);',
      '  vA = iAttr.w * (0.10 + 0.90 * glint) * (0.35 + 0.65 * length(uSunCol));',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  vA *= 1.0 - fogAmt(-mv.z, uFogDensity);',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec2 vUv; varying float vA;',
      'void main(){',
      '  float d = length(vUv - 0.5) * 2.0;',
      '  float core = 1.0 - smoothstep(0.0, 1.0, d);',
      '  float a = core * vA * 0.55;',
      '  if (a < 0.004) discard;',
      '  gl_FragColor = vec4(vec3(1.0, 0.97, 0.90) * a, a);',
      '}'
    ].join('\n')
  });
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 7;
  scene.add(m);
  App.propMeshes.push(m);
}

/* ---------- small life ----------
   A lizard holds still for half a minute, then darts a body-length or two
   and holds again. A scorpion does the same, slower. It is all on a
   per-creature clock in the vertex shader, so nothing runs on the CPU. */
function makeCritterTexture(kind) {
  var S = 64, c = cnv(S, S), g = c.getContext('2d');
  g.lineCap = 'round'; g.lineJoin = 'round';
  if (kind === 'lizard') {
    g.fillStyle = '#6d6a4c'; g.strokeStyle = '#6d6a4c';
    g.beginPath(); g.ellipse(S * 0.42, S * 0.5, S * 0.18, S * 0.075, 0, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(S * 0.64, S * 0.5, S * 0.07, S * 0.055, 0, 0, 6.283); g.fill();
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(S * 0.25, S * 0.5); g.quadraticCurveTo(S * 0.12, S * 0.46, S * 0.04, S * 0.56); g.stroke();
    g.lineWidth = 2;
    var legs = [[0.34, -1, -0.6], [0.34, 1, -0.6], [0.52, -1, 0.5], [0.52, 1, 0.5]];
    for (var q = 0; q < legs.length; q++) { var l = legs[q];
      g.beginPath(); g.moveTo(S * l[0], S * 0.5); g.lineTo(S * (l[0] + l[2] * 0.06), S * (0.5 + l[1] * 0.14)); g.lineTo(S * (l[0] + l[2] * 0.02), S * (0.5 + l[1] * 0.20)); g.stroke(); }
    g.fillStyle = '#4a4834';
    for (var d = 0; d < 6; d++) { g.beginPath(); g.arc(S * (0.28 + d * 0.06), S * 0.5, 1.2, 0, 6.283); g.fill(); }
  } else {
    g.fillStyle = '#3a2f24'; g.strokeStyle = '#3a2f24';
    g.beginPath(); g.ellipse(S * 0.5, S * 0.5, S * 0.14, S * 0.07, 0, 0, 6.283); g.fill();
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(S * 0.36, S * 0.5); g.quadraticCurveTo(S * 0.18, S * 0.5, S * 0.14, S * 0.3);
    g.quadraticCurveTo(S * 0.13, S * 0.2, S * 0.2, S * 0.2); g.stroke();
    g.lineWidth = 2;
    for (var lg = 0; lg < 4; lg++) for (var sd = -1; sd <= 1; sd += 2) {
      var x0 = S * (0.42 + lg * 0.05);
      g.beginPath(); g.moveTo(x0, S * 0.5); g.lineTo(x0 + S * 0.02, S * (0.5 + sd * 0.13)); g.lineTo(x0 + S * 0.05, S * (0.5 + sd * 0.17)); g.stroke();
    }
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(S * 0.62, S * 0.46); g.lineTo(S * 0.74, S * 0.36); g.lineTo(S * 0.80, S * 0.40); g.stroke();
    g.beginPath(); g.moveTo(S * 0.62, S * 0.54); g.lineTo(S * 0.74, S * 0.64); g.lineTo(S * 0.80, S * 0.60); g.stroke();
  }
  return tex(c, false);
}

function buildCritters(scene, P, R, U, H) {
  /* Lizards bask by day; scorpions hunt by night and hide from the sun (the
     night's come from a stream of their own). */
  if (!P.biome.critters || P.weather.rain > 0.3) return;
  var dark = P.timeA === 'night';
  if (dark && !/desert|canyon|oasis/.test(P.biomeKey)) return;
  if (dark) R = RNG(P.base + '/build/critters/night' + (P.nonce ? '/' + P.nonce : ''));
  var kinds = [dark ? ['scorpion', R.int(1, 3)] : ['lizard', R.int(1, 3)]];
  for (var ki = 0; ki < kinds.length; ki++) {
    var kind = kinds[ki][0], n = kinds[ki][1];
    if (!n) continue;
    var quad = new THREE.PlaneGeometry(1, 1); quad.rotateX(-Math.PI / 2);
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
    var iPos = new Float32Array(n * 3), iAttr = new Float32Array(n * 4), iDart = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
      var a = R.range(-0.9, 0.9), rr = R.range(2.2, 9);
      var x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
      iPos[i * 3] = x; iPos[i * 3 + 1] = H(x, z) + 0.035; iPos[i * 3 + 2] = z;
      iAttr[i * 4] = kind === 'lizard' ? R.range(0.16, 0.24) : R.range(0.09, 0.13);
      iAttr[i * 4 + 1] = R.range(0, 1);
      iAttr[i * 4 + 2] = kind === 'lizard' ? R.range(22, 48) : R.range(30, 70);
      iAttr[i * 4 + 3] = kind === 'lizard' ? 0.35 : 1.4;
      var da = R.range(0, 6.283), dl = kind === 'lizard' ? R.range(0.5, 1.2) : R.range(0.25, 0.5);
      iDart[i * 3] = Math.cos(da) * dl; iDart[i * 3 + 1] = da; iDart[i * 3 + 2] = Math.sin(da) * dl;
    }
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
    geo.setAttribute('iDart', new THREE.InstancedBufferAttribute(iDart, 3));
    geo.instanceCount = n;
    var mat = new THREE.ShaderMaterial({
      /* the clock drifts on after the build, so each kind keeps its own
         hours as it goes: scorpions go to ground as the sky pales toward
         dawn, lizards once the sun is down */
      uniforms: { uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol, uMap: { value: makeCritterTexture(kind) },
        uNight: App.skyU.uNight, uNoct: { value: kind === 'scorpion' ? 1 : 0 } },
      transparent: true, depthWrite: false, alphaTest: 0.02, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: [
        'attribute vec3 iPos; attribute vec4 iAttr; attribute vec3 iDart;',
        'uniform float uTime; uniform vec3 uSunDir, uSunCol, uAmbCol;',
        'varying vec2 vUv; varying vec3 vTint;',
        'void main(){',
        '  float len = iAttr.x, period = iAttr.z, dur = iAttr.w;',
        '  float t = uTime + iAttr.y * period;',
        '  float cyc = floor(t / period);',
        '  float ph = clamp((t - cyc * period) / dur, 0.0, 1.0);',
        '  float ease = ph * ph * (3.0 - 2.0 * ph);',
        '  float dir = mod(cyc, 2.0) < 0.5 ? 1.0 : -1.0;',
        '  float from = dir > 0.0 ? 0.0 : 1.0;',
        '  float at = from + dir * ease;',
        '  vec3 wp = iPos + vec3(iDart.x, 0.0, iDart.z) * at;',
        '  float heading = iDart.y + (dir > 0.0 ? 0.0 : 3.14159);',
        '  float c = cos(heading), s = sin(heading);',
        '  vec3 lp = vec3(position.x * c - position.z * s, 0.0, position.x * s + position.z * c) * len;',
        '  vTint = uAmbCol * 1.1 + uSunCol * max(uSunDir.y, 0.0) * 1.1;',
        '  vUv = uv;',
        '  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp + lp, 1.0);',
        '}'
      ].join('\n'),
      fragmentShader: [
        GLSL_TONE,
        'uniform sampler2D uMap; uniform float uNight, uNoct; varying vec2 vUv; varying vec3 vTint;',
        'void main(){ vec4 t = texture2D(uMap, vUv);',
        '  t.a *= mix(1.0 - smoothstep(0.0, 0.4, uNight), smoothstep(0.2, 0.7, uNight), uNoct);',
        '  if (t.a < 0.02) discard;',
        '  gl_FragColor = vec4(tone(t.rgb * vTint), t.a); }'
      ].join('\n')
    });
    var m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    scene.add(m);
    App.propMeshes.push(m);
  }
}

/* ---------- near-field clutter ----------
   Everything within a dozen metres is where the eye actually lands, so it gets
   its own scatter of stones, litter and tufts lying flat on the ground. */
function makeSprayTexture(kind, P, R) {
  /* a hand's span of twig: many small leaves at 256 square, so a card no
     longer shows a dozen leaves the size of plates */
  var S = 256, c = cnv(S, S), g = c.getContext('2d');
  var base, lite, lw = 0.038, ll = 0.064, n = 125;
  if (kind === 'pine') { base = new THREE.Color('#1f3a2a').multiplyScalar(P.treeTint); lite = base.clone().lerp(new THREE.Color('#7fa066'), 0.5); lw = 0.013; ll = 0.085; n = 150; }
  else if (kind === 'olive') { base = new THREE.Color('#6f7d5c'); lite = new THREE.Color('#b9c2a0'); lw = 0.017; ll = 0.054; n = 140; }
  else if (kind === 'blossom') { base = new THREE.Color(P.blossomCol || '#f2d3de'); lite = new THREE.Color('#ffffff'); lw = 0.023; ll = 0.028; n = 150; }
  else if (kind === 'acacia') { base = new THREE.Color('#4e5a2e').multiplyScalar(P.treeTint); lite = base.clone().lerp(new THREE.Color('#b3ba78'), 0.5); lw = 0.012; ll = 0.022; n = 180; }
  else { base = new THREE.Color(P.leafDark || P.grass.base).multiplyScalar(0.9 * P.treeTint); lite = new THREE.Color(P.leafLight || P.grass.tip).multiplyScalar(0.95 * P.treeTint); }
  /* twigs radiating from the middle, then the leaves on top of them */
  g.strokeStyle = '#4b3a2b'; g.lineWidth = 3.0; g.lineCap = 'round';
  for (var tw = 0; tw < 5; tw++) {
    var ta = R.f() * 6.283, tl = S * R.range(0.22, 0.42);
    g.beginPath(); g.moveTo(S * 0.5, S * 0.5); g.lineTo(S * 0.5 + Math.cos(ta) * tl, S * 0.5 + Math.sin(ta) * tl); g.stroke();
  }
  leafSpray(g, S / 2, S / 2, S * 0.44, base.clone().multiplyScalar(0.7), lite, Math.round(n * 2.4), S * lw * 0.62, S * ll * 0.62, R);
  return tex(c, false);
}

function makeClutterTexture(kind, P, R) {
  var S = 128, c = cnv(S, S), g = c.getContext('2d');
  var rgb = function (col) {
    return 'rgb(' + Math.round(col.r * 255) + ',' + Math.round(col.g * 255) + ',' + Math.round(col.b * 255) + ')';
  };
  /* Desert stones are dark with varnish, a few pale with quartz, and small:
     a pebble a few centimetres across, not a hand-sized orange blob. */
  var varnish = function (G) {
    var t = R.f();
    var col = t < 0.55 ? new THREE.Color('#3a2a20').lerp(new THREE.Color('#5a4434'), R.f())
      : (t < 0.85 ? new THREE.Color(P.rockCol).lerp(new THREE.Color('#4a3a2e'), R.range(0.3, 0.7))
      : new THREE.Color('#b5a898').lerp(new THREE.Color(P.grass.soil), R.range(0, 0.4)));
    return col.offsetHSL(0, R.range(-0.04, 0.02), R.range(-0.05, 0.04));
  };
  if (P.biome.ground === 'sand' && P.biomeKey !== 'coast' && kind !== 'litter') {
    R = RNG(P.base + '/clutter/' + kind);
    for (var vp = 0; vp < (kind === 'stones' ? 46 : 70); vp++) {
      var vx = R.range(0.08, 0.92) * S, vy = R.range(0.08, 0.92) * S;
      var vw = S * (kind === 'stones' ? R.range(0.012, 0.05) : R.range(0.008, 0.026)), vh = vw * R.range(0.55, 0.95), va = R.range(0, 3.14);
      var vc = varnish();
      g.fillStyle = rgb(vc.clone().multiplyScalar(0.55));
      g.beginPath(); g.ellipse(vx + vw * 0.2, vy + vh * 0.25, vw, vh, va, 0, 6.283); g.fill();
      g.fillStyle = rgb(vc);
      g.beginPath(); g.ellipse(vx, vy, vw, vh, va, 0, 6.283); g.fill();
      g.fillStyle = rgb(vc.clone().multiplyScalar(1.35));
      g.beginPath(); g.ellipse(vx - vw * 0.25, vy - vh * 0.28, vw * 0.45, vh * 0.38, va, 0, 6.283); g.fill();
    }
  } else if (kind === 'stones') {
    var rc = new THREE.Color(P.rockCol);
    for (var i = 0; i < 7; i++) {
      var x = R.range(0.2, 0.8) * S, y = R.range(0.2, 0.8) * S;
      var w = S * R.range(0.07, 0.17), h = w * R.range(0.6, 1.0);
      var col = rc.clone().offsetHSL(0, R.range(-0.05, 0.05), R.range(-0.14, 0.16));
      g.fillStyle = rgb(col);
      g.beginPath(); g.ellipse(x, y, w, h, R.range(0, 3.14), 0, 6.283); g.fill();
      g.fillStyle = rgb(col.clone().multiplyScalar(1.22));
      g.beginPath(); g.ellipse(x - w * 0.22, y - h * 0.24, w * 0.5, h * 0.42, 0, 0, 6.283); g.fill();
    }
  } else if (kind === 'litter') {
    if (P.season.blossom && P.blossomCol) {
      var pc = new THREE.Color(P.blossomCol).lerp(new THREE.Color(P.grass.base), 0.35);
      for (var j = 0; j < 70; j++) {
        var pcc = pc.clone().offsetHSL(0, 0, R.range(-0.08, 0.06));
        g.fillStyle = 'rgba(' + Math.round(pcc.r * 255) + ',' + Math.round(pcc.g * 255) + ',' + Math.round(pcc.b * 255) + ',' + R.range(0.55, 0.85) + ')';
        g.save();
        g.translate(R.f() * S, R.f() * S); g.rotate(R.f() * 6.283);
        g.beginPath(); g.ellipse(0, 0, S * R.range(0.012, 0.022), S * R.range(0.009, 0.015), 0, 0, 6.283); g.fill();
        g.restore();
      }
    } else {
      var lc = new THREE.Color(P.leafDark || P.leafLight || P.grass.dry).lerp(new THREE.Color(P.grass.soil), 0.25);
      for (var j2 = 0; j2 < 26; j2++) {
        g.fillStyle = rgb(lc.clone().offsetHSL(R.range(-0.05, 0.05), R.range(-0.1, 0.1), R.range(-0.15, 0.12)));
        g.save();
        g.translate(R.f() * S, R.f() * S); g.rotate(R.f() * 6.283);
        g.beginPath(); g.ellipse(0, 0, S * R.range(0.03, 0.065), S * R.range(0.012, 0.028), 0, 0, 6.283); g.fill();
        g.restore();
      }
    }
  } else if (P.biome.ground === 'sand') {
    /* nothing grows flat on sand or bare rock: small dark stones and grit
       (the coast; the desert's are drawn above) */
    var gc = new THREE.Color(P.rockCol).lerp(new THREE.Color(P.grass.soil), 0.35);
    for (var gp = 0; gp < 40; gp++) {
      var gx = R.range(0.1, 0.9) * S, gy = R.range(0.1, 0.9) * S, gw = S * R.range(0.012, 0.04);
      var gcol = gc.clone().offsetHSL(0, R.range(-0.05, 0.03), R.range(-0.16, 0.04));
      g.fillStyle = rgb(gcol);
      g.beginPath(); g.ellipse(gx, gy, gw, gw * R.range(0.6, 0.95), R.range(0, 3.14), 0, 6.283); g.fill();
    }
  } else { /* tuft: a low rosette of leaves seen from above, darker than the
              blade tips and a little see-through so it reads as a plant on the
              ground rather than a pale blotch */
    var tc = new THREE.Color(P.grass.cb || P.grass.base).lerp(new THREE.Color(P.grass.ct || P.grass.tip), 0.45);
    g.globalAlpha = 0.82;
    for (var k = 0; k < 22; k++) {
      var a = R.f() * 6.283, len = S * R.range(0.14, 0.30);
      g.fillStyle = rgb(tc.clone().offsetHSL(0, 0, R.range(-0.16, 0.04)));
      g.save(); g.translate(S / 2, S / 2); g.rotate(a);
      g.beginPath(); g.ellipse(len * 0.55, 0, len * 0.55, S * R.range(0.035, 0.06), 0, 0, 6.283); g.fill();
      g.restore();
    }
  }
  return tex(c, false);
}

function buildClutter(scene, P, R, U, H) {
  if ((P.terrainKind || P.biome.terrain) === 'salt') return;
  var kinds = ['stones', 'tufts'];
  if (P.leafFall || P.seasonKey === 'autumn') kinds.push('litter');
  var perKind = Math.round(520 * Q().propMul);
  for (var ki = 0; ki < kinds.length; ki++) {
    var kind = kinds[ki];
    var quad = new THREE.PlaneGeometry(1, 1);
    quad.rotateX(-Math.PI / 2);                 /* lying flat on the ground */
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    var items = [], guard = 0;
    while (items.length < perKind && guard < perKind * 25) {
      guard++;
      var a = R.range(-1.30, 1.30);
      var rr = 1.6 + Math.pow(R.f(), 1.9) * 17;   /* everything inside ~19 m */
      var x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
      if (z > -0.9) continue;
      if (P.waterY != null && H(x, z) < P.waterY + 0.2) continue;
      if (P._inRiver && P._inRiver(x, z)) continue;
      /* a worn path is where nothing low grows */
      if (kind === 'tufts' && P.pathKind && onPathAt(P, x, z) > 0.3) continue;
      if (P.pathKind === 'lane' && onPathAt(P, x, z) > 0.05) continue;   /* a road is kept clear */
      if (kind !== 'litter' && P.clearKind && P.clearKind < 3 && clearAt(P, x, z + 0.4) > 0.05) continue;
      var csz = R.range(0.22, 0.85) * (kind === 'tufts' && !P.biome.ground === 'sand' ? 1.5 : 1);
      var crot = R.range(0, 6.283);
      /* the stones are painted lit from the upper left of their card; turn
         each card so that side faces the sun, with a little scatter */
      if (kind === 'stones') crot = Math.atan2(-Math.cos(P.sunAz), Math.sin(P.sunAz)) - Math.atan2(-0.74, -0.67) + (crot - 3.14) * 0.11;
      items.push([x, H(x, z) + 0.03, z, csz, crot]);
    }
    /* a sand sea is sand: a stone here and there, no more (thinned after
       the fact, so the builder's stream is drawn as before) */
    if (P.erg || P.oasisW) items = items.filter(function (it) { return ihash(Math.round(it[0] * 10), Math.round(it[2] * 10), 77) < (P.erg ? 0.15 : 0.3); });
    if (!items.length) continue;
    var iPos = new Float32Array(items.length * 3);
    var iAttr = new Float32Array(items.length * 2);
    for (var i = 0; i < items.length; i++) {
      iPos[i * 3] = items[i][0]; iPos[i * 3 + 1] = items[i][1]; iPos[i * 3 + 2] = items[i][2];
      iAttr[i * 2] = items[i][3]; iAttr[i * 2 + 1] = items[i][4];
    }
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 2));
    geo.instanceCount = items.length;
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
        uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
        uSnow: U.uSnow, uSnowCol: U.uSnowCol, uCamPos: U.uCamPos,
        uMap: { value: makeClutterTexture(kind, P, R) }
      },
      /* lying flat and seen at a grazing angle, these are mostly partial alpha;
         blended, their edges are smooth and hold still. Dithered, they sparkle. */
      transparent: true, depthWrite: false, alphaTest: 0.02, side: THREE.DoubleSide,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
      vertexShader: [
        'attribute vec3 iPos; attribute vec2 iAttr;',
        'uniform float uTime, uFogDensity, uShadow, uSnow;',
        'uniform vec3 uSunDir, uSunCol, uAmbCol, uSnowCol, uCamPos, uFogCol;',
        'varying vec2 vUv; varying float vFog; varying vec3 vTint; varying float vNear; varying vec3 vHaze;',
        GLSL_COMMON,
        'void main(){',
        '  float sc = iAttr.x, rot = iAttr.y;',
        '  float c = cos(rot), s = sin(rot);',
        '  float dN = length(iPos - cameraPosition);',
        '  float keep = (1.0 - smoothstep(11.0, 18.0, dN)) * (1.0 - smoothstep(0.15, 0.45, uSnow));',
        '  vec3 lp = vec3(position.x * c - position.z * s, 0.0, position.x * s + position.z * c) * sc * keep;',
        '  vec3 wp = iPos + lp;',
        '  vec2 bk = bakedRG(wp.xz);',
        '  float sh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);',
        '  float diff = max(uSunDir.y, 0.0);',
        '  vec3 L = uAmbCol * 1.1 * bk.y + uSunCol * diff * 1.15 * sh;',
        '  vTint = mix(L, uSnowCol * L * 0.82, uSnow * 0.8);',
        '  vUv = uv;',
        '  vNear = 1.0;',
        '  vec4 mv = modelViewMatrix * vec4(wp, 1.0);',
        '  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);',
        '  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
      GLSL_TONE,
        'uniform sampler2D uMap;',
        'varying vec2 vUv; varying float vFog; varying vec3 vTint; varying float vNear; varying vec3 vHaze;',
        'void main(){',
        '  vec4 t = texture2D(uMap, vUv);',
        '  if (t.a < 0.25) discard;',
        '  gl_FragColor = vec4(mix(t.rgb * vTint, vHaze, vFog), t.a);',
        '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
      ].join('\n')
    });
    var m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    scene.add(m);
    App.propMeshes.push(m);
  }
}

