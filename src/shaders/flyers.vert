attribute vec3 iPos; attribute vec4 iAttr; attribute vec4 iPath;
uniform float uTime, uFogDensity, uFlap, uWob, uGlow, uWind;
uniform vec2 uWindDir; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;
varying vec2 vUv; varying float vFog; varying vec3 vTint; varying float vA; varying vec3 vHaze;
#include "common.glsl"
void main(){
  float t = uTime * iAttr.z + iAttr.y;
  /// a wandering path: two slow circles of different periods, so it never repeats visibly
  vec3 wp = iPos;
  wp.x += sin(t) * iPath.x + sin(t * 0.41 + iPath.y) * iPath.x * 0.7;
  wp.z += cos(t * 0.83 + iPath.w) * iPath.x + cos(t * 0.37) * iPath.x * 0.6;
  wp.y += sin(t * 1.7 + iPath.y) * iPath.z * 0.22 * uWob + sin(t * 0.6) * iPath.z * 0.30;
  wp.xz += uWindDir * uWind * 0.12;
  wp.z = min(wp.z, -1.6);
  /// never drift indoors
  float size = iAttr.x * iAttr.w;
  /// wingbeat: the body squashes as the wings go through the stroke
  float flap = uFlap > 0.5 ? 0.55 + 0.45 * abs(sin(uTime * uFlap + iAttr.y)) : 1.0;
  vec3 toCam = normalize(uCamPos - wp);
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 up = normalize(cross(toCam, right));
  /// lean into the turn
  float lean = cos(t) * 0.5;
  float lc = cos(lean), ls = sin(lean);
  vec2 q = vec2(position.x * lc - position.y * ls, position.x * ls + position.y * lc);
  vec3 p = wp + right * q.x * size * flap + up * q.y * size;
  vA = 1.0;
  if (uGlow > 0.5) {
    /// fireflies pulse, and go dark between pulses
    float ph = fract(uTime * 0.28 + iAttr.y * 0.16);
    vA = pow(max(sin(ph * 3.14159), 0.0), 6.0);
  }
  vTint = uGlow > 0.5 ? vec3(1.0) : (uAmbCol * 1.15 + uSunCol * 0.9 * max(uSunDir.y, 0.0));
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, p.y);
  vHaze = hazeAt(uFogCol, normalize(p - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
