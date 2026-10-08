#include "tone.glsl"
uniform sampler2D uMap; uniform vec3 uColour, uAmbCol, uSunCol;
uniform float uSpin;
varying vec2 vUv; varying float vA;
void main(){
  float a = texture2D(uMap, vUv).a;
  if (uSpin > 0.5) a = smoothstep(0.25, 0.6, a);
  vec3 c = uColour * clamp(uAmbCol * 1.5 + uSunCol * 0.6, 0.12, 1.0);
  gl_FragColor = vec4(c, a * vA * 0.9);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
