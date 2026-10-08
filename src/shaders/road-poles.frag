#include "tone.glsl"
varying float vA; varying float vFog; varying vec3 vHaze;
void main(){
  gl_FragColor = vec4(tone(mix(vec3(0.04, 0.04, 0.045), vHaze, vFog)), vA * 0.9);
}
