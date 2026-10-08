attribute vec3 iPos; attribute vec4 iAttr; attribute vec4 iInfo; attribute vec3 iCol; attribute vec3 iGlass;
uniform float uFogDensity;
varying vec3 vN; varying vec3 vL; varying float vFog; varying vec3 vSize; varying vec3 vW;
varying vec4 vInfo; varying vec3 vCol; varying vec3 vGlass;
#include "common.glsl"
void main(){
  float w = iAttr.x, rot = iAttr.y;
  vec3 sz = vec3(w, w * iAttr.z, w * iAttr.w);
  vec3 lp = position * sz;
  float c = cos(rot), s2 = sin(rot);
  vec3 wp = iPos + vec3(lp.x * c - lp.z * s2, lp.y, lp.x * s2 + lp.z * c);
  vN = normalize(vec3(normal.x * c - normal.z * s2, normal.y, normal.x * s2 + normal.z * c));
  vL = position; vSize = sz; vW = wp;
  vInfo = iInfo; vCol = iCol; vGlass = iGlass;
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);
  gl_Position = projectionMatrix * mv;
}
