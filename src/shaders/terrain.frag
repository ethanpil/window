#include "tone.glsl"
uniform sampler2D uTex; uniform vec3 uSunDir, uSunCol, uAmbCol, uFogCol, uSnowCol, uTip;
uniform vec3 uRock, uHigh, uCoverCol, uDryC, uWoodCol; uniform float uCoverK, uCoverMinY, uCoverNear, uPatch; uniform vec2 uPlantY;
uniform float uTime, uShadow, uSnow, uRockLine, uSnowLine, uWaterY, uBeach, uSwash, uPaddy, uStepH, uRowSp, uPuddle;
uniform vec2 uRowDir; uniform vec3 uRowCol, uRowSoil;
uniform float uStrata, uFloorY, uBedY[16], uBedH[16]; uniform vec3 uBedC[16];
uniform vec4 uCan1, uCan2; uniform float uRiver; uniform vec3 uRiverCol;
uniform vec4 uDuneA, uDuneB, uDuneC, uDuneD; uniform vec2 uDuneR; uniform vec3 uRip; uniform float uSand, uPave, uSalt, uWash, uMirage;
/// duneAt() in the script, term for term, with its gradient: (height,
/// dh/dx, dh/dz, phase in wavelengths); y is the profile, 0 trough to 1 brink
vec4 duneG(vec2 p, out float y){
  float u = p.x * uDuneA.z + p.y * uDuneA.w, v = -p.x * uDuneA.w + p.y * uDuneA.z;
  float ph = u * uDuneA.y + uDuneB.x * sin(uDuneB.y * v + uDuneB.z) + uDuneB.w * sin(uDuneC.x * v + uDuneC.y) + uDuneD.x * sin(uDuneD.y * u + uDuneD.z);
  float pu = uDuneA.y + uDuneD.x * uDuneD.y * cos(uDuneD.y * u + uDuneD.z);
  float pv = uDuneB.x * uDuneB.y * cos(uDuneB.y * v + uDuneB.z) + uDuneB.w * uDuneC.x * cos(uDuneC.x * v + uDuneC.y);
  float fl = floor(ph), f = ph - fl, r = 1.0 - uDuneD.w, t = f / r;
  y = f < r ? t * t * (3.0 - 2.0 * t) : 1.0 - (f - r) / uDuneD.w;
  float dy = f < r ? 6.0 * t * (1.0 - t) / r : -1.0 / uDuneD.w;
  float aa = uDuneC.z * v + uDuneC.w + 2.1 * fl;
  float A = uDuneA.x * (0.72 + 0.28 * sin(aa)), Av = uDuneA.x * 0.28 * uDuneC.z * cos(aa);
  float hu = A * dy * pu, hv = A * dy * pv + y * Av;
  float d = max(length(p), 1.0), sr = clamp((d - uDuneR.x) / (uDuneR.y - uDuneR.x), 0.0, 1.0);
  float g = sr * sr * (3.0 - 2.0 * sr), dg = 6.0 * sr * (1.0 - sr) / (uDuneR.y - uDuneR.x);
  vec2 gr = g * vec2(hu * uDuneA.z - hv * uDuneA.w, hu * uDuneA.w + hv * uDuneA.z) + A * y * dg * p / d;
  return vec4(A * y * g, gr, ph);
}
uniform float uPathW, uPathX, uPathZ, uPathBend, uPathPh, uPathBend2, uPathK2, uPathPh2, uPathGauge, uRoad;
uniform vec2 uPathDir; uniform vec3 uPathCol; uniform vec4 uClear;
uniform vec2 uWindDir; uniform float uWind, uFlwK; uniform vec3 uFlw0, uFlw1, uFlw2;
uniform float uCityOn, uNight, uCityBuilt; uniform vec4 uCity, uCity2; uniform vec3 uCityPark;
/// Painted lines and paving joints, box-filtered over the pixel's own
/// footprint f: exact coverage near, their average far, never moire.
/// sqAA: a dash pattern of period T, duty D (bandAA, the band lo..hi, is
/// in common.glsl).
float sqI(float x, float T, float D){ return floor(x / T) * D * T + min(fract(x / T) * T, D * T); }
float sqAA(float x, float T, float D, float f){ f = max(f, 1e-3); return (sqI(x + 0.5 * f, T, D) - sqI(x - 0.5 * f, T, D)) / f; }
/// is the block centred here part of the city (its streets are drawn)?
float cityBlk(vec2 b){ float d = length(b * uCity.z); return step(uCity2.z, d) * step(d, uCity2.w); }
/// the same edge as clearAt() in the script
float clearAmt(vec3 w){
  float edge = -uClear.x + uClear.y * (sin(w.x * 0.31 + 0.7) + 0.6 * sin(w.x * 0.83 + 2.1));
  return uClear.w > 0.5 ? smoothstep(edge - uClear.z, edge + uClear.z, w.z) : 0.0;
}
/// the same frame and sum as pathOff() in the script
/// (along it, distance from its middle)
vec2 pathUV(vec3 w){
  vec2 d = w.xz - vec2(uPathX, uPathZ);
  float u = d.x * uPathDir.x - d.y * uPathDir.y, v = d.x * uPathDir.y + d.y * uPathDir.x;
  float vc = uPathBend * (sin(u * 0.0042 + uPathPh) - sin(uPathPh)) + uPathBend2 * (sin(u * uPathK2 + uPathPh2) - sin(uPathPh2));
  float dv = uPathBend * 0.0042 * cos(u * 0.0042 + uPathPh) + uPathBend2 * uPathK2 * cos(u * uPathK2 + uPathPh2);
  return vec2(u, abs(v - vc) * inversesqrt(1.0 + dv * dv));
}
float pathAmt(vec3 w){
  if (uPathW < 0.01) return 0.0;
  float off = pathUV(w).y;
  if (uPathGauge > 0.01) off = min(abs(off - uPathGauge * 0.5), abs(off + uPathGauge * 0.5));
  float e = max(fwidth(w.x), fwidth(w.z)) * 0.5;
  return 1.0 - smoothstep(uPathW - e, uPathW * 1.5 + e, off);
}
uniform vec3 uCamPos, uZenith, uHorizon, uCloudL, uCloudD;
varying vec3 vW; varying vec3 vN; varying float vFog;
#include "common.glsl"
void main(){
  if (vW.z > -0.18) discard;                       /* nothing of the outside exists indoors */
  vec3 c = texture2D(uTex, vW.xz * 0.038).rgb, c0 = c;
  /// the pixel's footprint on the ground, across both axes: one of them
  /// alone stays small along a line of sight down that axis
  float fwW = max(fwidth(vW.x), fwidth(vW.z));
  /// the broad octave turned through an irrational angle and shifted, so
  /// its repeats never line up with the fine one's; and a third, a
  /// kilometre and a half across, for drier and lusher stretches
  vec2 rxz = vec2(vW.x * 0.8269 - vW.z * 0.5623, vW.x * 0.5623 + vW.z * 0.8269);
  vec3 c2 = texture2D(uTex, rxz * 0.0052 + vec2(0.31, 0.17)).rgb;
  c = mix(c, c2, 0.5);
  vec3 cM = texture2D(uTex, vW.zx * 0.0007 + vec2(0.17, 0.53)).rgb;
  float macro = clamp((cM.g - c2.g) * 1.6, -0.12, 0.12);
  c *= 1.0 + macro;
  c = mix(c, c * vec3(1.06, 1.01, 0.86), clamp(macro * 6.0, 0.0, 1.0) * 0.5);
  /// close up, a third octave of grain so the foreground is not a smooth wash
  float near = 1.0 - smoothstep(6.0, 26.0, length(uCamPos - vW));
  /// sampled unconditionally: inside a per-pixel branch the mip level is
  /// undefined and some GPUs pick a different one every frame
  vec3 fine = texture2D(uTex, vW.xz * 0.62 + vec2(0.77)).rgb;
  vec3 grit = texture2D(uTex, vW.xz * 2.10 + vec2(0.19)).rgb;
  if (near > 0.01) {
    c = mix(c, c * (0.72 + 0.56 * fine.g), near * 0.55);
    float grazing = 1.0 - smoothstep(0.15, 0.55, abs(normalize(uCamPos - vW).y));
    c = mix(c, c * (0.82 + 0.38 * grit.r), near * 0.34 * (1.0 - grazing * 0.55));
  }
  /// hand over from blades to ground across the band where the blades are
  /// shrinking away, so there is no seam
  float dC = length(uCamPos - vW);
  float handover = smoothstep(11.0, 34.0, dC);
  float grows = uCoverK * smoothstep(uCoverMinY - 0.2, uCoverMinY + 0.3, vW.y) * (1.0 - smoothstep(uPlantY.x, uPlantY.y, vW.y + 6.0 * (c2.g - cM.g)));
  c = mix(c, uCoverCol * (0.72 + 0.5 * c.g), max(handover * 0.62, uCoverNear) * grows);
  /// Past the blades the field is still alive: where a gust lays the grass
  /// over, the paler undersides and tips catch the light at a glancing
  /// angle, in the same patches that sweep the near blades.
  float graze = 1.0 - smoothstep(0.06, 0.45, abs(normalize(uCamPos - vW).y));
  float fieldK = grows * handover;
  float gw = gustWave(vW.xz, uWindDir, uTime, 0.061, 0.62, 2.1);
  c = mix(c, uTip * 1.05, fieldK * graze * 0.28 * (0.5 + 0.5 * gw) * clamp(0.35 + 0.6 * uWind, 0.0, 1.0));
  /// flowers past drawing range: a speckle of their colours in patches,
  /// which blurs to a tint once a speckle is smaller than a pixel
  float fPatch = smoothstep(0.48, 0.80, vn(vW.xz * 0.045 + 7.3)) * uFlwK * grows;
  vec2 fc = floor(vW.xz * 3.0);
  float fh = h2(fc), fpick = h2(fc + 17.0);
  float kF = 1.0 - smoothstep(0.30, 0.85, fwW * 3.0);
  vec3 fcol = fpick < 0.34 ? uFlw0 : (fpick < 0.67 ? uFlw1 : uFlw2);
  vec3 favg = (uFlw0 + uFlw1 + uFlw2) / 3.0;
  float fOn = mix(0.32, step(0.68, fh), kF) * fPatch * smoothstep(14.0, 26.0, dC);
  c = mix(c, mix(favg, fcol, kF) * (0.75 + 0.25 * c.g / max(c.g, 0.05)), fOn * 0.7);
  /// Farmed country from a distance is a patchwork: fields of different
  /// crops and states inside hedge lines, and woods in the valleys and on
  /// the slopes too steep to plough. Parcels on a warped grid; the hedge
  /// lines fade out once they are finer than a pixel.
  float slope0 = clamp(1.0 - vN.y, 0.0, 1.0);
  if (uPatch > 0.5) {
    float pk = smoothstep(110.0, 260.0, length(vW.xz)) * grows;
    vec2 pr = vec2(vW.x * 0.866 - vW.z * 0.5, vW.x * 0.5 + vW.z * 0.866) / 130.0;
    pr += (cM.rb + c2.gr) * 0.7;
    vec2 cell = floor(pr), fc2 = fract(pr);
    float tC = h2(cell + 3.7);
    vec3 tone = tC < 0.30 ? uCoverCol * 0.80 : (tC < 0.50 ? mix(uCoverCol, uDryC, 0.7) : (tC < 0.62 ? uPathCol * 0.92 : uCoverCol * 1.06));
    float edge = min(min(fc2.x, 1.0 - fc2.x), min(fc2.y, 1.0 - fc2.y));
    float wE = fwidth(pr.x) + fwidth(pr.y);
    float kE = 1.0 - smoothstep(0.30, 0.85, wE * 40.0);
    float hedgeL = (1.0 - smoothstep(0.004, 0.012 + wE, edge)) * kE;
    float wood = smoothstep(0.66, 0.80, (cM.g + c2.b) * 0.9 + slope0 * 1.4);
    c = mix(c, tone * (0.85 + 0.3 * c.g / max(c.g, 0.05)), pk * 0.42);
    c = mix(c, uWoodCol * (0.75 + 0.5 * c2.g), pk * max(hedgeL * 0.75, wood * 0.85));
  }
  float far = smoothstep(30.0, 240.0, length(vW.xz));
  c = mix(c, mix(c, uTip * 0.82, 0.35), far);
  /// bumpiness close in. Sampled unconditionally — inside a branch the mip
  /// level is undefined and some drivers pick a different one every frame.
  float e = 0.06;
  float hx = texture2D(uTex, (vW.xz + vec2(e, 0.0)) * 0.62 + vec2(0.77)).g - fine.g;
  float hz = texture2D(uTex, (vW.xz + vec2(0.0, e)) * 0.62 + vec2(0.77)).g - fine.g;
  vec3 N2 = normalize(vN + vec3(-hx, 0.0, -hz) * 1.6 * near);
  /// Dunes. The mesh is metres across close in and tens of metres out, too
  /// coarse to hold a brink, so the light follows the dune field itself:
  /// its own normal, until a dune is only a few pixels long and the mesh's
  /// average takes over. Brinks are paler, troughs darker and coarser,
  /// slip faces smooth fresh sand. Wind ripples, a hand's width apart, on
  /// the windward slopes only (a slip face is avalanched smooth), show
  /// when the sun is low across them; faded with their own footprint.
  float onPath = pathAmt(vW);
  float slip = 0.0, duneY = 0.5, kDn = 0.0;
  if (uDuneA.x > 0.01) {
    vec4 dg = duneG(vW.xz, duneY);
    float fwD = fwidth(dg.w), fD = fract(dg.w), rD = 1.0 - uDuneD.w;
    /// a wash levels the dunes across it (ergDuneAt), so their light goes too
    kDn = (1.0 - smoothstep(0.03, 0.25, fwD)) * (1.0 - 0.9 * uWash * smoothstep(0.0, 0.6, onPath));
    float eD = max(fwD * 1.5, 1e-4);
    slip = mix(uDuneD.w, clamp((fD - rD) / eD + 0.5, 0.0, 1.0) * clamp((1.0 - fD) / eD + 0.5, 0.0, 1.0), kDn);
    duneY = mix(0.5, duneY, kDn);
    vec3 nD = normalize(vec3(-dg.y, 1.0, -dg.z));
    N2 = normalize(N2 + (nD - vN) * kDn * smoothstep(uDuneR.x, uDuneR.x + 20.0, length(vW.xz)));
    c *= 0.90 + 0.18 * duneY;
    c = mix(c, uHigh * (0.85 + 0.3 * c2.g), smoothstep(0.75, 1.0, duneY) * (1.0 - slip) * 0.30);
    c = mix(c, c2 * 1.05, slip * 0.55);
    c = mix(c, c * (0.80 + 0.36 * grit.r), (1.0 - duneY) * 0.5 * near);
  }
  if (uRip.x > 0.5) {
    float ru = dot(vW.xz, uRip.yz), rv = dot(vW.xz, vec2(-uRip.z, uRip.y));
    float rp = ru / 0.11 + 2.4 * vn(vec2(rv * 0.4, ru * 0.07)) + 0.7 * sin(rv * 0.83);
    float kR = 1.0 - smoothstep(0.30, 0.85, fwidth(rp));
    float rs = cos(6.2832 * rp) + 0.35 * cos(12.566 * rp);
    float onR = kR * (1.0 - slip) * smoothstep(0.88, 0.97, vN.y + 0.06) * smoothstep(uWaterY + 0.5, uWaterY + 1.2, vW.y);
    /// stronger in some patches than others, as the last wind left them
    onR *= 0.25 + 0.75 * smoothstep(0.35, 0.75, vn(vW.xz * 0.21 + 3.7));
    N2 = normalize(N2 - vec3(uRip.y, 0.0, uRip.z) * rs * 0.075 * onR);
  }
  if (uRowSp > 0.01) {
    float perp = dot(vW.xz, uRowDir);
    float band = abs(fract(perp / uRowSp + 0.5) - 0.5) * 2.0;
    /// band-limited, so rows blur to an average once finer than a pixel
    /// rather than turning to moire near the horizon
    float kRow = 1.0 - smoothstep(0.30, 0.85, fwidth(perp) / uRowSp);
    float onRow = 1.0 - smoothstep(0.18, 0.62, band);
    /// the drawn rows come up under the planted ones and take over as they
    /// thin out, so there is no line where one stops and the other starts
    float grow = smoothstep(12.0, 26.0, length(uCamPos - vW));
    c = mix(c, mix(uRowSoil, uRowCol, onRow), grow * kRow * 0.72);
  }
  /// earth grit: a coarse and a fine octave, the fine one faded out once its
  /// cells are smaller than a pixel so it cannot shimmer
  float kG = 1.0 - smoothstep(0.30, 0.85, fwW * 6.0), kG1 = 1.0 - smoothstep(0.30, 0.85, fwW * 1.3);
  float dirt = mix(0.5, vn(vW.xz * 1.3), kG1) * 0.55 + mix(0.5, vn(vW.xz * 6.0 + 17.0), kG) * 0.45;
  /// A lane: tarmac with a broken, crumbling edge, a strip of worn verge
  /// beside it, paler wheel tracks, a dashed line down the middle. Its
  /// lines are box-filtered by the pixel's footprint.
  if (uRoad > 0.5) {
    vec2 pu = pathUV(vW);
    float fr = fwW;
    float hw = uPathW + (vn(vec2(pu.x * 0.35, 3.1)) - 0.5) * 0.35 + (vn(vec2(pu.x * 1.7, 9.2)) - 0.5) * 0.14;
    float onR = clamp((hw - pu.y) / fr + 0.5, 0.0, 1.0);
    float verge = clamp((hw + 1.0 - pu.y) / fr + 0.5, 0.0, 1.0) * (1.0 - onR);
    float kAg = 1.0 - smoothstep(0.30, 0.85, fr * 6.0);
    float ag = mix(0.5, h2(floor(vW.xz * 6.0)), kAg);
    vec3 tar = vec3(0.17, 0.17, 0.175) * (0.80 + 0.28 * ag + 0.30 * (dirt - 0.5) + 0.2 * (c2.g - cM.g));
    float lcR = abs(pu.y - 0.5 * uPathW);
    tar *= 1.0 + 0.10 * bandAA(lcR, 0.55, 1.15, fr) - 0.08 * bandAA(lcR, 0.0, 0.40, fr);
    tar = mix(tar, vec3(0.62, 0.62, 0.60) * (0.75 + 0.25 * ag), sqAA(pu.x, 9.0, 0.33, fr) * bandAA(pu.y, 0.0, 0.06, fr) * 0.85);
    c = mix(c, c * vec3(0.70, 0.68, 0.62), verge * 0.8);
    c = mix(c, tar, onR);
    onPath = 0.0;
  }
  /// a dry wash is floored with sand and gravel the floods have sorted
  /// and the sun bleached, paler than the ground it cuts
  vec3 pathC = mix(uPathCol * (0.80 + 0.36 * dirt), mix(vec3(0.80, 0.74, 0.64), uPathCol, 0.3) * (0.82 + 0.30 * dirt + 0.16 * grit.r * near), uWash);
  if (onPath > 0.001) c = mix(c, pathC, onPath * 0.88);
  /// A city's streets, on its grid: asphalt with paler polished wheel tracks
  /// and oil down the lanes, a gutter, painted centre and lane lines,
  /// zebra crossings set back from each junction and a stop line, paved
  /// pavements with a pale kerb, paved block interiors and now and then a
  /// green courtyard. Every line is box-filtered by its footprint. No
  /// texture is read in here: the noise is what was fetched above. At
  /// night the street lamps lay pools of light along the pavements.
  float pool = 0.0;
  if (uCityOn > 0.5) {
    vec2 gq = vec2(vW.x * uCity.x + vW.z * uCity.y, -vW.x * uCity.y + vW.z * uCity.x);
    vec2 blk = floor(gq / uCity.z + 0.5), lq = gq - blk * uCity.z, sg = sign(lq);
    vec2 e = abs(lq) - 0.5 * uCity.w;
    float zone = max(cityBlk(blk), max(step(0.0, e.x) * cityBlk(blk + vec2(sg.x, 0.0)),
                 max(step(0.0, e.y) * cityBlk(blk + vec2(0.0, sg.y)), step(0.0, min(e.x, e.y)) * cityBlk(blk + sg))));
    zone *= smoothstep(uWaterY + 0.6, uWaterY + 1.0, vW.y);
    float sw = uCity2.x, sk = uCity2.y, rw = sw - 2.0 * sk, mid = 0.5 * sw;
    bool ns = e.x > e.y;
    float ac = ns ? e.x : e.y, al = ns ? gq.y : gq.x, ot = ns ? e.y : e.x;
    float fq = max(fwidth(gq.x), fwidth(gq.y));
    float kAgg = 1.0 - smoothstep(0.30, 0.85, fq * 6.0);
    float agg = mix(0.5, h2(floor(vW.xz * 6.0)), kAgg);
    float dc = abs(ac - mid), wide = step(12.0, rw);
    float lw = mix(rw * 0.5, rw * 0.25, wide), lc = abs(fract(dc / lw) * lw - 0.5 * lw);
    vec3 road = vec3(0.115, 0.117, 0.122) * (0.80 + 0.28 * agg + 0.30 * (dirt - 0.5) + 0.25 * (c2.g - cM.g));
    road *= (1.0 + 0.10 * bandAA(lc, 0.55, 1.15, fq) - 0.10 * bandAA(lc, 0.0, 0.40, fq)) * (1.0 - 0.22 * bandAA(ac, sk, sk + 0.45, fq));
    float inter = smoothstep(-fq, fq, ot);
    float centre = mix(sqAA(al, 9.0, 0.38, fq) * bandAA(dc, 0.0, 0.075, fq), bandAA(dc, 0.07, 0.19, fq), wide);
    float laneL = wide * sqAA(al + 3.0, 9.0, 0.33, fq) * bandAA(abs(dc - lw), 0.0, 0.07, fq);
    float zeb = bandAA(ot, -4.6, -1.2, fq);
    float stripes = sqAA(ac - sk - 0.3, 1.1, 0.5, fq) * zeb;
    float appr = abs(step(mid, ac) - step(0.0, sg.x * sg.y));
    float stopL = bandAA(ot, -5.9, -5.45, fq) * appr;
    float mk = clamp((centre + laneL) * (1.0 - zeb) * (1.0 - inter) + stripes + stopL * (1.0 - inter), 0.0, 1.0) * step(sk, ac);
    road = mix(road, vec3(0.60, 0.60, 0.58) * (0.78 + 0.25 * agg), mk * 0.92);
    /// pavement slabs a metre and a half square, a kerb of pale stone
    vec3 pav = vec3(0.43, 0.42, 0.40) * (0.88 + 0.22 * dirt + 0.10 * (fine.g - 0.5) * kAgg);
    float jt = max(1.0 - sqAA(al, 1.5, 0.94, fq), 1.0 - sqAA(ac, 1.5, 0.94, fq));
    pav *= 1.0 - 0.22 * jt;
    vec3 plaza = vec3(0.37, 0.36, 0.34) * (0.86 + 0.26 * dirt) * (1.0 - 0.16 * max(1.0 - sqAA(gq.x, 3.0, 0.97, fq), 1.0 - sqAA(gq.y, 3.0, 0.97, fq)));
    float court = step(h2(blk + 11.0), 0.14) * smoothstep(-2.5, -3.5, ac);
    plaza = mix(plaza, uCityPark * (0.70 + 0.45 * dirt) * (1.0 - 0.45 * smoothstep(0.55, 0.75, vn(gq * 0.11 + blk))), court);
    vec3 cc = mix(pav, road, clamp((ac - sk) / fq + 0.5, 0.0, 1.0));
    cc = mix(cc, vec3(0.58, 0.57, 0.54) * (0.85 + 0.2 * agg), bandAA(ac, sk - 0.18, sk, fq));
    /// the ring of blocks just short of the city keeps its own ground
    /// inside the kerb: a park or a garden with a street round it
    float inB = clamp(-ac / fq + 0.5, 0.0, 1.0), built = step(uCityBuilt, length(blk * uCity.z));
    cc = mix(cc, plaza, inB);
    c = mix(c, cc, zone * (1.0 - inB * (1.0 - built)));
    /// a lamp every CITY_LAMP m down each pavement, staggered across the street
    float la = (fract((al + {{LAMP_HALF}} * step(0.0, ns ? sg.x : sg.y)) / {{LAMP}}) - 0.5) * {{LAMP}}, lx = ac - sk + {{LAMP_IN}};
    float r2 = la * la + lx * lx;
    pool = zone * step(-2.0, ac) * (exp(-r2 / 50.0) * 0.45 + exp(-r2 / 9.0) * 0.8);
  }
  /// the kept ground: a lawn mown in stripes, pale gravel, a bare yard, or a
  /// damp bank. The stripes fade once finer than a pixel.
  float inClear = clearAmt(vW);
  float kM = 1.0 - smoothstep(0.30, 0.85, fwW * 0.56);
  /// outside the branch: derivatives in one are undefined
  if (inClear > 0.001) {
    vec3 lawn = uCoverCol * (0.80 + 0.30 * fine.g) * (1.0 + 0.07 * sin(vW.x * 3.49) * kM);
    vec3 gravel = mix(vec3(0.60, 0.58, 0.54), uPathCol, 0.35) * (0.74 + 0.30 * dirt + 0.22 * grit.r * near);
    vec3 yard = uPathCol * (0.82 + 0.34 * dirt);
    vec3 kept = uClear.w < 1.5 ? lawn : (uClear.w < 2.5 ? gravel : (uClear.w < 3.5 ? yard : c * 0.80));
    c = mix(c, kept, inClear * (uClear.w < 1.5 ? 0.55 : 0.9));
  }
  /// Desert pavement: the wind has taken the fines and left the stones,
  /// packed edge to edge and dark with varnish, in patches between bare
  /// sandy ground. Stones a few centimetres across on a jittered lattice,
  /// averaged to their mean tone once smaller than a pixel.
  if (uPave > 0.5) {
    vec2 pq = vW.xz * 21.0, pc = floor(pq), pf = fract(pq) - 0.5;
    float pa = h2(pc + 5.1), pr = 0.24 + 0.18 * h2(pc + 9.7);
    vec2 pj = (vec2(h2(pc + 1.3), h2(pc + 2.9)) - 0.5) * 0.28;
    float kP = 1.0 - smoothstep(0.30, 0.85, max(fwidth(pq.x), fwidth(pq.y)));
    float peb = mix(0.42, (1.0 - smoothstep(pr - 0.07, pr + 0.07, length(pf - pj))) * step(0.3, pa), kP);
    vec3 varn = mix(vec3(0.17, 0.11, 0.08), vec3(0.42, 0.36, 0.30), pa * pa) * (0.9 + 0.2 * dirt);
    float pv = smoothstep(0.38, 0.62, cM.g * 0.6 + c2.r * 0.5 + dirt * 0.3 - 0.2) * (1.0 - onPath) * (1.0 - smoothstep(0.10, 0.25, slope0));
    c = mix(c, varn, peb * pv * 0.85);
    c *= 1.0 - 0.10 * pv * kP * (1.0 - peb);
  }
  /// Beds of rock (bedTable), each its own colour, with a darker parting
  /// between them; the heights wander a little so the lines are not
  /// ruled. The walls were shaped from the same table, so a cliff is a
  /// hard bed and a bench sits on one. The parting fades with footprint.
  vec3 bedC = uRock; float bedOn = 0.0, hardB = 0.0;
  /// A salt pan dries into polygons a metre or two across, their edges
  /// pushed up into pale ridges by the crystals growing under them, with
  /// a hairline crack along each. Cellular (the two nearest of a jittered
  /// set of points), faded out once a polygon is a few pixels across.
  float saltH = 0.0;
  if (uSalt > 0.5) {
    vec2 sp = vW.xz / 1.5 + vec2(0.37 * sin(vW.z * 0.21), 0.37 * sin(vW.x * 0.19));
    vec2 sc = floor(sp), sf = fract(sp);
    float fe = fwidth(sp.x) + fwidth(sp.y);
    float kC = 1.0 - smoothstep(0.12, 0.45, fe);
    /// past the band limit nothing below reads the cells (every use is
    /// weighted by kC), so the nine-cell search is skipped
    float d1 = 8.0, d2 = 8.0;
    if (kC > 0.0) {
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 sg = vec2(float(i), float(j));
        float dd = length(sg + vec2(h2(sc + sg), h2(sc + sg + 19.7)) * 0.8 + 0.1 - sf);
        if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) { d2 = dd; }
      }
    }
    float se = d2 - d1;
    float rim = 1.0 - smoothstep(0.0, 0.16 + fe, se);
    float crack = 1.0 - smoothstep(0.0, 0.02 + fe * 0.5, se);
    saltH = rim * kC * 0.035;
    c = mix(c, c * (1.10 + 0.08 * h2(sc)), mix(0.18, rim, kC) * 0.7);
    c *= 1.0 - kC * (0.18 * crack + 0.05 * h2(sc + 3.3));
  }
  if (uStrata > 0.5) {
    float yb = vW.y + 0.3 * sin(vW.x * 0.011 + 1.3) + 0.25 * sin(vW.z * 0.017 + 0.4);
    float partD = 1e3;
    for (int i = 0; i < 16; i++) {
      if (yb > uBedY[i]) { bedC = uBedC[i]; hardB = uBedH[i]; }
      partD = min(partD, abs(yb - uBedY[i]));
      /// the beds rise in order (the padding is at 1e6): once one starts
      /// above this point every later one does, and none is nearer
      if (yb <= uBedY[i]) break;
    }
    float kS = 1.0 - smoothstep(0.30, 0.85, fwidth(yb) * 1.5);
    /// A canyon's soft beds weather back to slopes of a third or a half,
    /// which the slope test alone left as plain sand: every wall between
    /// the floor and the rim is the rock it is cut through
    float inWall = step(0.5, uCan1.w) * smoothstep(uFloorY + 0.8, uFloorY + 2.6, vW.y) * (1.0 - smoothstep(-4.0, -1.0, yb));
    bedOn = max(smoothstep(0.05, 0.22, slope0), inWall) * step(uBedY[0], yb);
    bedC = mix(bedC, uRock * 1.15, 0.3);
    c = mix(c, bedC * (0.90 + 1.2 * (c2.g - cM.g) + 0.2 * (dirt - 0.5)), bedOn * 0.9);
    c *= 1.0 - 0.24 * (1.0 - smoothstep(0.0, 0.3 + 1.5 * fwidth(yb), partD)) * kS * bedOn;
  }
  float slope = slope0;
  /// Rock. Soil does not hold much past forty degrees, so steep ground is
  /// bare rock wherever it is, and above the rock line on gentler slopes
  /// too; below steep faces the rubble they shed lies as paler scree.
  /// The rock is textured from the side (two taps, blended by which way
  /// the face looks) instead of the ground texture stretched down it,
  /// with gullies running down the fall line and darker joints.
  float steep = smoothstep(0.17, 0.34, slope + (c2.g - cM.g) * 0.5);
  float high = smoothstep(uRockLine - 8.0, uRockLine + 22.0, vW.y);
  float rockW = max(max(steep * 0.92, high * (0.35 + 0.65 * smoothstep(0.08, 0.28, slope))), high * uSalt) * (1.0 - uSand);
  /// one tap, projected on the face itself: across it horizontally, and
  /// up it, stretched down the fall line so it draws gullies
  vec2 fN = normalize(vN.xz + vec2(1e-4, 0.0));
  /// bedded rock is laminated across the face, not grooved down it
  vec2 bb = texture2D(uTex, vec2(dot(vW.xz, vec2(-fN.y, fN.x)), vW.y) * mix(vec2(0.031, 0.012), vec2(0.009, 0.075), uStrata) + vec2(0.4, 0.1)).gr;
  /// where the face levels off (a crest, a bench) the face's own
  /// direction is undefined and flips across it: hand over to the
  /// ground's top-down first tap, already fetched
  bb = mix(c0.gr, bb, smoothstep(0.04, 0.20, length(vN.xz)));
  float rmod = bb.x;
  float gully = smoothstep(0.08, 0.2, bb.x - bb.y);
  vec3 rockC = (uStrata > 0.5 ? bedC * mix(1.06, 0.90, hardB) : uRock) * (0.70 + 0.65 * rmod) * (1.0 - 0.26 * gully) * (1.0 - 0.22 * smoothstep(0.42, 0.22, rmod));
  /// desert varnish: dark streaks down the cliffs where water runs off
  /// the rim, heaviest on the hard beds; their mean once too fine
  if (uStrata > 0.5) {
    vec2 vq = vec2(dot(vW.xz, vec2(-fN.y, fN.x)) * 0.32, vW.y * 0.028 + hardB * 3.7);
    float kV = 1.0 - smoothstep(0.30, 0.85, max(fwidth(vq.x), fwidth(vq.y)) * 2.0);
    float vs = mix(0.22, smoothstep(0.5, 0.8, vn(vq) * 0.7 + vn(vq * 3.1 + 5.0) * 0.3), kV);
    rockC = mix(rockC, vec3(0.12, 0.075, 0.05), vs * 0.6 * (0.45 + 0.55 * hardB));
  }
  c = mix(c, rockC, rockW);
  float scree = smoothstep(0.05, 0.13, slope) * (1.0 - steep) * max(high, smoothstep(uRockLine - 40.0, uRockLine, vW.y) * 0.6) * step(uRockLine, 1e5);
  c = mix(c, uRock * 1.12 * (0.82 + 0.36 * dirt), scree * 0.55);
  /// the rock has relief: a gentle bump from the same side texture, by
  /// its screen-space slope (no extra fetch), only where rock shows
  vec3 dpx = dFdx(vW), dpy = dFdy(vW);
  float hb = rmod * 7.0;
  vec3 r1 = cross(dpy, vN), r2 = cross(vN, dpx);
  float det = dot(dpx, r1);
  vec3 sg = sign(det) * (dFdx(hb) * r1 + dFdy(hb) * r2);
  vec3 Nb = normalize(abs(det) * vN - sg);
  /// the bump is the texture's slope per pixel, so it fades once a pixel
  /// spans more than the grain it was cut from
  N2 = normalize(mix(N2, Nb, rockW * 0.8 * step(1e-9, abs(det)) * (1.0 - smoothstep(0.30, 0.85, fwW * 0.6))));
  if (uSalt > 0.5) {
    vec3 sgS = sign(det) * (dFdx(saltH) * r1 + dFdy(saltH) * r2);
    N2 = normalize(mix(N2, normalize(abs(det) * vN - sgS), 0.8 * step(1e-9, abs(det))));
  }
  c = mix(c, uHigh, smoothstep(uSnowLine, uSnowLine + 34.0, vW.y) * (1.0 - smoothstep(0.30, 0.62, slope)));
  /// The canyon's inner channel, on the same curve as the heightfield,
  /// drawn here rather than cut into a mesh too coarse to hold it: a
  /// river of silty water with bars of pale sand and gravel standing in
  /// it, or a dry wash of the same bleached gravel. Edges by footprint.
  float rivM = 0.0, rivS = 0.0;
  if (uCan1.w > 0.5) {
    float ca_ = vW.x * uCan1.x - vW.z * uCan1.y, cp_ = vW.x * uCan1.y + vW.z * uCan1.x + uCan1.z;
    float cxA = uCan2.x * (sin(ca_ * 0.0026 + uCan2.y) - sin(uCan2.y)) + sin(ca_ * 0.011 + uCan2.y * 2.0) * uCan1.w * 0.10;
    float dq = abs(cp_ - cxA - sin(ca_ * 0.0071 + uCan2.w) * max(uCan1.w - uCan2.z * 1.6, 0.0) * 0.6);
    float fq = fwidth(dq) + 0.05;
    float onFloor = 1.0 - smoothstep(0.6, 2.0, vW.y - uFloorY);
    float bar = smoothstep(0.58, 0.72, vn(vec2(ca_ * 0.016, cp_ * 0.05) + 3.3)) * smoothstep(0.2, 0.7, dq / uCan2.z);
    float chanD = dq / uCan2.z + 0.15 * (vn(vec2(ca_ * 0.03, 1.7)) - 0.5);
    float wash = (1.0 - smoothstep(1.05 - fq / uCan2.z, 1.05 + fq / uCan2.z, chanD)) * onFloor;
    c = mix(c, mix(vec3(0.80, 0.74, 0.64), uPathCol, 0.3) * (0.80 + 0.36 * dirt), wash * 0.85);
    rivM = uRiver * onFloor * (1.0 - smoothstep(0.85 - fq / uCan2.z, 0.85 + fq / uCan2.z, chanD)) * (1.0 - bar);
    c *= 1.0 - 0.35 * uRiver * wash * (1.0 - rivM);
    /// the wet margin
    rivS = vn(vec2(ca_ * 0.05 - uTime * 0.7, cp_ * 0.45)) * (1.0 - smoothstep(0.3, 0.85, max(fwidth(ca_) * 0.05, fwidth(cp_) * 0.45)));
  }
  /// The shore. Ground the water has just left, or laps over, is dark with
  /// it and takes a sheen of sky (below), in a band whose width wanders
  /// along the water and is widest on a beach; the bed under the surface
  /// is darker still, and the water drawn over it does the rest. On the
  /// sea the last of each wave runs up the sand as a lace of foam, and the
  /// highest of them leave a dark line of wrack.
  float above = vW.y - uWaterY;
  float eY = fwidth(vW.y);
  float shore = 1.0 - smoothstep(0.0, (0.35 + 0.8 * dirt) * (1.0 + uBeach * 0.6), above);
  float under = 1.0 - smoothstep(-0.06, 0.02, above);
  float runUp = 0.10 + 0.26 * (0.5 + 0.5 * sin(uTime * 0.47 + vW.x * 0.05));
  float lace = uSwash * (1.0 - smoothstep(0.0, 0.05 + eY, abs(above - runUp))) * smoothstep(0.35, 0.7, dirt) * (1.0 - under);
  float wrack = uSwash * (1.0 - smoothstep(0.0, 0.04 + eY, abs(above - 0.44 - 0.06 * dirt))) * (1.0 - smoothstep(0.02, 0.12, eY));
  c *= (1.0 - 0.36 * shore - 0.16 * under) * (1.0 - 0.35 * wrack);
  c = mix(c, vec3(0.86, 0.89, 0.89), lace * 0.75);
  /// After rain the ground darkens (water fills the pores) and takes a sheen
  /// of sky at a glancing angle; level ground holds puddles. The mirror is
  /// the sky only, on the geometric normal, not the bumped one, which
  /// would sparkle. The puddle mask reuses the snow-lie noise fetch.
  float lieN = texture2D(uTex, vW.xz * 0.011 + vec2(0.5)).r;
  float pud = uWet * uPuddle * smoothstep(0.975, 0.995, vN.y) * smoothstep(0.60, 0.66, lieN);
  c *= 1.0 - uWet * 0.32 - pud * 0.25;
  vec2 bk = bakedRG(vW.xz);
  float sh = mix(1.0 - uShadow, 1.0, cloudShade(vW.xz, uTime)) * mix(0.03, 1.0, bk.x);
  float diff = max(dot(N2, normalize(uSunDir)), 0.0);
  vec3 light = bk.y * hemi(N2, uAmbCol * 1.15) + uSunCol * diff * 1.25 * sh;
  vec3 lit = c * light;
  lit += c * vec3(1.0, 0.80, 0.56) * pool * uNight * 1.8;
  /// looking into a low sun across grass, the blades glow with it
  lit += uSunCol * uTip * pow(max(dot(normalize(vW - uCamPos), normalize(uSunDir)), 0.0), 4.0) * graze * fieldK * 0.35 * sh * (1.0 - uSnow);
  vec3 Vw = normalize(uCamPos - vW), Rw = reflect(-Vw, vN);
  vec3 skyR = mix(horizonAt(Rw, uFogCol, uSunDir), uZenith, smoothstep(0.0, 0.6, Rw.y));
  float Fw = 0.02 + 0.98 * pow(1.0 - max(dot(vN, Vw), 0.0), 5.0);
  /// dry sand is brightest looking down-sun (each grain hides its own
  /// shadow): a broad glow round the shadow of your own head
  lit *= 1.0 + uSand * 0.22 * pow(max(dot(Vw, normalize(uSunDir)), 0.0), 6.0) * sh * (1.0 - uWet);
  /// the canyon river: silt-coloured water, the sky in it by Fresnel, a
  /// glint, and slow streaks drifting downstream
  if (rivM > 0.001) {
    vec3 Rr = reflect(-Vw, vec3(0.0, 1.0, 0.0));
    vec3 skyW = mix(horizonAt(Rr, uFogCol, uSunDir), uZenith, smoothstep(0.0, 0.6, Rr.y));
    float Fr = 0.02 + 0.98 * pow(1.0 - max(Vw.y, 0.0), 5.0);
    vec3 body = uRiverCol * (0.85 + 0.25 * rivS) * (bk.y * hemi(vec3(0.0, 1.0, 0.0), uAmbCol) + uSunCol * max(uSunDir.y, 0.0) * sh);
    vec3 wat = mix(body, skyW, Fr * 0.85) + uSunCol * pow(max(dot(Rr, normalize(uSunDir)), 0.0), 60.0) * sh * 0.5;
    lit = mix(lit, wat, rivM);
  }
  lit = mix(lit, skyR, max(uWet * mix(Fw * 0.5, 0.7, pud), shore * (1.0 - under) * Fw * 0.45));
  float up = smoothstep(0.55, 0.95, vN.y);
  /// a thin fall lies in the hollows first; a deep one covers everything
  float want = uSnow * (0.35 + 0.65 * up);
  float lie = lieN * 0.6 + texture2D(uTex, vW.xz * 0.09).r * 0.25;
  float laid = smoothstep(0.42, 0.62, lie + want * 1.25 - 0.55);
  /// hollows go a little blue, the crust has a fine grain, drifts read in the light.
  /// Lit like everything else (scaled so a clear midday matches the old flat
  /// white), so snow takes cloud and tree shadow, the dusk colour, and the night
  vec3 snowLit = uSnowCol * light * 0.82 * (0.93 + 0.11 * fine.g) * (0.96 + 0.08 * texture2D(uTex, vW.xz * 0.21 + vec2(0.31)).r);
  snowLit = mix(snowLit, snowLit * vec3(0.90, 0.94, 1.04), (1.0 - diff) * 0.6);
  lit = mix(lit, snowLit, laid * min(1.0, want * 1.5) * (1.0 - under));
  /// flooded paddies: level treads mirror the sky, which is what makes a
  /// terrace read as a rice terrace rather than a stepped lawn
  /// Past about forty metres the mesh cannot carry the steps and they melt
  /// into the slope they stand on, and the hillside read as a plain field.
  /// The risers lie on contours a tread's height apart (the melted slope
  /// passes through each riser half way up it), so the bunds are drawn on
  /// those contours and the treads between them hold water. Band-limited:
  /// where the contours crowd under a pixel the hill takes the average.
  /// Close in, where the mesh draws the real steps, the drawn bunds would
  /// only trace its grid, so they come in beyond it.
  if (uPaddy > 0.5) {
    float tu = vW.y / uStepH;
    float kT = 1.0 - smoothstep(0.30, 0.85, fwidth(tu));
    float bund = (1.0 - smoothstep(0.08, 0.22, abs(fract(tu) - 0.5))) * kT * smoothstep(22.0, 48.0, length(vW.xz));
    float level = max(1.0 - smoothstep(0.02, 0.10, slope), kT * smoothstep(40.0, 90.0, length(vW.xz))) * (1.0 - bund);
    vec3 still = mix(uFogCol, uZenith, 0.45) * 0.92;
    lit = mix(lit, mix(lit * 0.7, still, 0.8), level * 0.55);
    lit *= 1.0 - 0.38 * bund;
  }
  /// the mirage: ground seen within half a degree of the horizon, past
  /// four hundred metres, shows the sky just above it, broken along its
  /// length (uMirage, from updateWeather)
  if (uMirage > 0.01) {
    /// the ray must graze the ground itself: up a slope there is none
    float dip = dot(normalize(uCamPos - vW), normalize(vN));
    float mir = uMirage * smoothstep(400.0, 900.0, dC) * smoothstep(-0.0004, 0.0012, dip) * (1.0 - smoothstep(0.004, 0.010, dip))
      * smoothstep(0.985, 0.998, vN.y) * (1.0 - smoothstep(6.0, 14.0, vW.y - uCamPos.y));
    mir *= 0.55 + 0.45 * vn(vec2(atan(vW.x - uCamPos.x, uCamPos.z - vW.z) * 160.0, 3.7));
    lit = mix(lit, mix(uFogCol, uZenith, 0.3), mir * 0.85);
  }
  vec3 fogC = hazeAt(uFogCol, normalize(vW - uCamPos), uSunDir, uSunCol, vFog);
  gl_FragColor = vec4(mix(lit, fogC, vFog), 1.0);
  gl_FragColor.rgb = tone(gl_FragColor.rgb);
}
