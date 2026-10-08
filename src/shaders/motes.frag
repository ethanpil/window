varying vec2 vUv; varying float vA;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.0, 1.0, d);
  float a = core * vA * 0.55;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.90) * a, a);
}
