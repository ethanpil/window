attribute vec4 iAttr; attribute vec3 iCol; attribute vec4 iLane; attribute float aPart;
uniform float uTime, uFogDensity, uLen, uShadow, uNight, uLift;
uniform vec2 uDir;
uniform vec3 uOrigin, uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;
varying vec3 vCol; varying float vFog; varying vec3 vHaze; varying vec3 vLoc; varying float vEnd; varying float vPart; varying vec3 vNl; varying vec2 vKind;
#include "common.glsl"
void main(){
  float dir = iLane.y, truck = iLane.w;
  float u = fract(iAttr.w + uTime * iLane.z / uLen * dir + 1.0);
  float along = (u - 0.5) * uLen;
  vec2 across = vec2(-uDir.y, uDir.x);
  /// each part's box within the vehicle (x along it, y up, z across),
  /// as fractions of length, height and width
  vec3 lo = vec3(-0.5, 0.10, -0.5), hi = vec3(0.5, 0.52, 0.5);
  if (aPart > 0.5 && aPart < 1.5) { lo = mix(vec3(-0.30, 0.52, -0.42), vec3(-0.5, 0.10, -0.5), truck); hi = mix(vec3(0.20, 1.0, 0.42), vec3(0.24, 1.0, 0.5), truck); }
  if (aPart < 0.5) { lo = mix(lo, vec3(0.27, 0.10, -0.47), truck); hi = mix(hi, vec3(0.5, 0.80, 0.47), truck); }
  if (aPart > 1.5) { lo = vec3(-0.53, 0.0, -0.56); hi = vec3(0.53, 0.012, 0.56); }
  /// facing back down the road: the same shape mirrored (bounds, not a
  /// negative scale, which would turn the faces inside out)
  if (dir < 0.0) { float t0 = lo.x; lo.x = -hi.x; hi.x = -t0; }
  vec3 q = mix(lo, hi, position + 0.5);
  vec3 lp = q * vec3(iAttr.x, iAttr.y, iAttr.z);
  vec2 xz = uOrigin.xz + uDir * (along + lp.x) + across * (iLane.x + lp.z);
  vec3 p = vec3(xz.x, uOrigin.y + lp.y + 0.02, xz.y);
  vec2 nxz = uDir * normal.x + across * normal.z;
  vec3 n = normalize(vec3(nxz.x, normal.y, nxz.y));
  float diff = max(dot(n, normalize(uSunDir)), 0.0);
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(xz, uTime)) * mix(0.03, 1.0, bakedSun(p, uLift));
  vCol = iCol * (hemi(n, uAmbCol * 1.1) + uSunCol * diff * 1.05 * sh);
  /// paint and glass catch the sky on their tops
  vCol += uFogCol * 0.10 * smoothstep(0.5, 0.9, n.y);
  vCol = mix(vCol, vec3(0.025) * (1.0 + uAmbCol), step(1.5, aPart));
  /// which end this face is: +1 the front, -1 the back, 0 a side
  vEnd = normal.x * dir; vKind = vec2(truck, step(0.1, iLane.z));
  vLoc = position; vPart = aPart; vNl = normal;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  vFog = fogAmtH(-mv.z, uFogDensity, p.y);
  vHaze = hazeAt(uFogCol, normalize(p - cameraPosition), uSunDir, uSunCol, vFog);
  gl_Position = projectionMatrix * mv;
}
