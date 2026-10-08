#include "tone.glsl"
uniform sampler2D uMap; uniform float uGlow;
varying vec2 vUv; varying float vFog; varying vec3 vTint; varying float vA; varying vec3 vHaze;
void main(){
  vec4 t = texture2D(uMap, vUv);
  float a = t.a * vA * (1.0 - vFog);
  if (a < 0.02) discard;
  vec3 col = uGlow > 0.5 ? t.rgb * vTint : mix(t.rgb * vTint, vHaze, vFog);
  gl_FragColor = vec4(tone(col), a);
}
