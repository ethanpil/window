/* ---------- insects and small birds in the near field ----------
   Butterflies wander over a summer meadow, bees work the lavender, dragonflies
   hold and dart at the marsh, fireflies drift at dusk, and a small bird flits
   between perches. Each flies its own path in the vertex shader. */
var FLYERS = {
  butterfly: { n: [3, 9],  size: [0.055, 0.085], speed: [0.10, 0.20], hgt: [0.5, 1.9], flap: 9.0,  wob: 1.0, glow: 0 },
  bee:       { n: [6, 16], size: [0.022, 0.034], speed: [0.22, 0.40], hgt: [0.3, 1.1], flap: 26.0, wob: 2.2, glow: 0 },
  dragonfly: { n: [2, 6],  size: [0.070, 0.100], speed: [0.30, 0.55], hgt: [0.4, 1.4], flap: 18.0, wob: 0.5, glow: 0 },
  firefly:   { n: [14, 34],size: [0.030, 0.050], speed: [0.06, 0.13], hgt: [0.3, 1.6], flap: 0.0,  wob: 1.4, glow: 1 },
  smallbird: { n: [1, 3],  size: [0.13, 0.19],  speed: [0.14, 0.26], hgt: [0.8, 3.2], flap: 7.0,  wob: 0.7, glow: 0 }
};
function makeFlyerTexture(kind) {
  var S = 64, c = cnv(S, S), g = c.getContext('2d');
  if (kind === 'butterfly') {
    var col = ['#e8b93c', '#e6e2d6', '#d9743a', '#6f8fc4'][Math.floor(Math.random() * 4)];
    g.fillStyle = col;
    g.beginPath(); g.ellipse(S * 0.34, S * 0.42, S * 0.20, S * 0.15, -0.4, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(S * 0.66, S * 0.42, S * 0.20, S * 0.15, 0.4, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(S * 0.38, S * 0.63, S * 0.13, S * 0.11, 0.3, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(S * 0.62, S * 0.63, S * 0.13, S * 0.11, -0.3, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(40,34,28,0.85)';
    g.beginPath(); g.ellipse(S * 0.5, S * 0.52, S * 0.035, S * 0.20, 0, 0, 6.283); g.fill();
  } else if (kind === 'bee') {
    g.fillStyle = '#3a3128';
    g.beginPath(); g.ellipse(S * 0.5, S * 0.55, S * 0.16, S * 0.11, 0, 0, 6.283); g.fill();
    g.fillStyle = '#d9a72c';
    g.fillRect(S * 0.40, S * 0.47, S * 0.08, S * 0.17);
    g.fillRect(S * 0.55, S * 0.47, S * 0.07, S * 0.16);
    g.fillStyle = 'rgba(230,235,240,0.5)';
    g.beginPath(); g.ellipse(S * 0.44, S * 0.36, S * 0.15, S * 0.08, -0.3, 0, 6.283); g.fill();
  } else if (kind === 'dragonfly') {
    g.strokeStyle = 'rgba(90,150,150,0.85)'; g.lineWidth = S * 0.045; g.lineCap = 'round';
    g.beginPath(); g.moveTo(S * 0.5, S * 0.36); g.lineTo(S * 0.5, S * 0.86); g.stroke();
    g.fillStyle = 'rgba(120,190,190,0.55)';
    g.beginPath(); g.ellipse(S * 0.30, S * 0.45, S * 0.22, S * 0.06, -0.15, 0, 6.283); g.fill();
    g.beginPath(); g.ellipse(S * 0.70, S * 0.45, S * 0.22, S * 0.06, 0.15, 0, 6.283); g.fill();
    g.fillStyle = 'rgba(70,130,130,0.95)';
    g.beginPath(); g.arc(S * 0.5, S * 0.32, S * 0.075, 0, 6.283); g.fill();
  } else if (kind === 'firefly') {
    var gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    gr.addColorStop(0, 'rgba(233,255,170,1)');
    gr.addColorStop(0.25, 'rgba(190,235,110,0.55)');
    gr.addColorStop(1, 'rgba(150,210,80,0)');
    g.fillStyle = gr; g.fillRect(0, 0, S, S);
  } else {
    g.fillStyle = '#5c5348';
    g.beginPath(); g.ellipse(S * 0.46, S * 0.54, S * 0.17, S * 0.11, -0.15, 0, 6.283); g.fill();
    g.beginPath(); g.arc(S * 0.66, S * 0.44, S * 0.085, 0, 6.283); g.fill();
    g.fillStyle = '#c8b48a';
    g.beginPath(); g.ellipse(S * 0.42, S * 0.60, S * 0.11, S * 0.06, 0, 0, 6.283); g.fill();
    g.fillStyle = '#3e382f';
    g.beginPath(); g.moveTo(S * 0.32, S * 0.52); g.lineTo(S * 0.10, S * 0.62); g.lineTo(S * 0.33, S * 0.60); g.fill();
    g.beginPath(); g.moveTo(S * 0.74, S * 0.43); g.lineTo(S * 0.82, S * 0.45); g.lineTo(S * 0.74, S * 0.47); g.fill();
  }
  return tex(c, false);
}
function buildFlyers(scene, P, R, U, H) {
  var W = P.weather, night = P.timeA === 'night', dusky = P.timeA === 'dusk' || P.timeA === 'golden';
  if (W.rain > 0.35 || W.snow > 0.3 || P.seasonKey === 'winter') return;
  var want = [];
  var warm = /meadow|flowerfield|farmland|orchard|blossom|savanna|lavender|autumn|river|lakefront|marsh|terraces|moor/.test(P.biomeKey);
  if (!warm) return;
  if ((night || dusky) && /meadow|marsh|river|lakefront|flowerfield|orchard/.test(P.biomeKey)) want.push('firefly');
  if (!night) {
    if (/lavender|flowerfield|meadow|orchard|blossom|farmland/.test(P.biomeKey)) want.push(R.f() < 0.55 ? 'butterfly' : 'bee');
    if (/marsh|river|lakefront|terraces/.test(P.biomeKey)) want.push('dragonfly');
    if (R.f() < 0.5) want.push('smallbird');
  }
  if (!want.length) return;
  for (var wi = 0; wi < want.length; wi++) {
    var kind = want[wi], F = FLYERS[kind];
    var n = R.int(F.n[0], F.n[1]);
    var quad = new THREE.PlaneGeometry(1, 1);
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
    var iPos = new Float32Array(n * 3), iAttr = new Float32Array(n * 4), iPath = new Float32Array(n * 4);
    for (var i = 0; i < n; i++) {
      /* Placed by depth, not by radius, so the whole wander stays outside: the
         path swings up to 1.6 times its wander radius in z. */
      var wander = R.range(0.5, 1.6);
      var z = -(6.0 + wander * 1.6) - Math.pow(R.f(), 1.3) * 12;
      var x = Math.tan(R.range(-0.95, 0.95)) * -z * R.range(0.5, 1.0);
      iPos[i * 3] = x; iPos[i * 3 + 1] = H(x, z) + R.range(F.hgt[0], F.hgt[1]); iPos[i * 3 + 2] = z;
      iAttr[i * 4] = R.range(F.size[0], F.size[1]);
      iAttr[i * 4 + 1] = R.range(0, 6.283);
      iAttr[i * 4 + 2] = R.range(F.speed[0], F.speed[1]);
      iAttr[i * 4 + 3] = R.range(0.7, 1.3);
      iPath[i * 4] = wander;                       /* how far it wanders */
      iPath[i * 4 + 1] = R.range(0, 6.283);
      iPath[i * 4 + 2] = R.range(0.5, 1.6);
      iPath[i * 4 + 3] = R.range(0, 6.283);
    }
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
    geo.setAttribute('iPath', new THREE.InstancedBufferAttribute(iPath, 4));
    geo.instanceCount = n;
    var mat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime, uCamPos: U.uCamPos, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
        uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uWind: U.uWind, uWindDir: U.uWindDir,
        uMap: { value: makeFlyerTexture(kind) },
        uFlap: { value: F.flap }, uWob: { value: F.wob }, uGlow: { value: F.glow }
      },
      transparent: true, depthWrite: F.glow ? false : true, alphaTest: F.glow ? 0.0 : 0.06,
      blending: F.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      side: THREE.DoubleSide,
      vertexShader: GLSL['flyers.vert'],
      fragmentShader: GLSL['flyers.frag']
    });
    var m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = F.glow ? 7 : 4;
    scene.add(m);
    App.propMeshes.push(m);
  }
}

