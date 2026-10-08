/// Vertex side: which of the four variants an instance wears, mirrored or
/// not, and a little colour of its own (value +-8 %, a touch warmer or
/// cooler), all from its seed.
vec2 spriteUv(vec2 q, float seed, out float flip, out vec3 jit){
  float v = floor(fract(seed * 7.31) * 4.0);
  flip = step(0.5, fract(seed * 3.17));
  float h = fract(seed * 13.7) * 2.0 - 1.0, val = fract(seed * 29.3) * 2.0 - 1.0;
  jit = (1.0 + 0.08 * val) * vec3(1.0 + 0.05 * h, 1.0, 1.0 - 0.06 * h);
  vec2 u = vec2(mix(q.x, 1.0 - q.x, flip), q.y) * 0.992 + 0.004;
  return (u + vec2(mod(v, 2.0), 1.0 - floor(v * 0.5))) * 0.5;
}
