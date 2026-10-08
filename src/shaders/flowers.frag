#include "tone.glsl"
uniform sampler2D uMap;
varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze;
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.02) discard;
  gl_FragColor = vec4(mix(t.rgb * vTint, vHaze, vFog), t.a);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
