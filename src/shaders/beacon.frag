varying vec2 vUv; varying float vA;
void main(){
  float d = length(vUv - 0.5) * 2.0;
  float core = 1.0 - smoothstep(0.0, 1.0, d);
  gl_FragColor = vec4(vec3(1.0, 0.95, 0.78) * core * vA, core * vA);
}
