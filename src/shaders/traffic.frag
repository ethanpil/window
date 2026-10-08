#include "tone.glsl"
uniform float uNight;
varying vec3 vCol; varying float vFog; varying vec3 vHaze; varying vec3 vLoc; varying float vEnd; varying float vPart; varying vec3 vNl; varying vec2 vKind;
void main(){
  vec3 c = vCol;
  /// A car's cabin is glass all round below its roof; a lorry's cab is
  /// glazed in its upper half and its box is blank. A dark band of tyres
  /// and sill runs along the foot of the body.
  float truck = vKind.x, p0 = 1.0 - step(0.5, vPart), p1 = step(0.5, vPart) * step(vPart, 1.5);
  float wall = 1.0 - step(0.5, abs(vNl.y));
  float fw = fwidth(vLoc.y);
  float pane = mix(smoothstep(-0.42 - fw, -0.30 + fw, vLoc.y) * (1.0 - smoothstep(0.32 - fw, 0.42 + fw, vLoc.y)),
                   smoothstep(0.0 - fw, 0.08 + fw, vLoc.y) * (1.0 - smoothstep(0.38 - fw, 0.46 + fw, vLoc.y)) * (1.0 - step(0.5, -vEnd)), truck);
  float glass = mix(p1, p0, truck) * wall * pane;
  c = mix(c, vec3(0.05, 0.06, 0.07) + vHaze * 0.18, glass * 0.92);
  float lowK = mix(p0, p0 + p1, truck);
  c *= 1.0 - 0.75 * lowK * wall * (1.0 - smoothstep(mix(-0.30, -0.40, truck), mix(-0.18, -0.30, truck), vLoc.y));
  /// A pair of lamps at each end: warm white headlights in front, red
  /// tail lights behind, lit while the vehicle is moving. Once a lamp is
  /// under a pixel it fades to its share of the end face, so it cannot
  /// flicker.
  float front = smoothstep(0.5, 0.9, vEnd), back = smoothstep(0.5, 0.9, -vEnd);
  float onLamp = mix(p0, p0 * front + p1 * back, truck);
  vec2 lq = vec2((abs(vLoc.z) - 0.33) / 0.11, (vLoc.y - mix(0.22, -0.26, truck)) / mix(0.13, 0.07, truck));
  float d = length(lq), fd = fwidth(d);
  float spot = 1.0 - smoothstep(0.7 - fd, 1.0 + fd, d);
  spot = mix(spot, 0.12, smoothstep(0.6, 2.5, fd)) * onLamp * vKind.y;
  c += (vec3(1.0, 0.92, 0.76) * 2.4 * front + vec3(1.0, 0.10, 0.06) * 1.5 * back) * spot * uNight;
  gl_FragColor = vec4(tone(mix(c, vHaze, vFog)), 1.0);
}
