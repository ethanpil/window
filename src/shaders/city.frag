#include "tone.glsl"
uniform vec3 uSunDir, uSunCol, uAmbCol, uFogCol, uLit, uZenith, uCloudL, uCloudD;
uniform float uNight, uTime, uShadow, uCitySeed;
varying vec3 vN; varying vec3 vL; varying float vFog; varying vec3 vSize; varying vec3 vW;
varying vec4 vInfo; varying vec3 vCol; varying vec3 vGlass;
float h21(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
#include "common.glsl"
/// the sky in a pane: skyMirror's gradient with a single cloud tap,
/// which is all a window can show and half the fetches over a city
/// that fills the view
vec3 skyRefl(vec3 r, vec3 sd){
  float h = max(r.y, 0.0);
  vec3 hor = horizonAt(r, uFogCol, sd);
  vec3 s = mix(hor, uZenith, pow(h, 0.45));
  float n = texture2D(uSkyCloud, r.xz / max(h, 0.08) * uSkyScale * 0.55 + uSkyOff).r;
  float cov = smoothstep(uSkyCover, uSkyCover + uSkySoft, n) * uSkyOp * (1.0 - 0.6 * smoothstep(0.22, 0.03, h));
  return mix(s, mix(uCloudL, uCloudD, 0.35), cov);
}
void main(){
  vec3 sd = normalize(uSunDir), N = normalize(vN);
  float isTop = step(0.5, N.y), wallK = 1.0 - isTop;
  float seed = vInfo.x, type = vInfo.y, base = vInfo.z;
  /// Sun and shadow. The bake stores, for each column of ground, the height
  /// below which the sun is hidden there (alpha), so a wall is lit from
  /// the top down as the shadow of the tower across the street climbs it.
  /// A wall reads the column just outside itself.
  vec2 suv = (vW.xz + N.xz * 2.6 - uShadowOrigin) * uShadowScale;
  float hsh = texture2D(uShadowMap, suv).a * 640.0 - 160.0;
  vec2 se = smoothstep(vec2(0.0), vec2(0.02), suv) * (1.0 - smoothstep(vec2(0.98), vec2(1.0), suv));
  float sunVis = mix(smoothstep(hsh - 1.5, hsh + 1.5, vW.y), smoothstep(hsh - 3.0, hsh - 0.8, vW.y), isTop);
  sunVis = mix(1.0, sunVis, se.x * se.y);
  float diff = max(dot(N, sd), 0.0);
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(vW.xz, uTime)) * mix(0.03, 1.0, sunVis);
  /// the face: u across it, v up it, in metres
  float side = step(abs(N.z), abs(N.x));
  float u = mix(vL.x * vSize.x, vL.z * vSize.z, side), span = mix(vSize.x, vSize.z, side);
  float v = vL.y * vSize.y, vs = v + base;
  /// the family: storey, bay, glass width (half, of a bay), sill and head
  /// (of a storey), how much the glass reflects, corner margin. Storeys,
  /// lobby and parapet are the script's (CITY_FLOOR...), as cut.
  float fh = {{FLOOR0}}, bay = 1.5, gx = 0.46, gy0 = 0.03, gy1 = 0.72, refl = 1.0, mar = 0.25;
  if (type > 0.5 && type < 1.5) { fh = {{FLOOR1}}; bay = 2.7; gx = 0.25; gy0 = 0.28; gy1 = 0.87; refl = 0.30; mar = 0.8; }
  else if (type > 1.5 && type < 2.5) { fh = {{FLOOR2}}; bay = 1.6; gx = 0.47; gy0 = 0.36; gy1 = 0.90; refl = 0.55; mar = 0.6; }
  else if (type > 2.5 && type < 3.5) { fh = {{FLOOR3}}; bay = 2.9; gx = 0.21; gy0 = 0.24; gy1 = 0.86; refl = 0.28; mar = 1.0; }
  else if (type > 3.5) fh = {{FLOOR4}};
  float plant = step(3.5, type);
  /// storeys over a lobby on the street, under a parapet; a whole number
  /// of bays across, so the corners are solid
  float lob = base < 0.5 ? {{LOBBY}} : 0.0;
  float fv = (v - lob) / fh, fl = floor(fv), fy = fract(fv);
  float inF = step(0.0, v - lob) * step(v, vSize.y - {{PARAPET}});
  float usable = span - 2.0 * mar, nb = max(1.0, floor(usable / bay));
  float cu = (u + 0.5 * span - mar) / usable * nb, ci = floor(cu), fx = fract(cu);
  float inC = step(0.0, cu) * step(cu, nb);
  float fwc = fwidth(cu), fwv = fwidth(fv);
  float kW = 1.0 - smoothstep(0.35, 0.9, max(fwc, fwv));
  float gM = bandAA(fx, 0.5 - gx, 0.5 + gx, fwc) * bandAA(fy, gy0, gy1, fwv) * inF * inC;
  /// the lobby: shopfronts glazed nearly floor to ceiling, or a stone base
  /// with smaller openings
  float lb = step(v, lob);
  float lcu = (u + 0.5 * span) / 4.2, lv = v / max(lob, 0.1);
  float stone = step(2.5, type) * (1.0 - plant);
  float lG = bandAA(fract(lcu), mix(0.07, 0.22, stone), mix(0.93, 0.78, stone), fwidth(lcu)) * bandAA(lv, 0.04, mix(0.82, 0.70, stone), fwidth(lv));
  gM = mix(gM, lG, lb) * (1.0 - plant);
  /// the wall itself
  vec3 wc = vCol;
  wc *= 1.0 - 0.16 * bandAA(fract(vs / 0.62), 0.0, 0.07, fwidth(vs) / 0.62) * stone;
  wc *= 1.0 + 0.10 * bandAA(fy, 0.0, 0.08, fwv) * inF * (1.0 - plant);
  float su = u * 1.3 + seed * 17.0;
  wc *= 1.0 + (0.10 * h21(vec2(floor(su), seed)) - 0.05) * (1.0 - smoothstep(0.3, 0.85, fwidth(su)));
  wc *= 1.0 - 0.28 * plant * bandAA(fract(v / 0.25), 0.55, 0.92, fwidth(v) / 0.25);
  wc *= mix(1.0, 0.78, lb * stone);
  /// a pale sill under each punched window
  float punched = step(0.5, type) * step(type, 1.5) + stone;
  wc *= 1.0 + 0.32 * punched * bandAA(fy, gy0 - 0.05, gy0 - 0.005, fwv) * bandAA(fx, 0.5 - gx - 0.04, 0.5 + gx + 0.04, fwc) * inF * inC;
  wc *= 1.0 - 0.25 * (1.0 - smoothstep(0.0, 0.6, vs));
  /// the damp foot
  wc *= 1.0 + 0.22 * step(vSize.y - 0.35, v);
  /// coping on the parapet
  /// the roof: membrane or gravel, darker toward the parapet
  vec2 rq = vL.xz * vSize.xz;
  float edge = min(0.5 * vSize.x - abs(rq.x), 0.5 * vSize.z - abs(rq.y));
  vec3 roof = mix(vec3(0.34, 0.34, 0.33), vec3(0.23, 0.24, 0.25), h21(vec2(seed * 31.0, 2.0))) * (0.78 + 0.22 * smoothstep(0.2, 1.6, edge));
  vec3 alb = mix(wc, roof, isTop) * (1.0 - 0.22 * uWet * (1.0 + isTop));
  /// lit by the sky and the ground's bounce; a street between tall walls
  /// sees less sky
  float canyon = mix(mix(0.62, 1.0, smoothstep(0.0, 30.0, vs)), 1.0, isTop);
  vec3 cW = alb * (hemi(N, uAmbCol * 1.15) * canyon + uSunCol * diff * 1.05 * sh);
  /// Glass. Fresnel on the face's own normal; it mirrors the sky (gradient
  /// and clouds) along the reflected ray, below that the towers across the
  /// way as a band of hazy dark shapes, and the street; a glint of sun.
  /// A curtain wall is coated and reflects at any angle, a punched window
  /// much less.
  vec3 V = normalize(cameraPosition - vW), Rf = reflect(-V, N);
  float F = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  float F0 = mix(0.05, 0.34, refl), Fk = F0 + (1.0 - F0) * F * mix(0.6, 1.0, refl);
  vec3 sky = skyRefl(Rf, sd);
  float az = atan(Rf.z, Rf.x) * 22.0 + seed * 40.0;
  float kA = 1.0 - smoothstep(0.3, 0.9, fwidth(az));
  float bh = mix(0.12, 0.03 + 0.20 * h21(vec2(floor(az), 7.0)), kA);
  /// the towers across the way: lit faces and shaded ones, hazed
  float shade = mix(0.75, 0.45 + 0.8 * h21(vec2(floor(az), 3.0)), kA);
  vec3 across = mix(hemi(vec3(0.0, 0.3, 0.0), uAmbCol) * 0.55 + uSunCol * 0.18, uFogCol * 0.8, 0.40) * shade;
  vec3 rfl = mix(sky, across, (1.0 - smoothstep(bh - 0.02, bh + 0.02, Rf.y)) * 0.85);
  rfl = mix(rfl, uGroundCol * 0.6 + uFogCol * 0.12, smoothstep(-0.25, -0.55, Rf.y));
  rfl += uSunCol * pow(max(dot(Rf, sd), 0.0), 240.0) * 6.0 * sh;
  /// behind the glass: a dark room, blinds drawn part way on some panes,
  /// lighter low down where the floor takes the daylight
  vec2 cell = vec2(ci + side * 517.0, fl) + floor(seed * 911.0);
  float r1 = h21(cell + uCitySeed), r2 = h21(cell * 1.71 + 3.1 + uCitySeed), r3 = h21(cell * 0.37 + 9.7);
  float iy = clamp((fy - gy0) / max(gy1 - gy0, 0.05), 0.0, 1.0);
  float aL = dot(uAmbCol, vec3(0.3, 0.59, 0.11));
  float blind = r2 < 0.55 ? r2 * 1.1 : 0.0;
  float onBlind = step(1.0 - blind, iy) * (1.0 - lb);
  vec3 room = vGlass * aL * (0.30 + 0.45 * (1.0 - iy)) + vec3(0.04, 0.042, 0.045) * aL;
  room = mix(room, vec3(0.62, 0.60, 0.56) * aL * 0.55, onBlind);
  room = mix(vGlass * aL * 0.5 + vec3(0.04) * aL + vec3(0.62, 0.60, 0.56) * aL * 0.15, room, kW);
  /// At night the rooms light up: offices a floor at a time, mostly
  /// fluorescent white; homes window by window, warm, now and then the
  /// blue of a television. A few change over the hour. Past the band
  /// limit, the share lit at the average colour.
  float office = step(type, 0.5) + step(1.5, type) * step(type, 2.5);
  float rF = h21(vec2(fl + side * 31.0, seed * 13.0) + uCitySeed);
  float flick = step(0.5, fract(r1 * 91.0 + floor(uTime / 47.0 + r1 * 13.0) * 0.5));
  float litW = mix(step(0.62, r1) * mix(1.0, flick, 0.35), step(0.55, rF) * step(0.12, r1), office);
  litW = mix(litW, step(0.3, r1), lb);
  vec3 lc = office > 0.5 ? (r3 < 0.68 ? vec3(0.86, 0.93, 1.0) : (r3 < 0.9 ? vec3(0.96, 0.98, 1.0) : vec3(1.0, 0.80, 0.55)))
                        : (r3 < 0.55 ? vec3(1.0, 0.64, 0.34) : (r3 < 0.86 ? vec3(1.0, 0.78, 0.52) : vec3(0.88, 0.93, 1.0)));
  float tv = (1.0 - office) * step(0.965, r2) * (1.0 - lb);
  lc = mix(lc, vec3(0.45, 0.58, 1.0) * (0.65 + 0.35 * sin(uTime * 7.3 + r1 * 40.0) * sin(uTime * 2.9 + r2 * 17.0)), tv);
  lc *= (0.6 + 0.6 * r2) * mix(1.0, 0.7, onBlind);
  float share = mix(0.36, 0.40, office);
  vec3 lAvg = mix(vec3(1.0, 0.74, 0.48), vec3(0.9, 0.94, 1.0), office) * 0.9;
  litW = mix(share, litW, kW); lc = mix(lAvg, lc, kW);
  float dim = 1.0 - smoothstep(0.25, 0.80, dot(uSunCol, vec3(0.30, 0.59, 0.11)));
  float glow = max(uNight, dim * 0.30);
  vec3 inside = mix(room, lc * 1.5, litW * glow);
  vec3 glass = inside * (1.0 - Fk) + rfl * Fk;
  /// a curtain wall's spandrels are glass too, with nothing lit behind
  cW = mix(cW, cW * 0.6 + rfl * Fk * 0.8, step(type, 0.5) * wallK);
  vec3 c = mix(cW, glass, gM * wallK);
  /// lamps in the street wash the foot of the walls with warm light
  c += alb * uLit * 0.30 * uNight * (1.0 - smoothstep(0.0, 10.0, vs)) * wallK;
  gl_FragColor = vec4(mix(c, hazeAt(uFogCol, normalize(vW - cameraPosition), sd, uSunCol, vFog), vFog), 1.0);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
