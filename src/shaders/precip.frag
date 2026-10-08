#include "tone.glsl"
varying float vA;
uniform vec3 uAmbCol, uSunCol;
void main(){
  vec3 lit = vec3(0.80, 0.85, 0.92) * clamp(uAmbCol * 1.6 + uSunCol * 0.5, 0.10, 1.0);
  gl_FragColor = vec4(lit, vA);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
