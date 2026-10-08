attribute vec3 iAttr;
uniform float uTime, uWind, uFogDensity, uScale;
uniform vec2 uWindDir; uniform vec3 uCamPos, uOrigin, uFogCol, uSunDir, uSunCol, uAmbCol;
varying float vA; varying vec2 vUv; varying vec3 vTint;
#include "common.glsl"
void main(){
  float life = fract(iAttr.x + uTime * 0.055);
  float rise = life * uScale * 2.6;
  vec3 wp = uOrigin + vec3(0.0, rise, 0.0);
  /// the wind bends the column over as it climbs
  wp.xz += uWindDir * life * life * uScale * (2.2 + 5.0 * uWind);
  wp.x += sin(uTime * 0.5 + iAttr.y) * life * uScale * 0.30;
  float size = uScale * (0.16 + life * 0.85) * iAttr.z;
  vec3 toCam = normalize(uCamPos - wp);
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 up = normalize(cross(toCam, right));
  vec3 p = wp + right * position.x * size + up * position.y * size;
  vA = smoothstep(0.0, 0.10, life) * (1.0 - smoothstep(0.35, 1.0, life)) * 0.42;
  vTint = uAmbCol * 1.2 + uSunCol * 0.55 * max(uSunDir.y, 0.0);
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vA *= 1.0 - fogAmt(-mv.z, uFogDensity);
  gl_Position = projectionMatrix * mv;
}
