#include "tone.glsl"
varying float vA; varying vec2 vUv; varying vec3 vTint;
void main(){
  float d = length(vUv - 0.5);
  float a = vA * (1.0 - smoothstep(0.14, 0.5, d));
  if (a < 0.004) discard;
  gl_FragColor = vec4(tone(vTint * 0.92), a);
}
