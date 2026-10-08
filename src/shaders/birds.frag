#include "tone.glsl"
uniform sampler2D uMap;
varying vec2 vUv; varying float vFog; varying vec3 vHaze;
void main(){
  vec4 t = texture2D(uMap, vUv);
  gl_FragColor = vec4(mix(t.rgb, vHaze, vFog), t.a * (1.0 - vFog) * 0.85);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
