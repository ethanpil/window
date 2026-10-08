uniform vec3 uCamPos, uOrigin; uniform float uScale, uTime, uNight;
varying vec2 vUv; varying float vA;
void main(){
  /// brightest as the lamp sweeps past the window, every eight seconds
  float sweep = pow(max(sin(uTime * 0.78), 0.0), 8.0);
  vA = (0.12 + 0.88 * sweep) * (0.25 + 0.75 * uNight);
  vec3 toCam = normalize(uCamPos - uOrigin);
  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));
  vec3 up = normalize(cross(toCam, right));
  float s = uScale * (0.22 + 0.30 * sweep);
  vec3 p = uOrigin + right * position.x * s + up * position.y * s;
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
