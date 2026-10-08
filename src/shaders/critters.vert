attribute vec3 iPos; attribute vec4 iAttr; attribute vec3 iDart;
uniform float uTime; uniform vec3 uSunDir, uSunCol, uAmbCol;
varying vec2 vUv; varying vec3 vTint;
void main(){
  float len = iAttr.x, period = iAttr.z, dur = iAttr.w;
  float t = uTime + iAttr.y * period;
  float cyc = floor(t / period);
  float ph = clamp((t - cyc * period) / dur, 0.0, 1.0);
  float ease = ph * ph * (3.0 - 2.0 * ph);
  float dir = mod(cyc, 2.0) < 0.5 ? 1.0 : -1.0;
  float from = dir > 0.0 ? 0.0 : 1.0;
  float at = from + dir * ease;
  vec3 wp = iPos + vec3(iDart.x, 0.0, iDart.z) * at;
  float heading = iDart.y + (dir > 0.0 ? 0.0 : 3.14159);
  float c = cos(heading), s = sin(heading);
  vec3 lp = vec3(position.x * c - position.z * s, 0.0, position.x * s + position.z * c) * len;
  vTint = uAmbCol * 1.1 + uSunCol * max(uSunDir.y, 0.0) * 1.1;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(wp + lp, 1.0);
}
