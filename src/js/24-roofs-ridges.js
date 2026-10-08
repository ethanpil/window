/* ---------- roofs, for the view down from a tower ----------
   Seen from above, roofs are most of what there is, and they were flat lids. */
function buildRoofs(scene, P, R, U, items) {
  var B = { pos: [], nor: [], idx: [], rib: [] };
  pushCyl(B, 0, 0, 0, 0.5, 0.42, 1.0, 12);            /* a timber water tank */
  pushCone(B, 0, 1.0, 0, 0.55, 0.30, 12);
  for (var l = 0; l < 4; l++) {
    var la = l * 1.5708 + 0.785;
    pushBox(B, Math.cos(la) * 0.38, -0.55, Math.sin(la) * 0.38, 0.045, 0.55, 0.045, 0);
  }
  var tank = finishGeo(B);
  var C = { pos: [], nor: [], idx: [], rib: [] };
  pushBox(C, 0, 0.5, 0, 0.5, 0.5, 0.5, 0);            /* a plant room */
  var hut = finishGeo(C);
  var D = { pos: [], nor: [], idx: [], rib: [] };
  pushCyl(D, 0, 0, 0, 0.035, 0.02, 1.0, 6);           /* an aerial */
  pushBox(D, 0, 0.62, 0, 0.02, 0.02, 0.24, 0);
  pushBox(D, 0, 0.80, 0, 0.02, 0.02, 0.17, 0);
  var mast = finishGeo(D);
  var E = { pos: [], nor: [], idx: [], rib: [] };
  pushCyl(E, 0, 0, 0, 0.5, 0.36, 0.12, 8);            /* a spire on a drum */
  pushCone(E, 0, 0.12, 0, 0.36, 0.88, 8);
  var spireG = finishGeo(E);

  var tanks = [], huts = [], masts = [], spires = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var top = it[1] + it[3] * it[5];                  /* base + width * (height/width) */
    var w = it[3] * 0.5;
    var d = Math.sqrt(it[0] * it[0] + it[2] * it[2]);
    /* a crown carries its spire and nothing else; its height comes from the
       building's own seed so the builder stream is not drawn from */
    if (it.spire) { spires.push([it[0], top, it[2], it.spire * 1.1, it[4], 2.5 + 3 * ((it[7] * 7.31) % 1), 1]); continue; }
    if (d > 700) continue;
    var r = R.f();
    /* placed in the building's own frame, turned with it, and kept inside
       the roof's edge: offsets in world x and z put plant rooms in mid-air
       off the corner of a turned tower */
    var hw = w, hd = it[3] * it[6] * 0.5, rc = Math.cos(it[4]), rs = Math.sin(it[4]);
    var onRoof = function (fx, fz, rx, rz) {
      var lx = fx * Math.max(hw - rx, 0), lz = fz * Math.max(hd - rz, 0);
      return [it[0] + lx * rc - lz * rs, it[2] + lx * rs + lz * rc];
    };
    var fx1 = R.range(-0.8, 0.8), fz1 = R.range(-0.8, 0.8), tr = R.range(0, 6.283);
    var ts = Math.min(R.range(2.6, 4.6), hw * 0.8, hd * 0.8);
    /* the tank stands on its legs, which reach 1.1 of its size below it */
    var tp = onRoof(fx1, fz1, ts * 0.55, ts * 0.55);
    if (r < 0.30) tanks.push([tp[0], top + ts * 1.1, tp[1], ts, tr, 1, 1]);
    var fx2 = R.range(-1, 1), fz2 = R.range(-1, 1), hsy2 = R.range(0.5, 1.0);
    var hs2 = Math.min(R.range(3, 7), hw * 1.6), hsz2 = Math.min(R.range(0.7, 1.4), hd * 1.6 / hs2);
    var hp = onRoof(fx2, fz2, hs2 * 0.5, hs2 * hsz2 * 0.5);
    if (r > 0.25 && r < 0.75) huts.push([hp[0], top, hp[1], hs2, it[4], hsy2, hsz2]);
    var mp = onRoof(R.range(-0.9, 0.9), R.range(-0.9, 0.9), 0.5, 0.5), ms = R.range(4, 11), mr = R.range(0, 6.283);
    if (r > 0.7) masts.push([mp[0], top, mp[1], ms, mr, 1, 1]);
    /* air-handling units and condensers, a few to a roof */
    var nac = R.int(0, 4);
    for (var q = 0; q < 4; q++) {
      var as = R.range(1.4, 3.2), asz = R.range(0.6, 1.6), ap = onRoof(R.range(-1, 1), R.range(-1, 1), as * 0.5, as * asz * 0.5);
      if (q < nac && as < hw * 1.5 && as * asz < hd * 1.5) huts.push([ap[0], top, ap[1], as, it[4], R.range(0.35, 0.6), asz]);
    }
  }
  var mt = solidMat(U, '#8a7a62', { rib: 0, grain: 1, spines: 0, barkN: 20, barkPlate: 6 });
  var mh = solidMat(U, '#9a9a98', { rib: 0, grain: 0, spines: 0, body2: '#7d7d7b' });
  var mm = solidMat(U, '#6f7276', { rib: 0, grain: 0, spines: 0 });
  if (tanks.length) instanceSolid(scene, tank, tanks, mt);
  if (huts.length) instanceSolid(scene, hut, huts, mh);
  if (masts.length) instanceSolid(scene, mast, masts, mm);
  if (spires.length) instanceSolid(scene, spireG, spires, solidMat(U, '#8d9296', { rib: 0, grain: 0, spines: 0, aoH: 0 }));
}

/* ---------- ridges stacked into the distance ----------
   Real distance comes in layers, each paler and bluer than the one in front.
   A single fading noise field cannot do that; these can. */
function buildRidges(scene, P, R, U) {
  if (P.biomeKey === 'penthouse') return;
  /* dry country weathers into mesas and buttes: flat caps, steep sides,
     scree spreading at the foot */
  var mesa = P.biome.dryAir && P.biome.ground === 'sand';
  var snowy = !mesa && (P.seasonKey === 'winter' || P.biomeKey === 'alpine' || P.biomeKey === 'fjord' || P.biomeKey === 'tundra');
  var layers = R.int(2, 4);
  for (var i = 0; i < layers; i++) {
    /* Beyond the terrain's own relief (it reaches 2400 m) so the two do not
       interleave, and inside the sky sphere (3000 m) or the sky would be
       nearer than the ridge and cover it. */
    var dist = Math.min(2900, 2480 + i * R.range(90, 150));
    var height = dist * R.range(0.035, 0.075) * (1 + i * 0.22);
    /* 512 segments: at 128 each was 60 m wide and the skyline kinked */
    var segs = 512, width = dist * 3.2;
    var g = new THREE.PlaneGeometry(width, height * 2.4, segs, 1);
    var pos = g.attributes.position;
    var seed = R.int(1, 9999), rough = R.range(0.5, 1.0);
    var v, top = [];
    for (v = 0; v <= segs; v++) {
      var x = pos.getX(v);
      /* the skyline: a ridged profile with a few summits standing above it */
      var n = ridged(x * 0.0016 + seed, seed * 0.1, seed, 4);
      var n2 = fbm2(x * 0.0005, seed * 0.3, seed + 7, 2);
      var y = (n * 0.75 + Math.abs(n2) * 0.55) * height * rough - height * 0.15;
      if (mesa) {
        /* terraced: each band runs nearly flat, then rises in a short cliff
           to the next; the two shares add up to one band, so the profile
           meets the next band's foot without a notch */
        var stp = height * 0.34, u = (y + height * 0.15) / stp, f = u - Math.floor(u);
        y = (Math.floor(u) + 0.88 * smoothstep(0.72, 0.92, f) + 0.12 * Math.min(f, 0.72) / 0.72) * stp - height * 0.15;
      }
      top.push(y);
    }
    var slope = new Float32Array(pos.count), dx = width / segs;
    for (v = 0; v <= segs; v++) {
      pos.setY(v, top[v]);
      pos.setY(v + segs + 1, -height * 1.4);
      var s = (top[Math.min(segs, v + 1)] - top[Math.max(0, v - 1)]) / (2 * dx);
      slope[v] = slope[v + segs + 1] = s;
    }
    g.setAttribute('aSlope', new THREE.BufferAttribute(slope, 1));
    g.computeVertexNormals();
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uFogCol: U.uFogCol, uSunCol: U.uSunCol, uSunDir: U.uSunDir, uHazeK: U.uHazeK,
        uZenith: App.skyU.uZenith,
        uDepth: { value: Math.min(0.62 + i * 0.12, 0.92) },
        uHeight: { value: height },
        uSnowCap: { value: snowy ? 0.55 : 2.0 },
        /* each layer its own faint cast, from its own seed, not a new draw */
        uHue: { value: new THREE.Vector3(1 + ((seed % 7) - 3) * 0.008, 1, 1 - ((seed % 5) - 2) * 0.010) }
      },
      side: THREE.DoubleSide, depthWrite: true, transparent: true,
      extensions: { derivatives: true },
      vertexShader: GLSL['ridges.vert'],
      fragmentShader: GLSL['ridges.frag']
    });
    var m = new THREE.Mesh(g, mat);
    m.position.set(0, height * 0.15, -dist);
    m.renderOrder = 890 + i;                    /* behind the land, in front of the sky */
    m.frustumCulled = false;
    scene.add(m);
    App.propMeshes.push(m);
  }
}
