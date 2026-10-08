/* ---------- a landmark in the middle distance ----------
   Something to look at that isn't landscape: a lighthouse on the headland, a
   windmill over the fields, a tower on the moor. One per world, placed off to
   one side at two to six hundred metres, and sized to read at that range. */
/* rz leans the box in its own xy plane before rot turns it about y, which is
   what a truss diagonal, an arch stone and a windmill sail need. Callers that
   leave it out get the old behaviour exactly. */
function pushBox(B, cx, cy, cz, hx, hy, hz, rot, rz) {
  var c = Math.cos(rot || 0), s = Math.sin(rot || 0), i;
  var cr = Math.cos(rz || 0), sr = Math.sin(rz || 0);
  var start = B.pos.length / 3;
  var corners = [[-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1],[-1,1,-1],[1,1,-1],[1,1,1],[-1,1,1]];
  var faces = [[0,1,2,3],[4,7,6,5],[0,4,5,1],[1,5,6,2],[2,6,7,3],[3,7,4,0]];
  var norms = [[0,-1,0],[0,1,0],[0,0,-1],[1,0,0],[0,0,1],[-1,0,0]];
  for (var f = 0; f < 6; f++) {
    var n = norms[f];
    var mx = n[0] * cr - n[1] * sr, my = n[0] * sr + n[1] * cr;
    var nx = mx * c - n[2] * s, nz = mx * s + n[2] * c;
    for (var k = 0; k < 4; k++) {
      var p = corners[faces[f][k]];
      var ax = p[0] * hx, ay = p[1] * hy, pz = p[2] * hz;
      var px = ax * cr - ay * sr, py = ax * sr + ay * cr;
      B.pos.push(cx + px * c - pz * s, cy + py, cz + px * s + pz * c);
      B.nor.push(nx, my, nz);
      B.rib.push(0);
    }
    var o = start + f * 4;
    B.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  }
}
/* a0 turns the base polygon: a four-sided cone from angle 0 is a diamond whose
   corners land on the wall faces; from pi/4 it is square to the walls */
function pushCone(B, cx, cy, cz, r, h, seg, invert, a0) {
  var start = B.pos.length / 3, i;
  a0 = a0 || 0;
  for (i = 0; i < seg; i++) {
    var a = a0 + (i / seg) * 6.2832, a2 = a0 + ((i + 1) / seg) * 6.2832;
    var x1 = Math.cos(a) * r, z1 = Math.sin(a) * r, x2 = Math.cos(a2) * r, z2 = Math.sin(a2) * r;
    var ny = r / Math.max(h, 0.001) * 0.5;
    B.pos.push(cx, cy + h, cz, cx + x1, cy, cz + z1, cx + x2, cy, cz + z2);
    for (var k = 0; k < 3; k++) { B.nor.push(Math.cos(a + 0.5) * (invert ? -1 : 1), ny, Math.sin(a + 0.5) * (invert ? -1 : 1)); B.rib.push(0); }
    var o = start + i * 3;
    B.idx.push(o, o + 1, o + 2);
  }
  /* four to six sides is a roof or a spire, its arrises sharp; more is round */
  if (seg >= 8) markSmooth(B, start);
}
/* One flat convex face, wound so it faces away from ref (a point inside the
   solid): the roofs below are built from faces, and getting each winding
   right by hand is how holes appear. */
function pushFace(B, pts, ref) {
  var a = pts[0], b = pts[1], c = pts[2];
  var ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  var flip = (a[0] - ref[0]) * nx + (a[1] - ref[1]) * ny + (a[2] - ref[2]) * nz < 0;
  var nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1, sg = flip ? -1 : 1;
  var start = B.pos.length / 3, k;
  for (k = 0; k < pts.length; k++) { B.pos.push(pts[k][0], pts[k][1], pts[k][2]); B.nor.push(nx / nl * sg, ny / nl * sg, nz / nl * sg); B.rib.push(0); }
  for (k = 1; k < pts.length - 1; k++) {
    if (flip) B.idx.push(start, start + k + 1, start + k); else B.idx.push(start, start + k, start + k + 1);
  }
}
/* A hipped roof over a hx by hz wall plate, eaves overhanging by o, every
   slope the same pitch: the ridge runs along the longer side and stops short
   of each end by the half-width. Closed underneath by a soffit, so the eaves
   seen from below are not a hole into the sky. */
function pushHipRoof(B, cx, cy, cz, hx, hz, h, o) {
  var ex = hx + o, ez = hz + o, along = ex >= ez;
  var L = along ? ex : ez, W = along ? ez : ex, rl = L - W;
  var P = function (u, y, v) { return along ? [cx + u, cy + y, cz + v] : [cx + v, cy + y, cz + u]; };
  var ref = [cx, cy + h * 0.3, cz];
  pushFace(B, [P(-L, 0, W), P(L, 0, W), P(rl, h, 0), P(-rl, h, 0)], ref);
  pushFace(B, [P(-L, 0, -W), P(L, 0, -W), P(rl, h, 0), P(-rl, h, 0)], ref);
  pushFace(B, [P(L, 0, -W), P(L, 0, W), P(rl, h, 0)], ref);
  pushFace(B, [P(-L, 0, -W), P(-L, 0, W), P(-rl, h, 0)], ref);
  pushFace(B, [P(-L, 0, -W), P(L, 0, -W), P(L, 0, W), P(-L, 0, W)], ref);
}
/* A pitched roof with its ridge along x: two slopes and a soffit. The gable
   ends are separate (pushGableEnds, given the roof's half-depth with its
   eaves, so the triangle fills the roof's section) because they are wall. */
function pushGableRoof(B, cx, cy, cz, hx, hz, h, o) {
  var ex = hx + o, ez = hz + o, ref = [cx, cy + h * 0.3, cz];
  pushFace(B, [[cx - ex, cy, cz + ez], [cx + ex, cy, cz + ez], [cx + ex, cy + h, cz], [cx - ex, cy + h, cz]], ref);
  pushFace(B, [[cx - ex, cy, cz - ez], [cx + ex, cy, cz - ez], [cx + ex, cy + h, cz], [cx - ex, cy + h, cz]], ref);
  pushFace(B, [[cx - ex, cy, cz - ez], [cx + ex, cy, cz - ez], [cx + ex, cy, cz + ez], [cx - ex, cy, cz + ez]], ref);
}
function pushGableEnds(B, cx, cy, cz, hx, hz, h) {
  var ref = [cx, cy + h * 0.3, cz];
  for (var sd = -1; sd <= 1; sd += 2)
    pushFace(B, [[cx + sd * hx, cy, cz - hz], [cx + sd * hx, cy, cz + hz], [cx + sd * hx, cy + h, cz]], ref);
}
function pushCyl(B, cx, cy, cz, r0, r1, h, seg) {
  var start = B.pos.length / 3, i;
  for (i = 0; i <= seg; i++) {
    var a = (i / seg) * 6.2832, ca = Math.cos(a), sa = Math.sin(a);
    B.pos.push(cx + ca * r0, cy, cz + sa * r0); B.nor.push(ca, 0.1, sa); B.rib.push(i / seg);
    B.pos.push(cx + ca * r1, cy + h, cz + sa * r1); B.nor.push(ca, 0.1, sa); B.rib.push(i / seg);
  }
  for (i = 0; i < seg; i++) {
    var o = start + i * 2;
    B.idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
  }
  markSmooth(B, start);
}

var LANDMARKS = {
  lighthouse: { biomes: ['coast', 'cliffcoast', 'lakefront', 'fjord'], scale: [14, 22], body: '#ece7dd', trim: '#8f3a32', lit: true },
  windmill:   { biomes: ['farmland', 'meadow', 'flowerfield', 'moor', 'lavender', 'hayfield'], scale: [11, 17], body: '#e6ddc8', trim: '#5a4636' },
  tower:      { biomes: ['moor', 'alpine', 'terraces', 'autumn', 'tundra', 'cliffcoast'], scale: [10, 18], body: '#8d867a', trim: '#6d675c' },
  barn:       { biomes: ['farmland', 'orchard', 'blossom', 'meadow', 'savanna', 'hayfield'], scale: [7, 11], body: '#7a3f31', trim: '#6b6259', smoke: [-0.33, 0.88] },
  house:      { biomes: ['moor', 'meadow', 'farmland', 'autumn', 'hayfield', 'lavender', 'river', 'tundra'], scale: [7, 10], body: '#a2988a', trim: '#5f544a' },
  smokestack: { biomes: ['moor', 'farmland', 'urban', 'hayfield', 'river', 'marsh'], scale: [16, 26], body: '#8a5a44', trim: '#6b4636', smoke: [0, 0.95] },
  silo:       { biomes: ['farmland', 'orchard'], scale: [9, 14], body: '#b9b3a4', trim: '#8a857a' },
  cabin:      { biomes: ['alpine', 'lakefront', 'river', 'autumn', 'tundra', 'marsh'], scale: [5, 8], body: '#6b543c', trim: '#4a3a2a', smoke: [-0.24, 0.82] },
  pagoda:     { biomes: ['terraces'], scale: [8, 13], body: '#7d4a3a', trim: '#3f3630' },
  watertank:  { biomes: ['desert', 'saltflat', 'savanna', 'farmland', 'hayfield'], scale: [8, 12], body: '#9aa0a2', trim: '#6f7476' },
  jetty:      { biomes: ['lakefront', 'coast', 'marsh', 'river'], scale: [6, 9], body: '#6a5a45', trim: '#4e4235' }
};
/* What each landmark is built of, for solidMat's facade grain (metres). */
var LANDMARK_FACADE = {
  barn:       { kind: 0, win: 0.25, bay: 3.2, roof: 1, doorW: 3.0, doorH: 3.2 },
  house:      { kind: 2, win: 0.85, bay: 2.6, roof: 0, doorW: 1.0, doorH: 2.1 },
  cabin:      { kind: 1, win: 0.6, bay: 2.4, roof: 0, doorW: 0.9, doorH: 2.0 },
  tower:      { kind: 3, win: 0.12, bay: 2.2, roof: 0, doorW: 1.0, doorH: 2.0 },
  windmill:   { kind: 2, win: 0.22, bay: 2.5, roof: 0, doorW: 1.0, doorH: 2.0, round: 1 },
  lighthouse: { kind: 2, win: 0.18, bay: 2.0, roof: 1, doorW: 0.9, doorH: 2.0, round: 1 },
  silo:       { kind: 5, win: 0, bay: 3, roof: 1, doorW: 0, round: 1 },
  smokestack: { kind: 4, win: 0.15, bay: 2.4, roof: 0, doorW: 0, round: 1 },
  watertank:  { kind: 5, win: 0, bay: 3, roof: 1, doorW: 0, round: 1 },
  pagoda:     { kind: 0, win: 0.3, bay: 2.0, roof: 0, doorW: 1.2, doorH: 2.2 },
  jetty:      { kind: 0, win: 0, bay: 3, roof: 0, doorW: 0 }
};
/* Where the windshaft sits on the tower, in the same units as landmarkGeo. */
var WINDMILL_HUB = [0, 0.74, -0.22];
/* Four sails on one shaft, built about the origin so the whole cross turns
   about z. Each is a stock out from the hub with bars laid across it: that
   lattice is what reads as a mill rather than as a mast with arms. */
function windmillSailGeo() {
  var B = { pos: [], nor: [], idx: [], rib: [] }, i, k;
  var len = 0.46;
  for (i = 0; i < 4; i++) {
    var a = i * 1.5708;
    /* the stock, running from the hub out to the tip */
    pushBox(B, Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.5, 0, len * 0.5, 0.017, 0.014, 0, a);
    /* the bars across it, shorter toward the tip */
    for (k = 1; k <= 5; k++) {
      var t = k / 5.6, w = 0.085 * (1 - t * 0.4);
      pushBox(B, Math.cos(a) * len * t, Math.sin(a) * len * t, 0, 0.011, w, 0.010, 0, a);
    }
  }
  pushBox(B, 0, 0, 0, 0.045, 0.045, 0.045, 0);              /* the hub itself */
  return finishGeo(B);
}

function landmarkGeo(kind, R) {
  var B = { pos: [], nor: [], idx: [], rib: [] }, i;
  /* Anything built inside mark() takes the trim colour instead of the body
     one, which is what lets a roof sit on a wall of a different shade. */
  var trims = [];
  var mark = function (fn) { var a0 = B.rib.length; fn(); trims.push(a0, B.rib.length); };
  var smokeAt = null;            /* where a chimney top actually is, if the shape knows */
  if (kind === 'lighthouse') {
    pushCyl(B, 0, 0, 0, 0.22, 0.13, 1.0, 16);
    pushCyl(B, 0, 1.0, 0, 0.17, 0.17, 0.10, 16);          /* gallery */
    pushCyl(B, 0, 1.10, 0, 0.11, 0.11, 0.16, 12);          /* lantern */
    pushCone(B, 0, 1.26, 0, 0.13, 0.14, 12);
    pushBox(B, 0.26, 0.06, 0.10, 0.16, 0.12, 0.13, R.range(0, 1));
  } else if (kind === 'windmill') {
    pushCyl(B, 0, 0, 0, 0.26, 0.15, 0.86, 12);
    pushCone(B, 0, 0.86, 0, 0.19, 0.20, 12);
    /* the windshaft the sails turn on, and a gallery round the tower */
    pushBox(B, 0, WINDMILL_HUB[1], -0.13, 0.035, 0.035, 0.10, 0);
    pushBox(B, 0, 0.30, 0, 0.30, 0.020, 0.30, 0);
  } else if (kind === 'tower') {
    /* A ruin, and no two ruins stand alike: round or square, upright or
       tapered, its crown whole or fallen away down one side. It used to be
       one box with four blocks on top and nothing else, which is why every
       tower looked like every other. */
    var rnd = R.f() < 0.5, tw = R.range(0.15, 0.24), th = R.range(0.62, 1.0);
    var tap = R.range(0.72, 1.0), spin = R.range(0, 1.571);
    var fallen = R.range(0, 0.62), fallAt = R.range(0, 6.283);
    if (rnd) {
      pushCyl(B, 0, 0, 0, tw * 1.22, tw * 1.08, th * 0.11, 14);
      pushCyl(B, 0, th * 0.10, 0, tw, tw * tap, th * 0.90, 14);
    } else {
      pushBox(B, 0, th * 0.055, 0, tw * 1.22, th * 0.055, tw * 1.22, spin);
      pushBox(B, 0, th * 0.5, 0, tw, th * 0.5, tw, spin);
      for (i = 0; i < 2; i++) {                             /* buttresses */
        var ba = spin + i * 1.571 + R.range(-0.35, 0.35);
        pushBox(B, Math.cos(ba) * tw, th * 0.24, Math.sin(ba) * tw, tw * 0.30, th * 0.24, tw * 0.26, ba);
      }
    }
    var mn = rnd ? 11 : 8, mr = tw * tap * (rnd ? 0.90 : 1.0);
    for (i = 0; i < mn; i++) {                              /* what is left of the crown */
      var ma = spin + (i / mn) * 6.2832;
      var dd = Math.abs(((ma - fallAt + 3.1416) % 6.2832 + 6.2832) % 6.2832 - 3.1416);
      if (dd < fallen * 3.1416) continue;
      pushBox(B, Math.cos(ma) * mr, th + tw * 0.15, Math.sin(ma) * mr,
              tw * 0.17, tw * R.range(0.10, 0.24), tw * 0.17, ma);
    }
  } else if (kind === 'barn') {
    /* the same barn every time, until now: its length, its pitch and whether
       it has a lean-to are all its own */
    var nw = R.range(0.46, 0.60), nd = R.range(0.28, 0.38), nh = R.range(0.22, 0.32);
    var brise = R.range(0.24, 0.36);
    pushBox(B, 0, nh, 0, nw, nh, nd, 0);
    /* a gabled roof: a four-sided cone left its corners standing out of the walls */
    pushGableEnds(B, 0, nh * 2, 0, nw, nd + 0.05, brise);
    mark(function () { pushGableRoof(B, 0, nh * 2, 0, nw, nd, brise, 0.05); });
    var chTop = nh * 2 + brise + 0.08;
    pushBox(B, -nw * 0.62, chTop - 0.16, 0, 0.05, 0.16, 0.05, 0);        /* chimney */
    smokeAt = [-nw * 0.62, chTop + 0.02];
    if (R.f() < 0.7) pushBox(B, nw + 0.20, nh * 0.58, 0.10, 0.18, nh * 0.58, nd * 0.6, 0);
  } else if (kind === 'house') {
    /* A house left to itself. The roof is two slopes over a stepped gable, so
       there is no hole under the eaves, and one slope has often gone. */
    var hw = R.range(0.30, 0.42), hd = R.range(0.22, 0.30), hh = R.range(0.30, 0.46);
    var rise = R.range(0.20, 0.32), lost = R.f() < 0.45;
    pushBox(B, 0, hh * 0.5, 0, hw, hh * 0.5, hd, 0);
    for (i = 0; i < 4; i++) {                               /* the gable, stepped */
      var gt = i / 4;
      pushBox(B, 0, hh + rise * (gt + 0.125), 0, hw * (1 - gt), rise * 0.125, hd, 0);
    }
    var sl = Math.atan2(rise, hw), rl = Math.sqrt(hw * hw + rise * rise) * 0.5;
    mark(function () {
      pushBox(B, hw * 0.5, hh + rise * 0.5, 0, rl, 0.022, hd * 1.12, 0, -sl);
      if (lost) pushBox(B, -hw * 0.76, hh + rise * 0.24, 0, rl * 0.42, 0.022, hd * 1.12, 0, sl);
      else pushBox(B, -hw * 0.5, hh + rise * 0.5, 0, rl, 0.022, hd * 1.12, 0, sl);
    });
    pushBox(B, hw * 0.66, hh + rise + 0.09, 0, 0.045, 0.14, 0.045, R.range(0, 0.5));   /* chimney */
    if (R.f() < 0.55) pushBox(B, -hw - 0.13, hh * 0.34, 0, 0.14, hh * 0.34, hd * 0.66, 0);
  } else if (kind === 'smokestack') {
    /* a works chimney on the shell of its engine house */
    var sr = R.range(0.055, 0.085), sh = R.range(0.88, 1.0), bw = sr * R.range(3.0, 4.4);
    pushBox(B, 0, 0.10, 0, bw, 0.10, bw * 0.7, R.range(0, 0.7));
    pushCyl(B, 0, 0.16, 0, sr * 1.7, sr, sh - 0.16, 14);
    mark(function () { pushCyl(B, 0, sh - 0.03, 0, sr * 1.22, sr * 1.16, sr * 0.6, 14); });
    if (R.f() < 0.7) pushBox(B, bw * 1.6, 0.07, 0, bw * 0.6, 0.07, bw * 0.5, 0);
  } else if (kind === 'silo') {
    pushCyl(B, 0, 0, 0, 0.20, 0.20, 0.84, 14);
    pushCone(B, 0, 0.84, 0, 0.22, 0.18, 14);
    pushBox(B, 0.42, 0.20, 0, 0.22, 0.20, 0.26, 0);
  } else if (kind === 'cabin') {
    pushBox(B, 0, 0.26, 0, 0.42, 0.26, 0.32, 0);
    pushGableEnds(B, 0, 0.52, 0, 0.42, 0.32 + 0.08, 0.26);
    pushGableRoof(B, 0, 0.52, 0, 0.42, 0.32, 0.26, 0.08);
    pushBox(B, -0.24, 0.66, 0.10, 0.05, 0.16, 0.05, 0);
  } else if (kind === 'pagoda') {
    var tiers = 3 + R.int(0, 2);
    for (i = 0; i < tiers; i++) {
      var t = i / tiers, y = t * 0.86, w = 0.34 * (1 - t * 0.45);
      pushBox(B, 0, y + 0.09, 0, w * 0.72, 0.09, w * 0.72, 0);
      /* square to the tier below, eaves well out past its walls */
      pushCone(B, 0, y + 0.18, 0, w * 0.72 * 1.40 * Math.SQRT2, 0.12, 4, false, Math.PI / 4);
    }
    pushCyl(B, 0, 0.86, 0, 0.03, 0.01, 0.16, 6);
  } else if (kind === 'watertank') {
    for (i = 0; i < 4; i++) {                                /* legs */
      var lx = (i % 2 ? 1 : -1) * 0.17, lz = (i < 2 ? 1 : -1) * 0.17;
      pushBox(B, lx, 0.33, lz, 0.022, 0.33, 0.022, 0);
    }
    pushCyl(B, 0, 0.66, 0, 0.26, 0.26, 0.30, 14);
    pushCone(B, 0, 0.96, 0, 0.28, 0.14, 14);
  } else { /* jetty: planks on posts, walking out into the water */
    for (i = 0; i < 7; i++) {
      pushBox(B, 0, 0.10, -i * 0.30, 0.22, 0.03, 0.15, 0);
      pushBox(B, -0.18, 0.05, -i * 0.30, 0.02, 0.09, 0.02, 0);
      pushBox(B, 0.18, 0.05, -i * 0.30, 0.02, 0.09, 0.02, 0);
    }
  }
  /* pushCyl writes a stripe coordinate the landmarks do not use, so start
     from body everywhere and paint the marked ranges as trim */
  for (i = 0; i < B.rib.length; i++) B.rib[i] = 0;
  for (i = 0; i < trims.length; i += 2)
    for (var t2 = trims[i]; t2 < trims[i + 1]; t2++) B.rib[t2] = 1;
  /* a plinth: everything that stood on the ground carries on down into it, so
     a building set level on a slope meets the ground on the downhill side
     instead of standing on air */
  if (kind !== 'jetty') for (i = 1; i < B.pos.length; i += 3) if (B.pos[i] < 1e-4) B.pos[i] = -0.15;
  var geo = finishGeo(B);
  geo.userData.smoke = smokeAt;
  return geo;
}

/* How far off the view axis anything can be and still be seen through the
   window. Placing by a fixed angle put half the landmarks behind the wall.
   Worked out for a 16:9 screen, not for the window open at the time: the
   world is built once and kept through a resize or a phone turned on its
   side, and builders that read the live window drew a different number of
   random values at each size, so one seed was another place, at another
   hour, on a wider screen. Wider screens see a little past 16:9's edge, which
   the scatter's margin covers; narrower ones see less of the same world. */
var BUILD_ASPECT = 16 / 9;
function visibleHalfAngle(P) {
  if (!P.win || !P.win.glassH) return Math.atan(1.5 / 2.1);
  var O = openingFor(P.win, BUILD_ASPECT);
  return Math.atan((O.glassW * 0.5 + P.win.frame + 0.012) / O.d);
}
/* The same for a phone held upright (9:16), the narrowest window there is:
   what is put there to be looked at -- a landmark, a herd, a fall, a boat --
   stands inside it, so a narrow screen does not lose it behind the wall.
   General scatter keeps the 16:9 wedge. A constant shape, so the world is
   still the same at every window size. */
var FEATURE_ASPECT = 9 / 16;
function featureHalfAngle(P, aspect) {
  if (!P.win || !P.win.glassH) return Math.atan(0.5 / 2.1);
  var O = openingFor(P.win, aspect || FEATURE_ASPECT);
  return Math.atan(O.glassW * 0.5 / O.d);
}

function buildLandmark(scene, P, R, U, H) {
  if (/penthouse|bridge|cascade|canyon/.test(P.biomeKey)) { App.landmark = null; return; }
  var opts = [];
  for (var k in LANDMARKS) if (LANDMARKS[k].biomes.indexOf(P.biomeKey) >= 0) opts.push(k);
  /* Whether there is one, what it is and how big are part of what this place
   is, so they come from an identity stream: drawn from R, which carries the
   layout nonce, a reshuffle turned a barn into a tower. Where it stands is
   layout and stays on R. */
  var IR = RNG(P.base + '/landmark');
  var present = IR.f() <= 0.72, kind = opts.length ? IR.pick(opts) : null;
  var L = kind ? LANDMARKS[kind] : null, sz = L ? IR.range(L.scale[0], L.scale[1]) : 0;
  /* a works chimney among towers is a power station's: 45 to 80 m, or the
     city dwarfs it */
  var bigStack = kind === 'smokestack' && P.biomeKey === 'urban';
  if (bigStack) sz = 45 + (sz - 16) / 10 * 35;
  if (!opts.length || !present) { App.landmark = null; return; }
  /* off to one side but inside the glass: a landmark you cannot see is no
     landmark at all. The bare view has no frame, so it sees a little wider. */
  var lim = featureHalfAngle(P) * (App.bare ? 1.05 : 0.80);
  /* where the middle of the view is sea or cliff, look wider after twenty
     tries: inside a 4:3 window, then the 16:9 one, rather than have none */
  var lims = [lim, featureHalfAngle(P, 4 / 3) * (App.bare ? 1.05 : 0.80), visibleHalfAngle(P) * (App.bare ? 1.05 : 0.80)];
  var side = R.f() < 0.5 ? -1 : 1;
  /* How far off it can stand and still be read. Fog sets one limit: past it
     the landmark is the colour of the air. Its own height sets the other: a
     thing too small to make out is not a landmark either. Neither limit was
     applied before, so the note in the corner named a windmill the eye could
     not find. Thick weather leaves no room for one at all. */
  var byFog = 1.02 / Math.max(P.weather.fogD, 0.0001);
  if (byFog < 150) { App.landmark = null; return; }
  var far = Math.min(560, byFog, (bigStack ? 62 : (L.scale[0] + L.scale[1]) * 0.5) / 0.045);
  var near = Math.min(190, far * 0.78);
  /* Only a jetty belongs in the water. Nothing else was checked, so a cabin
     on a lakefront could be set down on the lake bed and left standing in it.
     Look for dry ground, trying either side of the view, and rather than put
     a building under water, have none. */
  var wet = function (px, pz) {
    if (P.waterY != null && kind !== 'jetty' && H(px, pz) < P.waterY + 0.6) return true;
    /* nor inside a building: keep clear of every city footprint */
    var bxs = App._boxes || [], r = sz * 0.35;
    for (var bi = 0; bi < bxs.length; bi++) {
      var b = bxs[bi], ox = px - b[0], oz = pz - b[1], c = Math.cos(b[4]), s = Math.sin(b[4]);
      if (Math.abs(ox * c + oz * s) < b[2] + r && Math.abs(-ox * s + oz * c) < b[3] + r) return true;
    }
    return false;
  };
  /* the ground under each corner of its footprint: a centre on dry land
     still put a lighthouse's corner in the sea */
  var lgeo = null, bb = null, cornerY = function (px, pz, q) {
    return H(px + (q & 1 ? bb.max.x : bb.min.x) * sz * 0.9, pz + (q & 2 ? bb.max.z : bb.min.z) * sz * 0.9);
  };
  /* nor a corner in the water, nor a footprint on a slope so steep the
     building would be buried to the eaves on its uphill side */
  var cornersWet = function (px, pz) {
    if (kind === 'jetty') return false;
    var lo = 1e9, hi = -1e9;
    for (var q = 0; q < 4; q++) { var h = cornerY(px, pz, q); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return (P.waterY != null && lo < P.waterY + 0.6) || hi - lo > Math.max(2.5, sz * 0.2);
  };
  var a, dist, x, z, ok = false;
  for (var att = 0; att < 40; att++) {
    var lt = lims[att < 20 ? 0 : (att < 30 ? 1 : 2)];
    a = side * R.range(lt * 0.22, lt);
    dist = R.range(near, far);
    x = Math.sin(a) * dist; z = -Math.cos(a) * dist;
    if (!wet(x, z)) {
      /* the shape is drawn at the first dry centre, where it always was */
      if (!lgeo) { lgeo = landmarkGeo(kind, R); lgeo.computeBoundingBox(); bb = lgeo.boundingBox; }
      if (!cornersWet(x, z)) { ok = true; break; }
    }
    side = -side;
  }
  if (!ok) { if (lgeo) lgeo.dispose(); App.landmark = null; return; }
  /* Level on the lowest corner of its own footprint, sunk a little (set on
     the centre it stood on air down the slope), but never more than a metre
     and a quarter under the centre: on a steep hillside the lowest corner
     buried the building to its eaves. The plinth goes down to the lowest
     corner instead, and fills the uphill side. */
  var yc = H(x, z), lo = yc;
  for (var cq = 0; cq < 4; cq++) lo = Math.min(lo, cornerY(x, z, cq));
  var y = Math.max(lo, yc - 1.25) - 0.1;
  if (kind === 'jetty' && P.waterY != null) y = P.waterY - 0.4;
  else {
    var foot = -(y - lo + 0.3) / sz, lp = lgeo.attributes.position;
    if (foot < -0.15) {
      for (var vi = 0; vi < lp.count; vi++) if (lp.getY(vi) < -0.149) lp.setY(vi, foot);
      lp.needsUpdate = true;
    }
  }
  var mat = solidMat(U, L.body, { rib: 0, grain: 0, spines: 0, body2: L.trim, twoTone: 1, facade: LANDMARK_FACADE[kind] });
  instanceSolid(scene, lgeo, [[x, y, z, sz, 0, 1, 1]], mat);
  App._shadows.push([x, y, z, sz * 0.30, 0.85, sz]);
  if (kind === 'windmill') {
    /* The sails are their own mesh, set at the windshaft and turned about it
       by the shader. A mill sets its sails to the wind, so it runs with the
       weather, slowly, and always the same way round. */
    var hub = [x + WINDMILL_HUB[0] * sz, y + WINDMILL_HUB[1] * sz, z + WINDMILL_HUB[2] * sz];
    var rate = -(0.30 + P.windBase * 0.55);
    instanceSolid(scene, windmillSailGeo(), [[hub[0], hub[1], hub[2], sz, 0, 1, 1]],
      solidMat(U, L.trim, { rib: 0, grain: 0, spines: 0, body2: L.body, spin: rate }));
  }
  App.landmark = { kind: kind, x: x, y: y, z: z, size: sz, lit: !!L.lit, smoke: !!L.smoke };
  App._features.push(['landmark ' + kind, x, z]);
  P.landmarkName = kind;
  /* the chimney stands in a different place on each of them, so where the
     smoke leaves travels with the landmark rather than being guessed here */
  var sm = lgeo.userData.smoke || L.smoke;
  if (L.smoke) buildSmoke(scene, P, R, U, x + sz * sm[0], y + sz * sm[1], z, sz);
  if (L.lit) buildBeacon(scene, P, R, U, x, y + sz * 1.14, z, sz);
}

/* ---------- smoke from a chimney ---------- */
function buildSmoke(scene, P, R, U, x, y, z, sz) {
  var N = 26;
  var quad = new THREE.PlaneGeometry(1, 1);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
  var iAttr = new Float32Array(N * 3);
  for (var i = 0; i < N; i++) {
    iAttr[i * 3] = i / N;                       /* where in the plume it starts */
    iAttr[i * 3 + 1] = R.range(0, 6.283);
    iAttr[i * 3 + 2] = R.range(0.75, 1.3);
  }
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 3));
  geo.instanceCount = N;
  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uWind: U.uWind, uWindDir: U.uWindDir, uCamPos: U.uCamPos,
      uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
      uOrigin: { value: new THREE.Vector3(x, y, z) }, uScale: { value: sz }
    },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: GLSL['smoke.vert'],
    fragmentShader: GLSL['smoke.frag']
  });
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 3;
  scene.add(m);
  App.propMeshes.push(m);
}

/* ---------- a lighthouse beacon, turning ---------- */
function buildBeacon(scene, P, R, U, x, y, z, sz) {
  var quad = new THREE.PlaneGeometry(1, 1);
  var mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uCamPos: U.uCamPos, uNight: App.skyU.uNight,
                uOrigin: { value: new THREE.Vector3(x, y, z) }, uScale: { value: sz } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: GLSL['beacon.vert'],
    fragmentShader: GLSL['beacon.frag']
  });
  var m = new THREE.Mesh(quad, mat);
  m.frustumCulled = false;
  m.renderOrder = 8;
  scene.add(m);
  App.propMeshes.push(m);
}


