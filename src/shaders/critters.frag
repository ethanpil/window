#include "tone.glsl"
uniform sampler2D uMap; uniform float uNight, uNoct; varying vec2 vUv; varying vec3 vTint;
void main(){ vec4 t = texture2D(uMap, vUv);
  t.a *= mix(1.0 - smoothstep(0.0, 0.4, uNight), smoothstep(0.2, 0.7, uNight), uNoct);
  if (t.a < 0.02) discard;
  gl_FragColor = vec4(tone(t.rgb * vTint), t.a); }
