attribute vec3 iPos; attribute vec4 iGlow; attribute vec2 iMode;
uniform vec3 uCamPos, uSunCol; uniform float uTime, uNight, uFogDensity;
varying vec2 vUv; varying vec3 vC;
#include "common.glsl"
void main(){
  vec3 toCam = uCamPos - iPos; float d = length(toCam); toCam /= d;
  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));
  vec3 up = cross(toCam, right);
  float s = max(iGlow.x, d * 0.0042);
  float dim = 1.0 - smoothstep(0.25, 0.80, dot(uSunCol, vec3(0.30, 0.59, 0.11)));
  float on = iMode.x < 0.5 ? max(uNight, dim * 0.5) : (0.25 + 0.75 * uNight) * (0.3 + 0.7 * step(0.75, fract(uTime / 2.0 + iMode.y)));
  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);
  vC = iGlow.yzw * on * clamp(iGlow.x * iGlow.x / (s * s), 0.18, 1.0) * (1.0 - fogAmt(-mv.z, uFogDensity) * 0.85);
  vec3 p = iPos + (right * position.x + up * position.y) * s;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  /// unlit (a lamp by day): put it outside the view, so it costs no pixels
  if (on < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}
