attribute vec3 iPos; attribute vec4 iAttr; attribute float rib;
uniform float uTime, uFogDensity, uShadow, uSpin, uAoH, uLift;
uniform vec3 uSunDir, uSunCol, uAmbCol, uBody, uFogCol;
varying vec3 vCol; varying float vRib; varying float vUp; varying float vSeed; varying vec3 vLocal; varying vec3 vNrm;
varying vec3 vWp; varying vec3 vHaze; varying float vFogF; varying vec3 vMet; varying vec3 vNl; varying vec2 vToCam;
#include "common.glsl"
void main(){
  float sc = iAttr.x, rot = iAttr.y;
  float c = cos(rot), s = sin(rot);
  vec3 lp = position * vec3(sc, sc * iAttr.z, sc * iAttr.w);
  float hM = lp.y;
  /// metres above the object's base
  vec3 nl = normal;
  /// a turning part spins about its own z before it is placed, so a set of
  /// windmill sails keeps its hub while it goes round
  if (uSpin != 0.0) {
    float sa = uSpin * uTime, cs = cos(sa), ss = sin(sa);
    lp.xy = vec2(lp.x * cs - lp.y * ss, lp.x * ss + lp.y * cs);
    nl.xy = vec2(nl.x * cs - nl.y * ss, nl.x * ss + nl.y * cs);
  }
  vec3 wp = iPos + vec3(lp.x * c - lp.z * s, lp.y, lp.x * s + lp.z * c);
  vec3 n = normalize(vec3(nl.x * c - nl.z * s, nl.y, nl.x * s + nl.z * c));
  vec2 bk = bakedRG(wp.xz);
  /// contact darkening at the foot, in metres, so a house and a cactus get
  /// the same thin band instead of a third of their height. It is the sky
  /// that the ground hides, so it dims the ambient only, never the sun.
  float ao = (uSpin != 0.0 || uAoH <= 0.0) ? 1.0 : mix(0.55, 1.0, smoothstep(0.0, uAoH, hM));
  /// Ambient light carried no direction, so anything the sun did not reach
  /// came out evenly lit: a trunk read as a flat plank. Sky above, the
  /// ground's bounce below: a shaded side is lit cool from the sky, an
  /// underside dimly by the ground, and no sun reaches round the back.
  /// the sun and its shadows are worked out per pixel (fragment), so a
  /// big wall or roof is not lit from its corners
  vCol = uBody * hemi(n, uAmbCol * 1.1) * ao * mix(1.0, bk.y, 0.6 * (1.0 - uLift));
  vCol *= 1.0 - 0.25 * uWet;
  vRib = rib; vUp = position.y; vSeed = iAttr.y; vLocal = position; vNrm = n; vWp = wp; vMet = lp; vNl = nl;
  /// which way the camera lies in the object's own frame: a round wall
  /// measures its courses round from there, so the seam where the angle
  /// wraps is on the far side
  vec2 tc = cameraPosition.xz - iPos.xz;
  vToCam = normalize(vec2(tc.x * c + tc.y * s, tc.y * c - tc.x * s) + vec2(1e-5, 0.0));
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float fH = fogAmtH(-mv.z, uFogDensity, wp.y);
  vFogF = fH; vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, fH);
  gl_Position = projectionMatrix * mv;
}
