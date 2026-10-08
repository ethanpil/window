attribute vec3 iPos; attribute vec2 iAttr;
uniform float uTime, uWind, uGust, uFogDensity, uShadow, uSnow, uSway, uAspect;
uniform vec2 uWindDir; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;
varying vec2 vUv; varying float vFog; varying vec3 vHaze;
varying vec2 vQ; varying float vFlip, vSh; varying vec3 vJit, vRight, vToCam, vAmb;
#include "common.glsl"
#include "sprite.vert.glsl"
void main(){
  float size = iAttr.x;
  vec3 toCam = normalize(vec3(uCamPos.x - iPos.x, 0.0, uCamPos.z - iPos.z));
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 lp = right * position.x * size * uAspect + vec3(0.0, position.y * size, 0.0);
  float sway = sin(uTime * 0.8 + iAttr.y) * 0.5 + sin(uTime * 0.33 + iAttr.y * 1.6) * 0.5;
  lp.xz += uWindDir * sway * uWind * (0.3 + 0.7 * uGust) * size * uSway * position.y * position.y;
  vec3 wp = iPos + lp;
  vec2 bk = bakedRG(wp.xz);
  vSh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);
  vAmb = uAmbCol * 0.95 * mix(1.0, bk.y, 0.5);
  vQ = uv; vRight = right; vToCam = toCam;
  vUv = spriteUv(uv, iAttr.y, vFlip, vJit);
  vJit *= 1.0 - uSnow * 0.25;
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);
  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
