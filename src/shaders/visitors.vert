attribute vec4 iAttr;
uniform float uTime, uFogDensity, uSize, uDist, uHeight, uPeriod, uCross, uGround, uWalks;
uniform vec3 uCamPos;
varying vec2 vUv; varying float vFade;
#include "common.glsl"
void main(){
  float cyc = fract(uTime / uPeriod + iAttr.x + iAttr.z * 0.004);
  float span = uCross;
  float u = cyc / span;
  vFade = step(cyc, span) * smoothstep(0.0, 0.10, u) * smoothstep(1.0, 0.88, u);
  float side = iAttr.w > 0.0 ? 1.0 : -1.0;
  float travel = mix(-1.15, 1.15, u) * side;
  float d = uDist * iAttr.y + iAttr.z * 2.0;
  vec3 wp = vec3(travel * d * 0.75 + iAttr.z, uGround + uHeight + sin(uTime * 0.07 + iAttr.x * 6.0) * uHeight * 0.05, -d);
  float bob = uWalks * abs(sin(uTime * 1.6 + iAttr.x * 9.0)) * uSize * 0.045;
  wp.y += bob;
  vec3 toCam = normalize(vec3(uCamPos.x - wp.x, 0.0, uCamPos.z - wp.z));
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 up = uWalks > 0.5 ? vec3(0.0,1.0,0.0) : normalize(cross(toCam, right));
  vec3 p = wp + right * position.x * uSize * side + up * position.y * uSize;
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFade *= 1.0 - fogAmt(-mv.z, uFogDensity) * 0.9;
  gl_Position = projectionMatrix * mv;
}
