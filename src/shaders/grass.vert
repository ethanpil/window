attribute vec3 iPos; attribute vec4 iAttr; attribute vec3 iAttr2;
uniform float uTime, uWind, uGust, uFogDensity, uShadow, uSnow, uFar0, uFar1, uTopY, uTopK, uEar;
uniform vec2 uWindDir;
uniform vec3 uSunDir, uSunCol, uAmbCol, uFogCol, uBase, uTip, uDry, uSnowCol, uTop;
varying vec3 vColor;
#include "common.glsl"
void main(){
  /// Per instance, not per vertex, so the whole blade shrinks together.
  /// A blade narrower than a pixel cannot be drawn without flickering, so
  /// it is held at about a pixel across, and past that the blades are let
  /// go and the ground carries the far field.
  float dCam = length(iPos - cameraPosition);
  float far = smoothstep(uFar0, uFar1, dCam);
  float yN = position.y;
  /// under real snow the grass is gone; a light fall leaves short pale stubs
  float bury = smoothstep(0.12, 0.50, uSnow);
  float h = iAttr.x * (1.0 - bury * 0.94) * (1.0 - far);
  float earB = uEar * smoothstep(0.66, 0.72, yN) * (1.0 - smoothstep(0.93, 1.0, yN));
  float w = max(iAttr.y, dCam * 0.0015) * (1.0 + earB * 1.9) * (1.0 - far * far);
  float rot = iAttr.z;
  float c = cos(rot), s = sin(rot);
  vec3 lp = vec3(position.x * w, yN * h, 0.0);
  lp.z += iAttr2.y * 0.20 * h * yN * yN;
  /// gusts sweep the field as patches, cat's paws, not as ruled lines
  float wave = gustWave(iPos.xz, uWindDir, uTime, 0.22, 1.55, iAttr2.x * 0.6);
  float wave2 = gustWave(iPos.xz, uWindDir, uTime, 0.061, 0.62, 2.1);
  /// two turbulence rhythms, on the blade's own clock
  float flut = sin(uTime * 2.7 + iAttr2.x) * 0.30 + sin(uTime * 1.25 + iAttr2.x * 1.7) * 0.22;
  float drive = uWind * (0.46 + 0.95 * uGust) * iAttr2.y;
  float gust = max(0.55 + 0.40 * wave + 0.30 * wave2, 0.0);
  /// what the whole field feels
  float shape = max(gust + flut, 0.0);
  /// plus what this blade does
  float bf = drive * shape * 0.45;
  bf = bf / (1.0 + bf);
  float bend = bf * h * 0.8 * yN * yN * (1.0 - bury * 0.7);
  float gustBend = (drive * gust * 0.45) / (1.0 + drive * gust * 0.45) * h * 0.8;
  vec3 rp = vec3(lp.x * c - lp.z * s, lp.y, lp.x * s + lp.z * c);
  rp.xz += uWindDir * bend;
  rp.y -= bend * bend * 0.55;
  vec3 wp = iPos + rp;
  /// the lighting normal leans with the gust, not the flutter: light rolls across
  /// the field in waves without any blade flickering on its own. Each edge
  /// tilts off to its own side, so a blade reads as folded along its rib.
  vec3 side = vec3(c, 0.0, s) * sign(position.x) * 0.45 * (1.0 - far);
  vec3 N = normalize(vec3(-s, 0.62, c) + side + vec3(uWindDir.x, 0.0, uWindDir.y) * gustBend * 1.6 * (1.0 - far));
  vec3 sd = normalize(uSunDir);
  float diff = max(dot(N, sd), 0.0);
  float trans = pow(max(dot(-N, sd), 0.0), 2.5) * 0.42 * smoothstep(0.1, 0.8, yN) * (1.0 - far * 0.8);
  /// a satin sheen where the sun glances off the blade: keyed to the gust,
  /// so it sweeps the field in waves and no single blade twinkles
  vec3 Ng = normalize(vec3(-s, 0.62, c) + vec3(uWindDir.x, 0.0, uWindDir.y) * gustBend * 1.6);
  float sheen = pow(max(dot(reflect(-sd, Ng), normalize(cameraPosition - wp)), 0.0), 12.0) * 0.20 * yN * (1.0 - far);
  float ao = mix(0.42, 1.0, smoothstep(0.0, 0.55, yN));
  vec2 bk = bakedRG(wp.xz);
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);
  vec3 col = mix(uBase, uTip, clamp(yN * 1.05, 0.0, 1.0));
  col = mix(col, uDry, iAttr.w * 0.55);
  col = mix(col, uTop, smoothstep(uTopY, uTopY + 0.08, yN) * uTopK);
  col *= iAttr2.z * (1.0 - 0.18 * uWet);
  vec3 lit = col * (bk.y * hemi(N, uAmbCol * 1.15) + uSunCol * (diff * 1.15 + trans + sheen) * sh) * ao;
  /// one steady colour for the far field: no per-blade variation left to alias
  vec3 mass = mix(mix(uBase, uTip, 0.62), uTop, uTopK * 0.3) * (uAmbCol * 1.15 + uSunCol * 0.70 * sh) * 0.94;
  lit = mix(lit, mass, far);
  /// whitened along the whole blade, so nothing dark pokes through the snow
  vec3 snowL = uAmbCol * 1.15 + uSunCol * max(sd.y, 0.0) * 1.25 * sh;
  lit = mix(lit, uSnowCol * (0.80 + 0.20 * yN) * snowL * 0.82, clamp(uSnow * 1.6, 0.0, 0.96));
  vec4 mv = modelViewMatrix * vec4(wp, 1.0);
  float fg = fogAmt(-mv.z, uFogDensity);
  vColor = mix(lit, hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, fg), fg);
  gl_Position = projectionMatrix * mv;
}
