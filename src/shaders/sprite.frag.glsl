/// Fragment side: a normal for the card from where the pixel sits in the
/// crown ellipse (rounding off toward its rim), wrapped diffuse so the shade
/// side is not black, light through the thin edges when the sun is behind,
/// and the underside of the crown in its own shade. Needs common.glsl.
vec3 spriteLight(vec2 q, vec4 crown, float flip, vec3 right, vec3 toCam, float alpha, vec3 amb, float sh){
  vec2 e = (q - vec2(mix(crown.x, 1.0 - crown.x, flip), crown.y)) / crown.zw;
  float r = length(e);
  e /= max(r, 1.0);
  vec3 N = normalize(right * e.x + vec3(0.0, e.y, 0.0) + toCam * (sqrt(max(1.0 - dot(e, e), 0.0)) + 0.2));
  vec3 L = normalize(uSunDir);
  float wrap = max((dot(N, L) + 0.45) / 1.45, 0.0);
  float thin = clamp(smoothstep(0.6, 1.15, r) + (1.0 - smoothstep(0.4, 0.9, alpha)), 0.0, 1.0);
  float trans = pow(max(dot(-toCam, L), 0.0), 2.0) * (0.2 + 0.8 * thin) * 0.6;
  float under = mix(0.55, 1.0, smoothstep(-1.0, 0.3, e.y));
  return hemi(N, amb) * under + uSunCol * (wrap * 1.0 * mix(0.7, 1.0, under) + trans) * sh;
}
