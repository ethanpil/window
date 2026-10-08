/* ---------- water: sea with a swell, or a still fjord channel ---------- */
function buildWater(scene, P, R, U) {
  if (P.waterY == null) return;
  var geo = new THREE.PlaneGeometry(5200, 5200, 1, 1);
  geo.rotateX(-Math.PI / 2);
  var kind = P.waterKind;
  var sea = kind === 'sea';
  var flow = kind === 'flow';
  var mirror = kind === 'mirror';
  var marshy = (P.terrainKind || P.biome.terrain) === 'marsh';
  /* How high the land stands round the water, seen from the water: the rise
     over run of the highest ground beyond the near shore, averaged across the
     view. Below that line still water mirrors hills and banks, not sky; a
     gorge river is walled in and mirrors almost none of it. */
  var rim = 0, nRim = 0;
  for (var ai = -4; ai <= 4; ai++) {
    var az = ai * 0.17, d0 = -1, best = 0;
    for (var dd = 6; dd < 2300; dd *= 1.12) {
      var hy = App.Hm(Math.sin(az) * dd, -Math.cos(az) * dd) - P.waterY;
      if (d0 < 0) { if (hy < 0) d0 = dd; continue; }
      best = Math.max(best, hy / (dd - d0 + 20));
    }
    if (d0 > 0) { rim += best; nRim++; }
  }
  rim = nRim ? clamp(rim / nRim, 0.004, 0.7) : 0.01;
  var uni = {
    uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
    uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uCamPos: U.uCamPos, uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
    uWindDir: U.uWindDir, uGust: U.uGust, uRim: { value: rim },
    /* the colour the water itself scatters back, deep and over a shallow bed;
       a peat marsh is near black, a river carries silt */
    uDeep: { value: new THREE.Color(
      sea ? R.pick(['#0b3f58', '#093a4f', '#10354d'])
      : marshy ? R.pick(['#141a14', '#181d15', '#121712'])
      : flow ? R.pick(['#1f3433', '#203a36', '#24393a'])
      : R.pick(['#13262d', '#11232a', '#162b33'])) },
    uShallow: { value: new THREE.Color(
      sea ? R.pick(['#2a9aa0', '#36a8a6', '#2390a0'])
      : marshy ? R.pick(['#2e3322', '#33372a'])
      : flow ? R.pick(['#3b5a4e', '#425f50'])
      : R.pick(['#2c4a4c', '#294548'])) },
    /* how fast light dies in it, per metre: clear sea, a lake, a silty river,
       a marsh stained with peat */
    uAbs: { value: sea ? 0.35 : (marshy ? 2.6 : (flow ? 1.3 : (mirror ? 0.3 : 0.7))) },
    uFoam: { value: sea ? 1.0 : 0.0 },
    uChop: { value: sea ? 1.0 : (flow ? 0.7 : (marshy ? 0.18 : (mirror ? 0.05 : 0.4))) },
    uSwell: { value: R.range(0.19, 0.32) },
    uFlowDir: { value: new THREE.Vector2(0, flow ? (P.flowDown || 1) : 0) },
    uFlowRate: { value: flow ? R.range(0.9, 2.2) : 0 },
    uStreak: { value: flow ? 1.0 : 0.0 },
    uMirror: { value: mirror ? 1.0 : 0.0 },
    uZenith: App.skyU.uZenith, uCloudL: App.skyU.uCloudL, uCloudD: App.skyU.uCloudD
  };
  var mat = new THREE.ShaderMaterial({
    extensions: { derivatives: true },
    uniforms: uni,
    /* blended, so it thins to nothing over the last few centimetres of depth
       and the shore is wet ground going under rather than a hard seam */
    transparent: true,
    vertexShader: GLSL['water.vert'],
    fragmentShader: GLSL['water.frag']
  });
  var m = new THREE.Mesh(geo, mat);
  m.position.y = P.waterY;
  m.frustumCulled = false;
  /* first of the blended things, straight after the solid world, so a boat,
     spray or mist drawn later lies over it rather than under it */
  m.renderOrder = -1;
  scene.add(m);
  App.water = m;
}

