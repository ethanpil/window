attribute float aDrop;
varying vec2 vUv; varying float vFog; varying vec3 vTint; varying vec3 vHaze; varying float vDrop;
uniform float uFogDensity, uShadow, uTime; uniform vec3 uSunDir, uSunCol, uAmbCol, uFogCol;
#include "common.glsl"
void main(){ vUv = uv; vDrop = aDrop;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  /// lit like the rock it runs over: in the gully's shade it is grey
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.15, 1.0, baked(wp.xz));
  vTint = uAmbCol * 1.35 + uSunCol * 0.95 * sh;
  vec4 mv = viewMatrix * wp;
  vFog = fogAmt(-mv.z, uFogDensity);
  vHaze = hazeAt(uFogCol, normalize(wp.xyz - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv; }
