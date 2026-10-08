attribute vec3 iPos; attribute vec4 iAttr; attribute vec2 iGrad;
uniform float uTime, uFogDensity, uShadow, uGraze, uSpeed, uFoot;
uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;
varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze;
#include "common.glsl"
#include "wander.glsl"
void main(){
  float size = iAttr.x, ph = iAttr.y, rate = iAttr.z;
  float t = uTime * uSpeed * rate + ph;
  vec3 wp = wander(iPos, iGrad, t, ph);
  /// head down to graze for long stretches, up now and then to look around
  float look = step(0.82, fract(t * 0.6 + ph * 0.13));
  float head = mix(uGraze, 0.0, look);
  vec3 toCam = normalize(vec3(uCamPos.x - wp.x, 0.0, uCamPos.z - wp.z));
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec2 vel = wanderVel(t, ph);
  right *= dot(vec3(vel.x, 0.0, vel.y), right) >= 0.0 ? 1.0 : -1.0;
  /// grazing tips the whole body forward a little, about the hooves, which
  /// stand on the ground rather than the bottom edge of the card
  float lean = head * 0.22;
  float lc = cos(lean), ls = sin(lean);
  vec2 pp = vec2(position.x, position.y - uFoot);
  vec2 q = vec2(pp.x * lc - pp.y * ls, pp.x * ls + pp.y * lc);
  vec3 lp = right * q.x * size * 1.15 + vec3(0.0, q.y * size, 0.0);
  vec3 p = wp + lp;
  vec2 bk = bakedRG(wp.xz);
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);
  vTint = bk.y * hemi(vec3(0.0, mix(-0.4, 0.8, position.y), 0.0), uAmbCol * 1.05) + uSunCol * 0.8 * sh;
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, p.y);
  vHaze = hazeAt(uFogCol, normalize(p - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
