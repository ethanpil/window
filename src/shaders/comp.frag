uniform sampler2D tex, bloom; uniform float uTime, uBloom; uniform vec2 uRes, uTexel; varying vec2 vUv;
void main(){
  vec2 o = uTexel * 0.36;
  vec3 c = (texture2D(tex, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tex, vUv + vec2(o.x, -o.y)).rgb
          + texture2D(tex, vUv + vec2(-o.x, o.y)).rgb + texture2D(tex, vUv + vec2(o.x, o.y)).rgb) * 0.25;
  c += texture2D(bloom, vUv).rgb * uBloom;
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  float g = fract(sin(dot(floor(vUv * uRes) + fract(uTime) * 61.0, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  c += g * 0.026 * (1.0 - l * 0.7);
  /// contrast and split-tone are in tone(), so every tier gets them
  /// temporal accumulation: the last frame is folded in, more when the view
  /// is moving. Detail that flickered frame to frame settles; a pan gets a
  /// touch of motion blur, which is what an eye sees too.
  gl_FragColor = vec4(c, 1.0); }
