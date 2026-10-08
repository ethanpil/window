/// The horizon is the colour of the sky toward the sun and cooler, pinker,
/// away from it when the sun is low, blended by azimuth. The sky passes its
/// own pair; the land's haze its own (horizonAt), so they meet without a seam.
vec3 horizonMix(vec3 dir, vec3 away, vec3 toward, vec3 sunDir){
  float w = dot(normalize(dir.xz + vec2(1e-5)), normalize(sunDir.xz + vec2(1e-5))) * 0.5 + 0.5;
  return mix(away, toward, smoothstep(0.0, 1.0, w)); }
