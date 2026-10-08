attribute vec3 iPos; attribute vec3 iAttr; attribute vec4 iCrown; attribute float iRy;
uniform float uTime, uWind, uGust, uFogDensity, uShadow, uSnow;
uniform vec2 uWindDir; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;
varying vec2 vUv; varying float vFog; varying vec3 vHaze;
varying vec3 vWp; varying vec4 vCrown; varying float vRy, vSh; varying vec3 vAmb;
#include "common.glsl"
void main(){
  float size = iAttr.x, spin = iAttr.y, ph = iAttr.z;
  vec3 toCam = normalize(uCamPos - iPos);
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 up = normalize(cross(toCam, right));
  float c = cos(spin), s = sin(spin);
  vec2 q = vec2(position.x * c - (position.y - 0.5) * s, position.x * s + (position.y - 0.5) * c);
  vec3 lp = right * q.x * size + up * q.y * size;
  /// a slow common sway from the gust wave, a quicker rustle per spray
  float gustW = gustWave(iPos.xz, uWindDir, uTime, 0.22, 1.55, 0.0);
  float sway = gustW * 0.55 + sin(uTime * 1.9 + ph) * 0.30 + sin(uTime * 0.8 + ph * 1.4) * 0.15;
  lp.xz += uWindDir * sway * uWind * (0.3 + 0.7 * uGust) * size * 0.12;
  vec3 wp = iPos + vec3(0.0, size * 0.5, 0.0) + lp;
  vec2 bk = bakedRG(wp.xz);
  vSh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);
  vAmb = uAmbCol * mix(1.0, bk.y, 0.5) * (1.0 - uSnow * 0.2);
  vWp = wp; vCrown = iCrown; vRy = iRy;
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);
  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
