/* ============================================================
   6. shared GLSL
   ============================================================ */
/* A soft shoulder so highlights (sun, glitter, snow) roll off instead of
   clipping. The curve runs on the brightest channel and scales the other two
   with it, so a blue sky stays blue instead of each channel being squeezed
   toward the same grey; only near white does it ease toward a per-channel
   roll-off, so the sun and snow still burn to white. A small toe keeps the
   blacks down. The grade (a little contrast, cool shadows, warm highlights)
   lives here too, so a frame without the post pass looks the same. */
var GLSL_TONE = [
  'vec3 tone(vec3 c){',
  '  c = max(c, vec3(0.0));',
  '  c *= (c + 0.022) / (c + 0.040);',
  '  float m = max(max(c.r, c.g), c.b);',
  '  float s = 1.0 - exp(-1.42 * m);',
  '  vec3 hp = c * (s / max(m, 1e-4));',
  '  vec3 pc = 1.0 - exp(-1.42 * c);',
  '  c = mix(hp, pc, smoothstep(0.50, 0.95, s) * 0.85);',
  '  float l = dot(c, vec3(0.30, 0.59, 0.11));',
  '  c = mix(c, c * c * (3.0 - 2.0 * c), 0.16);',
  '  return c + vec3(-0.012, 0.0, 0.022) * (1.0 - l) + vec3(0.02, 0.008, -0.012) * l;',
  '}'
].join('\n');

/* The horizon is the colour of the sky toward the sun and cooler, pinker,
   away from it when the sun is low, blended by azimuth. The sky passes its
   own pair; the land's haze its own (horizonAt), so they meet without a seam. */
var GLSL_HORIZON = [
  'vec3 horizonMix(vec3 dir, vec3 away, vec3 toward, vec3 sunDir){',
  '  float w = dot(normalize(dir.xz + vec2(1e-5)), normalize(sunDir.xz + vec2(1e-5))) * 0.5 + 0.5;',
  '  return mix(away, toward, smoothstep(0.0, 1.0, w)); }'
].join('\n');

var GLSL_COMMON = [
  'uniform sampler2D uShadowMap; uniform vec2 uShadowOrigin, uShadowScale;',
  /* a hash without sin(), which loses its precision kilometres out, and
     smooth value noise from it */
  'float h2(vec2 p){ vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }',
  'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);',
  '  return mix(mix(h2(i), h2(i + vec2(1.0, 0.0)), f.x), mix(h2(i + vec2(0.0, 1.0)), h2(i + vec2(1.0)), f.x), f.y); }',
  /* how much of the band lo..hi a pixel of width f centred on d covers:
     exact close in, the band's average once it is under a pixel */
  'float bandAA(float d, float lo, float hi, float f){ f = max(f, 1e-3); return max(0.0, min(d + 0.5 * f, hi) - max(d - 0.5 * f, lo)) / f; }',
  /* outside the baked rectangle the edge texels would repeat to the horizon
     (clamp to edge), smearing one shadow into a stripe; fade to lit instead */
  /* .x sun (1 lit), .y sky seen (ambient occlusion: hollows, under things) */
  /* Thin things (a saguaro and its arms, an ocotillo, a creosote bush) cast
     shadows narrower than a texel of that map; near the window they are
     drawn into a finer one of their own (bakeNear), 25 cm texels over the
     64 m square in front, whose border is lit so it clamps to nothing. */
  'uniform sampler2D uNearMap; uniform vec4 uNearR;',
  'float bakedEdge(vec2 uv){ vec2 e = smoothstep(vec2(0.0), vec2(0.02), uv) * (1.0 - smoothstep(vec2(0.98), vec2(1.0), uv)); return e.x * e.y; }',
  /* mip-mapped (bakeNear), so its smaller levels' edge texels hold shadow
     that clamping would smear outward: lit outside the square */
  'float nearSun(vec2 xz){ vec2 uv = (xz - uNearR.xy) * uNearR.zw, q = step(vec2(0.0), uv) * step(uv, vec2(1.0));',
  '  return mix(1.0, texture2D(uNearMap, uv).r, q.x * q.y); }',
  'vec2 bakedRG(vec2 xz){ vec2 uv = (xz - uShadowOrigin) * uShadowScale; vec2 v = texture2D(uShadowMap, uv).rg;',
  '  v = mix(vec2(1.0), v, bakedEdge(uv)); v.x = min(v.x, nearSun(xz)); return v; }',
  'float baked(vec2 xz){ return bakedRG(xz).x; }',
  /* A bridge deck and the cars on it stand far above the ground the map was
     baked for, whose shadow (the gorge's floor, the bridge's own blob) is not
     theirs. lift 1: read instead how high the shadow climbs that column (A,
     see bakeShadows) and be lit above it. One fetch either way. */
  'float bakedSun(vec3 p, float lift){ vec2 uv = (p.xz - uShadowOrigin) * uShadowScale; vec4 t = texture2D(uShadowMap, uv);',
  '  float s = mix(min(t.r, nearSun(p.xz)), smoothstep(-0.4, 0.4, p.y - (t.a * 640.0 - 160.0)), lift);',
  '  return mix(1.0, s, bakedEdge(uv)); }',
  /* .b is the depth of standing water in metres (see bakeShadows); outside
     the baked rectangle it reads as deep */
  'float waterDepth(vec2 xz){ vec2 uv = (xz - uShadowOrigin) * uShadowScale; float b = texture2D(uShadowMap, uv).b;',
  '  vec2 e = smoothstep(vec2(0.0), vec2(0.02), uv) * (1.0 - smoothstep(vec2(0.98), vec2(1.0), uv));',
  '  b = mix(1.0, b, e.x * e.y); return b * b * 8.0; }',
  /* Clear air thins light by Beer-Lambert, a straight exponential: a far hill
     is paler, not gone. Mist and falling rain or snow close in as a wall, which
     the old squared exponent drew well, so each weather blends the two
     (uFogShape 0 = clear air, 1 = mist). The land's own edge always fades out. */
  'uniform float uFogShape, uFogH;',
  'float fogT(float t){ return mix(1.0 - exp(-0.6 * t), 1.0 - exp(-t * t), uFogShape); }',
  'float fogAmt(float d, float density){ return max(fogT(density * d), smoothstep(1900.0, 2400.0, d)); }',
  /* Haze is densest low down and thins with height (scale height uFogH). The
     optical depth along a ray between two heights has a closed form: the
     density at the lower end times the mean of the exponential over the climb. */
  'float fogAmtH(float d, float density, float y){',
  '  float ya = max(cameraPosition.y, 0.0), k = (max(y, 0.0) - ya) / uFogH;',
  '  float g = exp(-ya / uFogH) * (abs(k) < 1e-3 ? 1.0 : (1.0 - exp(-k)) / k);',
  '  return max(fogT(density * d * g), smoothstep(1900.0, 2400.0, d)); }',
  /* the land's horizon: the fog colour toward the sun, uFogAway away */
  'uniform vec3 uFogAway, uInScat, uGroundCol;',
  'uniform float uWet;',             /* 0 dry, 1 just rained */
  GLSL_HORIZON,
  'vec3 horizonAt(vec3 dir, vec3 fogCol, vec3 sunDir){ return horizonMix(dir, uFogAway, fogCol, sunDir); }',
  'uniform float uHazeK;',
  'vec3 hazeToward(vec3 fogCol, vec3 viewDir, vec3 sunDir, vec3 sunCol){ float f = pow(max(dot(viewDir, normalize(sunDir)), 0.0), 3.0) * uHazeK; return horizonAt(viewDir, fogCol, sunDir) + sunCol * f * 0.12; }',
  /* The first few hundred metres of air add the sky's own blue before the
     haze turns to the horizon's colour: dark things go blue with distance. The
     result is the colour to mix toward with the same amount f. */
  'vec3 hazeAt(vec3 fogCol, vec3 viewDir, vec3 sunDir, vec3 sunCol, float f){',
  '  return mix(uInScat, hazeToward(fogCol, viewDir, sunDir, sunCol), 0.35 + 0.65 * f); }',
  /* Ambient from a sky above and the lit ground below, by which way a surface
     faces: an underside sees the ground's bounce, a top sees the sky. */
  'vec3 hemi(vec3 n, vec3 amb){ return mix(uGroundCol, amb, n.y * 0.5 + 0.5); }',
  /* A gust front across a field: a wave running downwind, its crest bent and
     its strength varied across the wind, so it arrives as patches (cat's
     paws) rather than ruled lines. k is the wavenumber along the wind, w its
     rate, ph a phase. Grass, flowers, sprays and the far field all use it. */
  'float gustWave(vec2 p, vec2 dir, float t, float k, float w, float ph){',
  '  float a = dot(p, vec2(-dir.y, dir.x)), u = dot(p, dir);',
  '  float bendA = 1.7 * sin(a * 0.043 + 0.6) + 0.9 * sin(a * 0.11 - t * 0.07);',
  '  return sin(u * k - t * w + ph + bendA) * (0.65 + 0.35 * sin(a * 0.071 + u * 0.019 - t * 0.21));',
  '}',
  /* Cloud shadows are the sky's own clouds: from a point on the ground, follow
     the sun up to the deck (about 1000 m) and read the cloud texture there
     with the sky's mapping, so a shadow lies under a cloud you can see. The
     sky maps direction d to d.xz / d.y; a deck point is the same thing in
     units of the deck height. uCloudShift = sun.xz / sun.y. Two fetches, no
     branch; t is kept for the callers, the drift is in the offsets. */
  'uniform sampler2D uSkyCloud; uniform float uSkyScale, uSkyCover, uSkySoft, uSkyOp;',
  'uniform vec2 uSkyOff, uSkyOff2, uCloudShift;',
  'float cloudShade(vec2 p, float t){',
  '  vec2 uv = ((p - cameraPosition.xz) / 1000.0 + uCloudShift) * uSkyScale;',
  '  float n = texture2D(uSkyCloud, uv * 0.55 + uSkyOff).r * 0.58 + texture2D(uSkyCloud, uv * 1.37 + uSkyOff2).r * 0.42;',
  '  return 1.0 - smoothstep(uSkyCover, uSkyCover + uSkySoft, n) * uSkyOp;',
  '}',
  /* The sky as water or a wet surface sees it along r: the dome's own
     gradient and cloud deck, by the dome's own mapping, two fetches and no
     sun (the caller adds its glint). zen, cl, cd: the sky's zenith and cloud
     colours, which the callers already carry. Sky only: no geometry is
     mirrored, which was tried once and went badly. */
  'vec3 skyMirror(vec3 r, vec3 fogCol, vec3 sunDir, vec3 zen, vec3 cl, vec3 cd){',
  '  float h = max(r.y, 0.0);',
  '  vec3 hor = horizonAt(r, fogCol, sunDir);',
  '  vec3 s = mix(hor, zen, pow(h, 0.45));',
  '  s = mix(s, hor * 1.04, smoothstep(0.22, 0.0, h) * 0.40);',
  '  vec2 uv = r.xz / max(h, 0.055) * uSkyScale;',
  '  float n = texture2D(uSkyCloud, uv * 0.55 + uSkyOff).r * 0.58 + texture2D(uSkyCloud, uv * 1.37 + uSkyOff2).r * 0.42;',
  '  float far = 1.0 - smoothstep(0.03, 0.22, h);',
  '  float covM = smoothstep(uSkyCover - 0.35, uSkyCover + uSkySoft + 0.25, 0.5);',
  '  float cov = mix(smoothstep(uSkyCover, uSkyCover + uSkySoft, n), covM, far) * uSkyOp;',
  '  vec3 cc = mix(cl, cd * 0.92, smoothstep(uSkyCover - 0.06, uSkyCover + 0.34, n) * 0.95);',
  '  cc = mix(cc, mix(mix(cl, cd, 0.45), hor, 0.55), far);',
  '  return mix(s, cc, clamp(cov, 0.0, 1.0)); }'
].join('\n');

/* ---------- preferences ----------
   localStorage first, a cookie second, memory last. A sandboxed frame has an
   opaque origin and will throw on both, so nothing here may be assumed. */
var Prefs = {
  key: 'window-prefs-v1', mem: null,
  read: function () {
    if (this.mem) return this.mem;
    var out = null;
    try { var raw = window.localStorage.getItem(this.key); if (raw) out = JSON.parse(raw); } catch (e) {}
    if (!out) {
      try {
        var m = document.cookie.match(/(?:^|;\s*)windowprefs=([^;]*)/);
        if (m) out = JSON.parse(decodeURIComponent(m[1]));
      } catch (e2) {}
    }
    this.mem = out || {};
    return this.mem;
  },
  write: function () {
    var json = JSON.stringify(this.mem || {});
    try { window.localStorage.setItem(this.key, json); return 'local'; } catch (e) {}
    try {
      document.cookie = 'windowprefs=' + encodeURIComponent(json) + ';path=/;max-age=31536000;SameSite=Lax';
      if (document.cookie.indexOf('windowprefs=') >= 0) return 'cookie';
    } catch (e2) {}
    return 'memory';
  },
  set: function (k, v) { this.read(); this.mem[k] = v; return this.write(); },
  get: function (k, dflt) { var o = this.read(); return o[k] === undefined ? dflt : o[k]; }
};

