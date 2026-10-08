/* ---------- the new scenes' own furniture ---------- */

/* A bridge across the gorge, in one of four styles, with cars crossing it.
   The deck is instanced once; the traffic is a stream of small boxes whose
   position along the deck is a function of time, so it costs nothing. */
function bridgeGeo(P, R, H) {
  var B = { pos: [], nor: [], idx: [], rib: [] };
  var span = P.gorgeW * 2.6 + 40, deckW = R.range(9, 15), th = R.range(0.8, 1.6);
  var i;
  /* The road carries well past the span, so the traffic leaves the view
     instead of driving into the bank. */
  var roadHalf = span * 0.5 + 130;
  /* The deck level came from the gorge depth alone and was never compared
     with the land, so it often sat below the rim: the ends of the span were
     buried and the cars went into the dirt. Lift it clear of every piece of
     ground the road crosses. */
  var rim = -1e9;
  for (i = -24; i <= 24; i++) rim = Math.max(rim, H(i / 24 * roadHalf, P.bridgeZ));
  P.bridgeDeck = rim + th * 0.5 + 0.6;
  var kind = P.bridgeKind, drop = P.bridgeDeck - P.waterY;
  /* New detail draws from a stream of their own, so the builder's is drawn
     as before. The road surface and the railings' kerbs are trim (rib 1),
     tarmac grey; the lines on it are their own white mesh; the approaches
     stand on earth banks, also their own mesh. */
  var BR = RNG(P.base + '/build/bridge' + (P.nonce ? '/' + P.nonce : ''));
  var trims = [], mark = function (fn) { var a0 = B.rib.length; fn(); trims.push(a0, B.rib.length); };
  var Mk = { pos: [], nor: [], idx: [], rib: [] }, Ek = { pos: [], nor: [], idx: [], rib: [] };
  /* the roadway, and its tarmac the whole length of the road */
  pushBox(B, 0, 0, 0, span * 0.5, th * 0.5, deckW * 0.5, 0);
  mark(function () { pushBox(B, 0, th * 0.5 + 0.04, 0, roadHalf, 0.06, deckW * 0.5 - 0.05, 0); });
  /* a dashed line down the middle, a solid one along each edge */
  for (var dx2 = -roadHalf + 2; dx2 < roadHalf - 2; dx2 += 9) pushBox(Mk, dx2 + 1.5, th * 0.5 + 0.105, 0, 1.5, 0.008, 0.07, 0);
  for (var el = -1; el <= 1; el += 2) pushBox(Mk, 0, th * 0.5 + 0.105, el * (deckW * 0.5 - 1.6), roadHalf, 0.008, 0.07, 0);
  /* The approach either side, on an earth bank whose sides slope out to the
     ground (it reaches below the ground so it meets the land instead of
     floating over it); a concrete abutment where it meets the span. */
  var segs = 22;
  for (i = 0; i < segs; i++) {
    var e0 = span * 0.5 + (roadHalf - span * 0.5) * (i / segs);
    var e1 = span * 0.5 + (roadHalf - span * 0.5) * ((i + 1) / segs);
    for (var sd = -1; sd <= 1; sd += 2) {
      var gy = Math.min(H(sd * e0, P.bridgeZ), H(sd * e1, P.bridgeZ)) - 4.0 - P.bridgeDeck;
      pushBox(B, sd * (e0 + e1) * 0.5, 0, 0, (e1 - e0) * 0.5 + 0.1, th * 0.5, deckW * 0.5, 0);
      var yT = -th * 0.5, wT = deckW * 0.5, wB = wT + (yT - gy) * 1.3, xa = sd * e0, xb = sd * e1;
      var ref = [(xa + xb) * 0.5, (yT + gy) * 0.5, 0];
      for (var zs = -1; zs <= 1; zs += 2)
        pushFace(Ek, [[xa, yT, zs * wT], [xb, yT, zs * wT], [xb, gy, zs * wB], [xa, gy, zs * wB]], ref);
      if (i === 0) {
        pushBox(B, sd * (span * 0.5 + 0.8), (yT + gy) * 0.5, 0, 0.8, (yT - gy) * 0.5, wT + 0.6, 0);
        pushFace(Ek, [[xa, yT, -wT], [xa, yT, wT], [xa, gy, wB], [xa, gy, -wB]], [xa + sd, (yT + gy) * 0.5, 0]);
      }
    }
  }
  /* Parapets: a stone bridge has walls; the others a kerb, posts and two
     rails, which reads as railing rather than a wall the length of the road. */
  for (var ps = -1; ps <= 1; ps += 2) {
    var pz = ps * (deckW * 0.5 - 0.3);
    if (P.bridgeKind === 'stone') { pushBox(B, 0, th * 0.5 + 0.5, pz, roadHalf, 0.5, 0.22, 0); continue; }
    mark(function () { pushBox(B, 0, th * 0.5 + 0.15, pz, roadHalf, 0.15, 0.25, 0); });
    /* rails and posts a few centimetres thick break up into dots once they
       are under a pixel; the view is fixed, so each length of rail is made
       at least most of a pixel thick (at 720 lines) at its distance */
    for (var rx = -roadHalf; rx < roadHalf - 0.01; rx += 20) {
      var rx1 = Math.min(rx + 20, roadHalf), rk = 4.7e-4 * Math.sqrt((rx + rx1) * (rx + rx1) * 0.25 + P.bridgeZ * P.bridgeZ);
      pushBox(B, (rx + rx1) * 0.5, th * 0.5 + 1.12, pz, (rx1 - rx) * 0.5, Math.max(0.06, rk), Math.max(0.07, rk), 0);
      pushBox(B, (rx + rx1) * 0.5, th * 0.5 + 0.68, pz, (rx1 - rx) * 0.5, Math.max(0.04, rk), Math.max(0.05, rk), 0);
    }
    for (var px2 = -roadHalf; px2 <= roadHalf; px2 += 3) {
      var pk2 = Math.max(0.06, 4.7e-4 * Math.sqrt(px2 * px2 + P.bridgeZ * P.bridgeZ));
      pushBox(B, px2, th * 0.5 + 0.7, pz, pk2, 0.45, pk2, 0);
    }
  }
  /* Lamp standards every 30 m, staggered from side to side, an arm out over
     the road; their lamps glow at night (buildBridge). */
  var lamps = [];
  for (var lx = -span * 0.5 - 40, ln = 0; lx <= span * 0.5 + 40; lx += 30, ln++) {
    var lz = (ln % 2 ? 1 : -1) * (deckW * 0.5 - 0.3);
    pushCyl(B, lx, th * 0.5, lz, 0.13, 0.09, 8.0, 6);
    pushBox(B, lx, th * 0.5 + 7.9, lz - Math.sign(lz) * 0.9, 0.08, 0.06, 0.9, 0);
    lamps.push([lx, th * 0.5 + 7.75, lz - Math.sign(lz) * 1.7]);
  }
  P.bridgeLamps = lamps;
  /* the ground under the bridge line, in the deck's own frame */
  var gAt = function (x) { return H(x, P.bridgeZ) - P.bridgeDeck; };
  /* a straight member from (x0,y0) to (x1,y1) at z: a box laid along it */
  var strut = function (x0, y0, x1, y1, z, hy, hz) {
    var dx = x1 - x0, dy = y1 - y0;
    pushBox(B, (x0 + x1) * 0.5, (y0 + y1) * 0.5, z, Math.sqrt(dx * dx + dy * dy) * 0.5 + hy * 0.5, hy, hz, 0, Math.atan2(dy, dx));
  };
  if (kind === 'suspension') {
    var towH = drop * R.range(0.42, 0.72), tx = span * R.range(0.20, 0.30);
    for (i = -1; i <= 1; i += 2) {
      /* the legs go all the way down, to the river or the gorge side */
      /* and stand beside the deck, their inner faces behind the kerb: on a
         narrow deck legs set on it stood in the traffic lanes */
      var legBot = Math.max(-drop, gAt(i * tx)) - 1.5, legZ = deckW * 0.5 + 0.6;
      for (var sgn = -1; sgn <= 1; sgn += 2) pushBox(B, i * tx, (towH + legBot) * 0.5, sgn * legZ, 1.1, (towH - legBot) * 0.5, 1.1, 0);
      pushBox(B, i * tx, towH - 1.2, 0, 1.4, 0.7, legZ, 0);
      pushBox(B, i * tx, -th * 0.5 - 0.9, 0, 1.2, 0.6, legZ, 0);      /* the cross-beam under the deck */
    }
    /* The main cable hangs between the tower tops and dips to just above the
       deck at mid-span; past each tower a backstay runs down to an anchorage
       at the abutment. It used to be one cosh curve over the whole span, which
       peaks at the ends: the cable stood up in the middle and drooped onto
       the towers, upside down. */
    var cTop = towH - 0.4, cLow = th * 0.5 + 1.6, anchorX = span * 0.5 + 6;
    var cableY = function (x) {
      var ax2 = Math.abs(x);
      if (ax2 <= tx) { var u = ax2 / tx; return cLow + (cTop - cLow) * u * u; }
      var v = (ax2 - tx) / (anchorX - tx);                         /* the backstay, a slight sag */
      return cTop + (0.4 - cTop) * v - 0.06 * (cTop - 0.4) * Math.sin(v * Math.PI);
    };
    for (var sgn2 = -1; sgn2 <= 1; sgn2 += 2) {
      var zc = sgn2 * (deckW * 0.5 - 0.2);           /* over the parapet, on the legs' inner edge */
      /* nodes: anchorage to tower, tower to tower, tower to anchorage, so
         there is always a node exactly on each tower top */
      var xs2 = [], q2;
      for (q2 = 0; q2 < 8; q2++) xs2.push(-anchorX + (anchorX - tx) * q2 / 8);
      for (q2 = 0; q2 < 32; q2++) xs2.push(-tx + 2 * tx * q2 / 32);
      for (q2 = 0; q2 <= 8; q2++) xs2.push(tx + (anchorX - tx) * q2 / 8);
      for (i = 0; i < xs2.length - 1; i++) {
        var x0 = xs2[i], x1 = xs2[i + 1];
        strut(x0, cableY(x0), x1, cableY(x1), zc, 0.2, 0.2);
        var hx = (x0 + x1) * 0.5, hy2 = cableY(hx);
        if (i % 2 === 0 && hy2 > th * 0.5 + 0.4) pushBox(B, hx, (hy2 + th * 0.5) * 0.5, zc, 0.08, (hy2 - th * 0.5) * 0.5, 0.08, 0);
      }
      /* anchor blocks, beside the road on the approach, not on it, reaching
         down into the bank as it slopes away */
      for (i = -1; i <= 1; i += 2) pushBox(B, i * anchorX, -1.05, sgn2 * (deckW * 0.5 + 1.05), 2.0, 2.45, 1.4, 0);
    }
  } else if (kind === 'arch') {
    /* A steel arch springs from low on the gorge walls and rises to its crown
       just under the deck, which stands on columns from it. It used to hang
       below the deck like a hammock. Find where each wall reaches the
       springing level. */
    var ySpr = Math.max(-drop * 0.78, -drop + 2.0), yCrown = -th * 0.5 - 1.2;
    var spr = [0, 0];
    for (var sd2 = 0; sd2 < 2; sd2++) {
      var dir = sd2 ? 1 : -1, xs = span * 0.42;
      for (var st = 1; st <= 60; st++) {
        var xt = dir * span * 0.5 * st / 60;
        if (gAt(xt) >= ySpr) { xs = Math.abs(xt); break; }
      }
      spr[sd2] = dir * (xs + 1.0);                       /* a little into the rock */
    }
    var archY = function (t) { var u = 2 * t - 1; return ySpr + (yCrown - ySpr) * (1 - u * u); };
    for (var sgn3 = -1; sgn3 <= 1; sgn3 += 2) {
      var za = sgn3 * (deckW * 0.5 - 1.0);
      for (i = 0; i < 30; i++) {
        var a0 = i / 30, a1 = (i + 1) / 30;
        var ax0 = spr[0] + (spr[1] - spr[0]) * a0, ax1 = spr[0] + (spr[1] - spr[0]) * a1;
        strut(ax0, archY(a0), ax1, archY(a1), za, 0.55, 0.5);
        var amx = (ax0 + ax1) * 0.5, amy = (archY(a0) + archY(a1)) * 0.5;
        if (i % 3 === 1 && amy < yCrown - 1.0) pushBox(B, amx, (amy - th * 0.5) * 0.5, za, 0.30, (-th * 0.5 - amy) * 0.5, 0.30, 0);
      }
      /* bracing between the two ribs at the crown and the quarters */
      if (sgn3 > 0) for (i = 1; i < 6; i++) { var bt = i / 6; pushBox(B, spr[0] + (spr[1] - spr[0]) * bt, archY(bt), 0, 0.3, 0.3, deckW * 0.5 - 1.0, 0); }
    }
  } else if (kind === 'stone') {
    /* Round arches carried on piers. The voussoirs were axis-aligned boxes set
       around a curve that bent downward, so the ring read as a row of flat
       plates hanging in the air under the deck. Put the curve the right way up
       and lay each stone along its own radius. */
    var arches = R.int(3, 6), aw = span / arches;
    var rr = Math.min(aw * 0.40, drop * 0.42), ringT = Math.max(0.5, aw * 0.05);
    var spring = -1.0 - rr, VN = 15, k, q;
    for (i = 0; i < arches; i++) {
      var px = -span * 0.5 + aw * (i + 0.5);
      for (k = 0; k <= VN; k++) {
        var ang = Math.PI * (k / VN);
        pushBox(B, px - Math.cos(ang) * rr, spring + Math.sin(ang) * rr, 0,
                Math.PI * rr / VN * 0.62, ringT * 0.5, deckW * 0.5, 0, Math.PI * 0.5 - ang);
      }
      /* the spandrel: wall over the haunch of the arch, up to the roadway */
      for (q = 0; q < 14; q++) {
        var sx = (q / 14 - 0.5 + 1 / 28) * aw;
        var ay = Math.abs(sx) < rr ? spring + Math.sqrt(rr * rr - sx * sx) : spring;
        if (ay < -0.25) pushBox(B, px + sx, (ay - 0.25) * 0.5, 0, aw / 28 + 0.05, (-0.25 - ay) * 0.5, deckW * 0.5, 0);
      }
      if (i > 0) pushBox(B, px - aw * 0.5, (spring - drop) * 0.5, 0, aw * 0.12, (spring + drop) * 0.5, deckW * 0.48, 0);
    }
    pushBox(B, -span * 0.5, (spring - drop) * 0.5, 0, aw * 0.16, (spring + drop) * 0.5, deckW * 0.48, 0);
    pushBox(B, span * 0.5, (spring - drop) * 0.5, 0, aw * 0.16, (spring + drop) * 0.5, deckW * 0.48, 0);
  } else { /* girder: a truss each side of the deck, piers to the floor */
    var gTop = -th * 0.5, gBot = -th * 0.5 - BR.range(3, 5), gH = (gTop - gBot) * 0.5, gMid = (gTop + gBot) * 0.5;
    var bay = span * 0.96 / 24;
    for (var gs = -1; gs <= 1; gs += 2) {
      var gz = gs * deckW * 0.40;
      pushBox(B, 0, gTop, gz, span * 0.5, 0.24, 0.30, 0);       /* top chord */
      pushBox(B, 0, gBot, gz, span * 0.5, 0.24, 0.30, 0);       /* bottom chord */
      /* the web: an upright at every bay with a diagonal between each pair.
         These were boxes turned about y, which laid flat plates out sideways
         under the deck instead of bracing anything. */
      for (i = 0; i <= 24; i++) {
        var dx = (i / 24 - 0.5) * span * 0.96;
        pushBox(B, dx, gMid, gz, 0.16, gH, 0.22, 0);
        if (i < 24) {
          var lean = Math.atan2(bay, gH * 2) * (i % 2 ? 1 : -1);
          pushBox(B, dx + bay * 0.5, gMid, gz, 0.14, Math.sqrt(bay * bay + gH * gH * 4) * 0.5, 0.18, 0, lean);
        }
      }
    }
    var piers = R.int(2, 4);
    for (i = 0; i < piers; i++) {
      var qx = (i / (piers - 1) - 0.5) * span * 0.72;
      pushBox(B, qx, (gBot - drop) * 0.5, 0, 1.5, (gBot + drop) * 0.5, deckW * 0.34, 0);
    }
  }
  /* A suspension or arch deck is stiffened by a truss along each edge, three
     metres deep: a slab a metre thick spanning two hundred read as paper. */
  if (kind === 'suspension' || kind === 'arch') {
    var tD = BR.range(2.6, 3.4), tTop = -th * 0.5, tBot = tTop - tD, tMid = (tTop + tBot) * 0.5, nb2 = Math.round(span / tD);
    var bay2 = span / nb2;
    for (var ts = -1; ts <= 1; ts += 2) {
      var tz = ts * (deckW * 0.5 - 0.4);
      pushBox(B, 0, tBot, tz, span * 0.5, 0.2, 0.25, 0);
      for (i = 0; i <= nb2; i++) {
        var tx2 = -span * 0.5 + i * bay2;
        pushBox(B, tx2, tMid, tz, 0.13, tD * 0.5, 0.18, 0);
        if (i < nb2) pushBox(B, tx2 + bay2 * 0.5, tMid, tz, 0.11, Math.sqrt(bay2 * bay2 + tD * tD) * 0.5, 0.15, 0, Math.atan2(bay2, tD) * (i % 2 ? 1 : -1));
      }
    }
  }
  P.bridgeSpan = span; P.bridgeW = deckW; P.bridgeTh = th; P.bridgeRoad = roadHalf * 2;
  for (i = 0; i < B.rib.length; i++) B.rib[i] = 0;
  for (i = 0; i < trims.length; i += 2) for (var t2 = trims[i]; t2 < trims[i + 1]; t2++) B.rib[t2] = 1;
  P.bridgeLines = finishGeo(Mk); P.bridgeBank = finishGeo(Ek);
  return finishGeo(B);
}
function buildBridge(scene, P, R, U, H) {
  var col = { suspension: '#9aa2a6', arch: '#8e9498', girder: '#6f5a4a', stone: '#a3968a' }[P.bridgeKind];
  /* no foot to darken: the bridge's origin is its deck, not the ground */
  var mat = solidMat(U, col, { rib: 0, grain: 0, spines: 0, body2: '#36373a', twoTone: 1, aoH: 0, lift: 1 });
  var geo = bridgeGeo(P, R, H);
  var at = [[0, P.bridgeDeck, P.bridgeZ, 1, 0, 1, 1]];
  instanceSolid(scene, geo, at, mat);
  /* the lines lie a centimetre over the tarmac: pulled forward in depth so
     the two do not fight at range, and faded into it once thinner than a
     pixel, where they would only break into dots */
  var lm = solidMat(U, '#d9d7d0', { rib: 0, grain: 0, spines: 0, aoH: 0, lift: 1, body2: '#36373a', thin: 0.14 });
  lm.polygonOffset = true; lm.polygonOffsetFactor = -2; lm.polygonOffsetUnits = -4;
  instanceSolid(scene, P.bridgeLines, at, lm);
  /* the banks are earth grown over with grass */
  var bank = new THREE.Color(P.grass.base).lerp(new THREE.Color(P.grass.soil), 0.35);
  instanceSolid(scene, P.bridgeBank, at, solidMat(U, '#' + bank.getHexString(), { rib: 0, grain: 0, spines: 0, aoH: 0 }));
  var glows = [];
  for (var li = 0; li < P.bridgeLamps.length; li++) {
    var lp = P.bridgeLamps[li];
    glows.push([lp[0], P.bridgeDeck + lp[1], P.bridgeZ + lp[2], 1.1, 1.6, 1.3, 0.9, 0]);
  }
  buildGlows(scene, U, glows);
  App._shadows.push([0, P.bridgeDeck, P.bridgeZ, P.bridgeSpan * 0.22, 0.75, 2]);
  buildTraffic(scene, P, R, U, {
    x: 0, y: P.bridgeDeck + P.bridgeTh * 0.5 + 0.10, z: P.bridgeZ, len: P.bridgeRoad, dir: [1, 0],   /* the tarmac's top */
    /* each lane in the middle of its half of the road: between the centre
       line and the edge line (bridgeGeo), clear of the kerbs and towers */
    lanes: [-(P.bridgeW * 0.5 - 1.6) * 0.5, (P.bridgeW * 0.5 - 1.6) * 0.5], rate: P.trafficRate, speed: [20, 25], lift: 1
  });
}

/* Vehicles along a straight road through o.x, o.z running along o.dir (a
   unit vector in the ground plane), o.len long, one lane at each offset in
   o.lanes across it (a positive offset runs with o.dir, a negative one
   against it). Speeds are in metres a second, one per lane, so cars in a
   lane never run through each other. o.parked: the kerb lines (signed) that
   parked cars line, o.parkLen of them along the middle of the road, nose to
   tail with gaps, none where o.skip(along, length) says (junctions and their
   crossings). A car is two boxes, a body and a glazed cabin set in
   on it; a lorry a cab and a box; and a dark patch under each for the
   shadow it stands in. */
function buildTraffic(scene, P, R, U, o) {
  var lanes = o.lanes.length;
  var perLane = Math.max(3, Math.round(o.spacing ? o.len / o.spacing : o.rate * 7));
  var cars = [];
  for (var L = 0; L < lanes; L++) {
    var laneSpeed = R.range(o.speed[0], o.speed[1]);
    for (var i = 0; i < perLane; i++)
      cars.push([o.lanes[L], o.lanes[L] >= 0 ? 1 : -1, laneSpeed, (i + R.range(-0.35, 0.35)) / perLane]);
  }
  /* parked vehicles bumper to bumper down a kerb (o.parked: the kerb lines,
     signed): each one sized before it is placed, so a lorry takes the room of
     a lorry, and none where o.skip(centre, length) says no */
  var parked = o.parked || [];
  for (var pk = 0; pk < parked.length; pk++) {
    for (var a = -o.parkLen * 0.5; ;) {
      var pTruck = R.f() < 0.05, pLen = pTruck ? R.range(7, 11) : R.range(3.9, 4.9);
      var at = a + pLen * 0.5;
      a += pLen + R.range(1.0, 2.6);
      if (a > o.parkLen * 0.5) break;
      if (R.f() < 0.35 || (o.skip && o.skip(at, pLen))) continue;
      cars.push([parked[pk], parked[pk] >= 0 ? 1 : -1, 0, at / o.len + 0.5, pTruck, pLen]);
    }
  }
  var N = cars.length;
  /* the template: three unit boxes, told apart by aPart (0 lower body, 1
     cabin or cargo box, 2 the shadow), shaped per vehicle in the shader */
  var tpl = new THREE.BoxGeometry(1, 1, 1);
  var tp = tpl.attributes.position.array, tn = tpl.attributes.normal.array, ti = tpl.index.array;
  var pos = [], nor = [], part = [], idx = [];
  for (var pt = 0; pt < 3; pt++) {
    var base = pos.length / 3;
    for (var v = 0; v < tp.length; v++) { pos.push(tp[v]); nor.push(tn[v]); }
    for (var v2 = 0; v2 < tp.length / 3; v2++) part.push(pt);
    for (var v3 = 0; v3 < ti.length; v3++) idx.push(ti[v3] + base);
  }
  tpl.dispose();
  var geo = new THREE.InstancedBufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('aPart', new THREE.Float32BufferAttribute(part, 1));
  var iAttr = new Float32Array(N * 4), iCol = new Float32Array(N * 3), iLane = new Float32Array(N * 4);
  var carCols = ['#c8ccd0', '#2f3438', '#8d2f2a', '#2c4a72', '#c9a23a', '#3e6b46', '#d8d2c4', '#6a6d70', '#1d1f22', '#e8e6e0', '#5b6168'];
  for (var m = 0; m < N; m++) {
    var pc = cars[m].length > 4, truck = pc ? cars[m][4] : R.f() < 0.16;
    iAttr[m * 4] = pc ? cars[m][5] : truck ? R.range(7, 11) : R.range(3.9, 4.9); /* length */
    iAttr[m * 4 + 1] = truck ? R.range(2.6, 3.4) : R.range(1.4, 1.6); /* height */
    iAttr[m * 4 + 2] = truck ? R.range(2.4, 2.55) : R.range(1.75, 1.95); /* width */
    iAttr[m * 4 + 3] = cars[m][3];                                      /* start along the line */
    var c = new THREE.Color(truck ? R.pick(['#d8d2c4', '#8d8f92', '#2f3438', '#e6e4de']) : R.pick(carCols));
    iCol[m * 3] = c.r; iCol[m * 3 + 1] = c.g; iCol[m * 3 + 2] = c.b;
    /* a parked one keeps a hand's width off the kerb */
    iLane[m * 4] = pc ? cars[m][0] - cars[m][1] * (0.3 + iAttr[m * 4 + 2] * 0.5) : cars[m][0];
    iLane[m * 4 + 1] = cars[m][1];                                      /* which way it faces */
    iLane[m * 4 + 2] = cars[m][2];                                      /* metres a second */
    iLane[m * 4 + 3] = truck ? 1 : 0;
  }
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 4));
  geo.setAttribute('iCol', new THREE.InstancedBufferAttribute(iCol, 3));
  geo.setAttribute('iLane', new THREE.InstancedBufferAttribute(iLane, 4));
  geo.instanceCount = N;
  var mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol,
      uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uCamPos: U.uCamPos,
      uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
      uNight: App.skyU.uNight,
      uOrigin: { value: new THREE.Vector3(o.x || 0, o.y, o.z) },
      uDir: { value: new THREE.Vector2(o.dir[0], o.dir[1]).normalize() },
      uLen: { value: o.len },
      uLift: { value: o.lift ? 1 : 0 }
    },
    extensions: { derivatives: true },
    vertexShader: [
      'attribute vec4 iAttr; attribute vec3 iCol; attribute vec4 iLane; attribute float aPart;',
      'uniform float uTime, uFogDensity, uLen, uShadow, uNight, uLift;',
      'uniform vec2 uDir;',
      'uniform vec3 uOrigin, uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;',
      'varying vec3 vCol; varying float vFog; varying vec3 vHaze; varying vec3 vLoc; varying float vEnd; varying float vPart; varying vec3 vNl; varying vec2 vKind;',
      GLSL_COMMON,
      'void main(){',
      '  float dir = iLane.y, truck = iLane.w;',
      '  float u = fract(iAttr.w + uTime * iLane.z / uLen * dir + 1.0);',
      '  float along = (u - 0.5) * uLen;',
      '  vec2 across = vec2(-uDir.y, uDir.x);',
      /* each part's box within the vehicle (x along it, y up, z across),
         as fractions of length, height and width */
      '  vec3 lo = vec3(-0.5, 0.10, -0.5), hi = vec3(0.5, 0.52, 0.5);',
      '  if (aPart > 0.5 && aPart < 1.5) { lo = mix(vec3(-0.30, 0.52, -0.42), vec3(-0.5, 0.10, -0.5), truck); hi = mix(vec3(0.20, 1.0, 0.42), vec3(0.24, 1.0, 0.5), truck); }',
      '  if (aPart < 0.5) { lo = mix(lo, vec3(0.27, 0.10, -0.47), truck); hi = mix(hi, vec3(0.5, 0.80, 0.47), truck); }',
      '  if (aPart > 1.5) { lo = vec3(-0.53, 0.0, -0.56); hi = vec3(0.53, 0.012, 0.56); }',
      /* facing back down the road: the same shape mirrored (bounds, not a
         negative scale, which would turn the faces inside out) */
      '  if (dir < 0.0) { float t0 = lo.x; lo.x = -hi.x; hi.x = -t0; }',
      '  vec3 q = mix(lo, hi, position + 0.5);',
      '  vec3 lp = q * vec3(iAttr.x, iAttr.y, iAttr.z);',
      '  vec2 xz = uOrigin.xz + uDir * (along + lp.x) + across * (iLane.x + lp.z);',
      '  vec3 p = vec3(xz.x, uOrigin.y + lp.y + 0.02, xz.y);',
      '  vec2 nxz = uDir * normal.x + across * normal.z;',
      '  vec3 n = normalize(vec3(nxz.x, normal.y, nxz.y));',
      '  float diff = max(dot(n, normalize(uSunDir)), 0.0);',
      '  float sh = mix(1.0 - uShadow, 1.0, cloudShade(xz, uTime)) * mix(0.03, 1.0, bakedSun(p, uLift));',
      '  vCol = iCol * (hemi(n, uAmbCol * 1.1) + uSunCol * diff * 1.05 * sh);',
      /* paint and glass catch the sky on their tops */
      '  vCol += uFogCol * 0.10 * smoothstep(0.5, 0.9, n.y);',
      '  vCol = mix(vCol, vec3(0.025) * (1.0 + uAmbCol), step(1.5, aPart));',
      /* which end this face is: +1 the front, -1 the back, 0 a side */
      '  vEnd = normal.x * dir; vKind = vec2(truck, step(0.1, iLane.z));',
      '  vLoc = position; vPart = aPart; vNl = normal;',
      '  vec4 mv = modelViewMatrix * vec4(p, 1.0);',
      '  vFog = fogAmtH(-mv.z, uFogDensity, p.y);',
      '  vHaze = hazeAt(uFogCol, normalize(p - cameraPosition), uSunDir, uSunCol, vFog);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform float uNight;',
      'varying vec3 vCol; varying float vFog; varying vec3 vHaze; varying vec3 vLoc; varying float vEnd; varying float vPart; varying vec3 vNl; varying vec2 vKind;',
      'void main(){',
      '  vec3 c = vCol;',
      /* A car's cabin is glass all round below its roof; a lorry's cab is
         glazed in its upper half and its box is blank. A dark band of tyres
         and sill runs along the foot of the body. */
      '  float truck = vKind.x, p0 = 1.0 - step(0.5, vPart), p1 = step(0.5, vPart) * step(vPart, 1.5);',
      '  float wall = 1.0 - step(0.5, abs(vNl.y));',
      '  float fw = fwidth(vLoc.y);',
      '  float pane = mix(smoothstep(-0.42 - fw, -0.30 + fw, vLoc.y) * (1.0 - smoothstep(0.32 - fw, 0.42 + fw, vLoc.y)),',
      '                   smoothstep(0.0 - fw, 0.08 + fw, vLoc.y) * (1.0 - smoothstep(0.38 - fw, 0.46 + fw, vLoc.y)) * (1.0 - step(0.5, -vEnd)), truck);',
      '  float glass = mix(p1, p0, truck) * wall * pane;',
      '  c = mix(c, vec3(0.05, 0.06, 0.07) + vHaze * 0.18, glass * 0.92);',
      '  float lowK = mix(p0, p0 + p1, truck);',
      '  c *= 1.0 - 0.75 * lowK * wall * (1.0 - smoothstep(mix(-0.30, -0.40, truck), mix(-0.18, -0.30, truck), vLoc.y));',
      /* A pair of lamps at each end: warm white headlights in front, red
         tail lights behind, lit while the vehicle is moving. Once a lamp is
         under a pixel it fades to its share of the end face, so it cannot
         flicker. */
      '  float front = smoothstep(0.5, 0.9, vEnd), back = smoothstep(0.5, 0.9, -vEnd);',
      '  float onLamp = mix(p0, p0 * front + p1 * back, truck);',
      '  vec2 lq = vec2((abs(vLoc.z) - 0.33) / 0.11, (vLoc.y - mix(0.22, -0.26, truck)) / mix(0.13, 0.07, truck));',
      '  float d = length(lq), fd = fwidth(d);',
      '  float spot = 1.0 - smoothstep(0.7 - fd, 1.0 + fd, d);',
      '  spot = mix(spot, 0.12, smoothstep(0.6, 2.5, fd)) * onLamp * vKind.y;',
      '  c += (vec3(1.0, 0.92, 0.76) * 2.4 * front + vec3(1.0, 0.10, 0.06) * 1.5 * back) * spot * uNight;',
      '  gl_FragColor = vec4(tone(mix(c, vHaze, vFog)), 1.0);',
      '}'
    ].join('\n')
  });
  var mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  scene.add(mesh);
  App.propMeshes.push(mesh);
}

/* Small lights seen from afar: street lamps along the pavements, red
   obstacle lights on tall roofs. pts[i] = [x, y, z, size m, r, g, b, mode]
   mode 0 a lamp, lit at night and on dark days; 1 an aviation light, always
   on, blinking with all the others. Each keeps to at least a few pixels and
   gives up brightness as it grows past its size, so it neither vanishes nor
   swells with distance. */
function buildGlows(scene, U, pts) {
  if (!pts.length) return;
  var quad = new THREE.PlaneGeometry(1, 1);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index;
  geo.setAttribute('position', quad.attributes.position);
  geo.setAttribute('uv', quad.attributes.uv);
  var n = pts.length, iPos = new Float32Array(n * 3), iGlow = new Float32Array(n * 4), iMode = new Float32Array(n * 2);
  for (var i = 0; i < n; i++) {
    var p = pts[i];
    iPos[i * 3] = p[0]; iPos[i * 3 + 1] = p[1]; iPos[i * 3 + 2] = p[2];
    iGlow[i * 4] = p[3]; iGlow[i * 4 + 1] = p[4]; iGlow[i * 4 + 2] = p[5]; iGlow[i * 4 + 3] = p[6];
    iMode[i * 2] = p[7]; iMode[i * 2 + 1] = p[8] || 0;
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iGlow', new THREE.InstancedBufferAttribute(iGlow, 4));
  geo.setAttribute('iMode', new THREE.InstancedBufferAttribute(iMode, 2));
  geo.instanceCount = n;
  var mat = new THREE.ShaderMaterial({
    uniforms: { uTime: U.uTime, uCamPos: U.uCamPos, uNight: App.skyU.uNight, uSunCol: U.uSunCol, uFogDensity: U.uFogDensity },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: [
      'attribute vec3 iPos; attribute vec4 iGlow; attribute vec2 iMode;',
      'uniform vec3 uCamPos, uSunCol; uniform float uTime, uNight, uFogDensity;',
      'varying vec2 vUv; varying vec3 vC;',
      GLSL_COMMON,
      'void main(){',
      '  vec3 toCam = uCamPos - iPos; float d = length(toCam); toCam /= d;',
      '  vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam));',
      '  vec3 up = cross(toCam, right);',
      '  float s = max(iGlow.x, d * 0.0042);',
      '  float dim = 1.0 - smoothstep(0.25, 0.80, dot(uSunCol, vec3(0.30, 0.59, 0.11)));',
      '  float on = iMode.x < 0.5 ? max(uNight, dim * 0.5) : (0.25 + 0.75 * uNight) * (0.3 + 0.7 * step(0.75, fract(uTime / 2.0 + iMode.y)));',
      '  vec4 mv = modelViewMatrix * vec4(iPos, 1.0);',
      '  vC = iGlow.yzw * on * clamp(iGlow.x * iGlow.x / (s * s), 0.18, 1.0) * (1.0 - fogAmt(-mv.z, uFogDensity) * 0.85);',
      '  vec3 p = iPos + (right * position.x + up * position.y) * s;',
      '  vUv = uv;',
      '  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);',
      /* unlit (a lamp by day): put it outside the view, so it costs no pixels */
      '  if (on < 0.002) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec2 vUv; varying vec3 vC;',
      'void main(){',
      '  float r = length(vUv - 0.5) * 2.0;',
      '  float k = exp(-r * r * 5.0) * (1.0 - smoothstep(0.8, 1.0, r));',
      '  gl_FragColor = vec4(vC * k, 1.0);',
      '}'
    ].join('\n')
  });
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.userData.noTrim = true;              /* the beacons are last in the list: trimming put them out first */
  m.renderOrder = 8;
  scene.add(m);
  App.propMeshes.push(m);
}

/* Street trees down the pavements, a lamp every CITY_LAMP m (where the ground
   draws its pool of light), and the city's traffic: moving lanes and
   parked cars on four to six streets round the view. C: cityPlan. Streets
   are named by the grid line they run down: an x street at gx = (k + 0.5)
   pitch runs along the grid's z. */
function cityStreets(scene, P, R, U, H, C, opt) {
  var SR = RNG(P.base + '/build/streets' + (P.nonce ? '/' + P.nonce : ''));
  var tSeed = SR.int(1, 9999);
  var half = C.pitch * 0.5, lampIn = C.sk - CITY_LAMP_IN;
  var near = function (x, z) { return Math.sqrt(x * x + z * z); };
  var inRing = function (gx, gz) {
    /* a street is drawn where either block beside it is in the city */
    var w = C.toWorld(gx, gz), d = near(w[0], w[1]);
    return d >= C.streetStart && d <= C.end;
  };
  var y = function (x, z) { return opt.flat != null ? opt.flat : H(x, z); };
  /* lamps: the same places as the ground's pools (see buildTerrain) */
  var glows = [], trees = [], reach = opt.reach;
  var nb = Math.ceil(reach / C.pitch) + 1;
  for (var axis = 0; axis < 2; axis++) {
    for (var k = -nb; k <= nb; k++) {
      var line = (k + 0.5) * C.pitch;                    /* the street's centre line */
      for (var sd = -1; sd <= 1; sd += 2) {
        /* sd: which pavement. The block on the -side has this pavement on
           its + edge, where the ground's stagger is 0; the other, half a gap. */
        var off = line + sd * (C.sw * 0.5 - lampIn), st = sd < 0 ? 0 : CITY_LAMP / 2;
        var treesHere = ihash(k * 7 + axis, sd + 3, tSeed) < (opt.trees || 0);
        var treeOff = line + sd * (C.sw * 0.5 - C.sk * 0.45);
        for (var a = -reach; a <= reach; a += CITY_LAMP) {
          var al = Math.round(a / CITY_LAMP) * CITY_LAMP - st;
          var g = axis ? [al, off] : [off, al];
          var bc = axis ? [al, line + sd * half] : [line + sd * half, al];
          if (!inRing(bc[0], bc[1])) continue;
          var w = C.toWorld(g[0], g[1]);
          if (near(w[0], w[1]) > reach || w[1] > 30) continue;
          var gy = y(w[0], w[1]);
          if (P.waterY != null && gy < P.waterY + 0.8) continue;
          glows.push([w[0], gy + 7.5, w[1], 0.55, 1.0, 0.80, 0.56, 0]);
        }
        if (!treesHere) continue;
        for (var b = -reach; b <= reach; b += 9) {
          /* not across a junction: the along coordinate in its block */
          var inBlk = b - Math.round(b / C.pitch) * C.pitch;
          if (Math.abs(inBlk) > C.bw * 0.5 - 2) continue;
          var g2 = axis ? [b + SR.range(-0.6, 0.6), treeOff] : [treeOff, b + SR.range(-0.6, 0.6)];
          var bc2 = axis ? [Math.round(b / C.pitch) * C.pitch, line + sd * half] : [line + sd * half, Math.round(b / C.pitch) * C.pitch];
          if (!inRing(bc2[0], bc2[1])) continue;
          var w2 = C.toWorld(g2[0], g2[1]);
          var d2 = near(w2[0], w2[1]);
          if (d2 > opt.treeReach || w2[1] > 10) continue;
          var ty = y(w2[0], w2[1]);
          if (P.waterY != null && ty < P.waterY + 0.8) continue;
          trees.push([w2[0], ty - 0.1, w2[1], SR.range(0.85, 1.25), SR.range(0, 6.283), SR.range(0.9, 1.15), 1]);
        }
      }
    }
  }
  buildGlows(scene, U, glows.concat(opt.beacons || []));
  if (trees.length) {
    var T = { pos: [], nor: [], idx: [], rib: [] };
    pushCyl(T, 0, 0, 0, 0.16, 0.11, 3.0, 6);
    var trunk = finishGeo(T);
    /* a lumpy ball of leaves, its corners shared (an icosphere comes
       unindexed: thousands of crowns would each run 240 vertices, not 42) */
    var ico = new THREE.IcosahedronGeometry(1, 1), cp = ico.attributes.position, key = {}, upos = [], cidx = [];
    for (var vi = 0; vi < cp.count; vi++) {
      var vx = cp.getX(vi), vy = cp.getY(vi), vz = cp.getZ(vi);
      var kk = Math.round(vx * 1e4) + ',' + Math.round(vy * 1e4) + ',' + Math.round(vz * 1e4);
      if (key[kk] === undefined) {
        key[kk] = upos.length / 3;
        var nn = 1 + 0.16 * fbm2(vx * 2.1 + 3, vz * 2.1 + vy * 1.7, 77, 2);
        upos.push(vx * 2.4 * nn, 4.6 + vy * 2.1 * nn, vz * 2.4 * nn);
      }
      cidx.push(key[kk]);
    }
    ico.dispose();
    var crown = new THREE.BufferGeometry();
    crown.setAttribute('position', new THREE.Float32BufferAttribute(upos, 3));
    crown.setIndex(cidx);
    crown.computeVertexNormals();
    crown.setAttribute('rib', new THREE.Float32BufferAttribute(new Float32Array(upos.length / 3), 1));
    var leaf = new THREE.Color(P.seasonKey === 'autumn' ? '#8a6230' : (P.seasonKey === 'spring' ? '#4f6d34' : '#3f5a2e'));
    var bare = P.seasonKey === 'winter';
    if (bare) leaf.set('#4b4038');
    instanceSolid(scene, trunk, trees, solidMat(U, '#4a3f35', { rib: 0, grain: 0, spines: 0, aoH: 0.4 }));
    /* in winter the crown is bare twigs: the same mass, brown and thin */
    instanceSolid(scene, crown, trees, solidMat(U, '#' + leaf.getHexString(), { rib: 0, grain: 3, spines: 0, aoH: 0, body2: '#' + leaf.clone().multiplyScalar(bare ? 1.15 : 1.35).getHexString() }));
    for (var ti2 = 0; ti2 < trees.length; ti2 += 1)
      App._shadows.push([trees[ti2][0], trees[ti2][1], trees[ti2][2], 2.4 * trees[ti2][3], bare ? 0.35 : 0.85, 6.5 * trees[ti2][3] * trees[ti2][5]]);
  }
  /* traffic */
  var streets = opt.traffic || [];
  /* the lanes the ground paints (see buildTerrain): a road rw wide, one lane
     each way, or two once it is 12 m. Traffic keeps to the middle of its
     lane. A wide road parks down both kerbs and drives in its inner lanes; a
     narrow one has no room to park beside a lane that is driven. */
  var rw = C.sw - 2 * C.sk, wide = rw >= 12;
  var lanesM = wide ? [rw / 8, -rw / 8] : [rw / 4, -rw / 4];
  var parkM = wide ? [rw * 0.5, -rw * 0.5] : [];
  for (var si = 0; si < streets.length; si++) {
    var s = streets[si], ax = s[0], ln = (s[1] + 0.5) * C.pitch;
    /* the road's own frame: along it from a point level with the window */
    var o0 = ax ? C.toWorld(-s[2], ln) : C.toWorld(ln, -s[2]);
    var dir = ax ? C.toWorld(1, 0) : C.toWorld(0, 1);
    var oy = y(o0[0], o0[1]);
    buildTraffic(scene, P, SR, U, {
      x: o0[0], y: oy, z: o0[1], len: opt.len, dir: dir,
      lanes: lanesM, spacing: SR.range(60, 130) / Math.sqrt(Math.max(P.trafficRate || 1, 0.5)), rate: P.trafficRate || 1, speed: [11, 14],
      parked: parkM, parkLen: opt.parkLen,
      /* no part of a parked vehicle within 6.5 m of the block's end: the
         zebra and the stop line lie there (see buildTerrain) */
      skip: (function (s2) {
        return function (a, len) {
          var at = a + s2;              /* along, in the grid frame */
          var ib = at - Math.round(at / C.pitch) * C.pitch;
          return Math.abs(ib) + len * 0.5 > C.bw * 0.5 - 6.5;
        };
      })(-s[2])
    });
  }
}

/* The view down from a tower: blocks on a street grid, some above the window
   and some below, with traffic in the streets far beneath. */
function buildBlocks(scene, P, R, U, H) {
  var C = cityPlan(P), pitch = C.pitch;
  var items = [], roofs = [], reach = 12;
  var street = function () { return -P.storey; };
  /* every block cut into lots built to the pavement, at mixed heights, with
     a tower on a podium here and there; the block you are in is your own */
  for (var bx = -reach; bx <= reach; bx++) {
    for (var bz = -reach; bz <= 2; bz++) {
      var gx = bx * pitch, gz = bz * pitch, w = C.toWorld(gx, gz);
      var d = Math.sqrt(w[0] * w[0] + w[1] * w[1]);
      if (d < pitch * 0.75 || d > 1500) continue;
      var hgt = Math.pow(R.f(), 2.0) * P.towerMax + R.range(8, 26);
      if (R.f() < 0.05) hgt = P.towerMax * R.range(1.0, 1.5);
      cityBlock(C, R, gx, gz, hgt, street, items, roofs);
    }
  }
  cityMesh(scene, P, R, U, items);
  buildRoofs(scene, P, R, U, roofs);
  /* Traffic on four streets running away from the window and two across
     it, parked cars down the kerbs, trees down the pavements, and the
     lamps and roof lights that carry the night. */
  cityStreets(scene, P, R, U, H, C, {
    flat: -P.storey, reach: 1000, treeReach: 650, trees: 0.65, len: 2400, parkLen: 900,
    traffic: [[0, -2, 400], [0, -1, 400], [0, 0, 400], [0, 1, 400], [1, -1, 0], [1, -2, 0]],
    beacons: cityBeacons(items)
  });
}

/* The water, laid on the same profile the rock was cut from, so it runs down
   the mountainside rather than hanging in front of it. One continuous ribbon:
   it free-falls down the pitches and spreads over the benches. */
