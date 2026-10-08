#include "tone.glsl"
uniform sampler2D uMap; uniform vec3 uFogCol, uAmbCol, uSunCol;
varying vec2 vUv; varying float vFade;
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.05 || vFade <= 0.001) discard;
  vec3 c = t.rgb * (uAmbCol * 0.9 + uSunCol * 0.55);
  gl_FragColor = vec4(mix(c, uFogCol, 0.25), t.a * vFade);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
