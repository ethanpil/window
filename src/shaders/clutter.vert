attribute vec3 iPos; attribute vec2 iAttr;
uniform float uTime, uFogDensity, uShadow, uSnow;
uniform vec3 uSunDir, uSunCol, uAmbCol, uSnowCol, uCamPos, uFogCol;
varying vec2 vUv; varying float vFog; varying vec3 vTint; varying float vNear; varying vec3 vHaze;
#include "common.glsl"
void main(){
  float sc = iAttr.x, rot = iAttr.y;
  float c = cos(rot), s = sin(rot);
  float dN = length(iPos - cameraPosition);
  float keep = (1.0 - smoothstep(11.0, 18.0, dN)) * (1.0 - smoothstep(0.15, 0.45, uSnow));
  vec3 lp = vec3(position.x * c - position.z * s, 0.0, position.x * s + position.z * c) * sc * keep;
  vec3 wp = iPos + lp;
  vec2 bk = bakedRG(wp.xz);
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);
  float diff = max(uSunDir.y, 0.0);
  vec3 L = uAmbCol * 1.1 * bk.y + uSunCol * diff * 1.15 * sh;
  vTint = mix(L, uSnowCol * L * 0.82, uSnow * 0.8);
  vUv = uv;
  vNear = 1.0;
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);
  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
