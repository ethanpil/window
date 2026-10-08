attribute vec3 iPos; attribute vec4 iAttr;
uniform float uTime, uWind, uFogDensity;
uniform vec2 uWindDir; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;
varying vec2 vUv; varying float vA;
#include "common.glsl"
void main(){
  float t = uTime * iAttr.z + iAttr.y;
  vec3 wp = iPos;
  wp.x += sin(t * 0.7) * 0.5 + sin(t * 0.23 + iAttr.y) * 0.9;
  wp.y += sin(t * 0.41 + iAttr.y * 1.7) * 0.35;
  wp.z += cos(t * 0.53) * 0.6;
  wp.xz += uWindDir * uWind * 0.3;
  wp.z = min(wp.z, -3.0);
  vec3 toCam = normalize(uCamPos - wp);
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 up = normalize(cross(toCam, right));
  float size = iAttr.x;
  vec3 p = wp + right * position.x * size + up * position.y * size;
  /// a speck only shows when it catches the light nearly edge-on to the sun
  float glint = pow(max(dot(toCam, normalize(uSunDir)), 0.0), 3.0);
  vA = iAttr.w * (0.10 + 0.90 * glint) * (0.35 + 0.65 * length(uSunCol));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA *= 1.0 - fogAmt(-mv.z, uFogDensity);
  vUv = uv;
  gl_Position = projectionMatrix * mv;
}
