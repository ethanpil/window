#include "tone.glsl"
uniform sampler2D uMap; uniform vec3 uFogCol, uSunDir, uSunCol; uniform vec4 uCrown;
varying vec2 vUv; varying float vFog; varying vec3 vHaze;
varying vec2 vQ; varying float vFlip, vSh, vFade; varying vec3 vJit, vRight, vToCam, vAmb;
#include "common.glsl"
#include "sprite.frag.glsl"
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.25) discard;
  vec3 light = spriteLight(vQ, uCrown, vFlip, vRight, vToCam, t.a, vAmb, vSh);
  gl_FragColor = vec4(mix(t.rgb * vJit * light, vHaze, vFog), smoothstep(0.3, 0.7, t.a) * vFade);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
