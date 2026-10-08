#include "tone.glsl"
uniform sampler2D uMap; uniform vec3 uAmbCol, uSunCol;
varying vec2 vUv; varying float vFog; varying float vFade; varying float vScroll; varying vec3 vAir;
void main(){
  float n = texture2D(uMap, vec2(vUv.x * 0.5 + vScroll, vUv.y * 0.5)).r;
  n = n * 0.65 + texture2D(uMap, vec2(vUv.x * 1.3 - vScroll * 1.7, vUv.y * 0.9 + 0.4)).r * 0.35;
  float body = smoothstep(0.30, 0.72, n);
  float soft = smoothstep(0.0, 0.35, vUv.x) * smoothstep(1.0, 0.65, vUv.x)
             * (1.0 - smoothstep(0.15, 1.0, vUv.y)) * smoothstep(0.12, 0.42, vUv.y);
  float a = body * soft * vFade * 0.30 * (1.0 - vFog * 0.6);
  vec3 col = mix(vAir, uAmbCol * 0.6 + uSunCol * 0.7, 0.45);
  gl_FragColor = vec4(col, a);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
