function buildCascadeFall(scene, P, R, U, H) {
  var segs = P.fallSegs, notch = P.fallNotch, fx = P.fallX;
  var STEPS = 90;
  var pts = [];
  /* walk the profile from the top of the fall down to the pool */
  var total = 0;
  for (var i = segs.length - 1; i >= 0; i--) {
    var g = segs[i];
    for (var k = 0; k < STEPS / segs.length; k++) {
      var t = k / (STEPS / segs.length);
      var e = g.drop ? (1 - t) * (1 - t) * (3 - 2 * (1 - t)) : (1 - t);
      var z = g.z1 + (g.z0 - g.z1) * t;
      var y = g.y0 + (g.y1 - g.y0) * e;
      /* A pitch narrows as it falls and the water gathers speed; a bench
         spreads. The sheet used to reach almost the full width of the notch,
         which is wider than the floor of the gully it is meant to run in, so
         its edges lay out on the open hillside with nothing to sit in and
         simply faded out over the grass. Keep it inside its channel. */
      var w = notch * (g.drop ? (0.24 + 0.11 * t) : (0.30 + 0.13 * t));
      pts.push({ z: z, y: y, w: w, drop: g.drop });
    }
  }
  /* where it meets the pool it spreads, but not to twice the width of the
     channel above it: that one point splayed the foot of the fall out
     across the open ground */
  pts.push({ z: P.poolZ + 6, y: P.waterY + 0.15, w: notch * 0.52, drop: 0 });
  for (var q = 1; q < pts.length; q++)
    total += Math.hypot(pts[q].z - pts[q - 1].z, pts[q].y - pts[q - 1].y);

  /* How far the sheet stands off the rock differed between a pitch and a
     bench, and it switched the moment one became the other. The step forward
     is 1m while the water only advances about 1m a point, so at every join
     the sheet folded back toward the hill and out again: the fall came down
     the mountain in a zigzag. Blend the two across the join instead. */
  for (var m2 = 0; m2 < pts.length; m2++) {
    var acc = 0, cnt = 0;
    for (var d2 = -4; d2 <= 4; d2++) {
      var j2 = m2 + d2;
      if (j2 < 0 || j2 >= pts.length) continue;
      acc += pts[j2].drop ? 1 : 0; cnt++;
    }
    pts[m2].dropF = acc / cnt;
  }
  var pos = [], uv = [], idx = [], drops = [], run = 0, lastZ = -1e9;
  for (var m = 0; m < pts.length; m++) {
    var pt = pts[m];
    if (m > 0) run += Math.hypot(pt.z - pts[m - 1].z, pt.y - pts[m - 1].y);
    if (m > 0 && pt.z <= pts[m - 1].z) pt.z = pts[m - 1].z + 0.2;
    /* sit just clear of the rock: out of the gully floor and toward the viewer */
    var lift = 0.35 + 0.55 * pt.dropF;
    var out = 0.5 + 1.0 * pt.dropF;
    /* each edge rides the rock beneath it, so the sheet leans with the gully
       and never cuts into its walls */
    var zz2 = pt.z + out;
    if (zz2 <= lastZ) zz2 = lastZ + 0.05;      /* always run toward the window */
    lastZ = zz2;
    var yL = Math.min(Math.max(pt.y, H(fx - pt.w, zz2) + lift * 0.5), H(fx - pt.w, zz2) + lift + 1.6);
    var yR = Math.min(Math.max(pt.y, H(fx + pt.w, zz2) + lift * 0.5), H(fx + pt.w, zz2) + lift + 1.6);
    pos.push(fx - pt.w, yL, zz2);
    pos.push(fx + pt.w, yR, zz2);
    var v = run / Math.max(total, 1);
    uv.push(0, v, 1, v);
    drops.push(pt.dropF, pt.dropF);
    if (m < pts.length - 1) {
      var o = m * 2;
      idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('aDrop', new THREE.Float32BufferAttribute(drops, 1));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
      uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow,
      uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
      uLen: { value: total }
    },
    extensions: { derivatives: true },
    /* The eye looks along the slope, not across it, so the rock kept coming up
       in front of the sheet even though the water rides two metres above it.
       That cut the fall into horizontal bands. Bias the water toward the eye
       in depth rather than in space: it still goes behind anything properly in
       front of it, such as the trees on the near bank. */
    polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: [
      'attribute float aDrop;',
      'varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze; varying float vDrop;',
      'uniform float uFogDensity, uShadow, uTime; uniform vec3 uSunDir, uSunCol, uAmbCol, uFogCol;',
      GLSL_COMMON,
      'void main(){ vUv = uv; vDrop = aDrop;',
      '  vec4 wp = modelMatrix * vec4(position, 1.0);',
      /* lit like the rock it runs over: in the gully's shade it is grey */
      '  float sh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.15, 1.0, baked(wp.xz));',
      '  vTint = uAmbCol * 1.35 + uSunCol * 0.95 * sh;',
      '  vec4 mv = viewMatrix * wp;',
      '  vFog = fogAmt(-mv.z, uFogDensity);',
      '  vHaze = hazeAt(uFogCol, normalize(wp.xyz - cameraPosition), uSunDir, uSunCol, vFog);',
      '  gl_Position = projectionMatrix * mv; }'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform float uTime, uLen; varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze; varying float vDrop;',
      GLSL_COMMON,
      /* Value noise (vn). Read with the fall stretched against the width, it
         draws threads rather than blobs. The old pattern cut the sheet into
         thirty columns and gave each one a single brightness across its whole
         width, so it could only ever read as a row of vertical bars. */
      'void main(){',
      '  float d = vUv.y;',                       /* 0 at the head, 1 in the pool */
      /* The water gathers speed as it drops. That has to come from the shape
         of the fall coordinate, never from scaling uTime by depth: with
         y - uTime * (0.8 + 1.1 * d) the phase of the pattern is
         d * (k - 1.87 * uTime), whose sign turns over at uTime = k / 1.87.
         For a fall of eighty metres that is three seconds after the view
         opens, and from then on the water ran upward for ever. Raising d to
         a power under one makes the threads quicken as they descend and
         cannot change their direction. */
      '  float x = vUv.x * 6.0 + sin(d * 5.0 + uTime * 0.3) * 0.4;',
      '  float y = pow(max(d, 0.0), 0.62) * uLen * 0.075;',
      '  float n1 = vn(vec2(x, y - uTime * 1.9));',
      '  float n2 = vn(vec2(x * 2.1 + 4.3, y * 2.3 - uTime * 4.6));',
      '  float n3 = vn(vec2(x * 4.4 + 9.7, y * 4.8 - uTime * 9.8));',
      /* a thread finer than a pixel would only crawl, so let it average out */
      '  float px = fwidth(x);',
      '  float k2 = 1.0 - smoothstep(0.25, 0.80, px * 2.1);',
      '  float k3 = 1.0 - smoothstep(0.25, 0.80, px * 4.4);',
      '  float w = n1 * 0.50 + mix(0.5, n2, k2) * 0.32 + mix(0.5, n3, k3) * 0.18;',
      /* three noises summed bunch about a half, which is a flat wash. Open the
         middle of the range back out so the threads read. */
      '  w = clamp((w - 0.30) * 2.6, 0.0, 1.0);',
      /* whole over the lip, fraying into threads the further it falls */
      '  float veil = smoothstep(mix(0.10, 0.40, d), mix(0.42, 0.80, d), w);',
      /* the sheet feathers to nothing at either edge, and the edges wander:
         a fall is never ruled straight */
      '  float ew = vn(vec2(y * 0.35, 3.1)), ew2 = vn(vec2(y * 0.35, 8.7));',
      '  float body = smoothstep(0.0, 0.08 + 0.16 * ew, vUv.x) * smoothstep(1.0, 0.92 - 0.16 * ew2, vUv.x);',
      /* white water where it lands, and a little breaking over the lip. This
         was the other way about, so the froth gathered at the head. */
      '  float froth = max(smoothstep(0.76, 1.0, d), smoothstep(0.05, 0.0, d) * 0.6);',
      /* Over a pitch it is a white veil of threads. Over a bench it slides
         on the rock: dark and glassy, broken only by streaks of white where
         it riffles. Painted white all the way down, it read as paper steps. */
      '  float riff = smoothstep(0.55, 0.9, w);',
      '  vec3 cDrop = mix(vec3(0.60, 0.70, 0.78), vec3(1.0), clamp(w * 0.85 + froth * 0.9, 0.0, 1.0));',
      '  vec3 cBench = mix(vec3(0.16, 0.22, 0.25), vec3(0.92, 0.95, 0.96), clamp(riff * 0.75 + froth * 0.8, 0.0, 1.0));',
      '  vec3 c = mix(cBench, cDrop, vDrop);',
      '  float a = body * mix(mix(0.50 + 0.40 * riff, 0.30 + 0.70 * veil, vDrop), 1.0, froth * 0.9);',
      '  gl_FragColor = vec4(tone(mix(c * vTint * 0.55, vHaze, vFog * 0.7)), a * (1.0 - vFog * 0.6));',
      '}'
    ].join('\n')
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 4;
  scene.add(mesh);
  App.propMeshes.push(mesh);

  /* spray at the foot of every pitch, not just the bottom */
  for (var si = 0; si < segs.length; si++) {
    if (!segs[si].drop) continue;
    var g2 = segs[si];
    buildSmoke(scene, P, R, U, fx, g2.y0 + 1.0, g2.z0 + 3, notch * (0.9 + si * 0.25) * P.mistPower);
  }
}

