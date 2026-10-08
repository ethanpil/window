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
    vertexShader: [
      'attribute vec3 iPos; attribute vec4 iAttr;',
      'uniform float uTime, uWind, uGust, uFogDensity;',
      'uniform vec2 uWindDir; uniform vec3 uCamPos, uFogCol, uSunDir;',
      'varying vec2 vUv; varying float vFog; varying float vFade; varying float vScroll; varying vec3 vAir;',
      GLSL_COMMON,
      'void main(){',
      '  float speed = (0.5 + 0.9 * uGust) * uWind * iAttr.w;',
      /* A sheet keeps the height of the ground it set out from, so it may
         only travel a short way before rising or falling ground shows it up:
         it runs ninety metres, its foot a third of its height below the
         ground, and fades in its lower edge, so it neither slices through a
         dune nor hangs a hard edge in the air. */
      '  float span = 90.0;',
      '  float run = mod(uTime * speed + iAttr.z, span) - span * 0.5;',
      '  vec3 wp = iPos + vec3(uWindDir.x, 0.0, uWindDir.y) * run;',
      '  wp.y += iAttr.y * 0.18 + sin(uTime * 0.21 + iAttr.z) * 0.12;',
      '  vec3 toCam = normalize(vec3(uCamPos.x - wp.x, 0.0, uCamPos.z - wp.z));',
      '  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));',
      '  vec3 pp = wp + right * position.x * iAttr.x + vec3(0.0, position.y * iAttr.y, 0.0);',
      '  vUv = uv;',
      '  vScroll = uTime * 0.012 + iAttr.z * 0.01;',
      '  vFade = 1.0 - smoothstep(span * 0.28, span * 0.49, abs(run));',
      '  vec4 mv = modelViewMatrix * vec4(pp, 1.0);',
      '  vFog = fogAmtH(-mv.z, uFogDensity, pp.y);',
      /* the air it hangs in is the horizon's colour that way */
      '  vAir = horizonAt(normalize(pp - cameraPosition), uFogCol, uSunDir);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform sampler2D uMap; uniform vec3 uAmbCol, uSunCol;',
      'varying vec2 vUv; varying float vFog; varying float vFade; varying float vScroll; varying vec3 vAir;',
      'void main(){',
      '  float n = texture2D(uMap, vec2(vUv.x * 0.5 + vScroll, vUv.y * 0.5)).r;',
      '  n = n * 0.65 + texture2D(uMap, vec2(vUv.x * 1.3 - vScroll * 1.7, vUv.y * 0.9 + 0.4)).r * 0.35;',
      '  float body = smoothstep(0.30, 0.72, n);',
      '  float soft = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x)',
      '             * (1.0 - smoothstep(0.15, 1.0, vUv.y)) * smoothstep(0.12, 0.42, vUv.y);',
      '  float a = body * soft * vFade * 0.30 * (1.0 - vFog * 0.6);',
      '  vec3 col = mix(vAir, uAmbCol * 0.6 + uSunCol * 0.7, 0.45);',
      '  gl_FragColor = vec4(col, a);',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
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
    var x0 = pk[0] - ux * 6.5, z0 = pk[1] - uz * 6.5, top = pk[2], line = [], lastH = top;
    for (var sd = 0; sd < 300; sd += 2.5) {
      var px = x0 + ux * sd, pz = z0 + uz * sd, h = H(px, pz);
      if (sd > 0 && (lastH - h < 0.35 || top - h > 180)) break;     /* the ground has levelled out */
      if (P.waterY != null && h < P.waterY + 0.3) { line.push([px, Math.max(h, P.waterY) + 0.6, pz]); break; }
      line.push([px, h + 1.2, pz]);
      lastH = h;
    }
    if (line.length < 3) line = [[pk[0], top + 1.2, pk[1]], [pk[0], top - pk[3] * 0.5, pk[1]], [pk[0], top - pk[3], pk[1]]];
    var drop = line[0][1] - line[line.length - 1][1];
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
        seeds.push(seedsR[i]); wids.push(pk[4]); lens.push(Math.max(drop, 10));
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
    vertexShader: [
      'attribute float aSide, aAlong, aSeed, aWidth, aLen;',
      'uniform vec3 uFogCol, uSunDir, uSunCol; uniform float uFogDensity;',
      'varying vec2 vUv; varying float vFog; varying float vLen, vSeed, vW; varying vec3 vHaze;',
      GLSL_COMMON,
      'void main(){',
      /* it spreads as it falls, and billows out into spray at the foot
         (the edges are set out in the script) */
      '  float dn = aAlong;',
      '  float spread = 1.0 + dn * 0.5 + smoothstep(0.82, 1.0, dn) * 1.6;',
      '  vec3 wp = position;',
      '  vUv = vec2(aSide * 0.5 + 0.5, 1.0 - aAlong); vLen = aLen; vSeed = aSeed; vW = aWidth * spread;',
      '  vec4 mv = modelViewMatrix * vec4(wp, 1.0);',
      '  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);',
      '  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform vec3 uAmbCol, uSunCol;',
      'uniform float uTime;',
      'varying vec2 vUv; varying float vFog; varying float vLen, vSeed, vW; varying vec3 vHaze;',
      GLSL_COMMON,
      'void main(){',
      /* Streaks running down the drop, stretched along it and quickening as
         they go; a puffy cloud texture read up it had made a dotted line.
         The fine streaks fade to their mean once narrower than a pixel. */
      '  float d = 1.0 - vUv.y;',
      '  float along = pow(max(d, 0.0), 0.7) * vLen * 0.09;',   /* pow of a negative is undefined */
      '  float x = vUv.x * vW * 0.9 + vSeed * 7.0;',
      '  float s1 = vn(vec2(x, along - uTime * 2.2));',
      '  float s2 = vn(vec2(x * 2.3 + 3.1, along * 1.9 - uTime * 4.1));',
      '  float k2 = 1.0 - smoothstep(0.30, 0.85, fwidth(x) * 2.3);',
      '  float n = s1 * 0.62 + mix(0.5, s2, k2) * 0.38;',
      /* the edges wander as the water does */
      '  float ew = vn(vec2(along * 0.25, vSeed)) * 0.18;',
      '  float edge = smoothstep(0.0, 0.16 + ew, vUv.x) * smoothstep(1.0, 0.84 - ew, vUv.x);',
      '  float a = edge * mix(0.75, 0.45, d) * smoothstep(0.25, 0.70, n);',
      '  a += edge * (1.0 - smoothstep(0.0, 0.08, d)) * 0.35;',
      /* spray at the foot: a soft cloud, not a hard end */
      '  float foot = smoothstep(0.80, 1.0, d) * (1.0 - smoothstep(0.30, 0.50, abs(vUv.x - 0.5)) * 0.8);',
      '  a = max(a, foot * 0.45 * (0.6 + 0.4 * s1));',
      '  vec3 col = mix(vec3(0.86, 0.92, 0.95), uSunCol * 0.6 + uAmbCol * 0.8, 0.35);',
      '  gl_FragColor = vec4(mix(col, vHaze, vFog), a * (1.0 - vFog * 0.85));',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
  });
  mat.uniforms.uFogCol = U.uFogCol;
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 1;
  scene.add(m);
  App.falls = m;
}


