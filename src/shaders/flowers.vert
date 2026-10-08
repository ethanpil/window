attribute vec3 iPos; attribute vec3 iAttr; attribute vec2 iVar;
uniform float uTime, uWind, uGust, uFogDensity, uShadow, uSnow;
uniform vec2 uWindDir; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;
varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze;
#include "common.glsl"
void main(){
  float dF = length(iPos - cameraPosition);
  float gone = smoothstep(20.0, 34.0, dF);
  float size = iAttr.x * (1.0 - uSnow * 0.55) * (1.0 - gone);
  if (uSnow > 0.30) size = 0.0;
  vec3 toCam = normalize(vec3(uCamPos.x - iPos.x, 0.0, uCamPos.z - iPos.z));
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  float lc = cos(iVar.y), ls = sin(iVar.y);
  vec2 q = vec2(position.x * lc - position.y * ls, position.x * ls + position.y * lc);
  vec3 lp = right * q.x * size * 0.8 + vec3(0.0, q.y * size * 3.0, 0.0);
  float wave = gustWave(iPos.xz, uWindDir, uTime, 0.22, 1.55, iAttr.y * 0.6);
  float flut = sin(uTime * 2.3 + iAttr.y) * 0.24 + sin(uTime * 1.1 + iAttr.y * 1.6) * 0.12;
  float drive = uWind * (0.46 + 0.95 * uGust) * iAttr.z;
  float bf = drive * max(0.55 + 0.4 * wave + flut, 0.0) * 0.45;
  bf = bf / (1.0 + bf);
  float bend = bf * size * 1.1 * position.y * position.y * (1.0 - gone);
  vec3 wp = iPos + lp;
  wp.xz += uWindDir * bend;
  float vi = mod(iVar.x, 4.0); float flip = step(3.5, iVar.x);
  float ux = mix(uv.x, 1.0 - uv.x, flip);
  vUv = vec2((vi + ux) * 0.25, uv.y);
  vec2 bk = bakedRG(wp.xz);
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);
  vTint = uAmbCol * 0.85 * bk.y + uSunCol * 0.75 * sh;
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);
  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
