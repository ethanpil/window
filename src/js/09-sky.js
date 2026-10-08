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
    vertexShader: [
      'varying vec3 vDir;',
      'void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform vec3 uZenith, uHorizon, uHorizonAway, uSunCol, uSunDir, uCloudL, uCloudD, uMoonDir;',
      'uniform float uTime, uCover, uSoft, uCloudOp, uScale, uSunVis, uNight, uMoonPhase, uBow;',
      'float starHash(vec3 c){ return fract(sin(dot(c, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }',
      'uniform vec2 uOff1, uOff2;',
      'uniform sampler2D uCloudTex;',
      'varying vec3 vDir;',
      GLSL_HORIZON,
      'void main(){',
      '  vec3 d = normalize(vDir);',
      '  float h = max(d.y, 0.0);',
      /* the same horizon the land fades to (horizonAt in GLSL_COMMON) */
      '  vec3 hor = horizonMix(d, uHorizonAway, uHorizon, uSunDir);',
      '  vec3 sky = mix(hor, uZenith, pow(h, 0.45));',
      '  sky = mix(sky, hor * 0.86, smoothstep(0.0, -0.14, d.y));',
      '  float sd = max(dot(d, normalize(uSunDir)), 0.0);',
      '  float ang = acos(clamp(sd, -1.0, 1.0));',
      '  float disk = 1.0 - smoothstep(0.0085, 0.017, ang);',
      /* Mie: a broad warm glow spreads from the sun, strongest low in the sky */
      '  sky += uSunCol * (pow(sd, 220.0) * 0.55 + pow(sd, 12.0) * 0.16 + pow(sd, 3.0) * 0.10 * (1.2 - h) + disk * 1.5) * uSunVis;',
      '  sky = mix(sky, hor * 1.04, smoothstep(0.22, 0.0, d.y) * 0.40);',
      '  if (uNight > 0.01) {',
      /* Stars live in a coarse lattice so they hold still as the view drifts.
         The hash that decides whether a cell holds a star at all lands in a
         sliver just below 1.0 for every star that exists, so taking the
         twinkle from that same number gave the whole sky one rate to within
         a third of a per cent and one phase to within ten degrees: every
         star flashed at once. Rate, phase, brightness and size each get
         their own draw now, and a star is a round point of its own size
         rather than a whole lattice cell. */
      '    vec3 sp = d * 260.0;',
      '    vec3 sc = floor(sp);',
      '    float hStar = starHash(sc);',
      '    float hSize = starHash(sc + 31.7);',
      '    float hRate = starHash(sc + 57.3);',
      '    float hPhase = starHash(sc + 91.1);',
      /* a few bright ones and many faint, rather than all alike */
      '    float mag = smoothstep(0.9958, 1.0, hStar) * (0.30 + 0.70 * hSize * hSize);',
      '    vec3 jit = 0.28 + 0.44 * vec3(starHash(sc + 3.1), starHash(sc + 11.7), starHash(sc + 23.9));',
      '    float rad = 0.26 + 0.40 * hSize;',
      '    float shape = 1.0 - smoothstep(rad * 0.30, rad, length(sp - sc - jit));',
      '    float twinkle = 0.58 + 0.42 * sin(uTime * (0.5 + 3.6 * hRate) + hPhase * 62.83);',
      '    vec3 tint = mix(vec3(0.75, 0.83, 1.0), vec3(1.0, 0.92, 0.78), starHash(sc + 7.0));',
      '    sky += tint * mag * shape * twinkle * uNight * smoothstep(-0.02, 0.16, d.y) * 2.6;',
      /* the moon, with a terminator so it shows a phase */
      '    float md = dot(d, normalize(uMoonDir));',
      '    float mAng = acos(clamp(md, -1.0, 1.0));',
      '    float disc = 1.0 - smoothstep(0.020, 0.030, mAng);',
      '    vec3 up = normalize(cross(normalize(uMoonDir), vec3(0.0, 1.0, 0.0)));',
      '    float across = dot(normalize(d - normalize(uMoonDir) * md), up);',
      '    float lit = step(across, uMoonPhase * 2.0 - 1.0 + 0.55);',
      '    sky += vec3(0.95, 0.94, 0.88) * disc * mix(0.10, 1.35, lit) * uNight;',
      '    sky += vec3(0.55, 0.60, 0.72) * pow(max(md, 0.0), 90.0) * 0.35 * uNight;',
      '  }',
      '  float band = smoothstep(0.005, 0.20, d.y);',
      /* Toward the horizon the deck is too far to resolve: instead of fading
         it out (which left a clear band under every overcast), it turns into
         its own average cover, hazed toward the horizon colour. */
      '  float far = 1.0 - smoothstep(0.03, 0.22, d.y);',
      '  float above = smoothstep(-0.03, 0.004, d.y);',
      '  vec2 p = d.xz / max(d.y, 0.055);',
      '  vec2 uv = p * uScale;',
      /* the deck: two octaves at one height */
      '  float n = texture2D(uCloudTex, uv * 0.55 + uOff1).r * 0.58',
      '          + texture2D(uCloudTex, uv * 1.37 + uOff2).r * 0.42;',
      /* a lower, faster, darker scud in front of it: the parallax is in the
         different drift rates and the different projection scale */
      '  vec2 uvLo = p * uScale * 1.9 + uOff2 * 2.6 + vec2(0.27, 0.71);',
      '  float nLo = texture2D(uCloudTex, uvLo).r;',
      '  float scud = smoothstep(uCover + 0.22, uCover + 0.40, nLo) * band * 0.55 * uCloudOp * smoothstep(0.02, 0.35, d.y);',
      '  float covM = smoothstep(uCover - 0.35, uCover + uSoft + 0.25, 0.5);',
      '  float cov = mix(smoothstep(uCover, uCover + uSoft, n), covM, far) * above * uCloudOp;',
      '  float thick = smoothstep(uCover - 0.06, uCover + 0.34, n);',
      /* sample the cloud again a little toward the sun; where density falls
         off in that direction we are on the lit face, else in its own shadow */
      '  vec2 toSun = normalize(uSunDir.xz + vec2(1e-4)) * 0.011;',
      '  float n2 = texture2D(uCloudTex, uv * 0.55 + uOff1 + toSun).r * 0.58',
      '           + texture2D(uCloudTex, uv * 1.37 + uOff2 + toSun * 2.5).r * 0.42;',
      /* Lit faces: density falling off toward the sun, and Beer-Lambert through
         the cloud between here and the sun, with a powder term so thin wisps
         are not the brightest part */
      '  float beer = exp(-max(n2 - uCover, 0.0) * 6.0);',
      '  float powder = 1.0 - exp(-max(n - uCover, 0.0) * 8.0);',
      '  float litFace = (smoothstep(-0.03, 0.09, n - n2) * 0.5 + beer * mix(0.55, 1.0, powder) * 0.5) * uSunVis;',
      '  vec2 uvHi = p * uScale * 0.36 + uOff1 * 0.55 + vec2(0.61, 0.13);',
      '  float nHi = texture2D(uCloudTex, uvHi).r;',
      '  float cirrus = smoothstep(uCover + 0.14, uCover + 0.36, nHi) * band * 0.5 * uCloudOp;',
      '  sky = mix(sky, mix(uCloudL, uSunCol, 0.12) * 1.02, cirrus);',
      /* the thick middle of a cloud is its flat underside, darker */
      '  vec3 cc = mix(uCloudL, uCloudD * 0.92, thick * 0.95);',
      '  cc = mix(cc * 0.82, cc * 1.10 + uSunCol * 0.08, litFace);',
      '  cc += uSunCol * pow(sd, 7.0) * 0.30 * (1.0 - thick) * uSunVis;',
      '  cc = mix(cc, mix(mix(uCloudL, uCloudD, 0.45), hor, 0.55), far);',
      '  sky = mix(sky, cc, clamp(cov, 0.0, 1.0));',
      '  sky = mix(sky, uCloudD * 0.82, scud);',
      /* A rainbow stands opposite the sun at forty-two degrees, so it only
         shows when the sun is low, behind you, and there is still rain in the
         air. Red outside, violet in, with a fainter second bow beyond it. */
      '  if (uBow > 0.001) {',
      '    float ca = dot(d, -normalize(uSunDir));',
      '    float ang = degrees(acos(clamp(ca, -1.0, 1.0)));',
      '    float band = smoothstep(40.0, 41.2, ang) * (1.0 - smoothstep(42.4, 43.6, ang));',
      '    float t2 = clamp((ang - 40.6) / 2.2, 0.0, 1.0);',
      '    vec3 bow = vec3(0.55 + 0.45 * cos((t2 - 0.05) * 6.2832), 0.5 + 0.5 * cos((t2 - 0.38) * 6.2832), 0.5 + 0.5 * cos((t2 - 0.72) * 6.2832));',
      '    float band2 = smoothstep(51.0, 52.4, ang) * (1.0 - smoothstep(54.0, 55.6, ang));',
      '    float t3 = 1.0 - clamp((ang - 51.7) / 2.8, 0.0, 1.0);',
      '    vec3 bow2 = vec3(0.55 + 0.45 * cos((t3 - 0.05) * 6.2832), 0.5 + 0.5 * cos((t3 - 0.38) * 6.2832), 0.5 + 0.5 * cos((t3 - 0.72) * 6.2832));',
      '    float above = smoothstep(-0.02, 0.10, d.y);',
      '    sky += (bow * band * 0.30 + bow2 * band2 * 0.10) * uBow * above;',
      '  }',
      '  gl_FragColor = vec4(sky, 1.0);',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
  });
  var sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = 900;
  sky.frustumCulled = false;
  scene.add(sky);
  App.sky = sky;
}

