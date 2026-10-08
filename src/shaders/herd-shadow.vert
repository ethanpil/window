attribute vec3 iPos; attribute vec4 iAttr; attribute vec2 iGrad;
uniform float uTime, uSpeed, uFogDensity, uShadow;
uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol;
varying vec2 vUv; varying float vA;
#include "common.glsl"
#include "wander.glsl"
void main(){
  float size = iAttr.x, ph = iAttr.y, rate = iAttr.z;
  float t = uTime * uSpeed * rate + ph;
  vec3 wp = wander(iPos, iGrad, t, ph);
  vec3 toCam = normalize(vec3(uCamPos.x - wp.x, 0.0, uCamPos.z - wp.z));
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  /// long along the body, which always lies across the view, and pushed a
  /// little away from a low sun
  vec3 sd = normalize(uSunDir);
  vec2 push = -sd.xz / max(sd.y, 0.35) * size * 0.18;
  vec3 lp = right * position.x * size * 0.80 + toCam * position.z * size * 0.34;
  vec3 p = wp + lp + vec3(push.x, 0.03, push.y);
  p.y += dot(iGrad, lp.xz + push);
  /// lying on the slope
  /// Stronger in sunshine, still there as a darker patch under cloud: as
  /// dark as the sun's share of the light on level ground there, which is
  /// what the baked shadows round it show.
  float sunL = dot(uSunCol, vec3(0.30, 0.59, 0.11)) * max(sd.y, 0.0) * mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime));
  float share = sunL / (sunL + dot(uAmbCol, vec3(0.30, 0.59, 0.11)) + 1e-3);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA = mix(0.20, 0.45, smoothstep(0.05, 0.55, share)) * (1.0 - fogAmtH(-mv.z, uFogDensity, p.y));
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}
