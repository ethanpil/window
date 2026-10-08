/* ---------- sky ---------- */
function buildSky(scene, P, R, U) {
  var geo = new THREE.SphereGeometry(3000, 32, 20);
  var uni = {
    uZenith: { value: new THREE.Color(0x3f7ec9) },
    uHorizon: { value: new THREE.Color(0xc3daea) },
    uHorizonAway: { value: new THREE.Color(0xc3daea) },
    uSunCol: { value: new THREE.Color(0xfff2d8) },
    uSunDir: U.uSunDir,
    uSunVis: { value: 1 },
    uBow: { value: 0 },
    uNight: { value: 0 },
    uMoonDir: { value: new THREE.Vector3(0, 0.6, -0.8) },
    uMoonPhase: { value: R.range(0.15, 1.0) },
    uTime: U.uTime,
    uCover: { value: P.weather.cover },
    uSoft: { value: P.weather.soft },
    uCloudOp: { value: P.weather.op },
    uCloudL: { value: new THREE.Color(0xffffff) },
    uCloudD: { value: new THREE.Color(0xa7b1bf) },
    uScale: { value: R.range(0.030, 0.062) },
    uOff1: { value: new THREE.Vector2() },
    uOff2: { value: new THREE.Vector2() },
    uCloudTex: { value: (function () {
      var cseed = R.int(1, 99999);
      var puffy = P.weatherKey === 'clear' || P.weatherKey === 'fair' || P.weatherKey === 'breezy';
      /* heaped cumulus cost 60 to 230 ms of folding per world: they come
         from eight fields that are kept, and the sky's own scale and drift
         make each one look new */
      if (puffy) cseed = 1 + cseed % 8;
      return cached('cloud|' + cseed + '|' + Q().tex + (puffy ? '|puffy' : ''), function () { return makeCloudTexture(cseed, Q().tex, puffy); });
    })() }
  };
  App.skyU = uni;
  var mat = new THREE.ShaderMaterial({
    uniforms: uni,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,      /* drawn last among opaques: early-z skips covered pixels */
    fog: false,
    vertexShader: GLSL['sky.vert'],
    fragmentShader: GLSL['sky.frag']
  });
  var sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = 900;
  sky.frustumCulled = false;
  scene.add(sky);
  App.sky = sky;
}

