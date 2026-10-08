attribute vec3 iPos; attribute vec3 iAttr;
uniform float uTime, uWind, uGust, uFogDensity, uIntensity, uSway, uSpin;
uniform vec2 uWindDir; uniform vec3 uCamPos;
varying vec2 vUv; varying float vA;
#include "common.glsl"
void main(){
  float range = 30.0;
  float fall = iAttr.z;
  float y = mod(iPos.y - uTime * fall, range);
  float age = range - y;
  float drift = uWind * (0.4 + 0.6 * uGust);
  vec3 wp = vec3(iPos.x, y, iPos.z);
  wp.x += sin(uTime * 0.45 * uSway + iAttr.y) * 0.9 * uSway + uWindDir.x * age * drift * 0.42;
  wp.z += cos(uTime * 0.37 * uSway + iAttr.y * 1.7) * 0.9 * uSway + uWindDir.y * age * drift * 0.42;
  wp.x = mod(wp.x + 45.0, 90.0) - 45.0;
  wp.z = mod(wp.z + 57.0, 56.0) - 57.0;
  vec3 toCam = normalize(uCamPos - wp);
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 up = normalize(cross(toCam, right));
  float sp = uSpin * (uTime * 2.1 + iAttr.y * 4.0);
  vec2 q = vec2(position.x * cos(sp) - position.y * sin(sp),
               position.x * sin(sp) + position.y * cos(sp));
  float squash = mix(1.0, 0.35 + 0.65 * abs(sin(uTime * 1.7 + iAttr.y)), uSpin);
  float df = length(wp - cameraPosition);
  float grow = 1.0 + smoothstep(6.0, 36.0, df) * 2.2;
  vec3 p = wp + right * q.x * iAttr.x * grow + up * q.y * iAttr.x * squash * grow;
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  vA = (1.0 - fogAmt(d, uFogDensity)) * uIntensity * smoothstep(1.2, 5.0, d)
     / (0.6 + 0.4 * grow) * (1.0 - smoothstep(28.0, 44.0, df));
  gl_Position = projectionMatrix * mv;
}
