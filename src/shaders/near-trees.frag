#include "tone.glsl"
uniform sampler2D uMap; uniform vec3 uSunDir, uSunCol, uCamPos;
varying vec2 vUv; varying float vFog; varying vec3 vHaze;
varying vec3 vWp; varying vec4 vCrown; varying float vRy, vSh; varying vec3 vAmb;
#include "common.glsl"
void main(){
  vec4 t = texture2D(uMap, vUv);
  if (t.a < 0.25) discard;
  /// where this pixel sits in its crown, as a fraction of the crown
  vec3 e = (vWp - vCrown.xyz) / vec3(vCrown.w, vRy, vCrown.w);
  float r = length(e);
  vec3 N = e / max(r, 1e-3);
  vec3 L = normalize(uSunDir), V = normalize(uCamPos - vWp);
  float wrap = max((dot(N, L) + 0.5) / 1.5, 0.0);
  /// deep inside, the leaves see neither sun nor sky; at the rim, light
  /// comes through them from behind
  float inner = smoothstep(0.1, 0.9, r);
  float under = mix(0.68, 1.0, smoothstep(-0.9, 0.3, N.y));
  float trans = pow(max(dot(-V, L), 0.0), 2.0) * smoothstep(0.55, 1.05, r) * 0.7;
  vec3 light = hemi(N, vAmb * 1.1) * mix(0.62, 1.0, inner) * under + uSunCol * (wrap * 1.1 * mix(0.5, 1.0, inner) * under + trans) * vSh;
  gl_FragColor = vec4(mix(t.rgb * light, vHaze, vFog), smoothstep(0.3, 0.7, t.a));
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
