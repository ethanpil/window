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
    vertexShader: GLSL['cascade.vert'],
    fragmentShader: GLSL['cascade.frag']
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

