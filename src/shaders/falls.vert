attribute float aSide, aAlong, aSeed, aWidth, aLen;
uniform vec3 uFogCol, uSunDir, uSunCol; uniform float uFogDensity;
varying vec2 vUv; varying float vFog; varying float vLen, vSeed, vW; varying vec3 vHaze;
#include "common.glsl"
void main(){
  /// it spreads as it falls, and billows out into spray at the foot
  /// (the edges are set out in the script)
  float dn = aAlong;
  float spread = 1.0 + dn * 0.5 + smoothstep(0.82, 1.0, dn) * 1.6;
  vec3 wp = position;
  vUv = vec2(aSide * 0.5 + 0.5, 1.0 - aAlong); vLen = aLen; vSeed = aSeed; vW = aWidth * spread;
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);
  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
