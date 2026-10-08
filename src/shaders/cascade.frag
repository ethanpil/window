#include "tone.glsl"
uniform float uTime, uLen; varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze; varying float vDrop;
#include "common.glsl"
/// Value noise (vn). Read with the fall stretched against the width, it
/// draws threads rather than blobs. The old pattern cut the sheet into
/// thirty columns and gave each one a single brightness across its whole
/// width, so it could only ever read as a row of vertical bars.
void main(){
  float d = vUv.y;
  /// 0 at the head, 1 in the pool
  /// The water gathers speed as it drops. That has to come from the shape
  /// of the fall coordinate, never from scaling uTime by depth: with
  /// y - uTime * (0.8 + 1.1 * d) the phase of the pattern is
  /// d * (k - 1.87 * uTime), whose sign turns over at uTime = k / 1.87.
  /// For a fall of eighty metres that is three seconds after the view
  /// opens, and from then on the water ran upward for ever. Raising d to
  /// a power under one makes the threads quicken as they descend and
  /// cannot change their direction.
  float x = vUv.x * 6.0 + sin(d * 5.0 + uTime * 0.3) * 0.4;
  float y = pow(max(d, 0.0), 0.62) * uLen * 0.075;
  float n1 = vn(vec2(x, y - uTime * 1.9));
  float n2 = vn(vec2(x * 2.1 + 4.3, y * 2.3 - uTime * 4.6));
  float n3 = vn(vec2(x * 4.4 + 9.7, y * 4.8 - uTime * 9.8));
  /// a thread finer than a pixel would only crawl, so let it average out
  float px = fwidth(x);
  float k2 = 1.0 - smoothstep(0.25, 0.80, px * 2.1);
  float k3 = 1.0 - smoothstep(0.25, 0.80, px * 4.4);
  float w = n1 * 0.50 + mix(0.5, n2, k2) * 0.32 + mix(0.5, n3, k3) * 0.18;
  /// three noises summed bunch about a half, which is a flat wash. Open the
  /// middle of the range back out so the threads read.
  w = clamp((w - 0.30) * 2.6, 0.0, 1.0);
  /// whole over the lip, fraying into threads the further it falls
  float veil = smoothstep(mix(0.10, 0.40, d), mix(0.42, 0.80, d), w);
  /// the sheet feathers to nothing at either edge, and the edges wander:
  /// a fall is never ruled straight
  float ew = vn(vec2(y * 0.35, 3.1)), ew2 = vn(vec2(y * 0.35, 8.7));
  float body = smoothstep(0.0, 0.08 + 0.16 * ew, vUv.x) * smoothstep(1.0, 0.92 - 0.16 * ew2, vUv.x);
  /// white water where it lands, and a little breaking over the lip. This
  /// was the other way about, so the froth gathered at the head.
  float froth = max(smoothstep(0.76, 1.0, d), smoothstep(0.05, 0.0, d) * 0.6);
  /// Over a pitch it is a white veil of threads. Over a bench it slides
  /// on the rock: dark and glassy, broken only by streaks of white where
  /// it riffles. Painted white all the way down, it read as paper steps.
  float riff = smoothstep(0.55, 0.9, w);
  vec3 cDrop = mix(vec3(0.60, 0.70, 0.78), vec3(1.0), clamp(w * 0.85 + froth * 0.9, 0.0, 1.0));
  vec3 cBench = mix(vec3(0.16, 0.22, 0.25), vec3(0.92, 0.95, 0.96), clamp(riff * 0.75 + froth * 0.8, 0.0, 1.0));
  vec3 c = mix(cBench, cDrop, vDrop);
  float a = body * mix(mix(0.50 + 0.40 * riff, 0.30 + 0.70 * veil, vDrop), 1.0, froth * 0.9);
  gl_FragColor = vec4(tone(mix(c * vTint * 0.55, vHaze, vFog * 0.7)), a * (1.0 - vFog * 0.6));
}
