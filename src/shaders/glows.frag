varying vec2 vUv; varying vec3 vC;
void main(){
  float r = length(vUv - 0.5) * 2.0;
  float k = exp(-r * r * 5.0) * (1.0 - smoothstep(0.8, 1.0, r));
  gl_FragColor = vec4(vC * k, 1.0);
}
