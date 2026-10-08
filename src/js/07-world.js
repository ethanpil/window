/* ============================================================
   7. the world
   ============================================================ */
var App = {};

/* The page may be running somewhere the URL can't be touched (a sandboxed
   iframe, a file:// document). Seeds still work; they just live in memory. */
function readSeedFromUrl() {
  try {
    var q = new URLSearchParams(location.search);
    var code = q.get('code');
    if (code) { var d = decodeScene(code); if (d) { App.pendingT = d.t; App.qAuto = d.qAuto; App.qTier = d.qTier; App.clearPanes = d.panes; return d.seed; } }
    var sd = q.get('seed');
    return sd && parseSeed(sd).valid ? sd : null;
  } catch (e) { return null; }
}
function writeSeedToUrl(seed) {
  try {
    var code = App.P ? encodeScene() : null;
    history.replaceState({}, '', code ? '?code=' + code : '?seed=' + encodeURIComponent(seed));
    App.urlOk = true;
  } catch (e) {
    App.urlOk = false;
  }
}

function disposeDeep(obj, seen) {
  seen = seen || App._disposed || (App._disposed = []);
  var once = function (t) {
    if (!t || seen.indexOf(t) >= 0) return;
    seen.push(t);
    if (t.userData && t.userData.cacheKey) return;   /* shared across worlds */
    t.dispose();
  };
  obj.traverse(function (n) {
    if (n.geometry) n.geometry.dispose();
    var mats = n.material ? (Array.isArray(n.material) ? n.material : [n.material]) : [];
    for (var i = 0; i < mats.length; i++) {
      var m = mats[i], k;
      for (k in m) { if (m[k] && m[k].isTexture) once(m[k]); }
      if (m.uniforms) {
        for (k in m.uniforms) {
          var v = m.uniforms[k] && m.uniforms[k].value;
          if (v && v.isTexture) once(v);
        }
      }
      m.dispose();
    }
  });
}

function clearWorld() {
  var scene = App.scene;
  if (!scene) return;
  App._disposed = [];
  while (scene.children.length) {
    var c = scene.children[0];
    scene.remove(c);
    disposeDeep(c);
  }
  App.sky = App.terrain = App.grass = App.birdMesh = App.water = null;
  App.rain = App.snow = App.room = App.glass = App.glassMat = null;
  App.dust = App.falls = App.leaves = App.visitor = App.shadows = null;
  App.visitorInfo = null;
  App.flowerMeshes = App.propMeshes = null;
}

/* common.glsl declares the air and light every lit shader shares. Rather than
   list them in each material, they are handed to every shader material once
   the world is built, before anything compiles: three only binds a uniform the
   material carries, and an unbound one reads as zero. */
function shareCommon(scene) {
  var U = App.U, S = App.skyU;
  var common = {
    uFogShape: U.uFogShape, uFogH: U.uFogH, uFogAway: U.uFogAway, uInScat: U.uInScat,
    uGroundCol: U.uGroundCol, uHazeK: U.uHazeK, uWet: U.uWet,
    uSkyCloud: S.uCloudTex, uSkyScale: S.uScale, uSkyCover: S.uCover, uSkySoft: S.uSoft,
    uSkyOp: S.uCloudOp, uSkyOff: S.uOff1, uSkyOff2: S.uOff2, uCloudShift: U.uCloudShift,
    uNearMap: U.uNearMap, uNearR: U.uNearR
  };
  scene.traverse(function (o) {
    var m = o.material;
    if (!m || !m.isShaderMaterial || !m.uniforms) return;
    for (var k in common) if (!(k in m.uniforms)) m.uniforms[k] = common[k];
  });
}

function buildWorld(seed) {
  clearWorld();
  var P = buildParams(seed);
  App.P = P;
  App.locks = P.locks;                     /* keep the dropdowns in step */
  applyView();

  var scene = App.scene;
  App._shadows = [];
  App._casters = [];
  App._nearH = null;
  App._boxes = [];
  App._ao = null;
  App._bake = null;
  App._features = [];
  App._cardMat = null;
  sizeWindow(P, window.innerWidth / window.innerHeight);
  var R = RNG(P.base + '/build' + (P.nonce ? '/' + P.nonce : ''));
  var H = makeHeightField(P);
  App.H = H;
  /* how high does this land actually reach in view? snow and rock follow from that */
  var maxH = 0;
  for (var mz = -20; mz > -700; mz -= 22) {
    for (var mx = -420; mx <= 420; mx += 28) {
      var hh = H(mx, mz);
      if (hh > maxH) maxH = hh;
    }
  }
  P.rockLine = P.rockFrac != null ? maxH * P.rockFrac : 1e6;
  P.snowLine = P.snowFrac != null ? maxH * P.snowFrac : 1e6;

  var U = {
    uTime:      { value: 0 },
    uWind:      { value: P.windBase },
    uGust:      { value: 0.5 },
    uWindDir:   { value: new THREE.Vector2(Math.cos(P.windAngle), Math.sin(P.windAngle)) },
    uSunDir:    { value: new THREE.Vector3(0, 0.6, -0.8) },
    uSunCol:    { value: new THREE.Color(0xffffff) },
    uAmbCol:    { value: new THREE.Color(0x808080) },
    uFogCol:    { value: new THREE.Color(0xc8d8e4) },
    uFogDensity:{ value: P.weather.fogD * P.hazeMul },
    uShadow:    { value: P.weather.shadow },
    /* a winter snowfall has been going a while: start well covered */
    uSnow:      { value: (P.weather.snow > 0 && P.seasonKey === 'winter')
                  ? Math.max(P.baseSnow || 0, snowTarget(P.weather)) : (P.baseSnow || 0) },
    uSnowCol:   { value: new THREE.Color(0xeef2f7) },
    uCamPos:    { value: new THREE.Vector3() },
    uHazeK:     { value: 1.0 },
    uFogShape:  { value: P.weather.fogShape || 0 },
    uFogH:      { value: P.weather.fogH || 160 },
    uFogAway:   { value: new THREE.Color(0xc8d8e4) },
    uInScat:    { value: new THREE.Color(0xa8c0dc) },
    uGroundCol: { value: new THREE.Color(0x303428) },
    uCloudShift: { value: new THREE.Vector2() },
    uWet:       { value: 0 },
    uMirage:    { value: 0 },
    /* until a bake, and for good where there are no vertex textures (see
       applyShadowMap): lit, no AO, deep water, and A 0, a shadow that
       climbs nowhere (255 would put a city in shade up to 480 m) */
    uShadowMap: { value: (function () {
      var t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 0]), 1, 1, THREE.RGBAFormat);
      t.needsUpdate = true; return t;
    })() },
    uNearMap: { value: (function () {
      var t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, THREE.RGBAFormat);
      t.needsUpdate = true; return t;
    })() },
    uNearR: { value: new THREE.Vector4(NEAR.x0, NEAR.z0, 1 / (NEAR.x1 - NEAR.x0), 1 / (NEAR.z1 - NEAR.z0)) },
    uShadowOrigin: { value: new THREE.Vector2(SHADOW.x0, SHADOW.z0) },
    uShadowScale: { value: new THREE.Vector2(1 / (SHADOW.x1 - SHADOW.x0), 1 / (SHADOW.z1 - SHADOW.z0)) }
  };
  App.U = U;
  /* what the ground reflects back up, roughly: the bare earth and the plants'
     colour weighted by how much they cover it */
  /* bare sand is the colour of the sand, not of the soil under a sward: a
     dune or a salt pan throws a bright warm light back up under things */
  var sandy = P.biome.ground === 'sand';
  App.albedo = new THREE.Color(sandy ? P.grass.base : P.grass.soil).lerp(new THREE.Color(sandy ? P.grass.tip : P.grass.soil), 0.4).lerp(new THREE.Color(P.grass.cb || P.grass.base)
    .lerp(new THREE.Color(P.grass.ct || P.grass.tip), 0.5), clamp((P.coverCount || 0) / 26000, 0, 1) * 0.8);

  buildSky(scene, P, R, U);
  buildTerrain(scene, P, R, U, H);
  H = App.Hm;                              /* the drawn surface, for everything that follows */
  App.H = H;
  buildWater(scene, P, R, U);
  buildGrass(scene, P, R, U, H);
  buildFlowers(scene, P, R, U, H);
  buildProps(scene, P, R, U, H);
  buildClutter(scene, P, R, U, H);
  buildCritters(scene, P, R, U, H);
  buildLandmark(scene, P, R, U, H);
  if (P.hasCamp && P.oasisX != null) {
    /* a few tents pitched at the water's edge, with a fire going */
    var tb = { pos: [], nor: [], idx: [], rib: [] };
    pushCone(tb, 0, 0, 0, 0.62, 1.0, 4);
    var ttpl = finishGeo(tb);
    var tmat = solidMat(U, R.pick(['#c8b48c', '#b8a179', '#8d7d5e']), { rib: 0, grain: 0, spines: 0 });
    var tents = [], tg = 0;
    while (tents.length < R.int(2, 5) && tg < 200) {
      tg++;
      var ta = R.range(0, 6.283), tr = P.oasisW * R.range(0.75, 1.15);
      var tx = P.oasisX + Math.cos(ta) * tr, tz = P.oasisZ + Math.sin(ta) * tr;
      if (H(tx, tz) < P.waterY + 0.4) continue;
      var ts = R.range(2.4, 3.6);
      tents.push([tx, H(tx, tz), tz, ts, R.range(0, 6.283), 1, 1]);
      App._shadows.push([tx, H(tx, tz), tz, ts * 0.5, 0.8, ts]);
    }
    if (tents.length) {
      instanceSolid(scene, ttpl, tents, tmat);
      buildSmoke(scene, P, R, U, tents[0][0] + 4, tents[0][1] + 0.5, tents[0][2] + 3, 4.5);
    }
  }
  if ((P.terrainKind || P.biome.terrain) === 'cascade') buildCascadeFall(scene, P, R, U, H);
  buildBoundaries(scene, P, R, U, H);
  buildTerraceWall(scene, P, U, H);
  buildHerd(scene, P, R, U, H);
  buildWaterLife(scene, P, R, U, H);
  buildRidges(scene, P, R, U);
  buildFlyers(scene, P, R, U, H);
  buildMotes(scene, P, R, U, H);
  buildDust(scene, P, R, U, H);
  buildFalls(scene, P, R, U, H);
  buildBirds(scene, P, R, U);
  buildVisitors(scene, P, R, U, H);
  buildPrecip(scene, P, R, U);
  buildRoom(scene, P, U);

  var sun = new THREE.DirectionalLight(0xffffff, 0.85);
  scene.add(sun); scene.add(sun.target);
  App.sun = sun;
  var fill = new THREE.DirectionalLight(0xffffff, 0.55);
  fill.position.set(0.4, 0.55, 1);
  scene.add(fill);
  App.fill = fill;
  var amb = new THREE.AmbientLight(0xffffff, 0.34);
  scene.add(amb);
  App.amb = amb;
  /* the sky seen through the opening: it lights the sill top and the two
     reveals from outside, one light leaning to each side */
  App.skyLights = [-0.55, 0.55].map(function (sx) {
    var l = new THREE.DirectionalLight(0xffffff, 0.3);
    l.position.set(sx, 0.6, -1);
    scene.add(l);
    return l;
  });
  shareCommon(scene);

  /* This world's clock before the bake: baked under the last world's sun,
     the map was thrown away and baked again on the first frame. The clock
     and the wet ground come from streams of their own, so no builder's draws
     can move them, and a scene code's pinned clock leaves the wetness alone.
     The clock moves on a reshuffle (another look at the place); whether it
     rained lately is the place's weather and stays. */
  App.t = App.pendingT != null ? App.pendingT : RNG(P.base + '/clock' + (P.nonce ? '/' + P.nonce : '')).range(0, 500);
  App.pendingT = null;
  App._wxT = null;
  App.elapsed = 0;
  App.nextFlash = null; App.flash = 0; App.flashAgain = null;
  var WS = RNG(P.base + '/wet');
  App.wetness = P.weather.rain > 0 ? 1 : (WS.f() < 0.18 ? WS.range(0.4, 1) : 0);
  App.bowTarget = 0; App.skyU.uBow.value = 0;
  updateWeather(App.t);
  applyShadowMap(bakeShadows(P, H, U.uSunDir.value));
  FX.init(P, R);
  Sound.reset(P);

  writeSeedToUrl(P.seed);                  /* now that the clock is set, the code is complete */
  layout();
  updateHUD(P);
  updateWeather(App.t);
}

function start() {
  var canvas = document.getElementById('gl');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, alpha: false,
      powerPreference: 'high-performance', stencil: false, depth: true
    });
  } catch (e) { renderer = null; }
  if (!renderer) {
    document.getElementById('fallback').style.display = 'grid';
    document.getElementById('curtain').style.display = 'none';
    return;
  }
  App.renderer = renderer;
  try { App.maxAniso = Math.min(16, renderer.capabilities.getMaxAnisotropy() || 4); } catch (e) { App.maxAniso = 4; }
  renderer.setClearColor(0x0a0a0b, 1);

  App.scene = new THREE.Scene();
  App.camera = new THREE.PerspectiveCamera(52, 1, 0.3, 7000);
  App.clock = new THREE.Clock();
  App.quality = 0;
  App.frameAvg = 16;
  App.lastChange = 0;
  App.urlOk = false;
  App.elapsed = 0;
  App.clearPanes = !!Prefs.get('panes', false);
  App.autoMin = Prefs.get('autoMin', 0);
  App.pinned = !!Prefs.get('pinned', false);
  App.showTools = Prefs.get('tools', true);
  App.wantSound = !!Prefs.get('sound', false);
  App.noNight = false;
  App.liveClock = false;
  App.sashOpen = false;
  App.bare = false;
  App.sashAngle = 0;
  App.locks = { biome: null, weather: null, time: null, window: null, finish: null,
                season: null, view: null, night: null };
  var rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
  App.reduceMotion = !!(rm && rm.matches);
  App.mouseMotion = App.reduceMotion ? false : !!Prefs.get('motion', true);
  if (rm && rm.addEventListener) rm.addEventListener('change', function (e) {
    App.reduceMotion = e.matches;
    if (e.matches) { App.mouseMotion = false; App.pointer.tx = 0; App.pointer.ty = 0; }
    updateHUD(App.P);
  });
  App.qTier = clamp(Prefs.get('qTier', 1), 0, QUALITY.length - 1);
  App.qAuto = Prefs.get('qAuto', true);
  App.qChanges = 0;
  App.qSettle = 0;
  App.pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  window.addEventListener('resize', layout);
  window.addEventListener('pointermove', function (e) {
    if (App.mouseMotion) {
      App.pointer.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      App.pointer.ty = (e.clientY / window.innerHeight - 0.5) * 2;
    }
    wake();
  }, { passive: true });
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) App.clock.getDelta();
  });
  bindUI();
  document.getElementById('hud').classList.toggle('notools', !App.showTools);
  document.getElementById('bTools').setAttribute('aria-expanded', App.showTools ? 'true' : 'false');

  /* a stored "sound on" cannot start itself: browsers want a gesture first */
  if (App.wantSound) {
    var arm = function () {
      window.removeEventListener('pointerdown', arm);
      window.removeEventListener('keydown', arm);
      if (!Sound.on) { Sound.toggle(); updateHUD(App.P); }
    };
    window.addEventListener('pointerdown', arm);
    window.addEventListener('keydown', arm);
  }

  buildWorld(readSeedFromUrl() || randomSeed());

  /* first frame, then lift the curtain */
  renderFrame();
  requestAnimationFrame(function () {
    document.getElementById('curtain').classList.add('gone');
  });
  loop();
}

