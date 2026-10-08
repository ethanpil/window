attribute vec3 aB; attribute vec3 aP;
uniform float uFogDensity; uniform vec3 uFogCol, uSunDir, uSunCol;
varying float vA; varying float vFog; varying vec3 vHaze;
#include "common.glsl"
void main(){
  float t = aP.x;
  vec3 p = mix(position, aB, t); p.y -= aP.z * 4.0 * t * (1.0 - t);
  vec3 tg = normalize(aB - position + vec3(0.0, -aP.z * 4.0 * (1.0 - 2.0 * t), 0.0));
  vec3 toC = cameraPosition - p; float d = length(toC);
  vec3 sd = normalize(cross(tg, toC / d));
  float w = max(0.018, d * 0.0016);
  vA = clamp(0.018 / w, 0.07, 1.0);
  p += sd * aP.y * w * 0.5;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, p.y);
  vHaze = hazeAt(uFogCol, normalize(p - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
