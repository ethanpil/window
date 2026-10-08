/* ---------- dust drifting low over the ground ----------
   Tumbleweeds read as comedy props. Sheets of blown dust are what actually
   moves in a desert, and they move slowly. */
function buildDust(scene, P, R, U, H) {
  if (!P.dust) return;
  var COUNT = P.dust;
  var quad = new THREE.PlaneGeometry(1, 1);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  var iPos = new Float32Array(COUNT * 3);
  var iAttr = new Float32Array(COUNT * 4);
  for (var i = 0; i < COUNT; i++) {
    var a = R.range(-1.0, 1.0), rr = R.range(18, 130);
    var x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
    iPos[i * 3] = x; iPos[i * 3 + 1] = H(x, z); iPos[i * 3 + 2] = z;
    iAttr[i * 4] = R.range(9, 30);            /* width */
    iAttr[i * 4 + 1] = R.range(1.4, 4.2);     /* height */
    iAttr[i * 4 + 2] = R.range(0, 200);       /* phase */
    iAttr[i * 4 + 3] = R.range(0.5, 1.2);     /* speed */
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
  geo.instanceCount = COUNT;
  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uWind: U.uWind, uGust: U.uGust, uWindDir: U.uWindDir,
      uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uCamPos: U.uCamPos,
      uAmbCol: U.uAmbCol, uSunCol: U.uSunCol, uSunDir: U.uSunDir,
      uMap: { value: makeCloudTexture(R.int(1, 99999)) }
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: GLSL['dust.vert'],
    fragmentShader: GLSL['dust.frag']
  });
  mat.uniforms.uFogCol = U.uFogCol;
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 2;
  scene.add(m);
  App.dust = m;
}

/* ---------- waterfalls on the steep ground ---------- */
function buildFalls(scene, P, R, U, H) {
  if (!P.falls) return;
  var picks = [], guard = 0;
  while (picks.length < P.falls && guard < 900) {
    guard++;
    var flim = featureHalfAngle(P) * 0.92;
    var a = R.range(-flim, flim), rr = R.range(90, 340);
    var x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
    var top = H(x, z);
    if (P.waterY != null && top < P.waterY + 12) continue;
    /* look downhill toward the viewer: a fall needs a real drop */
    var stepX = -x / rr * 26, stepZ = -z / rr * 26;
    var below = H(x + stepX, z + stepZ);
    var drop = top - below;
    if (drop < 14) continue;
    picks.push([x + stepX * 0.25, z + stepZ * 0.25, top, Math.min(drop * 0.95, 120), R.range(2.5, 7)]);
    App._features.push(['waterfall', x, z]);
  }
  if (!picks.length) return;
  /* Each fall is a ribbon laid down the rock from its lip toward the viewer,
     a little proud of it, for as long as the ground keeps dropping steeply.
     A card hung straight down from the lip went into the face of any wall
     that leaned back, and only a stub showed at the top. */
  var pos = [], side = [], along = [], seeds = [], wids = [], lens = [], idx = [];
  var seedsR = [];
  for (var i = 0; i < picks.length; i++) seedsR.push(R.range(0, 6.283));
  for (i = 0; i < picks.length; i++) {
    var pk = picks[i], ux = -pk[0], uz = -pk[1], ul = Math.sqrt(ux * ux + uz * uz) || 1;
    ux /= ul; uz /= ul;
    var x0 = pk[0] - ux * 6.5, z0 = pk[1] - uz * 6.5, fallTop = pk[2], line = [], lastH = fallTop;
    for (var sd = 0; sd < 300; sd += 2.5) {
      var px = x0 + ux * sd, pz = z0 + uz * sd, h = H(px, pz);
      if (sd > 0 && (lastH - h < 0.35 || fallTop - h > 180)) break;     /* the ground has levelled out */
      if (P.waterY != null && h < P.waterY + 0.3) { line.push([px, Math.max(h, P.waterY) + 0.6, pz]); break; }
      line.push([px, h + 1.2, pz]);
      lastH = h;
    }
    if (line.length < 3) line = [[pk[0], fallTop + 1.2, pk[1]], [pk[0], fallTop - pk[3] * 0.5, pk[1]], [pk[0], fallTop - pk[3], pk[1]]];
    var fallDrop = line[0][1] - line[line.length - 1][1];
    var start = pos.length / 3;
    /* the edges are set out here, across the line of sight from the window,
       and each sits on the ground under it: set out in the shader at the
       middle's height, they went into any wall that curved round the fall */
    var rx = -uz, rz = ux;
    for (var k = 0; k < line.length; k++) {
      var dnk = k / (line.length - 1), hw = 0.5 * pk[4] * (1 + dnk * 0.5 + smoothstep(0.82, 1.0, dnk) * 1.6);
      for (var e = -1; e <= 1; e += 2) {
        var ex = line[k][0] + rx * e * hw, ez = line[k][2] + rz * e * hw;
        pos.push(ex, Math.max(line[k][1] - 0.6, H(ex, ez) + 0.6), ez);
        side.push(e); along.push(k / (line.length - 1));
        seeds.push(seedsR[i]); wids.push(pk[4]); lens.push(Math.max(fallDrop, 10));
      }
      if (k < line.length - 1) {
        var o = start + k * 2;
        idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
      }
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  geo.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  geo.setAttribute('aSeed', new THREE.Float32BufferAttribute(seeds, 1));
  geo.setAttribute('aWidth', new THREE.Float32BufferAttribute(wids, 1));
  geo.setAttribute('aLen', new THREE.Float32BufferAttribute(lens, 1));
  geo.setIndex(idx);
  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uFogCol: U.uFogCol,
      uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uAmbCol: U.uAmbCol, uSunCol: U.uSunCol, uSunDir: U.uSunDir
    },
    extensions: { derivatives: true },
    /* it rides clear of the rock, edges and all; a nudge toward the eye in
       depth keeps the face it lies on from cutting it into bands far off */
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: GLSL['falls.vert'],
    fragmentShader: GLSL['falls.frag']
  });
  mat.uniforms.uFogCol = U.uFogCol;
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 1;
  scene.add(m);
  App.falls = m;
}


