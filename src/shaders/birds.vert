attribute vec4 iAttr;
uniform float uTime, uFogDensity, uDrift; uniform vec3 uCamPos, uFogCol, uSunDir, uSunCol;
varying vec2 vUv; varying float vFog; varying vec3 vHaze;
#include "common.glsl"
void main(){
  vec3 wp; float flap;
  if (iAttr.w < 0.0) {
    float ang = uTime * 0.045 * abs(iAttr.w) + iAttr.x;
    float orbit = 34.0 + 46.0 * fract(iAttr.x * 0.37);
    wp = vec3(sin(ang) * orbit, iAttr.y + sin(ang * 0.7) * 5.0,
              -95.0 - 60.0 * fract(iAttr.x * 0.61) + cos(ang) * orbit);
    flap = 0.86 + 0.14 * sin(uTime * 1.6 + iAttr.x);
  } else {
    float t = uTime * 0.05 * iAttr.w + iAttr.x;
    float loop = 300.0;
    float px = mod(t * 250.0, loop) - loop * 0.5;
    float pz = -120.0 - 70.0 * sin(iAttr.x) - 30.0 * sin(t * 0.7);
    wp = vec3(px * (uDrift > 0.0 ? 1.0 : -1.0), iAttr.y + sin(t * 1.7) * 4.0, pz);
    flap = 0.55 + 0.45 * sin(uTime * 7.0 + iAttr.x * 5.0);
  }
  vec3 toCam = normalize(uCamPos - wp);
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 up = normalize(cross(toCam, right));
  vec3 p = wp + right * position.x * iAttr.z + up * position.y * iAttr.z * flap;
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, p.y);
  vHaze = hazeAt(uFogCol, normalize(p - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
