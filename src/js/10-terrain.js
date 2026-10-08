/* ---------- terrain ---------- */
/* An even grid wastes vertices on the horizon and starves the foreground, so
   the terrain's is warped: about a metre across near the window, tens of
   metres out. u runs -1..1 across the grid. */
var TERRAIN_SIZE = 4800;
function terrainWarp(u) {
  var a = Math.abs(u);
  return (u < 0 ? -1 : 1) * (0.028 * a + 0.972 * a * a * a) * TERRAIN_SIZE * 0.5;
}
/* the grid's spacing d metres out, on a grid of seg cells a side. Shapes
   that must read on every tier (a mesa's cliff) size themselves for the
   coarsest, so the land is the same on all of them. */
function terrainCellAt(d, seg) {
  var a = Math.cbrt(d / (0.972 * TERRAIN_SIZE * 0.5));
  return (0.028 + 2.916 * a * a) * TERRAIN_SIZE / seg;
}

function buildTerrain(scene, P, R, U, H) {
  var SEG = Q().grid;
  var pos = [], idx = [], i, j;
  var axis = [];
  for (i = 0; i <= SEG; i++) axis.push(terrainWarp((i / SEG) * 2 - 1));
  for (j = 0; j <= SEG; j++) {
    for (i = 0; i <= SEG; i++) {
      var x = axis[i], z = axis[j];
      pos.push(x, H(x, z), z);
    }
  }
  for (j = 0; j < SEG; j++) {
    for (i = 0; i < SEG; i++) {
      var a = j * (SEG + 1) + i, b = a + 1, c = a + SEG + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  /* a sampler of the mesh itself, bilinear across the warped grid: from here on,
     anything placed on the ground uses this, so a tree at 300 m sits on the
     surface you can see rather than on a bump the mesh never drew */
  (function () {
    var find = function (v) { var lo = 0, hi = SEG; while (hi - lo > 1) { var m = (lo + hi) >> 1; if (axis[m] <= v) lo = m; else hi = m; } return lo; };
    App.Hm = function (x, z) {
      if (x <= axis[0] || x >= axis[SEG] || z <= axis[0] || z >= axis[SEG]) return H(x, z);
      var i = find(x), j = find(z);
      var tx = (x - axis[i]) / (axis[i + 1] - axis[i]), tz = (z - axis[j]) / (axis[j + 1] - axis[j]);
      var a = pos[(j * (SEG + 1) + i) * 3 + 1], b = pos[(j * (SEG + 1) + i + 1) * 3 + 1];
      var c = pos[((j + 1) * (SEG + 1) + i) * 3 + 1], d = pos[((j + 1) * (SEG + 1) + i + 1) * 3 + 1];
      return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
    };
  })();
  var CP = cityPlan(P);
  var TKt = P.terrainKind || P.biome.terrain;
  var desertK = TKt === 'dunes' ? (P.erg ? 1 : 2) : 0, DU = (desertK === 1 && P.dune) || {};
  var BT = (TKt === 'canyon' || desertK === 2) ? bedTable(P) : [], BT16 = [];
  for (var bq = 0; bq < 16; bq++) BT16.push(BT[bq] || null);
  var uni = {
    uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
    uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale, uSnow: U.uSnow,
    uSnowCol: U.uSnowCol,
    uTex: { value: (function () {
      var gseed = R.int(1, 99999);
      return cached('ground|' + P.grass.name + '|' + gseed + '|' + Q().tex + '|' + P.patchiness.toFixed(3),
        function () { return makeGroundTexture(P, gseed, Q().tex); });
    })() },
    uTip: { value: new THREE.Color(P.grass.tip) },
    /* heather is brown stems with a band of bells on top: from afar it is
       brown touched with purple, not a purple wash */
    uCoverCol: { value: P.terrainKind === 'skyline' ? new THREE.Color('#3b3c3e') : new THREE.Color(P.grass.cb || P.grass.base)
      .lerp(new THREE.Color(P.grass.ct || P.grass.tip), P.coverStyle === 'heather' ? 0.32 : 0.62) },
    uWindDir: U.uWindDir, uWind: U.uWind,
    /* flowers too small to draw past twenty metres or so still colour the
       field: the species' colours, speckled where their patches are */
    uFlw0: { value: new THREE.Color(P.species && P.species[0] ? P.species[0].petal : '#ffffff') },
    uFlw1: { value: new THREE.Color(P.species && P.species[1 % P.species.length] ? P.species[1 % P.species.length].petal : '#ffffff') },
    uFlw2: { value: new THREE.Color(P.species && P.species[2 % P.species.length] ? P.species[2 % P.species.length].petal : '#ffffff') },
    uFlwK: { value: P.flowerCount && P.species && P.species.length ? clamp(P.flowerCount / 900, 0.35, 1) : 0 },
    /* how much of the ground the blades actually hide, and the lowest ground
       they grow on: the far field only takes the plant colour where plants are */
    uCoverK: { value: clamp((P.coverCount || 0) / 26000, 0, 1) },
    /* a heather moor is a carpet of bushes: the drawn ones are too few to
       hide the ground, so close in the ground takes their colour too */
    uCoverNear: { value: P.coverStyle === 'heather' ? 0.6 : 0.0 },
    /* farmed country: fields, hedge lines and woods drawn into the far ground */
    uPatch: { value: P.biome.farmed ? 1.0 : 0.0 },
    uDryC: { value: new THREE.Color(P.grass.dry) },
    uWoodCol: { value: new THREE.Color(P.leafDark || '#2c3a24').multiplyScalar(0.75 * (P.treeTint || 1)) },
    uCoverMinY: { value: P.waterY != null ? P.waterY + Math.max(P.coverMinH || -1, P.coverWet ? -0.30 : 0.25) : -1e6 },
    /* at an oasis things grow only near the water: the green stops a few
       metres above it (lo, hi), and the sand round about stays sand */
    uPlantY: { value: TKt === 'oasis' ? new THREE.Vector2(P.waterY + 1.0, P.waterY + 4.5) : new THREE.Vector2(1e6, 2e6) },
    uCamPos: U.uCamPos,
    uRock: { value: new THREE.Color(P.rockCol) },
    uHigh: { value: new THREE.Color(P.highCol) },
    uRockLine: { value: P.rockLine != null ? P.rockLine : 1e6 },
    uSnowLine: { value: P.snowLine != null ? P.snowLine : 1e6 },
    uWaterY: { value: P.waterY != null ? P.waterY : -1e6 },
    uBeach: { value: (P.terrainKind || P.biome.terrain) === 'beach' ? 1.0 : 0.0 },
    uSwash: { value: P.waterKind === 'sea' ? 1.0 : 0.0 },
    /* rain soaks into sand; puddles stand on soil and paths */
    uPuddle: { value: ((P.terrainKind || P.biome.terrain) === 'beach' || P.biome.ground === 'sand') ? 0.0 : 1.0 },
    uPaddy: { value: (P.terrainKind || P.biome.terrain) === 'terrace' ? 1.0 : 0.0 },
    uStepH: { value: P.stepH || 1.0 },
    /* the planted rows carry on past the last plant, drawn into the ground on
       the same spacing and angle, so they run to the horizon */
    uRowSp: { value: (P.rowSpacing && P.coverRows) ? P.rowSpacing : 0.0 },
    uRowDir: { value: new THREE.Vector2(Math.cos(P.rowAngle || 0), Math.sin(P.rowAngle || 0)) },
    uRowCol: { value: new THREE.Color(P.rowColour || P.grass.ct || P.grass.tip) },
    uRowSoil: { value: new THREE.Color(P.grass.cb || P.grass.base) },
    /* horizontal beds of rock, each its own shade, laid through the walls */
    uPathW: { value: P.pathKind ? P.pathW : 0.0 },
    uPathX: { value: P.pathX || 0 },
    uPathZ: { value: P.pathZ || 0 },
    uPathDir: { value: new THREE.Vector2(Math.sin(P.pathAng || 0), Math.cos(P.pathAng || 0)) },
    uPathBend: { value: P.pathBend || 0 },
    uPathPh: { value: P.pathPhase || 0 },
    uPathBend2: { value: P.pathBend2 || 0 },
    uPathK2: { value: P.pathK2 || 0 },
    uPathPh2: { value: P.pathPhase2 || 0 },
    uPathGauge: { value: P.pathGauge || 0.0 },
    uRoad: { value: P.pathKind === 'lane' ? 1.0 : 0.0 },
    uPathCol: { value: new THREE.Color(P.grass.soil) },
    /* a city's streets, drawn on its grid (see cityPlan): [cos, sin, pitch,
       block], [street, pavement, ring start, ring end] */
    uCityOn: { value: CP ? 1.0 : 0.0 },
    uCity: { value: new THREE.Vector4(CP ? CP.ca : 1, CP ? CP.sa : 0, CP ? CP.pitch : 1, CP ? CP.bw : 1) },
    uCity2: { value: new THREE.Vector4(CP ? CP.sw : 1, CP ? CP.sk : 1, CP ? CP.streetStart : 0, CP ? CP.end : 0) },
    uCityBuilt: { value: CP ? CP.start : 0 },
    uCityPark: { value: new THREE.Color(P.grass.cb || P.grass.base) },
    uNight: App.skyU.uNight,
    /* the kept ground under the window: depth, edge wobble, edge softness, kind */
    uClear: { value: new THREE.Vector4(P.clearD || 0, P.clearKind ? CLEAR_EDGE[P.clearKind][0] : 0,
                                       P.clearKind ? CLEAR_EDGE[P.clearKind][1] : 1, P.clearKind || 0) },
    /* the beds of rock (bedTable): where each starts, how hard it is, its colour */
    uStrata: { value: BT.length && (TKt === 'canyon' || (desertK === 2 && P.mesaH > 12)) ? 1 : 0 },
    uBedY: { value: BT16.map(function (b) { return b ? b.y0 : 1e6; }) },
    uBedH: { value: BT16.map(function (b) { return b && b.hard ? 1 : 0; }) },
    uBedC: { value: BT16.map(function (b) {
      var bc = new THREE.Color(BED_COLS[b ? b.col : 0]).offsetHSL(0, 0, b ? b.tone * 0.04 : 0);
      return new THREE.Vector3(bc.r, bc.g, bc.b);
    }) },
    uFloorY: { value: TKt === 'canyon' ? -P.canyonDepth : -1e6 },
    /* the canyon's frame and its inner channel (makeHeightField 'canyon'):
       [sin, cos of the axis, p0, half width of the floor], [bend, phase,
       half width of the channel, its phase], and whether water runs in it */
    uCan1: { value: new THREE.Vector4(Math.sin(P.canyonAng || 0), Math.cos(P.canyonAng || 0), P._canP0 || 0, TKt === 'canyon' ? P.canyonW : 0) },
    uCan2: { value: new THREE.Vector4(P.canyonBend || 0, P.canyonPhase || 0, P.chanW || 12, P.chanPh || 0) },
    uRiver: { value: P.hasCanyonRiver && TKt === 'canyon' ? 1 : 0 },
    uRiverCol: { value: new THREE.Color(ihash(5, 6, P.terrainSeed) < 0.5 ? '#4f4a30' : '#56492f') },
    /* the dune field (duneAt), wind ripples, and the bajada's stone pavement */
    uDuneA: { value: new THREE.Vector4(DU.hd || 0, 1 / (DU.lam || 1), Math.cos(DU.ang || 0), Math.sin(DU.ang || 0)) },
    uDuneB: { value: new THREE.Vector4(DU.a1 || 0, DU.k1 || 0, DU.p1 || 0, DU.a2 || 0) },
    uDuneC: { value: new THREE.Vector4(DU.k2 || 0, DU.p2 || 0, DU.k3 || 0, DU.p3 || 0) },
    uDuneD: { value: new THREE.Vector4(DU.a3 || 0, DU.k4 || 0, DU.p4 || 0, DU.sf || 0.2) },
    uDuneR: { value: new THREE.Vector2(DU.r0 || 0, DU.r1 || 1) },
    uRip: { value: new THREE.Vector3((desertK === 1 || TKt === 'beach') ? 1 : 0, Math.cos(DU.ang != null ? DU.ang : P.windAngle), Math.sin(DU.ang != null ? DU.ang : P.windAngle)) },
    uSand: { value: (desertK === 1 || TKt === 'beach' || TKt === 'oasis') ? 1.0 : 0.0 },
    uPave: { value: desertK === 2 ? 1.0 : 0.0 },
    uWash: { value: P.pathKind === 'wash' ? 1.0 : 0.0 },
    uSalt: { value: TKt === 'salt' ? 1.0 : 0.0 },
    uMirage: U.uMirage,
    uZenith: App.skyU.uZenith, uHorizon: App.skyU.uHorizon,
    uSkyCloud: App.skyU.uCloudTex, uSkyScale: App.skyU.uScale,
    uSkyCover: App.skyU.uCover, uSkySoft: App.skyU.uSoft, uSkyOff: App.skyU.uOff1,
    uCloudL: App.skyU.uCloudL, uCloudD: App.skyU.uCloudD
  };
  var mat = new THREE.ShaderMaterial({
    extensions: { derivatives: true },
    uniforms: uni,
    vertexShader: GLSL['terrain.vert'],
    fragmentShader: shader('terrain.frag', {
      LAMP_HALF: (CITY_LAMP / 2).toFixed(1), LAMP: CITY_LAMP.toFixed(1),
      LAMP_IN: CITY_LAMP_IN.toFixed(2)
    })
  });
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  /* Last of the solids: drawn first, every pixel of ground behind a wall,
     a tower or a tree was shaded and then painted over (urban 65 to 44 ms,
     penthouse 55 to 22 on an HD 4600). Water (-1), the sky (900) and the
     ridges are in the transparent pass or later still. */
  m.renderOrder = 1;
  scene.add(m);
  App.terrain = m;
}


