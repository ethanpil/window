varying vec3 vW; varying vec3 vN; varying float vFog;
uniform float uFogDensity;
#include "common.glsl"
void main(){
  vW = position; vN = normalize(normal);
  vec4 mv = modelViewMatrix * vec4(position,1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, position.y);
  gl_Position = projectionMatrix * mv;
}
