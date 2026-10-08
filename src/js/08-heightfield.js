/* ---------- terrain height ---------- */
function ridged(x, y, s, oct) {
  var v = 0, amp = 0.5, f = 1, norm = 0;
  for (var i = 0; i < oct; i++) {
    var n = 1 - Math.abs(vnoise(x * f, y * f, s + i * 131) * 2 - 1);
    v += n * n * amp; norm += amp; amp *= 0.5; f *= 2.03;
  }
  return v / norm;
}

/* The dune field (P.dune, see buildParams): the height of the dunes at x,z.
   u runs downwind, v across it. The phase counts wavelengths downwind, its
   crest lines bent by sums of sines across the wind and its spacing by one
   along it. Each wavelength rises over 1 - sf of its length (a smoothstep:
   gentle off the trough, level at the brink) and falls straight down the slip
   face over the rest. The terrain shader's duneG() is the same sum, term for
   term, so the light can follow crests the mesh is too coarse to draw. */
/* bed colours: deep red, orange, salmon, buff, cream, chocolate, mauve */
var BED_COLS = ['#93472b', '#ad6038', '#bf8458', '#c6a47c', '#cdb998', '#6e3c26', '#83605a'];
/* The beds of rock (P.beds, see buildParams) laid between their floor and
   their top: in a canyon from the floor to the rim, in a bajada from the
   plain to the tops of the mesas. The top bed is always hard, a caprock. The
   canyon's walls are shaped from this table and the terrain shader colours
   by the same heights. */
function bedTable(P) {
  if (!P.beds) return [];
  var canyon = (P.terrainKind || P.biome.terrain) === 'canyon';
  var n = canyon ? P.strata : 9;
  var lo = canyon ? -P.canyonDepth : 0, hi = canyon ? 0 : Math.max(P.mesaH, 4);
  var sum = 0, i, out = [], y = lo;
  for (i = 0; i < n; i++) sum += P.beds[i].th;
  for (i = 0; i < n; i++) {
    var b = P.beds[i], y1 = y + (hi - lo) * b.th / sum;
    out.push({ y0: y, y1: y1, hard: i === n - 1 || b.hard, bench: b.bench, col: b.col, tone: b.tone });
    y = y1;
  }
  return out;
}

function duneAt(D, x, z) {
  if (!D || !D.hd) return 0;
  var ca = Math.cos(D.ang), sa = Math.sin(D.ang);
  var u = x * ca + z * sa, v = -x * sa + z * ca;
  var ph = u / D.lam + D.a1 * Math.sin(D.k1 * v + D.p1) + D.a2 * Math.sin(D.k2 * v + D.p2) + D.a3 * Math.sin(D.k4 * u + D.p4);
  var fl = Math.floor(ph), f = ph - fl, r = 1 - D.sf;
  var y = f < r ? (function (t) { return t * t * (3 - 2 * t); })(f / r) : 1 - (f - r) / D.sf;
  var A = D.hd * (0.72 + 0.28 * Math.sin(D.k3 * v + D.p3 + 2.1 * fl));
  var d = Math.sqrt(x * x + z * z);
  return A * y * smoothstep(D.r0, D.r1, d);
}

/* A dry wash cuts across an erg on the path's own curve and levels the
   dunes across it: how much (0..1), and the dune height the ground keeps.
   The heightfield, plantable() and the grass all read the same one. */
function washAt(P, x, z) { return P.pathKind === 'wash' ? smoothstep(0.0, 0.6, onPathAt(P, x, z)) : 0; }
function ergDuneAt(P, x, z, wa) {
  return duneAt(P.dune, x, z) * (1 - 0.9 * (wa == null ? washAt(P, x, z) : wa));
}

function makeHeightField(P) {
  var s = P.terrainSeed, amp = P.hillAmp, f = P.hillFreq, far = P.farHills;
  var kind = P.terrainKind || P.biome.terrain;

  if (kind === 'beach') {
    var drop = P.beachDrop, run = P.shoreRun;
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var out = smoothstep(-10, -10 - run, z);           /* 0 at the dune, 1 out to sea */
      var h = -out * drop;
      h += fbm2(x * 0.045, z * 0.045, s, 3) * 0.45 * (1 - out) * smoothstep(3, 20, d);
      h += fbm2(x * 0.012, z * 0.012, s + 41, 2) * 0.9 * (1 - out * 0.7) * smoothstep(2, 30, d);
      h += fbm2(x * 0.03 + 9.1, z * 0.03, s + 77, 2) * 0.8 * out;   /* wobble the waterline */
      return h;
    };
  }
  if (kind === 'dunes') {
    var da = P.duneAmp, mesa = P.mesaH, DU = P.dune;
    /* A dry wash: a flat floor cut into the land, the dunes levelled across
       it, half a metre to a metre deep, on the path's own curve */
    var wcut = P.pathKind === 'wash' ? 0.5 + (P.pathW - 5) / 9 * 0.5 : 0;
    if (P.erg) {
      /* the dunes fade from the mesh where its grid can no longer carry a
         slip face; the shader keeps drawing them in the light beyond */
      var dfar = clamp(DU.lam * 5, 450, 1300);
      return function (x, z) {
        var d = Math.sqrt(x * x + z * z);
        var wa = washAt(P, x, z);
        var h = ergDuneAt(P, x, z, wa) * (1 - smoothstep(dfar, dfar * 1.6, d)) - wa * wcut;
        h += fbm2(x * 0.02, z * 0.02, s, 3) * 0.35 * smoothstep(4, 40, d);
        h += ridged(x * f * 0.03, z * f * 0.03, s + 303, 3) * Math.min(mesa, 30) * 0.8 * smoothstep(900, 1600, d);
        return h;
      };
    }
    /* A bajada: the land rises gently toward the range it was washed down
       from, in low fans, and mesas stand on it. A mesa is a blob of the
       noise above a threshold: its cliff is a fixed share of the noise, set
       wide enough in metres that the grid out there draws it as a cliff and
       not a sawtooth, its top is flat caprock, and the rubble it sheds lies
       in a concave apron round its foot. The noise threshold, not its
       height, decides whether a mesa stands near the house: none closer
       than a few hundred metres. */
    var rise = 0.012 + (da - 1.2) / 2.2 * 0.02;
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var h = Math.max(0, -z - 30) * rise * smoothstep(20, 200, d);
      h += fbm2(x * f * 0.6, z * f * 0.6, s, 4) * da * 0.9 * smoothstep(4, 40, d);
      h += fbm2(x * 0.03, z * 0.03, s + 21, 2) * 0.25 * smoothstep(3, 20, d);
      var m = fbm2(x * 0.0026, z * 0.0026, s + 7, 3) - (1 - smoothstep(260, 520, d)) * 0.8;
      /* the noise climbs about 0.0026 a metre: a cliff two and a half grid
         cells across, never less than 15 m */
      var w = clamp(Math.max(terrainCellAt(d, QUALITY[0].grid) * 2.5, 15) * 0.0026, 0.04, 0.3);
      var top = smoothstep(0.16, 0.16 + w, m);
      var apron = smoothstep(0.16 - w * 3, 0.16, m);
      h += mesa * (top * 0.86 + apron * apron * 0.14) + top * fbm2(x * 0.01, z * 0.01, s + 9, 2) * mesa * 0.03;
      h += ridged(x * f * 0.03, z * f * 0.03, s + 303, 3) * mesa * 0.8 * smoothstep(900, 1600, d);
      return h - washAt(P, x, z) * wcut;
    };
  }
  if (kind === 'cliff') {
    var edge = P.cliffEdge, drop2 = P.cliffDrop, amp2 = P.cliffAmp, cph = P.cliffPhase;
    /* The coastline swings in and out, so headlands run past the window and you
       see their faces in profile. A straight edge just reads as "land stops". */
    var coastAt = function (x) {
      var hx = (x - P.headX) / P.headW;
      var c = -edge + Math.sin(x * 0.017 + cph) * amp2
        + Math.sin(x * 0.041 - cph * 0.7) * amp2 * 0.35
        + fbm2(x * 0.008, 4.2, s + 71, 2) * amp2 * 0.5
        - P.headLen * Math.exp(-hx * hx * hx * hx);       /* the headland, square-ended */
      /* however the coast swings, the house is never on the edge of it; from
         an upper floor the clifftop must reach out past the foot of the view,
         or the house seems to hang over the water */
      return Math.min(c, -12 - (P.eyeH || 0) * 3 - Math.abs(x) * 0.1);
    };
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var c = coastAt(x);
      var lip = smoothstep(c - 6, c + 2, z);              /* 1 on the clifftop, 0 out at sea */
      var h = -drop2 * (1 - lip);
      h += fbm2(x * 0.02, z * 0.02, s, 3) * 1.4 * lip * smoothstep(3, 26, d);
      h += fbm2(x * 0.006, z * 0.006, s + 13, 2) * 4.0 * lip * smoothstep(2, 34, d);
      return h;
    };
  }
  if (kind === 'terrace') {
    var stepH = P.stepH, stepW = P.stepW, tilt2 = P.terraceTilt;
    /* how far up the hill a point sits, in metres, with the contour wandering */
    var vd = P.valleyD, vr = 25, v0 = Math.sqrt(vd * vd + vr * vr);
    var runRaw = function (x, z) {
      /* down from the house to the valley floor vd out, then up the far side */
      var down = Math.sqrt((-z - vd) * (-z - vd) + vr * vr) - v0;
      return down * P.terraceGrade + x * tilt2 + fbm2(x * 0.0045, z * 0.0045, s + 5, 2) * 11.0;
    };
    /* shift the whole staircase so the house sits in the middle of a tread,
       never with a riser at the sill */
    var frac0 = runRaw(0, 0) / stepW; frac0 -= Math.floor(frac0);
    var shift = (0.5 - frac0) * stepW;
    var runAt = function (x, z) { return runRaw(x, z) + shift; };
    var band0 = Math.floor(runAt(0, 0) / stepW);
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var run = runAt(x, z) / stepW;
      var band = Math.floor(run);
      /* The ground mesh warps from about a metre across at the window to tens
         of metres at its edge, and passes the width of one tread at around
         sixty-five metres out. Past that the staircase falls between the grid
         points: neighbouring vertices land on treads two or three apart and
         the hillside breaks into angular blocks with nothing between them.
         Let the steps melt into the slope they approximate over the range
         where the mesh stops being able to carry them. */
      var melt = smoothstep(38, 115, d);
      var h = ((band - band0) * (1 - melt) + (run - band0 - 0.5) * melt) * stepH;
      h += fbm2(x * 0.06, z * 0.06, s, 2) * 0.07;          /* the paddy surface is not glass */
      h += Math.pow(ridged(x * 0.0032, z * 0.0032, s + 29, 3), 1.4) * far * 1.2 * smoothstep(320, 900, d);
      return h;
    };
  }
  if (kind === 'slope') {
    var grade = P.slopeGrade, sdir = P.slopeDir;
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var along = -z * Math.cos(sdir) + x * Math.sin(sdir);
      var h = along * grade;
      h += fbm2(x * f, z * f, s, 4) * amp * 1.4;
      h += fbm2(x * f * 0.2, z * f * 0.2, s + 44, 3) * far * 0.7 * smoothstep(60, 400, d);
      return h * smoothstep(2, 20, d);
    };
  }
  if (kind === 'salt') {
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var h = fbm2(x * 0.03, z * 0.03, s, 2) * 0.045
            + fbm2(x * 0.004, z * 0.004, s + 3, 2) * 0.10;
      h += Math.pow(ridged(x * 0.0028, z * 0.0028, s + 19, 3), 1.6) * far * 2.4 * smoothstep(420, 950, d);
      return h;
    };
  }
  if (kind === 'lake') {
    var ldrop = P.beachDrop, lrun = P.shoreRun, lfar = P.lakeFar;
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      /* the bank runs further out under an upper-floor window, so the view
         has a shore at its foot and not only water */
      var l0 = -4.5 - (P.eyeH || 0) * 2.5;
      var out = smoothstep(l0, l0 - lrun, z);
      var h = -out * ldrop;
      h += fbm2(x * 0.03, z * 0.03, s, 3) * 0.5 * (1 - out) * smoothstep(3, 22, d);
      h += fbm2(x * 0.011, z * 0.011, s + 41, 2) * 1.1 * (1 - out * 0.8) * smoothstep(2, 30, d);
      /* the far shore, closing the water in */
      h += Math.pow(ridged(x * 0.0042, z * 0.0042, s + 88, 4), 1.3) * far * 2.2 * smoothstep(lfar, lfar + 260, d);
      return h;
    };
  }
  if (kind === 'river') {
    var hw = P.riverW, dep = P.riverDepth, bend = P.riverBend, ph = P.riverPhase, tilt = P.riverTilt, off = P.riverOffset;
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      /* 'off' was redeclared below, which hoisted it and made cx NaN, so every
         river valley had no terrain at all. The channel distance gets its own name. */
      var cx = off + bend * (Math.sin(z * 0.0055 + ph) - Math.sin(ph)) + tilt * z;
      var side = Math.abs(x - cx);
      var chan = 1 - smoothstep(hw * 0.65, hw * 1.4, side);
      var h = fbm2(x * f, z * f, s, 4) * amp * smoothstep(4, 40, d);
      h -= dep * chan;
      h += smoothstep(hw * 1.1, hw * 3.4, side) * far * 0.5 * smoothstep(30, 300, d);
      h += Math.pow(ridged(x * 0.005, z * 0.005, s + 17, 4), 1.4) * far * 1.4 * smoothstep(240, 780, d);
      return h;
    };
  }
  if (kind === 'gorge') {
    /* a deep flowing river between steep banks, with the land level on top */
    var gw = P.gorgeW, gd = P.gorgeDepth, gph = P.gorgePhase, gb = P.gorgeBend;
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var cx = gb * (Math.sin(z * 0.0032 + gph) - Math.sin(gph));
      var side = Math.abs(x - cx);
      var cut = 1 - smoothstep(gw * 0.55, gw * 1.5, side);
      var h = fbm2(x * f * 0.7, z * f * 0.7, s, 3) * amp * 0.5 * smoothstep(6, 60, d);
      h -= gd * cut;
      /* the rim rises a little either side, then rolls away */
      h += smoothstep(gw * 1.2, gw * 2.6, side) * (1 - smoothstep(gw * 5.0, gw * 11.0, side)) * gd * 0.16;
      h += Math.pow(ridged(x * 0.0035, z * 0.0035, s + 31, 4), 1.5) * far * 1.1 * smoothstep(300, 900, d);
      return h;
    };
  }
  if (kind === 'canyon') {
    /* Walls built bed by bed (bedTable): a hard bed a cliff, a soft one a
       concave slope of its own rubble, and on top of a hard bed with soft
       rock above it, a bench. Cut by side canyons, with an inner channel
       down the floor that the river runs in, or that lies dry. */
    var cw = P.canyonW, cd = P.canyonDepth, canyonPh = P.canyonPhase, cb = P.canyonBend;
    /* The canyon has its own frame: a runs along the axis, which heads
       canyonAng off straight ahead, p across it. The axis is set so the
       window stands canyonLedge back from the top of the uppermost wall. */
    var ksa = Math.sin(P.canyonAng || 0), kca = Math.cos(P.canyonAng || 0);
    var cxAt = function (a) { return cb * (Math.sin(a * 0.0026 + canyonPh) - Math.sin(canyonPh)) + Math.sin(a * 0.011 + canyonPh * 2) * cw * 0.10; };
    var biteAt = function (a) { return Math.pow(Math.max(0, Math.sin(a * 0.017 + canyonPh * 1.7)), 6) * cw * 0.55; };
    var p0 = cxAt(0) + (ksa < 0 ? -1 : 1) * (2.9 * (cw + biteAt(0)) + (P.canyonLedge || 0));
    P._canP0 = p0;
    var tb = bedTable(P), prof = [[0, 0, 0]], s0 = 0, e0 = 0, bi;
    for (bi = 0; bi < tb.length; bi++) {
      var bth = (tb[bi].y1 - tb[bi].y0) / cd;
      s0 += bth * (tb[bi].hard ? 0.28 : 1.5); e0 += bth; prof.push([s0, e0, tb[bi].hard ? 1 : 2]);
      if (tb[bi].hard && bi < tb.length - 1 && !tb[bi + 1].hard) { s0 += bth * tb[bi].bench; prof.push([s0, e0, 0]); }
    }
    for (bi = 0; bi < prof.length; bi++) prof[bi][0] /= s0;
    var eAt = function (t) {
      for (var k = 1; k < prof.length; k++) if (t <= prof[k][0]) {
        var u = (t - prof[k - 1][0]) / Math.max(prof[k][0] - prof[k - 1][0], 1e-6), de = prof[k][1] - prof[k - 1][1];
        return prof[k - 1][1] + de * (prof[k][2] === 2 ? Math.pow(u, 1.5) : u);
      }
      return 1;
    };
    var cwc = P.chanW || 12;
    var ccAt = function (a) { return cxAt(a) + Math.sin(a * 0.0071 + (P.chanPh || 0)) * Math.max(cw - cwc * 1.6, 0) * 0.6; };
    /* where the channel runs, for the willows along it: world x, z at a
       along the axis, off metres across from the channel's middle */
    P._chanXZ = function (a, off) { var q = ccAt(a) + off - p0; return [a * ksa + q * kca, -a * kca + q * ksa]; };
    /* is x, z in the painted river? The shader's edge sits at 0.85 of the
       channel's half width, wandering by up to 0.075 */
    P._inRiver = P.hasCanyonRiver ? function (x, z) {
      var a = x * ksa - z * kca;
      return Math.abs(x * kca + z * ksa + p0 - ccAt(a)) < cwc * 0.9;
    } : null;
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var a = x * ksa - z * kca, p = x * kca + z * ksa + p0;
      var cx = cxAt(a);
      var side = Math.abs(p - cx);
      /* side canyons bite into the wall at intervals */
      var edge = cw + biteAt(a);
      var t = clamp((side - edge) / Math.max(edge * 1.9, 1), 0, 1);
      var h = -cd * (1 - eAt(t));
      var wall = smoothstep(0, 0.06, t);
      h += fbm2(x * 0.02, z * 0.02, s + 5, 3) * 1.6 * (0.35 + 0.65 * wall);
      h += fbm2(x * 0.09, z * 0.09, s + 9, 2) * 0.5 * (0.3 + t);
      h += smoothstep(0.92, 1.0, t) * far * 0.9 * smoothstep(200, 800, d);
      /* the inner channel swings across the floor; bars of sand and gravel
         stand in it here and there */
      var cc = ccAt(a);
      /* only a shallow dip: hundreds of metres out the mesh is tens of
         metres across and would carve the channel into blocks; the water
         and the wash are drawn on it by the terrain shader, which follows
         the same curve exactly */
      var chan = (1 - smoothstep(cwc * 0.6, cwc * 1.6, Math.abs(p - cc))) * (1 - wall);
      h -= chan * 0.6;
      return h;
    };
  }
  if (kind === 'cascade') {
    var segs = P.fallSegs, notch = P.fallNotch, poolZ = P.poolZ;
    var topY = P.fallTopY, topZ = P.fallTopZ, massifH = P.massifH, massifRun = P.massifRun;
    /* the height of the mountain face at this depth, following the staircase */
    var faceAt = function (z) {
      if (z > poolZ) return -1.4;
      for (var i = 0; i < segs.length; i++) {
        var g = segs[i];
        if (z <= g.z0 && z > g.z1) {
          var t = (g.z0 - z) / Math.max(g.z0 - g.z1, 0.001);
          /* a pitch is steepest in its middle, so its lip and foot are rounded */
          var e = g.drop ? t * t * (3 - 2 * t) : t;
          return g.y0 + (g.y1 - g.y0) * e;
        }
      }
      /* above the top of the fall the mountain keeps climbing */
      var u = clamp((topZ - z) / massifRun, 0, 1);
      return topY + massifH * (1 - Math.pow(1 - u, 1.7));
    };
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var side = Math.abs(x - P.fallX);
      var face = faceAt(z);
      /* the gully the water has cut: deep in the middle, flaring at the edges */
      /* tight enough to have walls: flared over four times its own floor,
         the channel was a dish and read as no channel at all */
      var gully = 1 - smoothstep(notch * 0.48, notch * 1.25, side);
      var h = face - gully * P.gullyDepth * clamp((poolZ - z) / 30, 0, 1);
      /* the valley floor in front, with the plunge pool at the foot of the fall */
      if (z > poolZ) {
        h = -1.4 + fbm2(x * 0.05, z * 0.05, s, 3) * 0.7;
        h -= 1.4 * (1 - smoothstep(0, 26, Math.abs(z - (poolZ + 12)))) * (1 - smoothstep(0, 30, side));
      }
      /* the walls either side of the gully climb away from it */
      var flank = smoothstep(notch * 1.2, notch * 5.5, side) * (1 - smoothstep(0, 40, Math.max(0, z - poolZ)));
      h += flank * (massifH * 0.28 + fbm2(x * 0.02, z * 0.02, s + 23, 3) * 12);
      h += fbm2(x * 0.09, z * 0.09, s + 3, 3) * 1.6 * smoothstep(poolZ + 12, poolZ - 20, z);
      h += fbm2(x * 0.013, z * 0.013, s + 17, 3) * amp * 0.5 * smoothstep(10, 90, d);
      h += Math.pow(ridged(x * 0.0035, z * 0.0035, s + 41, 4), 1.4) * far * 1.3 * smoothstep(massifRun * 0.8, massifRun * 2.4, -z);
      return h;
    };
  }
  if (kind === 'oasis') {
    /* Dunes all around, a hollow with water in the middle of them. The
       house stands on the sand and the land falls away from it toward the
       hollow along the line of sight, the dunes kept low across that line,
       so the water is in view; a rim of blown sand stands only on the far
       side. Near the house the ground is level, so the window is above it. */
    var ow = P.oasisW, ox2 = P.oasisX, oz2 = P.oasisZ, oL2 = ox2 * ox2 + oz2 * oz2, oL = Math.sqrt(oL2);
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var od = Math.sqrt((x - ox2) * (x - ox2) + (z - oz2) * (z - oz2));
      var bowl = 1 - smoothstep(ow * 0.35, ow * 1.25, od);
      /* the dunes must not fill the hollow, or the oasis has no water in it:
         they are flattened out as the bowl deepens */
      var open = 1 - bowl;
      var tq = clamp((x * ox2 + z * oz2) / oL2, 0, 1), qx = ox2 * tq - x, qz = oz2 * tq - z;
      var lane = 1 - smoothstep(ow * 0.5, ow * 1.9, Math.sqrt(qx * qx + qz * qz));
      var h = ridged(x * 0.011, z * 0.011, s, 4) * amp * 2.4 * smoothstep(8, 70, d) * open * (1 - 0.85 * lane);
      h += fbm2(x * 0.035, z * 0.035, s + 11, 3) * 0.9 * open * smoothstep(4, 30, d);
      h -= lane * smoothstep(0.03, 0.7, tq) * 4.5 * open;
      h -= bowl * 9.0;
      var away = ((x - ox2) * -ox2 + (z - oz2) * -oz2) / (Math.max(od, 1) * oL);
      h += smoothstep(ow * 1.1, ow * 2.4, od) * (1 - smoothstep(ow * 4.0, ow * 9.0, od)) * 2.2 * (1 - smoothstep(-0.3, 0.3, away));
      h += Math.pow(ridged(x * 0.004, z * 0.004, s + 41, 3), 1.3) * far * 1.5 * smoothstep(260, 820, d);
      return h;
    };
  }
  if (kind === 'skyline') {
    /* The street far below: dead level, as a paved city is, so the cars and
       the kerbs sit on it; only past the city does the land rise a little. */
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      return -P.storey + smoothstep(900, 2000, d) * (far * 0.6 + fbm2(x * 0.004, z * 0.004, s, 2) * 6);
    };
  }
  if (kind === 'marsh') {
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var h = (fbm2(x * 0.055, z * 0.055, s, 3) * 0.5
            + fbm2(x * 0.013, z * 0.013, s + 23, 3) * 1.15
            + fbm2(x * 0.004, z * 0.004, s + 61, 2) * 1.0) * smoothstep(2, 30, d);
      h += 0.35 * (1 - smoothstep(0, 26, d));            /* a low dry bank under the window */
      h += Math.pow(ridged(x * 0.0035, z * 0.0035, s + 9, 3), 1.3) * far * 1.6 * smoothstep(230, 700, d);
      return h;
    };
  }
  if (kind === 'alpine') {
    var pk = P.peakH;
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var near = smoothstep(5, 44, d);
      var h = fbm2(x * f, z * f, s, 4) * amp * near;
      var r1 = Math.pow(ridged(x * f * 0.085, z * f * 0.085, s + 11, 5), 1.55);
      h += r1 * pk * smoothstep(60, 470, d);
      var r2 = Math.pow(ridged(x * f * 0.026 + 5.3, z * f * 0.026, s + 213, 4), 1.4);
      h += r2 * pk * 1.35 * smoothstep(300, 1000, d);
      /* the valley sides, close in either hand and running away up the view */
      var vs = Math.abs(x - P.valleyX + fbm2(z * 0.004, 7.7, s + 5, 2) * P.valleyW * 0.6);
      var wallUp = smoothstep(P.valleyW, P.valleyW * 3.2, vs) * (0.55 + 0.45 * ridged(x * 0.006, z * 0.006, s + 61, 3));
      h += wallUp * pk * P.valleyLift * smoothstep(12, 90, d);
      return h;
    };
  }
  if (kind === 'fjord') {
    var ch = P.channelW, wh = P.wallH;
    return function (x, z) {
      var d = Math.sqrt(x * x + z * z);
      var ax = Math.abs(x);
      var ramp = smoothstep(22, 95, d);
      var wall = smoothstep(ch * 0.45, ch * 1.3, ax);
      var rough = 0.55 + 0.45 * ridged(x * 0.0045 + 1.7, z * 0.0045, s, 4);
      var h = wall * wh * rough * ramp;
      h -= 5.5 * smoothstep(16, 70, d) * (1 - wall);        /* the channel floor */
      h += fbm2(x * 0.016, z * 0.016, s + 31, 3) * 3.2 * ramp;
      h += Math.pow(ridged(x * 0.004, z * 0.004, s + 91, 4), 1.3) * wh * 0.75 * smoothstep(330, 780, d);
      return h;
    };
  }
  /* rolling meadow */
  return function (x, z) {
    var d = Math.sqrt(x * x + z * z);
    var near = smoothstep(5, 46, d);
    var h = fbm2(x * f, z * f, s, 4) * amp * near;
    h += fbm2(x * f * 0.18 + 31.7, z * f * 0.18 - 12.3, s + 51, 3) * far * smoothstep(55, 420, d);
    h += fbm2(x * f * 0.055 - 7.1, z * f * 0.055 + 4.4, s + 707, 2) * far * 1.5 * smoothstep(260, 900, d);
    return h;
  };
}

/* Fair-weather cumulus are heaped, not smoke: the finer octaves are folded
   (1 - |2n - 1|) so they crease into cauliflower lobes, and the lookup is
   pushed about by a slow warp so the edges curl. The result is matched to the
   plain field's mean and spread, so the sky's cover thresholds mean the same. */
function billowClouds(f, S, seed) {
  var wx = tileFBM(S, seed + 17, 2, 2), wy = tileFBM(S, seed + 31, 2, 2);
  var out = new Float32Array(S * S), x, y, o, i;
  for (y = 0; y < S; y++) for (x = 0; x < S; x++) {
    i = y * S + x;
    var px = x + (wx[i] - 0.5) * S * 0.07, py = y + (wy[i] - 0.5) * S * 0.07;
    var acc = 0, amp = 1, norm = 0;
    for (o = 0; o < 5; o++) {
      var p = 3 * Math.pow(2, o), n = tnoise(px * p / S, py * p / S, p, seed + o * 977);
      acc += (o < 2 ? n : 1 - Math.abs(2 * n - 1)) * amp;
      norm += amp; amp *= 0.52;
    }
    out[i] = acc / norm;
  }
  var m0 = 0, m1 = 0, s0 = 0, s1 = 0, N = S * S;
  for (i = 0; i < N; i++) { m0 += f[i]; m1 += out[i]; }
  m0 /= N; m1 /= N;
  for (i = 0; i < N; i++) { s0 += (f[i] - m0) * (f[i] - m0); s1 += (out[i] - m1) * (out[i] - m1); }
  var k = Math.sqrt(s0 / Math.max(s1, 1e-9));
  for (i = 0; i < N; i++) out[i] = m0 + (out[i] - m1) * k;
  return out;
}

