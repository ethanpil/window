attribute vec3 iPos; attribute vec4 iAttr;
uniform float uTime, uWind, uGust, uFogDensity;
uniform vec2 uWindDir; uniform vec3 uCamPos, uFogCol, uSunDir;
varying vec2 vUv; varying float vFog; varying float vFade; varying float vScroll; varying vec3 vAir;
#include "common.glsl"
void main(){
  float speed = (0.5 + 0.9 * uGust) * uWind * iAttr.w;
  /// A sheet keeps the height of the ground it set out from, so it may
  /// only travel a short way before rising or falling ground shows it up:
  /// it runs ninety metres, its foot a third of its height below the
  /// ground, and fades in its lower edge, so it neither slices through a
  /// dune nor hangs a hard edge in the air.
  float span = 90.0;
  float run = mod(uTime * speed + iAttr.z, span) - span * 0.5;
  vec3 wp = iPos + vec3(uWindDir.x, 0.0, uWindDir.y) * run;
  wp.y += iAttr.y * 0.18 + sin(uTime * 0.21 + iAttr.z) * 0.12;
  vec3 toCam = normalize(vec3(uCamPos.x - wp.x, 0.0, uCamPos.z - wp.z));
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 pp = wp + right * position.x * iAttr.x + vec3(0.0, position.y * iAttr.y, 0.0);
  vUv = uv;
  vScroll = uTime * 0.012 + iAttr.z * 0.01;
  vFade = 1.0 - smoothstep(span * 0.28, span * 0.49, abs(run));
  vec4 mv = modelViewMatrix * vec4(pp, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, pp.y);
  /// the air it hangs in is the horizon's colour that way
  vAir = horizonAt(normalize(pp - cameraPosition), uFogCol, uSunDir);
  gl_Position = projectionMatrix * mv;
}
