attribute float aSlope;
varying vec3 vW; varying float vTop; varying float vSlope;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vTop = position.y; vSlope = aSlope;
  gl_Position = projectionMatrix * viewMatrix * wp; }
