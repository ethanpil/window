/// The wander, shared by the animal and its shadow so they never part:
/// a few metres either way, taking its time, with the ground's slope. The
/// animal faces the way it is walking across the view: a fixed facing had
/// sheep drifting backwards half the time.
vec3 wander(vec3 base, vec2 grad, float t, float ph){
  vec2 o = vec2(sin(t) * 3.4 + sin(t * 0.37 + ph) * 2.1, cos(t * 0.81 + ph) * 3.0 + cos(t * 0.29) * 1.8);
  return vec3(base.x + o.x, base.y + dot(grad, o), base.z + o.y);
}
vec2 wanderVel(float t, float ph){
  return vec2(cos(t) * 3.4 + 0.37 * cos(t * 0.37 + ph) * 2.1, -0.81 * sin(t * 0.81 + ph) * 3.0 - 0.29 * sin(t * 0.29) * 1.8);
}
