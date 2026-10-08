#include "tone.glsl"
uniform vec3 uDeep, uShallow, uSunDir, uSunCol, uAmbCol, uFogCol, uCamPos, uZenith, uCloudL, uCloudD;
uniform float uTime, uFoam, uChop, uSwell, uShadow, uFlowRate, uStreak, uMirror, uAbs, uGust, uRim, uFogDensity;
uniform vec2 uFlowDir, uWindDir;
varying vec3 vW;
#include "common.glsl"
float bl(float ph){ return 1.0 - smoothstep(0.30, 0.85, fwidth(ph) * 0.159); }
/// the slope of one train of waves, deep-water speed for its length,
/// faded out once a crest is finer than a pixel
vec2 wv(vec2 p, vec2 dir, float lam, float slope, float t){
  float k = 6.2832 / lam;
  float ph = dot(p, dir) * k - sqrt(9.8 * k) * t;
  return dir * slope * cos(ph) * bl(ph);
}
void main(){
  vec2 p = vW.xz;
  float t = uTime;
  vec3 toC = uCamPos - vW;
  float dCam = length(toC);
  vec3 v = toC / dCam;
  vec3 sd = normalize(uSunDir);
  float depth = waterDepth(p);
  /// a salt flat is a film over the crust; out past the baked map its
  /// depth is unknown, and it is a film there too
  depth = mix(depth, min(depth, 0.12), uMirror);
  /// Three trains of ripples off the wind (along the current on a river),
  /// and on the sea a long swell running in. Each is a few centimetres in
  /// the metre of slope: enough to break the mirror, not to sparkle.
  vec2 fd = normalize(mix(uWindDir, uFlowDir, uStreak) + vec2(1e-4, 0.0));
  vec2 d2 = vec2(fd.x * 0.80 - fd.y * 0.60, fd.x * 0.60 + fd.y * 0.80);
  vec2 d3 = vec2(fd.x * 0.87 + fd.y * 0.50, -fd.x * 0.50 + fd.y * 0.87);
  float ch = uChop * (0.65 + 0.5 * uGust);
  /// the current drags streaks of slack and broken water downstream: the
  /// cloud texture stretched along the flow and carried with it
  float streak = texture2D(uSkyCloud, vec2(p.x * 0.045, (p.y - uFlowDir.y * uFlowRate * t) * 0.007)).r;
  ch *= mix(1.0, 0.35 + 1.3 * smoothstep(0.25, 0.75, streak), uStreak);
  /// the crests are bent by a slow warp so the trains do not run as ruled lines
  vec2 pw = p + vec2(sin(p.y * 0.21 + p.x * 0.07) + sin(p.y * 0.047 - p.x * 0.031) * 1.7, sin(p.x * 0.19 - p.y * 0.05) + sin(p.x * 0.041 + p.y * 0.029) * 1.7) * 1.3;
  vec2 d4 = vec2(-d2.y, d2.x) * 0.5 + d3 * 0.866, d5 = vec2(d3.y, -d3.x) * 0.6 + d2 * 0.8;
  vec2 g = wv(pw, fd, 3.3, 0.034 * ch, t) + wv(pw, d2, 1.9, 0.030 * ch, t) + wv(pw * 1.13, d3, 0.95, 0.028 * ch, t)
         + wv(pw * 0.93, d4, 1.37, 0.022 * ch, t) + wv(pw * 1.07, d5, 2.6, 0.022 * ch, t);
  vec2 ps = p + vec2(sin(p.y * 0.013) * 9.0 + sin(p.y * 0.051 + p.x * 0.02) * 4.0, sin(p.x * 0.021) * 6.0);
  g += (wv(ps, vec2(0.0, 1.0), 21.0, 0.018, t * 0.55) + wv(ps, vec2(0.38, 0.92), 13.0, 0.013, t * 0.6)) * uFoam;
  g *= 1.0 - smoothstep(150.0, 600.0, dCam);
  vec3 N = normalize(vec3(-g.x, 1.0, -g.y));
  float ndv = max(dot(N, v), 0.02);
  vec3 r = reflect(-v, N); r.y = abs(r.y);
  float F = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
  vec3 sky = skyMirror(r, uFogCol, uSunDir, uZenith, uCloudL, uCloudD);
  /// low reflections are of the land round about: its colour, hazed
  vec3 land = mix(uGroundCol * 1.3, horizonAt(r, uFogCol, uSunDir), 0.35);
  sky = mix(land, sky, smoothstep(uRim * 0.55, uRim * 1.2 + 0.004, r.y));
  vec2 bk = bakedRG(p);
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(p, t)) * mix(0.03, 1.0, bk.x);
  /// what comes up out of the water: its own colour, lit, and the bed
  /// through it, thinned by Beer-Lambert along the refracted path
  float cosT = sqrt(max(1.0 - (1.0 - v.y * v.y) / 1.77, 0.04));
  float T = exp(-uAbs * depth / cosT);
  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 5.0, depth)) * (uAmbCol * 0.95 + uSunCol * max(sd.y, 0.0) * 0.45 * sh);
  /// The sun on it: the facets that tip the sun at the eye, from a slope
  /// spread wider than the ripples that are drawn (the ones too fine to
  /// draw are still there). Toward a low sun that spread stretches into
  /// a broad path of light rather than a field of sparkles.
  float sig = 0.018 + ch * (0.025 + 0.06 * smoothstep(10.0, 300.0, dCam));
  vec3 hv = normalize(v + sd);
  float nh = max(dot(N, hv), 0.05), nh2 = nh * nh;
  float D = exp(-(1.0 - nh2) / (nh2 * 2.0 * sig * sig)) / (6.2832 * sig * sig * nh2 * nh2);
  float Fh = 0.02 + 0.98 * pow(1.0 - max(dot(hv, v), 0.0), 5.0);
  vec3 glint = uSunCol * sh * min(D * Fh / (4.0 * ndv), 8.0) * smoothstep(-0.02, 0.06, sd.y) * step(0.0, dot(N, sd));
  float keep = (1.0 - F) * T;
  /// how much of the bed shows
  float a = 1.0 - keep;
  vec3 col = (F * sky + glint + (1.0 - F) * (1.0 - T) * body) / max(a, 0.02);
  /// foam, lit like everything else: breakers over the shelving sea bed
  /// and a wash at its edge; a small lap at a lake or river margin
  vec3 foamC = vec3(0.92, 0.95, 0.96) * (uAmbCol * 1.15 + uSunCol * max(sd.y, 0.0) * 1.1 * sh);
  float bph = t * uSwell * 6.2832 * 0.16 + depth * 1.6 + sin(p.x * 0.031) * 0.9 + sin(p.x * 0.0071 + 1.3) * 1.4;
  float crest = smoothstep(0.40, 0.96, sin(bph)) * smoothstep(0.25, 0.6, depth) * (1.0 - smoothstep(1.5, 4.5, depth));
  float wash = (1.0 - smoothstep(0.02, 0.35, depth)) * (0.55 + 0.45 * sin(t * 0.47 + p.x * 0.05));
  float foam = (crest * bl(bph) * 0.85 + wash) * uFoam;
  float lph = depth * 55.0 - t * 1.4 + sin(p.x * 0.7 + p.y * 0.5) * 1.5;
  foam += (1.0 - uFoam) * (1.0 - smoothstep(0.03, 0.22, depth)) * smoothstep(0.6, 0.95, sin(lph)) * bl(lph) * clamp(uChop * 0.9, 0.0, 0.4);
  foam = clamp(foam, 0.0, 0.9) * (1.0 - smoothstep(60.0, 160.0, dCam));
  col = mix(col, foamC, foam); a = max(a, foam);
  /// a film thinner than a few centimetres is wet ground, which the
  /// terrain draws: no seam where water meets land
  a *= smoothstep(0.0, 0.06, depth);
  /// per pixel: the plane is one quad kilometres across, and haze worked
  /// out at its corners and spread across it came to half everywhere
  float fogF = fogAmtH(dCam, uFogDensity, vW.y);
  col = mix(col, hazeAt(uFogCol, -v, uSunDir, uSunCol, fogF), fogF);
  gl_FragColor = vec4(tone(col), a);
}
