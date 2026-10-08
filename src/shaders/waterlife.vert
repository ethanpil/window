attribute vec3 iPos; attribute vec4 iAttr;
uniform float uTime, uFogDensity, uSwim;
uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;
varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze;
#include "common.glsl"
void main(){
  float size = iAttr.x, ph = iAttr.y, rate = iAttr.z, face = iAttr.w;
  float t = uTime * rate * 0.10 + ph;
  vec3 wp = iPos;
  /// ducks paddle in slow arcs and bob; a heron barely moves at all
  wp.x += (sin(t) * 2.6 + sin(t * 0.43 + ph) * 1.5) * uSwim;
  wp.z += (cos(t * 0.77 + ph) * 2.2 + cos(t * 0.31) * 1.2) * uSwim;
  wp.y += sin(uTime * 0.5 + ph) * 0.012 * uSwim;
  vec3 toCam = normalize(vec3(uCamPos.x - wp.x, 0.0, uCamPos.z - wp.z));
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam)) * face;
  vec3 lp = right * position.x * size * 1.1 + vec3(0.0, position.y * size, 0.0);
  vec3 p = wp + lp;
  vTint = uAmbCol * 1.1 + uSunCol * 0.85 * max(uSunDir.y, 0.0);
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFog = fogAmt(-mv.z, uFogDensity);
  vHaze = hazeAt(uFogCol, normalize(p - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
