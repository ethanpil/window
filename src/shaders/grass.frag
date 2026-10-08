#include "tone.glsl"
varying vec3 vColor;
void main(){ gl_FragColor = vec4(tone(vColor), 1.0); }
