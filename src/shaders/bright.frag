uniform sampler2D tex; uniform vec2 uStep; varying vec2 vUv;
/// nine taps across the whole footprint of this small pixel, so a bright
/// speck in the big image cannot drop in and out of the glow
void main(){
  vec3 c = vec3(0.0);
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++)
    c += texture2D(tex, vUv + vec2(float(x), float(y)) * uStep).rgb;
  c /= 9.0;
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  gl_FragColor = vec4(c * smoothstep(0.86, 1.0, l), 1.0); }
