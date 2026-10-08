attribute vec3 iPos; attribute vec3 iAttr;
uniform float uTime, uWind, uGust, uFogDensity, uIntensity;
uniform vec2 uWindDir; uniform vec3 uCamPos;
varying float vA;
#include "common.glsl"
void main(){
  float speed = 15.0 + iAttr.z * 12.0 + uGust * 6.0;
  float range = 34.0;
  float y = mod(iPos.y - uTime * speed, range);
  float slant = uWind * (0.35 + 0.5 * uGust) * 0.5;
  vec3 wp = vec3(iPos.x + uWindDir.x * (range - y) * slant * 0.35, y, iPos.z + uWindDir.y * (range - y) * slant * 0.35);
  /// an on-shore wind must not blow a drop through the glass: wrap the
  /// drift back into the outdoor band, as the flakes do
  wp.z = mod(wp.z + 58.0, 56.5) - 58.0;
  vec3 dir = normalize(vec3(uWindDir.x * slant, -1.0, uWindDir.y * slant));
  vec3 toCam = normalize(uCamPos - wp);
  vec3 right = normalize(cross(dir, toCam));
  float dr = length(wp - cameraPosition);
  float grow = 1.0 + smoothstep(6.0, 40.0, dr) * 3.2;
  vec3 p = wp + right * position.x * iAttr.y * grow + dir * position.y * iAttr.x * 2.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  vA = (1.0 - fogAmt(d, uFogDensity)) * uIntensity * (0.30 + 0.5 * smoothstep(2.0, 16.0, d)) * 0.75
     / grow * (1.0 - smoothstep(30.0, 46.0, dr));
  gl_Position = projectionMatrix * mv;
}
