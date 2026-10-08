varying vec2 vUv; varying float vA;
void main(){
  float r = length((vUv - 0.5) * 2.0);
  gl_FragColor = vec4(0.0, 0.0, 0.0, vA * (1.0 - smoothstep(0.35, 1.0, r)));
}
