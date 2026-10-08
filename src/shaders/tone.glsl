/// A soft shoulder so highlights (sun, glitter, snow) roll off instead of
/// clipping. The curve runs on the brightest channel and scales the other two
/// with it, so a blue sky stays blue instead of each channel being squeezed
/// toward the same grey; only near white does it ease toward a per-channel
/// roll-off, so the sun and snow still burn to white. A small toe keeps the
/// blacks down. The grade (a little contrast, cool shadows, warm highlights)
/// lives here too, so a frame without the post pass looks the same.
vec3 tone(vec3 c){
  c = max(c, vec3(0.0));
  c *= (c + 0.022) / (c + 0.040);
  float m = max(max(c.r, c.g), c.b);
  float s = 1.0 - exp(-1.42 * m);
  vec3 hp = c * (s / max(m, 1e-4));
  vec3 pc = 1.0 - exp(-1.42 * c);
  c = mix(hp, pc, smoothstep(0.50, 0.95, s) * 0.85);
  float l = dot(c, vec3(0.30, 0.59, 0.11));
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.16);
  return c + vec3(-0.012, 0.0, 0.022) * (1.0 - l) + vec3(0.02, 0.008, -0.012) * l;
}
