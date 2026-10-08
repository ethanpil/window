#include "tone.glsl"
uniform vec3 uAmbCol, uSunCol;
uniform float uTime;
varying vec2 vUv; varying float vFog; varying float vLen, vSeed, vW; varying vec3 vHaze;
#include "common.glsl"
void main(){
  /// Streaks running down the drop, stretched along it and quickening as
  /// they go; a puffy cloud texture read up it had made a dotted line.
  /// The fine streaks fade to their mean once narrower than a pixel.
  float d = 1.0 - vUv.y;
  float along = pow(max(d, 0.0), 0.7) * vLen * 0.09;
  /// pow of a negative is undefined
  float x = vUv.x * vW * 0.9 + vSeed * 7.0;
  float s1 = vn(vec2(x, along - uTime * 2.2));
  float s2 = vn(vec2(x * 2.3 + 3.1, along * 1.9 - uTime * 4.1));
  float k2 = 1.0 - smoothstep(0.30, 0.85, fwidth(x) * 2.3);
  float n = s1 * 0.62 + mix(0.5, s2, k2) * 0.38;
  /// the edges wander as the water does
  float ew = vn(vec2(along * 0.25, vSeed)) * 0.18;
  float edge = smoothstep(0.0, 0.16 + ew, vUv.x) * smoothstep(1.0, 0.84 - ew, vUv.x);
  float a = edge * mix(0.75, 0.45, d) * smoothstep(0.25, 0.70, n);
  a += edge * (1.0 - smoothstep(0.0, 0.08, d)) * 0.35;
  /// spray at the foot: a soft cloud, not a hard end
  float foot = smoothstep(0.80, 1.0, d) * (1.0 - smoothstep(0.30, 0.50, abs(vUv.x - 0.5)) * 0.8);
  a = max(a, foot * 0.45 * (0.6 + 0.4 * s1));
  vec3 col = mix(vec3(0.86, 0.92, 0.95), uSunCol * 0.6 + uAmbCol * 0.8, 0.35);
  gl_FragColor = vec4(mix(col, vHaze, vFog), a * (1.0 - vFog * 0.85));
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
