#include "tone.glsl"
uniform vec3 uSpine, uTipCol, uBody2, uLichen, uBody; uniform float uRib, uNodes, uGrain, uRibN, uSpines, uTipMix, uBarkN, uBarkPlate, uTwoTone, uVarn;
uniform vec3 uSunDir, uSunCol; uniform float uShadow, uTime, uLift, uThin;
#include "common.glsl"
/// A computed pattern has no mip chain, so once its stripes are finer than
/// a pixel it turns to moire. This measures how fast the pattern's own
/// coordinate moves per pixel and fades the pattern out as it nears that
/// limit, which is what a mip-map would have done for a texture.
float bandLimit(float x, float freq){ float w = fwidth(x) * freq; return 1.0 - smoothstep(0.30, 0.85, w); }
varying vec3 vCol; varying float vRib; varying float vUp; varying float vSeed; varying vec3 vLocal; varying vec3 vNrm;
varying vec3 vWp; varying vec3 vHaze; varying float vFogF; varying vec3 vMet; varying vec3 vNl; varying vec2 vToCam;
uniform vec4 uFac; uniform vec3 uFac2;
float h3(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
/// smooth value noise: a hash alone is constant across its cell, which
/// is what made lichen come out as flat squares
float vn3(vec3 p){
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z);
}
void main(){
  float diff = max(dot(normalize(vNrm), normalize(uSunDir)), 0.0);
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(vWp.xz, uTime)) * mix(0.03, 1.0, bakedSun(vWp, uLift));
  vec3 c = mix(vCol + uBody * uSunCol * diff * 1.15 * sh * (1.0 - 0.25 * uWet), vHaze, vFogF);
  vec3 litC = c;
  /// a roof, a cap, a set of tyres: parts marked as trim take the second
  /// colour, keeping the light already worked out for them
  if (uTwoTone > 0.5) c *= mix(vec3(1.0), uBody2 / max(uBody, vec3(0.02)), step(0.5, vRib));
  if (uThin > 0.0) c *= mix(uBody2 / max(uBody, vec3(0.02)), vec3(1.0), clamp(uThin / max(fwidth(vWp.z), 1e-4), 0.0, 1.0));
  float rr = vRib * 6.2832 * uRibN;
  float kRib = bandLimit(vRib, uRibN);
  if (uRib > 0.01) c *= 1.0 + 0.16 * uRib * cos(rr) * kRib;
  if (uSpines > 0.01) {
    float kSpine = min(kRib, bandLimit(vUp, 26.0 * uSpines));
    /// An areole sits on the crest of a rib, at steps up the plant, and the
    /// steps of one rib do not line up with those of the next. A band across
    /// a band gave a grid of squares instead, and with nothing seeded into
    /// it every plant wore the same one. Stagger the steps per rib and carry
    /// the instance seed into both coordinates.
    float crest = uRib > 0.01 ? smoothstep(0.55, 1.0, abs(cos(rr))) : smoothstep(0.7, 1.0, fract(sin(floor(vRib * 40.0) * 7.1 + vSeed) * 43758.5));
    float ribIdx = floor(vRib * uRibN + 0.5);
    float stepUp = fract(vUp * 26.0 * uSpines + vSeed * 0.62 + fract(sin(ribIdx * 12.9 + vSeed) * 4375.5));
    float areole = smoothstep(0.32, 0.5, stepUp) * smoothstep(0.68, 0.5, stepUp);
    /// past the limit the spines average into a slight overall paleness
    /// rather than vanishing or crawling
    float amt = clamp(crest * areole * 0.70 * uSpines, 0.0, 0.85);
    c = mix(c, uSpine * (0.35 + 0.65 * length(litC)), mix(0.09 * uSpines, amt, kSpine));
  }
  c = mix(c, uTipCol * (0.4 + 0.6 * length(litC)), uTipMix * smoothstep(0.72, 1.0, vUp));
  if (uNodes > 0.5) {
    float seg = fract(vUp * 7.0 + vSeed * 0.3);
    c *= 0.78 + 0.22 * smoothstep(0.02, 0.13, seg);
    c *= 1.0 + 0.10 * cos(vRib * 25.13) * bandLimit(vRib, 4.0);
  }
  if (uGrain > 3.5) {
    /// A building: its walls clad (boards, logs, render, coursed stone, brick
    /// or corrugated sheet), windows in bays with dark glass and a pale frame,
    /// a door on the side facing the window, roof courses or corrugation, and
    /// a damp, darker foot. Measured in metres in the object's frame, so the
    /// courses are the same size on a cabin and a barn. Every pattern fades
    /// to its mean once it is finer than a pixel.
    vec3 m = vMet, nl = normalize(vNl);
    float wall = (1.0 - step(0.5, vRib)) * (1.0 - smoothstep(0.35, 0.6, abs(nl.y)));
    float rnd = uFac2.z;
    float rad = length(m.xz);
    float u = abs(nl.x) > abs(nl.z) ? m.z : m.x;
    if (rnd > 0.5) u = atan(dot(m.xz, vec2(-vToCam.y, vToCam.x)), dot(m.xz, vToCam) + 1e-5) * rad;
    float v = m.y;
    float wu = fwidth(u), wv = fwidth(v);
    float kd = uFac.x, g = 1.0;
    if (kd < 0.5) {
      float bu = u / 0.22, kb = 1.0 - smoothstep(0.30, 0.85, wu / 0.22);
      g = (1.0 - 0.32 * smoothstep(0.84, 1.0, abs(fract(bu) - 0.5) * 2.0) * kb) * (1.0 + 0.12 * (h3(vec3(floor(bu), vSeed, 2.0)) - 0.5) * kb);
    } else if (kd < 1.5) {
      float bv = v / 0.27, kl = 1.0 - smoothstep(0.30, 0.85, wv / 0.27);
      g = mix(0.86, 0.60 + 0.48 * sin(fract(bv) * 3.1416), kl) * (1.0 + 0.10 * (h3(vec3(floor(bv), vSeed, 4.0)) - 0.5) * kl);
    } else if (kd < 2.5) {
      g = 0.92 + 0.16 * vn3(m * 0.8 + vSeed);
    } else if (kd < 4.5) {
      vec2 bs = kd < 3.5 ? vec2(0.55, 0.32) : vec2(0.23, 0.075);
      float row = floor(v / bs.y), bu = u / bs.x + row * 0.5;
      float kS = 1.0 - smoothstep(0.30, 0.85, max(wv / bs.y, wu / bs.x));
      float jn = max(smoothstep(0.84, 1.0, abs(fract(v / bs.y) - 0.5) * 2.0), smoothstep(0.90, 1.0, abs(fract(bu) - 0.5) * 2.0));
      g = (1.0 + (kd < 3.5 ? -0.32 : 0.22) * jn * kS) * (1.0 + 0.18 * (h3(vec3(floor(bu), row, vSeed)) - 0.5) * kS);
    } else {
      float kc = 1.0 - smoothstep(0.30, 0.85, wu / 0.076);
      g = 1.0 + 0.14 * cos(u / 0.076 * 6.2832) * kc;
    }
    c *= mix(1.0, g, wall);
    /// the roof: tile courses up the slope, or the ribs of a tin roof down it
    float roofK = step(0.5, vRib) * smoothstep(0.15, 0.4, abs(nl.y));
    float kR = 1.0 - smoothstep(0.30, 0.85, (uFac.w > 0.5 ? wu / 0.076 : wv / 0.2));
    c *= 1.0 - roofK * kR * (uFac.w > 0.5 ? 0.12 * (0.5 + 0.5 * cos(u / 0.076 * 6.2832)) : 0.26 * smoothstep(0.72, 1.0, fract(v / 0.2)));
    /// the door, on whichever wall faces the window
    vec3 toC = cameraPosition - vWp; vec2 tc = normalize(toC.xz + vec2(1e-4, 0.0));
    float facing = dot(normalize(vNrm.xz + vec2(1e-4, 0.0)), tc);
    float halfD = uFac2.x * 0.5;
    float onDoor = mix(step(0.55, facing) * step(abs(u), halfD), step(cos(min(halfD / max(rad, 0.5), 1.4)), facing), rnd);
    float door = onDoor * step(v, uFac2.y) * step(0.0, v) * step(0.01, uFac2.x) * wall;
    /// windows: a sill a metre up each storey, in some of the bays
    float cu = u / uFac.z, cv = (v - 0.9) / 2.9;
    vec2 wc = vec2(floor(cu + 0.5), floor(cv));
    vec2 wf = vec2(fract(cu + 0.5) - 0.5, fract(cv));
    float has = step(h3(vec3(wc, vSeed + floor(nl.x * 2.0 + nl.z * 3.0 + 7.0))), uFac.y) * step(0.0, cv) * (1.0 - onDoor * step(v, uFac2.y + 0.6));
    float hw = 0.46 / uFac.z, ex = wu / uFac.z, ey = wv / 2.9;
    float inner = (1.0 - smoothstep(hw - ex, hw + ex, abs(wf.x))) * smoothstep(0.10 - ey, 0.10 + ey, wf.y) * (1.0 - smoothstep(0.52 - ey, 0.52 + ey, wf.y));
    float outer = (1.0 - smoothstep(hw + 0.07 / uFac.z - ex, hw + 0.07 / uFac.z + ex, abs(wf.x))) * smoothstep(0.075 - ey, 0.075 + ey, wf.y) * (1.0 - smoothstep(0.545 - ey, 0.545 + ey, wf.y));
    float kW = 1.0 - smoothstep(0.30, 0.85, max(wu, wv) * 2.5);
    vec3 glass = mix(vec3(0.05, 0.06, 0.07) + vHaze * 0.25 * pow(1.0 - abs(dot(normalize(vNrm), normalize(toC))), 2.0), vHaze, vFogF);
    vec3 frameC = mix(length(litC) * vec3(0.55, 0.54, 0.51), vHaze, vFogF * 0.5);
    c = mix(c, frameC, (outer - inner) * has * wall * kW);
    c = mix(c, glass, inner * has * wall * kW);
    c *= 1.0 - wall * (1.0 - kW) * uFac.y * 0.14;
    c = mix(c, c * vec3(0.42, 0.38, 0.34), door * kW);
    c *= 1.0 - 0.18 * wall * (1.0 - smoothstep(0.0, 0.7, v));
  } else if (uGrain > 2.5) {
    /// foliage (a hedge): clumps of leaves at two scales with dark gaps
    /// between them, new growth paler, each faded out as it nears a pixel
    vec3 q = vLocal * vec3(7.0, 9.0, 9.0) + vSeed * 3.1;
    float w = max(fwidth(q.x), max(fwidth(q.y), fwidth(q.z)));
    float k1 = 1.0 - smoothstep(0.30, 0.85, w), k2 = 1.0 - smoothstep(0.30, 0.85, w * 2.8);
    float leaf = mix(0.5, vn3(q), k1) * 0.6 + mix(0.5, vn3(q * 2.8 + 5.3), k2) * 0.4;
    c *= 0.58 + 0.80 * leaf;
    c = mix(c, c * uBody2 / max(uBody, vec3(0.02)), smoothstep(0.62, 0.92, leaf) * 0.45 * k1);
  } else if (uGrain > 1.5) {
    /// stone: two tones mottled at two scales, a fine speckle, dark seams,
    /// and lichen on the faces that see the sky
    vec3 q = vLocal + vSeed;
    float w = max(fwidth(vLocal.x), fwidth(vLocal.z));
    float k9 = 1.0 - smoothstep(0.30, 0.85, w * 9.0);
    float k31 = 1.0 - smoothstep(0.30, 0.85, w * 31.0);
    float kSeam = 1.0 - smoothstep(0.30, 0.85, w * 20.0);
    float m1 = h3(floor(q * 3.2)), m2 = h3(floor(q * 9.0)), m3 = h3(floor(q * 31.0));
    float mottle = m1 * 0.55 + mix(0.5, m2, k9) * 0.45;
    vec3 ratio = uBody2 / max(uBody, vec3(0.02));
    c = mix(c, c * ratio, mottle);
    c *= 1.0 + 0.28 * (m3 - 0.5) * k31;
    /// a product of two sines is a woven grid, which reads as banding. Cracks
    /// are the borders between irregular cells instead: pick the two nearest
    /// of a set of jittered points and darken where they are equally close.
    vec2 cp = vLocal.xz * 13.0 + vLocal.y * 4.2;
    vec2 cell = floor(cp);
    float d1 = 8.0, d2 = 8.0;
    for (int oy = -1; oy <= 1; oy++) for (int ox = -1; ox <= 1; ox++) {
      vec2 g2 = cell + vec2(float(ox), float(oy));
      vec2 jit = vec2(h3(vec3(g2, 3.1)), h3(vec3(g2, 7.7)));
      float dd = length(g2 + jit - cp);
      if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
    }
    float crack = 1.0 - smoothstep(0.02, 0.14, d2 - d1);
    c *= 1.0 - 0.30 * crack * kSeam;
    c *= 1.0 + 0.12 * (h3(vec3(cell, 1.7)) - 0.5) * kSeam;
    /// each facet its own shade
    float upFace = smoothstep(0.35, 0.8, vNrm.y);
    /// Lichen was a hard step on a grid about three cells wide on a boulder,
    /// so it read as yellow squares painted on the stone. Grow it on smooth
    /// noise at two scales instead, and thin the fine one with distance.
    float lf = vn3(q * 3.4) * 0.66 + mix(0.5, vn3(q * 9.0), k9) * 0.34;
    if (uVarn > 0.5) {
      /// Dry rock is laid in beds, each its own shade with a darker parting
      /// between, dipping a little; and its weathered skin is desert varnish,
      /// a dark brown-black film in streaks and patches, missing from the
      /// sand-blasted foot and from fresh breaks. Faded by footprint.
      float bv = (vMet.y + 0.12 * sin(vMet.x * 1.3 + vSeed) + 0.06 * sin(vMet.z * 2.1)) / 0.24;
      float kBd = 1.0 - smoothstep(0.30, 0.85, fwidth(bv));
      c *= 1.0 + (0.16 * (h3(vec3(floor(bv), vSeed, 5.0)) - 0.5) - 0.22 * smoothstep(0.80, 1.0, abs(fract(bv) - 0.5) * 2.0)) * kBd;
      float vm = smoothstep(0.42, 0.66, lf + 0.25 * vn3(vec3(vLocal.xz * 1.5, vLocal.y * 9.0) + vSeed)) * smoothstep(0.08, 0.45, vMet.y);
      c = mix(c, vec3(0.11, 0.075, 0.055) * (0.5 + 0.9 * length(litC) / max(length(uBody), 0.05)), vm * 0.55);
    } else {
    float lich = smoothstep(0.54, 0.78, lf);
    c = mix(c, uLichen * (0.4 + 0.6 * length(litC) / max(length(uBody), 0.05)), lich * upFace * 0.70);
    }
  } else if (uGrain > 0.5) {
    /// Bark is not a comb. This was a triangle wave at one fixed pitch with
    /// a slow wobble laid over it, every ridge the same width and the same
    /// depth as its neighbour, and only four bands of variation over the
    /// whole height. A trunk therefore came out as a fluted column of even
    /// stripes. Let the ridges wander, let each carry its own depth along
    /// its length, and break the trunk across them.
    float wander = (vn3(vec3(vRib * 4.0, vUp * 9.0, vSeed)) - 0.5) * 1.6;
    float u = vRib * uBarkN + wander + vSeed * 2.6;
    float kB = bandLimit(u, 1.0);
    float ridge = abs(fract(u) - 0.5) * 2.0;
    float deep = vn3(vec3(floor(u) * 1.7, vUp * 4.0, 11.0));
    c *= 1.0 - (0.16 + 0.34 * deep) * smoothstep(0.34, 1.0, ridge) * kB;
    float plate = h3(vec3(floor(u), floor(vUp * uBarkPlate * 4.0 + vSeed), 1.0));
    c *= 1.0 + 0.22 * (plate - 0.5) * min(kB, bandLimit(vUp, uBarkPlate * 4.0));
    float gn = h3(vec3(floor(u * 3.0), floor(vUp * 70.0), 3.0));
    c *= 1.0 + 0.14 * (gn - 0.5) * bandLimit(vUp, 70.0);
  }
  gl_FragColor = vec4(c, 1.0);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
