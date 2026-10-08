varying vec3 vW;
void main(){
  /// world position: the plane is lifted to the water level by its
  /// mesh, and seen from its own y = 0 every river in a gorge was viewed
  /// at a glancing angle and mirrored the horizon
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
