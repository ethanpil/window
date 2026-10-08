/* ============================================================
   4. seed → world parameters
   ============================================================ */
var LOCK_KEYS = [['b', 'biome'], ['w', 'weather'], ['t', 'time'], ['n', 'window'], ['f', 'finish'],
  ['s', 'season'], ['v', 'view'], ['x', 'night']];

/* A seed is "base", optionally "#layout", optionally "@b=...,w=..." so that a
   copied link reproduces exactly what the sender is looking at. */
function parseSeed(str) {
  str = String(str);
  var locks = { biome: null, weather: null, time: null, window: null, finish: null,
                season: null, view: null, night: null };
  var at = str.indexOf('@');
  var head = at >= 0 ? str.slice(0, at) : str;
  var tail = at >= 0 ? str.slice(at + 1) : '';
  if (tail) {
    var parts = tail.split(','), i, k;
    for (i = 0; i < parts.length; i++) {
      var eq = parts[i].indexOf('=');
      if (eq <= 0) continue;
      var abbr = parts[i].slice(0, eq), val = parts[i].slice(eq + 1);
      for (k = 0; k < LOCK_KEYS.length; k++)
        if (LOCK_KEYS[k][0] === abbr && val) locks[LOCK_KEYS[k][1]] = val;
    }
  }
  var m = /^([\s\S]*?)#(\d+)$/.exec(head);
  var base = seedHex(m ? m[1] : head);
  var nonce = m ? (parseInt(m[2], 10) || 0) : 0;
  return { base: base, nonce: nonce, locks: locks, valid: base !== null };
}
function seedString(base, nonce, locks) {
  var out = base + (nonce ? '#' + nonce : ''), parts = [];
  for (var i = 0; i < LOCK_KEYS.length; i++) {
    var v = locks && locks[LOCK_KEYS[i][1]];
    if (v) parts.push(LOCK_KEYS[i][0] + '=' + v);
  }
  return parts.length ? out + '@' + parts.join(',') : out;
}

/* Layout draws always consume the identity stream, so the scene's ingredients
   stay put; when a layout number is set, the value used comes from a second
   stream instead. Same elements, new arrangement. */
function layoutRng(R, L) {
  var wrap = function (name) {
    return function (a, b) { var v = R[name](a, b); return L ? L[name](a, b) : v; };
  };
  return { range: wrap('range'), int: wrap('int'), chance: wrap('chance'), pick: wrap('pick'), f: wrap('f') };
}


/* ---------- scene codes ----------
   Everything that decides what you are looking at, packed into hex: which
   seed, which layout, every chosen ingredient, the detail tier, the panes,
   and the exact second on the scene's clock. Word seeds from the built-in
   lists pack to 20 bits; anything typed by hand is carried as text. */
/* Layout, version 2. Fields are fixed-width so the settings half is always
   twenty hex characters; sixteen reserved bits and the version nibble leave
   room for new options without breaking codes already in the wild. */
var CODE_VERSION = 2;
var CODE_DELIM = '-';
function bitWriter() {
  var bits = [];
  return {
    push: function (v, n) { for (var i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); },
    hex: function () {
      while (bits.length % 4) bits.push(0);
      var out = '';
      for (var i = 0; i < bits.length; i += 4) out += ((bits[i] << 3) | (bits[i + 1] << 2) | (bits[i + 2] << 1) | bits[i + 3]).toString(16);
      return out;
    }
  };
}
function bitReader(hex) {
  var bits = [];
  for (var i = 0; i < hex.length; i++) { var v = parseInt(hex[i], 16); bits.push((v >> 3) & 1, (v >> 2) & 1, (v >> 1) & 1, v & 1); }
  var pos = 0;
  return { read: function (n) { var v = 0; for (var k = 0; k < n; k++) v = (v << 1) | (bits[pos++] || 0); return v >>> 0; } };
}
var CODE_LISTS = function () {
  return {
    biome: Object.keys(BIOMES).sort(),
    weather: Object.keys(WEATHERS).sort(),
    time: TIME_ORDER,
    window: WINDOW_TYPES.map(function (t) { return t.name; }),
    finish: FINISHES.map(function (f) { return f.name; }),
    season: SEASON_ORDER,
    view: ['', 'open', 'bare']
  };
};
function encodeSettings(sp, qAuto, qTier, panes, t) {
  var L = CODE_LISTS(), w = bitWriter();
  w.push(CODE_VERSION, 4);
  w.push(Math.min(sp.nonce, 255), 8);
  w.push(L.biome.indexOf(sp.locks.biome) + 1, 6);
  w.push(L.weather.indexOf(sp.locks.weather) + 1, 5);
  w.push(L.time.indexOf(sp.locks.time) + 1, 3);
  w.push(L.window.indexOf(sp.locks.window) + 1, 5);
  w.push(L.finish.indexOf(sp.locks.finish) + 1, 5);
  w.push(L.season.indexOf(sp.locks.season) + 1, 3);
  w.push(Math.max(0, L.view.indexOf(sp.locks.view || '')), 2);
  w.push(sp.locks.night === 'off' ? 1 : 0, 1);
  w.push(qAuto ? 4 : qTier, 3);
  w.push(panes ? 1 : 0, 1);
  w.push(Math.floor(t || 0) & 0xFFFF, 16);
  w.push(0, 16);                                   /* reserved */
  return w.hex();
}
function encodeScene() {
  var sp = parseSeed(App.P.seed);
  return encodeSettings(sp, App.qAuto, App.qTier, App.clearPanes, App.t) + CODE_DELIM + sp.base;
}
function decodeScene(code) {
  var str = String(code).trim().toLowerCase();
  var m = /^([0-9a-f]{16,})-([0-9a-f]{8})$/.exec(str);
  if (!m) return null;
  var r = bitReader(m[1]), L = CODE_LISTS();
  var version = r.read(4);
  if (version < 2 || version > CODE_VERSION) return null;
  var nonce = r.read(8);
  var pick = function (list, bits) { var v = r.read(bits); return v ? list[v - 1] || null : null; };
  var locks = {
    biome: pick(L.biome, 6), weather: pick(L.weather, 5), time: pick(L.time, 3),
    window: pick(L.window, 5), finish: pick(L.finish, 5), season: pick(L.season, 3)
  };
  var view = L.view[r.read(2)]; locks.view = view || null;
  locks.night = r.read(1) ? 'off' : null;
  var tier = r.read(3), panes = r.read(1) === 1, t = r.read(16);
  return { seed: seedString(m[2], nonce, locks), qAuto: tier === 4, qTier: tier === 4 ? App.qTier : Math.min(tier, QUALITY.length - 1), panes: panes, t: t };
}
function isSceneCode(str) { return /^[0-9a-f]{16,}-[0-9a-f]{8}$/i.test(String(str).trim()); }
function applyScene(code) {
  var d = decodeScene(code);
  if (!d) return false;
  App.qAuto = d.qAuto; App.qTier = d.qTier; App.qChanges = d.qAuto ? 0 : 99;
  App.clearPanes = d.panes;
  App.pendingT = d.t;
  Prefs.set('panes', d.panes);
  go(d.seed);
  return true;
}

function buildParams(seedStr, nonce) {
  var parsed = parseSeed(seedStr);
  nonce = nonce == null ? parsed.nonce : nonce;
  var R = RNG(parsed.base);
  var L = nonce ? RNG(parsed.base + '/layout/' + nonce) : null;
  var LR = layoutRng(R, L);
  var LK = parsed.locks;                   /* chosen ingredients travel in the seed */
  var P = { seed: seedStr, base: parsed.base, nonce: nonce, locks: LK };

  /* which landscape, then which weather that landscape gets */
  var bPairs = [];
  for (var bk in BIOMES) bPairs.push([bk, BIOMES[bk].w]);
  P.biomeKey = R.weighted(bPairs);
  if (LK.biome && BIOMES[LK.biome]) P.biomeKey = LK.biome;
  P.biome = BIOMES[P.biomeKey];

  P.seasonKey = R.pick(SEASON_ORDER);
  if (LK.season && SEASONS[LK.season]) P.seasonKey = LK.season;
  if (P.seasonKey === 'winter' && NO_WINTER[P.biomeKey]) P.seasonKey = R.pick(['spring', 'summer', 'autumn']);
  P.season = SEASONS[P.seasonKey];

  var wPairs = [];
  for (var k in P.biome.weather) if (WEATHERS[k]) {
    var wgt = P.biome.weather[k];
    var snowy = (k === 'snowfall' || k === 'snowstorm');
    if (snowy) wgt *= (P.seasonKey === 'winter' ? 3.2 : (P.seasonKey === 'autumn' ? 0.5 : 0.06));
    if (NO_WINTER[P.biomeKey] && snowy) wgt = 0;
    if (k === 'clear' && P.seasonKey === 'summer') wgt *= 1.5;
    if (k === 'mist' && P.seasonKey === 'autumn') wgt *= 1.5;
    if (k === 'overcast' && P.seasonKey === 'winter') wgt *= 1.4;
    if (wgt > 0) wPairs.push([k, wgt]);
  }
  if (P.biome.weather.rainstorm && WEATHERS.storm && !NO_WINTER[P.biomeKey]) wPairs.push(['storm', P.biome.weather.rainstorm * 0.55]);
  else if (P.biome.weather.rainstorm && WEATHERS.storm) wPairs.push(['storm', P.biome.weather.rainstorm * 0.35]);
  P.weatherKey = R.weighted(wPairs);
  if (LK.weather && WEATHERS[LK.weather]) P.weatherKey = LK.weather;
  P.weather = WEATHERS[P.weatherKey];
  /* fixed for the world, so the frame need not work them out: dry air on a
     fine day, and how strongly a mirage lies on the flats */
  var fineWx = P.weatherKey === 'clear' || P.weatherKey === 'fair';
  P.dryClear = !!P.biome.dryAir && fineWx;
  P.mirageK = P.biome.mirage && fineWx ? (P.weatherKey === 'clear' ? 1 : 0.6) : 0;

  var tIdx = R.int(0, TIME_ORDER.length - 1);
  if (TIME_ORDER[tIdx] === 'night' && LK.night === 'off') tIdx = R.int(1, TIME_ORDER.length - 1);
  /* storms rarely sit at high noon; dawn/dusk feel better with weather */
  if ((P.weatherKey === 'rainstorm' || P.weatherKey === 'snowstorm') && tIdx === 2) tIdx = R.chance(0.5) ? 1 : 3;
  if (LK.time && TIMES[LK.time]) tIdx = TIME_ORDER.indexOf(LK.time);
  P.timeA = TIME_ORDER[tIdx];
  var dir = R.chance(0.5) ? 1 : -1;
  var tIdxB = clamp(tIdx + dir, 0, TIME_ORDER.length - 1);
  if (tIdxB === tIdx) tIdxB = tIdx - dir;
  P.timeB = TIME_ORDER[clamp(tIdxB, 0, TIME_ORDER.length - 1)];
  P.driftPeriod = R.range(420, 900);      /* seconds for a full sun breath */
  P.driftPhase = R.range(0, 6.283);
  P.driftAmount = R.range(0.35, 0.85);

  P.sunAz = R.range(-1.85, 1.85);          /* radians away from straight out the window */
  P.hazeMul = R.range(0.8, 1.35);

  /* wind */
  var wr = P.weather.wind;
  P.windBase = R.range(wr[0], wr[1]);
  P.windAngle = R.range(0, 6.283);
  P.windTurn = R.range(-0.012, 0.012);
  P.gustPeriod = R.range(9, 19);
  P.windName = WIND_NAMES[Math.floor(((P.windAngle / 6.283) * 8 + 0.5)) % 8];

  /* ground */
  var B = P.biome;
  var SEA = P.season;
  P.grass = R.pick(B.palettes);
  /* a tinted copy: the palette tables are shared. In sand country all four
     ground fields stay as drawn; dry grassland (savanna) keeps its earth. */
  P.grass = tintPalette(P.grass, SEA, B.ground === 'sand' ? 0 : 1, B.ground === 'sand' || B.dryAir ? 0 : 1);
  P.terrainSeed = LR.int(1, 100000);
  P.hillAmp = LR.range(0.5, 2.6);
  P.hillFreq = LR.range(0.010, 0.030);
  P.farHills = LR.range(6, 34);
  P.grassHeight = R.range(B.coverH[0], B.coverH[1])
    * (P.seasonKey === 'winter' ? 0.72 : (P.seasonKey === 'spring' ? 1.05 : 1));
  P.grassLean = R.range(0.5, 1.25);
  P.patchiness = R.range(0.15, 0.6);
  var cv = B.coverVar || [0.8, 1.15];
  P.coverCount = R.chance(B.coverChance == null ? 1 : B.coverChance)
    ? Math.round(B.cover * R.range(cv[0], cv[1])) : 0;
  P.coverStyle = B.coverStyle || 'grass';
  P.coverWet = !!B.coverWet;
  P.coverMinH = B.coverMinH || 0;
  P.coverWidth = P.coverStyle === 'reeds' ? 0.9 : (P.coverStyle === 'heather' ? 1.6 : 1);
  if (P.coverStyle === 'heather') P.grassLean = R.range(0.12, 0.3);
  if (P.coverStyle === 'reeds') P.grassLean = R.range(0.22, 0.5);
  P.coverRows = B.coverRows !== false;
  if (B.crop) {
    P.crop = R.pick([
      { name: 'maize',       h: [1.5, 2.3], cb: '#4d6b2c', ct: '#9fae4e', dry: '#c8bb63', gap: [0.72, 1.05] },
      { name: 'wheat',       h: [0.9, 1.4], cb: '#8a7c37', ct: '#d9c778', dry: '#e3d590', gap: [0.30, 0.52] },
      { name: 'barley',      h: [0.8, 1.3], cb: '#7d7538', ct: '#cfc07a', dry: '#ded08b', gap: [0.28, 0.48] },
      { name: 'strawberries',h: [0.26, 0.42], cb: '#3f5f2c', ct: '#6f8f3f', dry: '#b4402f', gap: [0.62, 0.95] }
    ]);
  }
  if (B.rows || P.crop || (B.flowers === 'dense' && R.chance(0.38))) {
    P.rowSpacing = LR.range(1.5, 2.6);
    P.rowAngle = LR.range(-0.35, 0.35);
    /* drawn always (the identity stream stays in step), used only for lavender:
       every crop and flower row had been painted lavender purple */
    var rowLav = R.pick(['#6b5d9e', '#7a68ad', '#5f5490', '#8878bd']);
    P.rowColour = P.biomeKey === 'lavender' ? rowLav : null;
    if (P.crop) P.rowSpacing = LR.range(P.crop.gap[0], P.crop.gap[1]);
    else if (P.biomeKey === 'lavender') P.rowSpacing = LR.range(0.72, 1.12);
  }
  if (P.crop) {
    P.grass.cb = P.crop.cb; P.grass.ct = P.crop.ct; P.grass.dry = P.crop.dry;
    P.grassHeight = R.range(P.crop.h[0], P.crop.h[1]);
    P.grassLean = R.range(0.30, 0.62);          /* a stiff stalk, not a grass blade */
    P.coverWidth = 1.5;
  }

  /* shape of the land, and any water in it */
  P.waterY = null;
  P.terrainKind = B.terrain;
  if (B.flatLand) { P.hillAmp = Math.min(P.hillAmp, 2.2); P.hillFreq *= 0.6; }
  if (B.terrain === 'urban') {
    /* A skyline needs the edge of a city in front of it, not open country:
       a park, a low neighbourhood, or the far bank of a river. */
    P.cityFront = R.pick(['park', 'houses', 'river']);
    P.terrainKind = P.cityFront === 'river' ? 'river' : 'rolling';
    P.grass = tintPalette(R.pick(GRASS_PALETTES), SEA, 1, 1);
    /* a park is mown, and gardens nearly so (the flowers are thinned once
       they are counted, below) */
    if (P.cityFront === 'park') { P.grassHeight *= 0.35; P.flowerScale = 0.4; }
    if (P.cityFront === 'houses') { P.grassHeight *= 0.6; P.flowerScale = 0.6; }
    P.hillAmp = Math.min(P.hillAmp, 3.2);      /* a city sits on level ground */
  }
  /* A worn way leading off: a footpath through grass, tramlines in a crop,
     a dirt road, a dry wash. Drawn into the ground, with the cover cleared
     along it, so it reads as used rather than painted on. */
  P.pathKind = null;
  /* (no canyon: a wash laid on the path's own curve climbed straight up the
     far wall; the canyon's dry wash is the channel down its floor) */
  var PATHABLE = { meadow: 'foot', moor: 'foot', hayfield: 'track', farmland: 'tram', flowerfield: 'foot',
    lavender: 'tram', orchard: 'track', blossom: 'track', autumn: 'foot', savanna: 'track',
    desert: 'wash', saltflat: 'track', tundra: 'foot', terraces: 'foot',
    alpine: 'foot', oasis: 'track', river: 'foot', lakefront: 'foot' };
  /* Every layout draw also consumes an identity draw, which is what keeps a
     reshuffle from changing the scene. So the draws must not be conditional on
     a layout result: take them all, then decide whether to use them. */
  var wantPath = LR.chance(0.45);
  var pk = PATHABLE[P.biomeKey] || 'foot';
  /* In farmed country and by the water the way off is as often a metalled
     lane: tarmac between verges, a dashed line down it, telegraph poles
     along it. Whether there is one is identity, from a stream of its own,
     so no layout draw moves; a road is there more often than a footpath. */
  var RD = RNG(P.base + '/road');
  var roadRoll = RD.f(), roadMore = RD.f();
  var road = !!{ meadow: 1, farmland: 1, hayfield: 1, river: 1, lakefront: 1 }[P.biomeKey] && roadRoll < 0.5;
  if (road) { pk = 'lane'; wantPath = wantPath || roadMore < 0.5; }
  var pathX = LR.range(-16, 16), pathBend = LR.range(-40, 40), pathPhase = LR.range(0, 6.283);
  var pw1 = LR.range(0.5, 0.9), pw2 = LR.range(5, 14), pw3 = LR.range(1.9, 3.2), pw4 = LR.range(0.6, 1.3);
  var pgauge = LR.range(2.6, 4.2);
  /* Which way the path runs is layout, from a stream of its own, so adding
     it moved no other draw. A path that always set off from under the window
     straight for the vanishing point read as a diagram of perspective: this
     one may lead away ahead, cut across the view at an angle, or pass along
     it some way out, and it meanders on a second, shorter swing (a field
     length or two) on top of the long one, so it bends out of sight. */
  var PL = RNG(P.base + '/path' + (nonce ? '/' + nonce : ''));
  var pMode = PL.weighted([['ahead', 3], ['diagonal', 4], ['across', 2]]);
  var pSide = PL.chance(0.5) ? 1 : -1;
  var pAng = { ahead: PL.range(0, 0.35), diagonal: PL.range(0.4, 0.85), across: PL.range(0.95, 1.3) };
  var pZ = { ahead: PL.range(3, 16), diagonal: PL.range(10, 40), across: PL.range(16, 80) };
  var pX = PL.range(-0.5, 0.5);
  var pBend2 = PL.range(4, 15) * (PL.chance(0.5) ? 1 : -1), pLen2 = PL.range(140, 280), pPh2 = PL.range(0, 6.283);
  if (PATHABLE[P.biomeKey] && wantPath) {
    P.pathKind = pk;
    P.pathX = pathX; P.pathBend = pathBend; P.pathPhase = pathPhase;
    P.pathAng = pSide * pAng[pMode];
    P.pathZ = -pZ[pMode];
    /* ahead, it may start off to one side; across or slanting, it passes
       through somewhere in the middle of the view */
    if (pMode !== 'ahead') P.pathX = pX * pZ[pMode] * 0.8;
    P.pathBend2 = pBend2; P.pathK2 = 6.2832 / pLen2; P.pathPhase2 = pPh2;
    /* The draws keep their old ranges (changing them would shift every draw
       after) and are remapped to real sizes: a wheel rut is 0.22 to 0.35m
       half-width on a 1.6 to 1.9m axle, with grass left standing on the
       crown between; ruts 2 to 3m wide on a 3 to 4m gauge had run together
       into one bare band eight metres across. Tramlines are half as wide. */
    var rutW = 0.22 + (pw3 - 1.9) / 1.3 * 0.13;
    P.pathW = pk === 'tram' ? pw1 * 0.5 : (pk === 'wash' ? pw2 : (pk === 'track' ? rutW : pw4));
    /* a lane is 5.6 to 6.4 m of tarmac (the foot path's draw, remapped) */
    if (pk === 'lane') P.pathW = 2.8 + (pw4 - 0.6) / 0.7 * 0.4;
    P.pathGauge = (pk === 'tram' || pk === 'track') ? 1.6 + (pgauge - 2.6) / 1.6 * 0.3 : 0;
  }

  if (B.terrain === 'gorge') {
    P.gorgeW = LR.range(26, 60);
    P.gorgeDepth = LR.range(16, 42);
    P.gorgePhase = LR.range(0, 6.283);
    P.gorgeBend = LR.range(-40, 40);
    P.waterY = -P.gorgeDepth + LR.range(1.0, 3.0);
    /* what kind of bridge it is, is identity: R.pick takes the same one R draw
       LR.pick did, so the identity stream stays in step */
    P.bridgeKind = R.pick(['suspension', 'arch', 'girder', 'stone']);
    P.bridgeZ = -LR.range(95, 210);
    P.bridgeDeck = P.waterY + P.gorgeDepth * LR.range(0.86, 1.02);
    P.trafficRate = LR.range(0.5, 2.4);          /* vehicles a second, each way */
  }
  if (B.terrain === 'canyon') {
    P.canyonW = LR.range(40, 110);
    P.canyonDepth = LR.range(40, 130);
    P.canyonPhase = LR.range(0, 6.283);
    P.canyonBend = LR.range(-70, 70);
    LR.int(3, 7);                    /* once the canyon's steps (the beds shape it now); kept so the stream runs on alike */
    P.strata = LR.int(7, 16);
    P.hasCanyonRiver = LR.chance(0.55);
    /* The river is painted on the floor by the terrain shader, down the
       inner channel (P._inRiver), not a water surface: the mesh hundreds of
       metres out is too coarse to cut a channel for one. So the canyon has
       no P.waterY (one set below the floor drew a plane nothing could see,
       floated a boat under the gravel and let plants stand in the river).
       This draw once set its level; it is kept so the stream runs on alike. */
    LR.range(2.1, 3.4);
    /* The window used to hang over the middle of the canyon, as high above
       its floor as the canyon is deep. It stands on the rim now, a ledge of
       rimrock in front, with the canyon running across the view below and
       the far wall facing it. The axis and the ledge are layout, from their
       own stream so no other draw moves. */
    var CY = RNG(P.base + '/canyon' + (nonce ? '/' + nonce : ''));
    P.canyonAng = (CY.chance(0.5) ? 1 : -1) * CY.range(1.0, 1.45);
    P.canyonLedge = CY.range(3, 10);
    /* the inner channel: half its width, and how it swings across the floor */
    P.chanW = CY.range(7.5, 20);
    P.chanPh = CY.range(0, 6.283);
  }
  /* The rock is laid down in beds, and one table of them drives both the
     shape of the walls and their colour: a hard bed stands as a cliff, a
     soft one weathers back to a slope with a bench on the hard bed below it.
     Thickness, hardness, bench and colour per bed are what this place is,
     from an identity stream of their own; sixteen always drawn. */
  if (B.terrain === 'canyon' || B.terrain === 'dunes') {
    var SB = RNG(P.base + '/strata');
    var bedSet = { 'red rock': [0, 0, 1, 1, 2, 5, 3, 0], 'painted desert': [0, 2, 3, 4, 6, 6, 5, 1], 'sandstone': [2, 3, 3, 1, 1, 0, 5, 2] }[P.grass.name] || [0, 1, 2, 3, 5, 1];
    P.beds = [];
    for (var bi = 0; bi < 16; bi++)
      P.beds.push({ th: SB.range(0.45, 1.6), hard: SB.f() < 0.45, bench: SB.range(0.5, 3.2), col: bedSet[Math.floor(SB.f() * bedSet.length)], tone: SB.range(-1, 1) });
  }
  if (B.terrain === 'cascade') {
    /* The rock and the water are cut from the same profile, so the fall always
       runs down the mountainside instead of hanging in front of it. The profile
       is a staircase read from the pool upward: near-vertical pitches where the
       water free-falls, sloping benches where it runs over rock. */
    P.fallX = LR.range(-26, 26) * 0.7;      /* keep the fall inside the glass */
    P.fallH = LR.range(30, 90);
    P.fallNotch = LR.range(8, 24);
    P.fallDrops = LR.int(1, 4);
    P.waterY = -2.2;
    P.poolZ = -LR.range(60, 110);
    P.mistPower = LR.range(0.5, 1.0);
    var segs = [];
    var yy = P.waterY + LR.range(0.4, 1.4), zz = P.poolZ;
    var perDrop = P.fallH / P.fallDrops;
    /* Always take the draws for the largest possible staircase and use only as
       many as this fall needs. A layout draw made a variable number of times
       desynchronises the identity stream, and a reshuffle would then change the
       scene rather than just its arrangement. */
    for (var si = 0; si < 4; si++) {
      var dh = perDrop * LR.range(0.75, 1.3);
      /* steep, but not so steep the terrain grid cannot resolve it: a pitch
         the mesh smooths into a ramp leaves the water floating off the rock */
      var dz = dh * LR.range(0.34, 0.70);
      var bz = LR.range(7, 26), bh = LR.range(0.8, 4.5);
      if (si >= P.fallDrops) continue;
      segs.push({ z0: zz, y0: yy, z1: zz - dz, y1: yy + dh, drop: 1 });
      yy += dh; zz -= dz;
      segs.push({ z0: zz, y0: yy, z1: zz - bz, y1: yy + bh, drop: 0 });
      yy += bh; zz -= bz;
    }
    P.fallSegs = segs;
    P.fallTopY = yy; P.fallTopZ = zz;
    P.massifH = P.fallH * LR.range(1.5, 3.0);          /* the mountain behind the fall */
    P.massifRun = LR.range(240, 520);
    P.gullyDepth = LR.range(3, 9);
    P.fallZ = P.poolZ;
  }
  if (B.terrain === 'oasis') {
    P.oasisW = LR.range(22, 54);
    P.oasisX = LR.range(-30, 30);
    P.oasisZ = -LR.range(48, 130);
    P.waterY = -5.2;
    P.palmCount = LR.int(9, 30);
    P.hasCamp = LR.chance(0.45);
  }
  /* A city's air is its own: rinsed clean after rain, a flat grey, or a
     warm brown smog. Identity, from a stream of its own (no LR draws). */
  if (B.terrain === 'skyline' || B.terrain === 'urban') {
    var CA = RNG(P.base + '/cityair');
    var air = CA.weighted([[0, 3], [1, 3], [2, 2]]);
    P.cityHaze = [[0.97, 1.0, 1.04], [1.0, 1.0, 1.0], [1.07, 1.0, 0.88]][air];
    P.cityHazeK = [0.8, 1.0, 1.15][air] * CA.range(0.9, 1.1);
  }
  if (B.terrain === 'skyline') {
    P.storey = LR.range(38, 130);                /* how far down the street is */
    P.blockW = LR.range(52, 84);                 /* the street grid */
    P.streetW = LR.range(15, 26);
    P.gridAngle = LR.range(-0.22, 0.22);
    P.towerMax = LR.range(60, 220);
    P.trafficRate = LR.range(1.2, 4.0);
  }

  var TK = P.terrainKind;
  if (TK === 'beach') {
    P.shoreRun = LR.range(26, 46);
    P.beachDrop = LR.range(3.6, 6.0);
    P.waterY = -LR.range(1.1, 2.0);
    P.waterKind = 'sea';
  } else if (TK === 'cliff') {
    P.cliffEdge = LR.range(14, 46);
    P.cliffDrop = LR.range(11, 30);
    P.cliffAmp = LR.range(18, 55);
    P.cliffPhase = LR.range(0, 6.283);
    P.waterY = -P.cliffDrop + LR.range(0.5, 3);
    P.waterKind = 'sea';
    P.farHills = LR.range(6, 22);
    /* A headland running out to sea on one side, so a cliff face stands in
       view: from the clifftop itself the edge drops away out of sight and the
       place read as a lawn by the sea. Layout, from its own stream. */
    var CC = RNG(P.base + '/cliff' + (nonce ? '/' + nonce : ''));
    P.headW = CC.range(40, 90);
    P.headX = (CC.chance(0.5) ? 1 : -1) * (P.headW * 0.8 + CC.range(25, 75));
    P.headLen = CC.range(120, 300);
  } else if (TK === 'terrace') {
    P.stepH = LR.range(0.7, 1.8);
    P.stepW = LR.range(7, 18);
    P.terraceGrade = LR.range(0.55, 1.0);
    P.terraceTilt = LR.range(-0.3, 0.3);
    P.farHills = LR.range(20, 60);
    /* the hillside falls away from the house to a valley floor and climbs
       again beyond it, so the treads are seen from above, stepping down */
    P.valleyD = RNG(P.base + '/terrace' + (nonce ? '/' + nonce : '')).range(70, 160);
  } else if (TK === 'slope') {
    P.slopeGrade = LR.range(0.06, 0.17);
    P.slopeDir = LR.range(-0.7, 0.7);
    P.farHills = LR.range(12, 40);
  } else if (TK === 'salt') {
    P.waterY = LR.range(0.005, 0.03);
    P.waterKind = 'mirror';
    P.farHills = LR.range(15, 50);
    /* the ranges round a salt pan are dark rock, not salt: they stood white
       as snow on the horizon */
    P.rockFrac = 0.25;
  } else if (TK === 'lake') {
    P.shoreRun = LR.range(9, 20);
    P.beachDrop = LR.range(2.2, 3.8);
    P.waterY = -LR.range(0.9, 1.8);
    P.waterKind = 'still';
    P.lakeFar = LR.range(250, 520);
    P.farHills = LR.range(10, 34);
  } else if (TK === 'river') {
    P.riverW = LR.range(7, 24);
    P.riverDepth = LR.range(1.8, 3.2);
    P.riverBend = LR.range(-26, 26);
    P.riverPhase = LR.range(0, 6.283);
    P.riverTilt = LR.range(-0.16, 0.16);
    P.riverOffset = (LR.chance(0.5) ? 1 : -1) * (P.riverW + LR.range(10, 34));
    P.waterY = -LR.range(0.7, 1.3);
    P.waterKind = 'flow';
    P.flowDown = R.chance(0.5) ? 1 : -1;
    P.farHills = LR.range(8, 26);
  } else if (TK === 'marsh') {
    P.waterY = -LR.range(0.10, 0.35);
    P.waterKind = 'still';
    P.farHills = LR.range(5, 16);
  } else if (TK === 'fjord') {
    P.channelW = LR.range(55, 130);
    P.wallH = LR.range(90, 230);
    P.waterY = -LR.range(1.6, 2.6);
    P.waterKind = 'still';
    P.farHills = LR.range(40, 90);
  } else if (TK === 'alpine') {
    P.peakH = LR.range(110, 260);
    P.snowFrac = LR.range(0.36, 0.60);
    P.rockFrac = LR.range(0.24, 0.42);
    /* the house is in a valley: its sides climb close by on the left and
       right, not only on the far horizon */
    var AV = RNG(P.base + '/valley' + (nonce ? '/' + nonce : ''));
    P.valleyW = AV.range(28, 70);
    P.valleyX = AV.range(-0.4, 0.4) * P.valleyW;
    P.valleyLift = AV.range(0.35, 0.7);
  } else if (TK === 'dunes') {
    P.duneAmp = LR.range(1.2, 3.4);
    P.mesaH = LR.chance(0.55) ? LR.range(25, 90) : LR.range(4, 18);
    P.farHills = P.mesaH;
    /* drawn unconditionally: branching on a layout value would knock the
       identity stream out of step and change the scene's ingredients */
    var mesaRock = LR.range(0.34, 0.55);
    if (P.mesaH > 24) P.rockFrac = mesaRock;
    /* Two deserts. An erg is a sea of sand: wind-built dunes, nothing on
       them but a few tussocks in the hollows between. A bajada is the long
       gravel apron below a range: a gentle slope paved with dark varnished
       stones, cut by dry washes, mesas standing off it, and the Sonoran
       plants (saguaro, creosote, ocotillo). Which one is identity; the dune
       field's set is layout. Both from streams of their own, so no other
       draw moves. */
    P.erg = RNG(P.base + '/desert').f() < 0.42;
    var DN = RNG(P.base + '/dunes' + (nonce ? '/' + nonce : ''));
    /* Transverse dunes square to the wind that built them: a long windward
       rise over most of each wavelength, then the slip face at the angle of
       repose. Crest lines wander (sums of sines, so the shader can follow
       them exactly) and crest height varies along them. */
    var lam = DN.range(60, 200), hd = clamp(lam * DN.range(0.065, 0.09), 5, 16);
    P.dune = {
      ang: P.windAngle + DN.range(-0.35, 0.35), lam: lam, hd: hd,
      sf: clamp(hd / (0.64 * lam), 0.08, 0.3),
      a1: DN.range(0.25, 0.6), k1: 6.2832 / (lam * DN.range(2.5, 5)), p1: DN.range(0, 6.283),
      a2: DN.range(0.08, 0.2), k2: 6.2832 / (lam * DN.range(0.9, 1.6)), p2: DN.range(0, 6.283),
      k3: 6.2832 / (lam * DN.range(1.2, 3)), p3: DN.range(0, 6.283),
      a3: DN.range(0.06, 0.15), k4: 6.2832 / (lam * DN.range(3, 4.5)), p4: DN.range(0, 6.283),
      /* the house stands on the flat between two dunes; they rise beyond it */
      r0: DN.range(10, 24), r1: DN.range(60, 140)
    };
    if (!P.erg) P.dune.hd = 0;
    /* nothing in an erg is rock: dune crests above the rock line went grey */
    if (P.erg) P.rockFrac = null;
  }
  if (TK === 'fjord') { P.snowFrac = LR.range(0.52, 0.76); P.rockFrac = LR.range(0.2, 0.34); }
  /* every landscape needs its own stone: an unknown key used to give
     new THREE.Color(undefined), which is white, and steep ground went chalk */
  P.rockCol = {
    meadow: '#6b675f', coast: '#8b8477', desert: '#9b6b47', alpine: '#6e6b66', fjord: '#5a5c5e',
    savanna: '#7c6a55', lavender: '#8a8272', penthouse: '#6e6a64', bridge: '#66635d',
    hayfield: '#757064', cascade: '#5e605c', canyon: '#8a4c30', oasis: '#a3805a',
    lakefront: '#6a6862', river: '#6b675f', flowerfield: '#6f6a60', marsh: '#57544b',
    cliffcoast: '#6d6c68', terraces: '#6a6253', orchard: '#8c8371', autumn: '#625c52',
    moor: '#55504a', tundra: '#5c5b57', saltflat: '#857b6e', bamboo: '#5e5a50',
    blossom: '#6b675f', farmland: '#6d675c', urban: '#6b6862'
  }[P.biomeKey] || ('#' + new THREE.Color(P.grass.soil).multiplyScalar(0.8).getHexString());
  P.highCol = P.biomeKey === 'desert' ? '#c8a074' : '#eef2f7';

  /* flowers */
  if (B.flowers === 'dense') {
    P.flowerCount = Math.round(R.int(4500, 15000) * SEA.flowers);
    P.species = [R.pick(FLOWERS)];
    P.singleColour = R.chance(0.45);
    if (!P.singleColour) {
      var extra = R.int(2, 3);
      for (var fx = 0; fx < extra; fx++) {
        var cand = R.pick(FLOWERS), dup = false;
        for (var fy = 0; fy < P.species.length; fy++) if (P.species[fy].name === cand.name) dup = true;
        if (!dup) P.species.push(cand);
      }
    }
    P.flowerReach = R.range(46, 60);
  } else {
    P.flowerCount = (B.flowers && !R.chance(0.12)) ? R.int(500, 1900) : 0;
    P.flowerCount = Math.round(P.flowerCount * SEA.flowers);
    /* a few daisies in a mown park lawn, rather more in the gardens */
    if (P.cityFront === 'park') P.flowerCount = Math.round(P.flowerCount * 0.2);
    if (P.cityFront === 'houses') P.flowerCount = Math.round(P.flowerCount * 0.5);
    P.species = [R.pick(FLOWERS)];
    if (R.chance(0.55)) {
      var s2 = R.pick(FLOWERS);
      if (s2.name !== P.species[0].name) P.species.push(s2);
    }
    P.flowerReach = 44;
  }
  /* no meadow flowers on the sand round an oasis (the draws are taken) */
  if (P.biomeKey === 'oasis') P.flowerCount = 0;

  /* what grows or sits on the land */
  P.props = [];
  var propList = B.props;
  /* a planted embankment, an avenue of park trees, or gardens and hedges */
  if (P.cityFront === 'river') propList = B.props.concat([{ kind: 'broadleaf', count: [10, 26], size: [6, 13], r: [12, 150] },
                                                            { kind: 'shrub', count: [10, 30], size: [1.0, 2.4], r: [8, 90] }]);
  if (P.cityFront === 'park') propList = B.props.concat([{ kind: 'broadleaf', count: [14, 34], size: [7, 15], r: [14, 170] },
                                                           { kind: 'shrub', count: [8, 22], size: [1.0, 2.2], r: [10, 110] }]);
  if (P.cityFront === 'houses') propList = B.props.concat([{ kind: 'broadleaf', count: [8, 20], size: [5, 11], r: [30, 170] },
                                                             { kind: 'hedge', count: [12, 30], size: [1.2, 2.0], r: [20, 130] }]);
  for (var pi = 0; pi < propList.length; pi++) {
    var sp = propList[pi];
    P.props.push({
      kind: sp.kind, count: R.int(sp.count[0], sp.count[1]),
      size: sp.size, r: sp.r, seed: R.int(1, 99999)
    });
  }
  /* A sand sea grows almost nothing: no cacti, no brittlebush, a few
     creosote and dead shrubs in the hollows between the dunes, and the odd
     stone where the sand is thin. Counts only; every draw is as it was. */
  if (P.erg) for (var ep = 0; ep < P.props.length; ep++) {
    var epk = P.props[ep];
    epk.count = Math.round(epk.count * ({ cactus: 0, brittlebush: 0, rock: 0.15 }[epk.kind] != null
      ? { cactus: 0, brittlebush: 0, rock: 0.15 }[epk.kind] : 0.4));
  }
  P.treeline = B.treeline ? R.chance(0.5) : false;
  P.treelineKind = B.treeline || 'broadleaf';
  P.treeTint = R.range(0.8, 1.15);
  if (B.autumn || (P.seasonKey === 'autumn' && !NO_WINTER[P.biomeKey])) {
    P.leafDark = R.pick(['#7a3f1c', '#8a5420', '#6d3a22', '#95611f']);
    P.leafLight = R.pick(['#d99236', '#e0a93f', '#c8752b', '#e6bc55']);
    P.treeTint = R.range(1.0, 1.2);
  }
  if (B.blossom || (P.seasonKey === 'spring' && B.props && /blossom|broadleaf|olive/.test(JSON.stringify(B.props))))
    P.blossomCol = R.pick(['#f6d7e0', '#fbe6ec', '#f2c9d8', '#fdf3f5']);
  P.baseSnow = B.baseSnow ? R.range(B.baseSnow[0], B.baseSnow[1]) : 0;
  if (P.seasonKey === 'winter' && !NO_WINTER[P.biomeKey])
    P.baseSnow = Math.max(P.baseSnow, R.range(0.25, 0.7));
  P.leafFall = B.leaffall ? R.int(B.leaffall[0], B.leaffall[1]) : 0;
  if (SEA.leaves && !P.leafFall && /broadleaf/.test(JSON.stringify(B.props || []))) P.leafFall = R.int(300, 1100);
  if (SEA.blossom && B.blossom && !P.leafFall) P.leafFall = R.int(300, 900);
  P.fallCol = B.blossom ? (P.blossomCol || '#f6d7e0') : (P.leafLight || '#c8862f');
  P.dust = B.dust ? R.int(B.dust[0], B.dust[1]) : 0;
  P.falls = B.waterfall ? R.int(B.waterfall[0], B.waterfall[1]) : 0;

  /* birds */
  P.birds = (P.weather.rain > 0.5 || P.weather.snow > 0.5) ? 0
    : (P.biome.raptors ? R.int(2, 4)
       : (R.chance(P.biomeKey === 'coast' ? 0.85 : 0.55) ? R.int(3, 12) : 0));

  /* window: the seed picks the style, the viewport picks the shape */
  var t = R.pick(WINDOW_TYPES);
  if (LK.window) {
    for (var wt = 0; wt < WINDOW_TYPES.length; wt++)
      if (WINDOW_TYPES[wt].name === LK.window) t = WINDOW_TYPES[wt];
  }
  var fin = t.metal
    ? R.pick(FINISHES.filter(function (f) { return f.type === 'metal'; }))
    : R.pick(FINISHES);
  if (LK.finish) {
    for (var ft = 0; ft < FINISHES.length; ft++)
      if (FINISHES[ft].name === LK.finish) fin = FINISHES[ft];
  }
  P.win = {
    type: t,
    finish: fin,
    glassH: R.range(1.75, 2.30),      /* physical height of the glazed area */
    viewFill: R.range(0.875, 0.925),  /* share of the frame the view takes up */
    pane: t.pane * R.range(0.85, 1.2),
    cy: R.range(1.45, 1.68),
    bar: t.bar * R.range(0.85, 1.2),
    frame: R.range(0.055, 0.095),
    casing: R.range(0.08, 0.18),
    casingDepth: R.range(0.018, 0.04),
    wallDepth: R.range(0.26, 0.62),
    sillDepth: R.range(0.10, 0.22),
    setback: R.range(0.45, 0.75),
    wallTint: R.pick(['#5c5751', '#57544e', '#4e4a45', '#615a50', '#514f4d', '#665e54']),
    /* filled in by sizeWindow() once the viewport is known */
    w: 2, h: 2, cols: 1, rows: 1, arch: false, meetingRow: 0
  };
  /* Where the window is in the house, and what lies under it. An eye a metre
     and a half above uncut grass sees the grass and little else: the bottom
     half of the view was blades, a marsh was a wall of reeds and a river was
     somewhere behind them. Some houses look out from an upper floor; at
     ground level there is usually something kept in front of the window, a
     mown strip, gravel or a bare yard, before the country starts. Both are
     part of what this place is, so they come from an identity stream of their
     own, and every draw is taken whatever is used. */
  var E = RNG(P.base + '/eye');
  var EYE = {   /* [chance of an upper floor, lowest, highest eye height above the ground] */
    river: [1, 3.6, 6.2], marsh: [1, 3.6, 6.0], cliffcoast: [0.85, 3.2, 6.0], terraces: [1, 4.5, 8.5],
    farmland: [1, 3.8, 6.4], flowerfield: [0.75, 3.2, 5.2], lakefront: [0.6, 3.2, 5.6],
    urban: [0.5, 7, 16], meadow: [0.3, 3.2, 5.0], hayfield: [0.3, 3.2, 5.0], savanna: [0.45, 3.4, 5.6],
    lavender: [0.5, 3.4, 5.4], orchard: [0.35, 3.2, 5.0], blossom: [0.35, 3.2, 5.0], autumn: [0.3, 3.2, 5.0],
    alpine: [0.35, 3.2, 5.6], bridge: [0.3, 3.2, 5.0], fjord: [0.35, 3.2, 5.6], cascade: [0.3, 3.2, 5.0],
    moor: [0.25, 3.2, 5.0], tundra: [0.2, 3.2, 4.6], coast: [0.3, 3.2, 5.0], oasis: [0.55, 3.2, 5.6],
    desert: [0.2, 3.2, 4.6], canyon: [0.6, 3.4, 7.0]
  }[P.biomeKey] || [0, 0, 0];
  var upper = E.f() < EYE[0], eyeH = E.range(EYE[1], EYE[2]);
  /* the ground in front: 1 mown lawn, 2 gravel behind a low wall, 3 bare
     yard, 4 a marsh bank kept clear of reeds */
  var CLEAR = {
    meadow: [1, 1, 0], flowerfield: [1, 1], river: [1, 1, 2], lakefront: [1, 2], marsh: [4],
    cliffcoast: [1, 2], orchard: [1, 1, 3], blossom: [1, 1], autumn: [1, 3], alpine: [2, 1, 0],
    farmland: [2, 3], lavender: [2, 2, 3], savanna: [3, 3, 0], urban: [1, 1, 2], bridge: [1, 2],
    fjord: [2, 1], cascade: [2, 0], hayfield: [0, 3], moor: [0, 0, 2], tundra: [0, 2]
  }[P.biomeKey] || [0];
  var clearKind = E.pick(CLEAR), clearD = E.range(5, 9), clearWall = E.range(0.38, 0.62);
  P.eyeH = upper ? eyeH : 0;
  P.win.cy += P.eyeH;
  P.clearKind = clearKind;
  /* deep enough to read as kept ground, shallow enough to leave the view:
     gravel behind its wall least of all, a marsh bank most */
  P.clearD = clearKind ? clearD * [0, 0.75, 0.6, 0.8, 2.0][clearKind] : 0;
  P.clearWall = clearKind === 2 ? clearWall : 0;
  return P;
}

var VFOV = 52, PITCH = 0.02;

/* Detail is a setting, not a guess. "auto" measures a few seconds of real frame
   time and settles on a tier; you can also pin one. */
var QUALITY = [
  { name: 'low',    grid: 96,  grassMul: 0.45, segs: 3, tex: 256, pixel: 0.85, propMul: 0.60, precipMul: 0.6, post: false },
  { name: 'medium', grid: 132, grassMul: 0.85, segs: 3, tex: 256, pixel: 1.15, propMul: 0.85, precipMul: 0.85 , post: true, ss: 1.35 },
  { name: 'high',   grid: 180, grassMul: 1.45, segs: 4, tex: 512, pixel: 1.55, propMul: 1.10, precipMul: 1.1 , post: true, ss: 1.5 },
  { name: 'ultra',  grid: 244, grassMul: 2.30, segs: 5, tex: 512, pixel: 2.00, propMul: 1.40, precipMul: 1.3 , post: true, ss: 1.5 }
];
function Q() { return QUALITY[App.qTier == null ? 1 : App.qTier]; }

/* How far back the eye sits from the glass, and how wide the glass is, for a
   screen of this shape */
function openingFor(W, aspect) {
  var tanV = Math.tan(VFOV * Math.PI / 360);
  var d = (W.glassH / W.viewFill) / (2 * tanV);
  return { d: d, glassW: clamp(2 * d * tanV * aspect * W.viewFill, 0.66, 7.6) };
}

/* The opening is cut to the shape of the screen: wide on a desktop, tall on a
   phone. Panes are added or dropped so they stay roughly square either way. */
function sizeWindow(P, aspect) {
  /* A view that has not been laid out yet reports no size at all, and 0/0 is
     NaN. That travels into the width of the opening and on into the wall
     texture, where createRadialGradient throws on a non-finite radius, out of
     the middle of the build, leaving the view black for good. Guarding the
     one caller in layout() was not enough: the world build calls this with
     window.innerWidth / window.innerHeight of its own. Guard it here, where
     every caller is covered. */
  if (!isFinite(aspect) || aspect <= 0) aspect = 1;
  var W = P.win, O = openingFor(W, aspect);
  var d = O.d, glassW = O.glassW;
  var inset = W.frame + 0.012;

  var before = W.w + ':' + W.h + ':' + W.cols + ':' + W.rows + ':' + W.arch + ':' + (App.clearPanes ? 1 : 0);
  W.clear = !!App.clearPanes;
  W.dist = d;
  W.w = glassW + 2 * inset;
  W.h = W.glassH + 2 * inset;
  /* a semicircular head needs the height to carry it */
  W.arch = !!P.win.type.arch && W.w < 2 * (W.h - 0.55);
  if (P.win.type.single || App.clearPanes) {
    W.cols = 1; W.rows = 1;
  } else {
    var rectH = W.arch ? W.glassH - glassW / 2 : W.glassH;
    W.cols = clamp(Math.round(glassW / W.pane), 1, 7);
    W.rows = clamp(Math.round(Math.max(rectH, 0.3) / W.pane), 1, 8);
  }
  W.meetingRow = (!App.clearPanes && P.win.type.meetingAt && W.rows > 2)
    ? clamp(Math.round(W.rows * P.win.type.meetingAt), 1, W.rows - 1) : 0;
  return before !== (W.w + ':' + W.h + ':' + W.cols + ':' + W.rows + ':' + W.arch + ':' + (App.clearPanes ? 1 : 0));
}

