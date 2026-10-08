/* ---------- grass ---------- */
function bladeTemplate(bands, ear) {
  /* Rings up the blade plus a tip. A blade of grass runs nearly parallel and
     closes only near its end; the old one tapered from the root like a spike.
     A cereal has extra rings at the top, where the ear swells (the shader
     widens them). More bands means a blade that curves instead of creasing. */
  var n = Math.max(2, bands || 3), ts = [], i;
  if (ear) ts = [0, 0.32, 0.6, 0.70, 0.76, 0.88];
  else for (i = 0; i < n; i++) ts.push(i / n);
  var pos = [], uvs = [], idx = [];
  for (i = 0; i < ts.length; i++) {
    var t = ts[i];
    var y = ear ? t : Math.pow(t, 0.88);
    var w = 0.5 * (1 - Math.pow(t, 4));
    pos.push(-w, y, 0); uvs.push(0, y);
    pos.push(w, y, 0); uvs.push(1, y);
  }
  n = ts.length;
  pos.push(0, 1, 0); uvs.push(0.5, 1);
  for (i = 0; i < n - 1; i++) {
    var o = i * 2;
    idx.push(o, o + 1, o + 3, o, o + 3, o + 2);
  }
  idx.push((n - 1) * 2, (n - 1) * 2 + 1, n * 2);
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(idx);
  return g;
}

/* How each cover grows. Grass stands in tussocks: a dozen or so blades from
   one crown, a hand or two across, sharing a height and a colour and leaning
   out from the middle; between them, single blades. Heather and lavender are
   low domed bushes of short stems with their flowers in a band at the top;
   a cereal is a few tillers to a plant with an ear on each, maize a stalk of
   broad leaves arching out. [share in tussocks, blades, spread m, dome, lean out] */
function coverHabit(P) {
  if (P.biomeKey === 'lavender') return { tuft: 1.0, n: [16, 26], sig: [0.15, 0.22], dome: 0.6, out: 0.7 };
  if (P.coverStyle === 'heather') return { tuft: 0.95, n: [16, 28], sig: [0.10, 0.20], dome: 0.55, out: 0.55 };
  if (P.coverStyle === 'reeds') return { tuft: 0.7, n: [8, 18], sig: [0.10, 0.22], dome: 0.15, out: 0.2 };
  if (P.crop) {
    if (P.crop.name === 'maize') return { tuft: 1.0, n: [5, 8], sig: [0.03, 0.05], dome: 0.1, out: 1.0 };
    if (P.crop.name === 'strawberries') return { tuft: 1.0, n: [7, 12], sig: [0.06, 0.10], dome: 0.4, out: 0.8 };
    return { tuft: 1.0, n: [3, 6], sig: [0.025, 0.045], dome: 0.05, out: 0.15 };
  }
  /* dry-country grass grows in tight separate tussocks with bare ground
     between, never as a sward */
  if (P.biomeKey === 'desert' || P.biomeKey === 'canyon') return { tuft: 0.95, n: [10, 22], sig: [0.05, 0.10], dome: 0.3, out: 0.65 };
  return { tuft: 0.45, n: [8, 18], sig: [0.08, 0.16], dome: 0.25, out: 0.4 };
}

function buildGrass(scene, P, R, U, H) {
  var COUNT = Math.round(P.coverCount * Q().grassMul);
  if (!P.coverCount) { App.grass = null; App.grassMax = 0; return; }   /* bare ground is a valid landscape */
  /* a stream of its own: the count depends on the detail setting, and with
     the builder's stream that shifted everything built after the grass */
  var GR = RNG(P.base + '/build/grass' + (P.nonce ? '/' + P.nonce : ''));
  var hab = coverHabit(P);
  var ear = !!(P.crop && (P.crop.name === 'wheat' || P.crop.name === 'barley'));
  var tpl = bladeTemplate(Q().segs, ear);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = tpl.index;
  geo.setAttribute('position', tpl.attributes.position);
  geo.setAttribute('uv', tpl.attributes.uv);

  /* each blade's brightness follows the ground it grows from: the terrain's
     own colour texture, at the broad scale the terrain shows it, so blades
     and ground share their patches */
  var gImg = null, gW = 0, gMean = 0.3;
  try {
    var gc = App.terrain.material.uniforms.uTex.value.image;
    gW = gc.width;
    gImg = gc.getContext('2d').getImageData(0, 0, gW, gW).data;
    var acc = 0;
    for (var gi = 0; gi < gImg.length; gi += 4 * 61) acc += gImg[gi] * 0.3 + gImg[gi + 1] * 0.59 + gImg[gi + 2] * 0.11;
    gMean = Math.max(acc / Math.ceil(gImg.length / (4 * 61)), 1);
  } catch (e) { gImg = null; }
  var groundLum = function (x, z) {
    if (!gImg) return 1;
    /* the shader's broad octave: turned, scaled and offset the same way */
    var u = (x * 0.8269 - z * 0.5623) * 0.0052 + 0.31, v = (x * 0.5623 + z * 0.8269) * 0.0052 + 0.17;
    u -= Math.floor(u); v -= Math.floor(v);
    var o = ((Math.floor((1 - v) * gW) % gW) * gW + Math.floor(u * gW) % gW) * 4;
    return clamp((gImg[o] * 0.3 + gImg[o + 1] * 0.59 + gImg[o + 2] * 0.11) / gMean, 0.72, 1.3);
  };

  var blades = [];
  var i, n = 0;
  var clumps = [];
  for (i = 0; i < 420; i++) {
    var ca = GR.range(-1.28, 1.28), cr = 1.4 + Math.pow(GR.f(), 1.7) * 30;
    clumps.push([Math.sin(ca) * cr, -Math.cos(ca) * cr, GR.range(0.6, 1.35)]);
  }
  /* can a blade grow here? */
  var ok = function (x, z) {
    var dist = Math.sqrt(x * x + z * z);
    if (dist < 1.0 || dist > (P.coverRows ? 54 : 35)) return 0;
    if (z > -0.6) return 0;
    if (Math.abs(Math.atan2(x, -z)) > 1.30) return 0;
    if (P.pathKind && onPathAt(P, x, z) > GR.f() * 0.55) return 0;
    if (P.erg && ergDuneAt(P, x, z) > P.dune.hd * 0.18) return 0;
    if (P._inRiver && P._inRiver(x, z)) return 0;
    /* an oasis grows by its water; on the sand round it, a rare tussock */
    if (P.oasisW && H(x, z) > P.waterY + 4.5 && GR.f() > 0.02) return 0;
    var hm = 1;
    /* the kept ground under the window: mown short, or nothing grows on it */
    if (P.clearKind) {
      var ck = clearAt(P, x, z);
      if (P.clearKind === 1) hm *= 1 - ck * 0.8;
      else if (GR.f() < ck * (P.clearKind === 3 ? 0.93 : 1)) return 0;
    }
    if (P.waterY != null) {
      var gh = H(x, z);
      /* reeds stand in the shallows; grass keeps its feet dry */
      if (gh < P.waterY + (P.coverWet ? -0.30 : 0.25)) return 0;
      if (P.coverMinH && gh < P.waterY + P.coverMinH) return 0;
    }
    return hm;
  };
  var guard = 0;
  while (n < COUNT && guard < COUNT * 12) {
    guard++;
    var x, z, hMul = 1;
    if (GR.f() < 0.55) {
      var c = clumps[Math.floor(GR.f() * clumps.length)];
      x = c[0] + GR.gauss() * 1.5;
      z = c[1] + GR.gauss() * 1.5;
      hMul = c[2];
    } else {
      var a = GR.range(-1.30, 1.30);
      var r = 1.1 + Math.pow(GR.f(), P.coverRows ? 1.45 : 1.75) * (P.coverRows ? 52 : 32);
      x = Math.sin(a) * r; z = -Math.cos(a) * r;
    }
    if (P.rowSpacing && P.coverRows) {
      /* snap sideways onto the nearest planted row: the plant, not each blade */
      var A = P.rowAngle;
      var perp = x * Math.cos(A) + z * Math.sin(A);
      var snap = Math.round(perp / P.rowSpacing) * P.rowSpacing + GR.gauss() * 0.06;
      x += (snap - perp) * Math.cos(A);
      z += (snap - perp) * Math.sin(A);
    }
    /* thin patches and the odd bare spot: a field is not a carpet */
    var thin = fbm2(x * 0.045 + 3.1, z * 0.045, P.terrainSeed + 5, 2);
    if (thin < -0.48 && GR.f() < 0.85 && !P.rowSpacing) continue;
    if (P.waterY != null && P.coverStyle === 'reeds' && GR.f() < 0.75 * smoothstep(0.35, 0.9, H(x, z) - P.waterY)) continue;
    /* the colour of this patch of field: a broad drift between green and dry,
       and the brightness of the ground beneath */
    var dryF = clamp(smoothstep(-0.15, 0.65, fbm2(x * 0.03, z * 0.03, P.terrainSeed + 31, 3)) * 0.8 + GR.range(-0.12, 0.12), 0, 1);
    var lum = groundLum(x, z) * GR.range(0.92, 1.08);
    var tuft = GR.f() < hab.tuft;
    var nb = tuft ? GR.int(hab.n[0], hab.n[1]) : 1;
    var sig = GR.range(hab.sig[0], hab.sig[1]);
    var tH = hMul * (0.78 + 0.32 * (fbm2(x * 0.05, z * 0.05, P.terrainSeed + 9, 2) * 0.5 + 0.5)) * GR.range(0.75, 1.2);
    for (var b = 0; b < nb && n < COUNT; b++) {
      var ox = 0, oz = 0;
      if (tuft) { ox = GR.gauss() * sig; oz = GR.gauss() * sig; }
      var bx = x + ox, bz = z + oz;
      var hm = ok(bx, bz);
      if (!hm) continue;
      var rr = Math.sqrt(ox * ox + oz * oz) / Math.max(sig, 1e-3);
      /* a tussock leans out from its middle and is lower at its edge */
      var rot = tuft && rr > 0.05 ? Math.atan2(-ox, oz) + GR.range(-0.5, 0.5) : GR.range(0, 6.283);
      var lean = P.grassLean * GR.range(0.62, 1.4) * (tuft ? (1 - hab.out) + hab.out * Math.min(rr, 2) * 0.9 : 1);
      var dome = tuft ? Math.max(0.35, 1 - hab.dome * rr * rr * 0.45) : 1;
      blades.push([bx, bz, tH * hm * dome * (tuft ? GR.range(0.8, 1.15) : GR.range(0.55, 1.45)), rot, dryF, lean, lum]);
      n++;
    }
  }
  /* shuffle so trimming the instance count thins evenly rather than clipping a region */
  for (i = blades.length - 1; i > 0; i--) {
    var j = Math.floor(GR.f() * (i + 1));
    var tmp = blades[i]; blades[i] = blades[j]; blades[j] = tmp;
  }
  COUNT = blades.length;
  var iPos = new Float32Array(COUNT * 3);
  var iAttr = new Float32Array(COUNT * 4);
  var iAttr2 = new Float32Array(COUNT * 3);
  for (i = 0; i < COUNT; i++) {
    var o = blades[i];
    var px = o[0], pz = o[1];
    var d2 = Math.sqrt(px * px + pz * pz);
    iPos[i * 3] = px;
    iPos[i * 3 + 1] = H(px, pz) - 0.02;
    iPos[i * 3 + 2] = pz;
    var hgt = P.grassHeight * o[2];
    hgt *= 1 + smoothstep(8, 30, d2) * 0.45;   /* fatten distant blades so the field stays dense */
    iAttr[i * 4] = hgt;
    /* half a centimetre to a centimetre across, as grass is; the shader keeps
       every blade at least a pixel wide, so the far field still fills */
    iAttr[i * 4 + 1] = (0.007 + GR.f() * 0.005) * P.coverWidth;
    iAttr[i * 4 + 2] = o[3];
    iAttr[i * 4 + 3] = o[4];
    /* the flutter phase is shared over about a hand's breadth, then drifts:
       neighbours stir alike, blades a stride apart do not */
    iAttr2[i * 3] = px * 3.1 + pz * 2.6 + GR.range(-1.1, 1.1);
    iAttr2[i * 3 + 1] = o[5];
    iAttr2[i * 3 + 2] = o[6];
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
  geo.setAttribute('iAttr2', new THREE.InstancedBufferAttribute(iAttr2, 3));
  geo.instanceCount = COUNT;

  /* a band of colour at the top: lavender's spikes, heather's bells (brown
     out of flower), a cereal's ear */
  var lav = P.biomeKey === 'lavender', heath = P.coverStyle === 'heather';
  var topK = lav ? 1 : (heath ? ({ summer: 1, autumn: 0.8, spring: 0.25, winter: 0.1 }[P.seasonKey] || 1) : (ear ? 1 : 0));
  var topCol = lav ? (P.rowColour || '#7a68ad') : (heath ? (P.grass.ct || P.grass.tip) : (ear ? (P.crop.dry || P.grass.dry) : '#000000'));
  var tipCol = lav ? (P.grass.tip) : (heath ? new THREE.Color(P.grass.cb || P.grass.base).lerp(new THREE.Color(P.grass.dry), 0.5) : (P.rowColour || P.grass.ct || P.grass.tip));
  var uni = {
    uTime: U.uTime, uWind: U.uWind, uGust: U.uGust, uWindDir: U.uWindDir,
    uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
    uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
    uSnow: U.uSnow, uSnowCol: U.uSnowCol,
    uBase: { value: new THREE.Color(P.grass.cb || P.grass.base) },
    uTip: { value: new THREE.Color(tipCol) },
    uDry: { value: new THREE.Color(P.grass.dry) },
    uTop: { value: new THREE.Color(topCol) },
    uTopY: { value: lav ? 0.6 : 0.7 },
    uTopK: { value: topK },
    uEar: { value: ear ? 1 : 0 },
    uFar0: { value: P.coverRows ? 26.0 : 14.0 },
    uFar1: { value: P.coverRows ? 53.0 : 32.0 }
  };
  var mat = new THREE.ShaderMaterial({
    uniforms: uni,
    side: THREE.DoubleSide,
    vertexShader: [
      'attribute vec3 iPos; attribute vec4 iAttr; attribute vec3 iAttr2;',
      'uniform float uTime, uWind, uGust, uFogDensity, uShadow, uSnow, uFar0, uFar1, uTopY, uTopK, uEar;',
      'uniform vec2 uWindDir;',
      'uniform vec3 uSunDir, uSunCol, uAmbCol, uFogCol, uBase, uTip, uDry, uSnowCol, uTop;',
      'varying vec3 vColor;',
      GLSL_COMMON,
      'void main(){',
      /* Per instance, not per vertex, so the whole blade shrinks together.
         A blade narrower than a pixel cannot be drawn without flickering, so
         it is held at about a pixel across, and past that the blades are let
         go and the ground carries the far field. */
      '  float dCam = length(iPos - cameraPosition);',
      '  float far = smoothstep(uFar0, uFar1, dCam);',
      '  float yN = position.y;',
      /* under real snow the grass is gone; a light fall leaves short pale stubs */
      '  float bury = smoothstep(0.12, 0.50, uSnow);',
      '  float h = iAttr.x * (1.0 - bury * 0.94) * (1.0 - far);',
      '  float earB = uEar * smoothstep(0.66, 0.72, yN) * (1.0 - smoothstep(0.93, 1.0, yN));',
      '  float w = max(iAttr.y, dCam * 0.0015) * (1.0 + earB * 1.9) * (1.0 - far * far);',
      '  float rot = iAttr.z;',
      '  float c = cos(rot), s = sin(rot);',
      '  vec3 lp = vec3(position.x * w, yN * h, 0.0);',
      '  lp.z += iAttr2.y * 0.20 * h * yN * yN;',
      /* gusts sweep the field as patches, cat's paws, not as ruled lines */
      '  float wave = gustWave(iPos.xz, uWindDir, uTime, 0.22, 1.55, iAttr2.x * 0.6);',
      '  float wave2 = gustWave(iPos.xz, uWindDir, uTime, 0.061, 0.62, 2.1);',
      /* two turbulence rhythms, on the blade's own clock */
      '  float flut = sin(uTime * 2.7 + iAttr2.x) * 0.30 + sin(uTime * 1.25 + iAttr2.x * 1.7) * 0.22;',
      '  float drive = uWind * (0.46 + 0.95 * uGust) * iAttr2.y;',
      '  float gust = max(0.55 + 0.40 * wave + 0.30 * wave2, 0.0);',       /* what the whole field feels */
      '  float shape = max(gust + flut, 0.0);',                             /* plus what this blade does */
      '  float bf = drive * shape * 0.45;',
      '  bf = bf / (1.0 + bf);',
      '  float bend = bf * h * 0.8 * yN * yN * (1.0 - bury * 0.7);',
      '  float gustBend = (drive * gust * 0.45) / (1.0 + drive * gust * 0.45) * h * 0.8;',
      '  vec3 rp = vec3(lp.x * c - lp.z * s, lp.y, lp.x * s + lp.z * c);',
      '  rp.xz += uWindDir * bend;',
      '  rp.y -= bend * bend * 0.55;',
      '  vec3 wp = iPos + rp;',
      /* the lighting normal leans with the gust, not the flutter: light rolls across
         the field in waves without any blade flickering on its own. Each edge
         tilts off to its own side, so a blade reads as folded along its rib. */
      '  vec3 side = vec3(c, 0.0, s) * sign(position.x) * 0.45 * (1.0 - far);',
      '  vec3 N = normalize(vec3(-s, 0.62, c) + side + vec3(uWindDir.x, 0.0, uWindDir.y) * gustBend * 1.6 * (1.0 - far));',
      '  vec3 sd = normalize(uSunDir);',
      '  float diff = max(dot(N, sd), 0.0);',
      '  float trans = pow(max(dot(-N, sd), 0.0), 2.5) * 0.42 * smoothstep(0.1, 0.8, yN) * (1.0 - far * 0.8);',
      /* a satin sheen where the sun glances off the blade: keyed to the gust,
         so it sweeps the field in waves and no single blade twinkles */
      '  vec3 Ng = normalize(vec3(-s, 0.62, c) + vec3(uWindDir.x, 0.0, uWindDir.y) * gustBend * 1.6);',
      '  float sheen = pow(max(dot(reflect(-sd, Ng), normalize(cameraPosition - wp)), 0.0), 12.0) * 0.20 * yN * (1.0 - far);',
      '  float ao = mix(0.42, 1.0, smoothstep(0.0, 0.55, yN));',
      '  vec2 bk = bakedRG(wp.xz);',
      '  float sh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);',
      '  vec3 col = mix(uBase, uTip, clamp(yN * 1.05, 0.0, 1.0));',
      '  col = mix(col, uDry, iAttr.w * 0.55);',
      '  col = mix(col, uTop, smoothstep(uTopY, uTopY + 0.08, yN) * uTopK);',
      '  col *= iAttr2.z * (1.0 - 0.18 * uWet);',
      '  vec3 lit = col * (bk.y * hemi(N, uAmbCol * 1.15) + uSunCol * (diff * 1.15 + trans + sheen) * sh) * ao;',
      /* one steady colour for the far field: no per-blade variation left to alias */
      '  vec3 mass = mix(mix(uBase, uTip, 0.62), uTop, uTopK * 0.3) * (uAmbCol * 1.15 + uSunCol * 0.70 * sh) * 0.94;',
      '  lit = mix(lit, mass, far);',
      /* whitened along the whole blade, so nothing dark pokes through the snow */
      '  vec3 snowL = uAmbCol * 1.15 + uSunCol * max(sd.y, 0.0) * 1.25 * sh;',
      '  lit = mix(lit, uSnowCol * (0.80 + 0.20 * yN) * snowL * 0.82, clamp(uSnow * 1.6, 0.0, 0.96));',
      '  vec4 mv = modelViewMatrix * vec4(wp, 1.0);',
      '  float fg = fogAmt(-mv.z, uFogDensity);',
      '  vColor = mix(lit, hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, fg), fg);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'varying vec3 vColor;',
      'void main(){ gl_FragColor = vec4(tone(vColor), 1.0); }'
    ].join('\n')
  });
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  scene.add(m);
  App.grass = m;
  App.grassMax = COUNT;
}

/* ---------- flowers ---------- */
function buildFlowers(scene, P, R, U, H) {
  if (!P.flowerCount) return;
  App.flowerMeshes = [];
  var perSpecies = Math.floor(P.flowerCount / P.species.length);
  for (var si = 0; si < P.species.length; si++) {
    var sp = P.species[si];
    var COUNT = perSpecies;
    var quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);

    var iPos = new Float32Array(COUNT * 3);
    var iAttr = new Float32Array(COUNT * 3);
    var iVar = new Float32Array(COUNT * 2);
    var patches = [];
    for (var p = 0; p < 26; p++) {
      var pa = R.range(-1.14, 1.14), pr = 1.8 + Math.pow(R.f(), 1.5) * (Math.min(P.flowerReach || 44, 36) - 6);
      patches.push([Math.sin(pa) * pr, -Math.cos(pa) * pr, R.range(0.8, 3.4)]);
    }
    var made = 0, guard = 0;
    while (made < COUNT && guard < COUNT * 40) {
      guard++;
      var x, z;
      if (R.f() < 0.75) {
        var pc = patches[Math.floor(R.f() * patches.length)];
        x = pc[0] + R.gauss() * pc[2];
        z = pc[1] + R.gauss() * pc[2];
      } else {
        var a = R.range(-1.14, 1.14), r = 1.8 + Math.pow(R.f(), 1.6) * (Math.min(P.flowerReach || 44, 36) - 4);
        x = Math.sin(a) * r; z = -Math.cos(a) * r;
      }
      if (P.rowSpacing) {
        var A2 = P.rowAngle;
        var pp2 = x * Math.cos(A2) + z * Math.sin(A2);
        var sn2 = Math.round(pp2 / P.rowSpacing) * P.rowSpacing + R.gauss() * 0.09;
        x += (sn2 - pp2) * Math.cos(A2);
        z += (sn2 - pp2) * Math.sin(A2);
      }
      var d = Math.sqrt(x * x + z * z);
      if (d < 1.4 || d > Math.min(P.flowerReach || 44, 36) || z > -1.0) continue;
      if (Math.abs(Math.atan2(x, -z)) > 1.15) continue;
      if (P.pathKind && onPathAt(P, x, z) > 0.3) continue;   /* trodden flat */
      if (P.clearKind && clearAt(P, x, z + 0.4) > 0.1) continue;   /* mown, or not grown */
      if (P.waterY != null) {
      var gh = H(x, z);
      /* reeds stand in the shallows; grass keeps its feet dry */
      if (gh < P.waterY + (P.coverWet ? -0.30 : 0.25)) continue;
      if (P.coverMinH && gh < P.waterY + P.coverMinH) continue;
    }
      iPos[made * 3] = x;
      iPos[made * 3 + 1] = H(x, z);
      iPos[made * 3 + 2] = z;
      /* no swelling with distance: big far flowers read as pom-poms */
      var sz = R.range(sp.size[0], sp.size[1]) * (P.flowerScale || 1);
      iAttr[made * 3] = sz;
      iAttr[made * 3 + 1] = x * 3.1 + z * 2.6 + R.range(-1.1, 1.1);
      iAttr[made * 3 + 2] = R.range(0.7, 1.25);
      var vr = R.f(); var variant = vr < 0.45 ? 0 : (vr < 0.75 ? 1 : (vr < 0.9 ? 2 : 3));
      iVar[made * 2] = variant + (R.f() < 0.5 ? 4 : 0);
      iVar[made * 2 + 1] = R.range(-0.22, 0.22);
      made++;
    }
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 3));
    geo.setAttribute('iVar', new THREE.InstancedBufferAttribute(iVar, 2));
    geo.instanceCount = made;

    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime, uWind: U.uWind, uGust: U.uGust, uWindDir: U.uWindDir,
        uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
        uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale, uSnow: U.uSnow,
        uMap: { value: makeFlowerTexture(sp, R) },
        uCamPos: U.uCamPos
      },
      transparent: false,
      alphaTest: 0.45,
      side: THREE.DoubleSide,
      vertexShader: [
        'attribute vec3 iPos; attribute vec3 iAttr; attribute vec2 iVar;',
        'uniform float uTime, uWind, uGust, uFogDensity, uShadow, uSnow;',
        'uniform vec2 uWindDir; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;',
        'varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze;',
        GLSL_COMMON,
        'void main(){',
        '  float dF = length(iPos - cameraPosition);',
        '  float gone = smoothstep(20.0, 34.0, dF);',
        '  float size = iAttr.x * (1.0 - uSnow * 0.55) * (1.0 - gone);',
        '  if (uSnow > 0.30) size = 0.0;',
        '  vec3 toCam = normalize(vec3(uCamPos.x - iPos.x, 0.0, uCamPos.z - iPos.z));',
        '  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));',
        '  float lc = cos(iVar.y), ls = sin(iVar.y);',
        '  vec2 q = vec2(position.x * lc - position.y * ls, position.x * ls + position.y * lc);',
        '  vec3 lp = right * q.x * size * 0.8 + vec3(0.0, q.y * size * 3.0, 0.0);',
        '  float wave = gustWave(iPos.xz, uWindDir, uTime, 0.22, 1.55, iAttr.y * 0.6);',
        '  float flut = sin(uTime * 2.3 + iAttr.y) * 0.24 + sin(uTime * 1.1 + iAttr.y * 1.6) * 0.12;',
        '  float drive = uWind * (0.46 + 0.95 * uGust) * iAttr.z;',
        '  float bf = drive * max(0.55 + 0.4 * wave + flut, 0.0) * 0.45;',
        '  bf = bf / (1.0 + bf);',
        '  float bend = bf * size * 1.1 * position.y * position.y * (1.0 - gone);',
        '  vec3 wp = iPos + lp;',
        '  wp.xz += uWindDir * bend;',
        '  float vi = mod(iVar.x, 4.0); float flip = step(3.5, iVar.x);',
        '  float ux = mix(uv.x, 1.0 - uv.x, flip);',
        '  vUv = vec2((vi + ux) * 0.25, uv.y);',
        '  vec2 bk = bakedRG(wp.xz);',
        '  float sh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);',
        '  vTint = uAmbCol * 0.85 * bk.y + uSunCol * 0.75 * sh;',
        '  vec4 mv = modelViewMatrix * vec4(wp, 1.0);',
        '  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);',
        '  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);',
        '  gl_Position = projectionMatrix * mv;',
        '}'
      ].join('\n'),
      fragmentShader: [
      GLSL_TONE,
        'uniform sampler2D uMap;',
        'varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze;',
        'void main(){',
        '  vec4 t = texture2D(uMap, vUv);',
        '  if (t.a < 0.02) discard;',
        '  gl_FragColor = vec4(mix(t.rgb * vTint, vHaze, vFog), t.a);',
        '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
      ].join('\n')
    });
    mat.uniforms.uFogCol = U.uFogCol;
    var m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    scene.add(m);
    App.flowerMeshes.push(m);
  }
}


