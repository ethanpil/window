#include "tone.glsl"
uniform vec3 uFogCol, uFogAway, uSunCol, uSunDir, uZenith, uHue; uniform float uDepth, uHazeK, uHeight, uSnowCap;
varying vec3 vW; varying float vTop; varying float vSlope;
float rh(float p){ return fract(sin(p * 127.1) * 43758.5453); }
float rn(float p){ float i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(rh(i), rh(i + 1.0), f); }
#include "horizon.glsl"
void main(){
  /// the horizon behind them, warm toward the sun and cool away (horizonAt)
  vec3 vd = normalize(vW - cameraPosition);
  vec3 hor = horizonMix(vd, uFogAway, uFogCol, uSunDir);
  float hN = vTop / uHeight;
  /// 0 near the foot, ~1 at the summits
  /// A face of its own: the profile's slope turns it toward or away from
  /// the sun, and gullies run down it. The gullies fade once they are
  /// finer than a pixel.
  float gq = vW.x * 0.018;
  float kG = 1.0 - smoothstep(0.30, 0.85, fwidth(gq));
  float gully = (rn(gq) - 0.5) * 1.6 * kG;
  vec3 n = normalize(vec3(-(vSlope * 2.5 + gully), 0.55, 1.0));
  vec3 sd = normalize(uSunDir);
  float sunK = clamp(dot(uSunCol, vec3(0.30, 0.59, 0.11)) * 1.4, 0.0, 1.0);
  float shade = mix(1.0, 0.80 + 0.45 * max(dot(n, sd), 0.0), sunK);
  /// the land under the air: darker and a little bluer than the horizon,
  /// white above the snow line
  vec3 land = hor * vec3(0.62, 0.68, 0.78) * uHue;
  float snow = smoothstep(uSnowCap, uSnowCap + 0.12, hN + gully * 0.08);
  land = mix(land, hor * vec3(1.10, 1.12, 1.16), snow);
  land *= shade;
  /// the valleys hold the haze; summits stand clearer
  float haze = uDepth * mix(1.0, 0.82, smoothstep(-0.6, 1.0, hN));
  vec3 c = mix(land, hor, haze);
  float f = pow(max(dot(vd, sd), 0.0), 3.0) * uHazeK;
  c += uSunCol * f * 0.06;
  gl_FragColor = vec4(tone(c), 1.0);
}
