/* ---------- props: trees, palms, cacti, rocks, bushes ---------- */
/* the same curve the ground shader draws, so plants and paint agree */
/* Distance from the path's centre line, measured square to the line. The
   path has its own frame: it passes through (pathX, pathZ) heading pathAng
   off straight ahead; u runs along it, v across. pathAmt in the terrain
   shader is the same sum, term for term. */
function pathCentre(P, u) {          /* the centre line: v at u along the path */
  return P.pathBend * (Math.sin(u * 0.0042 + P.pathPhase) - Math.sin(P.pathPhase))
       + P.pathBend2 * (Math.sin(u * P.pathK2 + P.pathPhase2) - Math.sin(P.pathPhase2));
}
function pathOff(P, x, z) {
  var sa = Math.sin(P.pathAng), ca = Math.cos(P.pathAng);
  var dx = x - P.pathX, dz = z - P.pathZ;
  var u = dx * sa - dz * ca, v = dx * ca + dz * sa;
  var vc = pathCentre(P, u);
  var dv = P.pathBend * 0.0042 * Math.cos(u * 0.0042 + P.pathPhase)
         + P.pathBend2 * P.pathK2 * Math.cos(u * P.pathK2 + P.pathPhase2);
  return Math.abs(v - vc) / Math.sqrt(1 + dv * dv);
}
function onPathAt(P, x, z) {
  if (!P.pathKind) return 0;
  var off = pathOff(P, x, z);
  if (P.pathGauge > 0.01) off = Math.min(Math.abs(off - P.pathGauge * 0.5), Math.abs(off + P.pathGauge * 0.5));
  return 1 - smoothstep(P.pathW, P.pathW * 1.5, off);
}

/* Whether a path stops anything standing at (x, z): its worn surface past
   amt (onPathAt), or for a track the whole width between and over its wheel
   ruts, which onPathAt leaves at 0 on the grass crown. margin: how far the
   thing reaches either way along its own line (a length of hedge or wall). */
function pathBlocked(P, x, z, amt, margin) {
  if (!P.pathKind) return false;
  if (onPathAt(P, x, z) > amt) return true;
  return P.pathGauge > 0.01 && pathOff(P, x, z) < P.pathGauge * 0.5 + P.pathW + (margin || 0);
}

/* Whether (x, z) is in a town's streets or under one of its buildings,
   within margin: a field hedgerow laid across a city front ran through
   houses and down the streets. */
function inTown(P, x, z, margin) {
  var C = cityPlan(P);
  if (!C) return false;
  var d = Math.sqrt(x * x + z * z);
  if (d >= C.streetStart - margin && d <= C.end + C.pitch) {
    var g = C.toGrid(x, z), lx = g[0] - Math.round(g[0] / C.pitch) * C.pitch, lz = g[1] - Math.round(g[1] / C.pitch) * C.pitch;
    if (Math.max(Math.abs(lx), Math.abs(lz)) > C.bw * 0.5 - margin) return true;
  }
  for (var i = 0; i < App._boxes.length; i++) {
    var b = App._boxes[i], dx = x - b[0], dz = z - b[1];
    if (Math.abs(dx) > 80 || Math.abs(dz) > 80) continue;
    var c = Math.cos(b[4]), s = Math.sin(b[4]);
    if (Math.abs(dx * c + dz * s) < b[2] + margin && Math.abs(-dx * s + dz * c) < b[3] + margin) return true;
  }
  return false;
}

/* The kept ground in front of the house (P.clearKind, see buildParams): a
   strip along the wall out to P.clearD, its far edge straight for gravel and
   wandering for a lawn, a yard or a marsh bank. 1 inside, 0 beyond. The
   terrain shader's clearAmt() is the same curve. */
var CLEAR_EDGE = [[0, 0], [0.25, 0.25], [0, 0.06], [0.8, 0.6], [1.6, 0.9]];   /* [wobble, softness] by kind */
function clearAt(P, x, z) {
  if (!P.clearKind) return 0;
  var k = CLEAR_EDGE[P.clearKind];
  var edge = -P.clearD + k[0] * (Math.sin(x * 0.31 + 0.7) + 0.6 * Math.sin(x * 0.83 + 2.1));
  return smoothstep(edge - k[1], edge + k[1], z);
}

/* How far round to plant. Only about 36 degrees either side can be seen
   through the glass, and things were spread evenly over 70, so most of every
   count stood behind the wall. A margin is kept for the bare view, a wider
   screen and the parallax of a moving head; the world is not rebuilt when
   the window is resized, so never narrower than about 50 degrees. */
function scatterLim(P) { return clamp(visibleHalfAngle(P) * 1.3, 0.9, 1.22); }

/* gradient of the ground, rise over run, from the drawn surface */
function slopeAt(H, x, z) {
  var e = 1.5;
  return Math.sqrt(Math.pow(H(x + e, z) - H(x - e, z), 2) + Math.pow(H(x, z + e) - H(x, z - e), 2)) / (2 * e);
}

/* How each kind grows when it is not planted in rows. Trees stand in copses
   (n members spread sigma metres about a centre) drawn to hollows and water;
   bushes in small clumps; creosote spaces itself out, each plant's roots
   claiming the ground around it, so it is laid down by dart throwing with a
   minimum gap of space times its size. maxSlope is rise over run. */
var SCATTER = {
  broadleaf: { n: [3, 15], sigma: [8, 25], wet: 1, maxSlope: 0.65 },
  pine:      { n: [4, 15], sigma: [8, 22], wet: 0.5, maxSlope: 0.75 },
  acacia:    { n: [1, 4], sigma: [6, 16], wet: 0.5, maxSlope: 0.5 },
  palm:      { n: [2, 7], sigma: [4, 11], wet: 1, maxSlope: 0.45 },
  shrub:     { n: [2, 6], sigma: [2, 5], wet: 0.5, maxSlope: 0.45 },
  deadbush:  { n: [1, 3], sigma: [2, 4], wet: 0, maxSlope: 0.45 },
  brittlebush: { n: [2, 8], sigma: [1.5, 4], wet: 0, maxSlope: 0.4 },
  creosote:  { space: 2.6, maxSlope: 0.4 }
};
/* The edge of a wood seen across the fields: not a row of identical trees
   on an arc with sky between them, but trees bunched along a wandering line
   a few deep, and behind and between them more crowns sunk to their
   shoulders, a dark band of wood that closes the gaps. Items carry a fourth
   number, how far the card is sunk as a share of its size. */
function treelineItems(P, H, spec, lim, lineR, S) {
  var items = [], n = Math.round(spec.count * S.range(5, 7)), seed = S.int(1, 99999);
  var bend = S.range(0.08, 0.22);
  for (var i = 0, guard = 0; i < n && guard < n * 4; guard++) {
    var a = S.range(-lim, lim);
    /* clumps and the odd gap: density follows a noise along the line */
    var dens = fbm2(a * 4.0, 1.3, seed, 2);
    if (S.f() > 0.55 + dens * 0.9) continue;
    var rr = lineR * (1 + fbm2(a * 2.2, 5.1, seed + 7, 2) * bend * 2) + S.gauss() * 9;
    var x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
    if (!plantable(P, H, x, z, 0)) continue;
    var band = S.f() < 0.4;
    /* the band stands a little behind the front trees */
    if (band) { x *= 1.04; z *= 1.04; }
    items.push([x, z, S.range(spec.size[0], spec.size[1]) * (band ? 1.15 : 1), band ? S.range(0.30, 0.45) : 0]);
    i++;
  }
  return items;
}

function scatterGroups(P, H, spec, grow, lim, S) {
  var items = [], guard = 0, r0 = spec.r[0], r1 = spec.r[1];
  var fits = function (x, z, sz, gap) {
    var a = Math.atan2(x, -z), r = Math.sqrt(x * x + z * z);
    if (Math.abs(a) > lim || r < r0 * 0.7 || r > r1 * 1.1) return false;
    if (!plantable(P, H, x, z, grow.maxSlope)) return false;
    if ((spec.kind === 'pine' || spec.kind === 'broadleaf') && P.snowLine != null
        && H(x, z) > P.snowLine * S.range(0.6, 0.95)) return false;
    for (var k = 0; k < items.length; k++) {
      var dx = items[k][0] - x, dz = items[k][1] - z, need = (items[k][2] + sz) * gap;
      if (dx * dx + dz * dz < need * need) return false;
    }
    return true;
  };
  var polar = function () {
    var a = S.range(-lim, lim), rr = r0 + Math.pow(S.f(), 1.35) * (r1 - r0);
    return [Math.sin(a) * rr, -Math.cos(a) * rr];
  };
  /* Along a dry wash the water that soaks in after a flood feeds a line of
     plants on either bank: three or four times as many there as out on the
     plain (the wash's edge, where onPathAt runs 0.15 to 0.55). */
  var bank = function (x, z) {
    if (P.pathKind !== 'wash') return 1;
    var o = onPathAt(P, x, z);
    return o > 0.15 && o < 0.55 ? 1 : 0.28;
  };
  if (grow.space) {
    while (items.length < spec.count && guard < spec.count * 60) {
      guard++;
      var q = polar(), sz = S.range(spec.size[0], spec.size[1]);
      if (S.f() > bank(q[0], q[1])) continue;
      if (fits(q[0], q[1], sz, grow.space * 0.5)) items.push([q[0], q[1], sz]);
    }
    return items;
  }
  while (items.length < spec.count && guard < spec.count * 12) {
    guard++;
    var c = polar();
    /* a copse would rather stand in a hollow, or by water, than on a rise */
    var hc = H(c[0], c[1]);
    var hollow = (H(c[0] + 25, c[1]) + H(c[0] - 25, c[1]) + H(c[0], c[1] + 25) + H(c[0], c[1] - 25)) * 0.25 - hc;
    var wet = P.waterY != null ? 1 - smoothstep(1.0, 6.0, hc - P.waterY) : 0;
    if (S.f() > (0.45 + clamp(hollow * 0.25, -0.3, 0.4) + wet * 0.5 * grow.wet) * (0.4 + 0.6 * bank(c[0], c[1]) * 1.6)) continue;
    var n = S.int(grow.n[0], grow.n[1]), sig = S.range(grow.sigma[0], grow.sigma[1]);
    var base = S.range(spec.size[0], spec.size[1]);
    for (var m = 0; m < n * 3 && n > 0 && items.length < spec.count; m++) {
      var x = c[0] + S.gauss() * sig, z = c[1] + S.gauss() * sig;
      var sz = clamp(base * S.range(0.78, 1.18), spec.size[0], spec.size[1]);
      if (!fits(x, z, sz, 0.32)) continue;
      items.push([x, z, sz]);
      n--;
    }
  }
  return items;
}

function plantable(P, H, x, z, maxSlope) {
  if (P.waterY != null && H(x, z) < P.waterY + 0.25) return false;
  if (P._inRiver && P._inRiver(x, z)) return false;
  /* in an erg, only the hollows between the dunes hold anything */
  if (P.erg && ergDuneAt(P, x, z) > P.dune.hd * 0.22) return false;
  if (maxSlope && slopeAt(H, x, z) > maxSlope) return false;
  if (P.clearKind && clearAt(P, x, z + 0.6) > 0) return false;
  /* nothing grows up between the wheel ruts big enough to stop a tractor */
  if (pathBlocked(P, x, z, 0.55)) return false;
  return true;
}

/* the billboard material every planted prop shares */
function propMat(U, P, R, kind, swayMul, far) {
  return new THREE.ShaderMaterial({
      uniforms: {
        uTime: U.uTime, uWind: U.uWind, uGust: U.uGust, uWindDir: U.uWindDir,
        uSunCol: U.uSunCol, uAmbCol: U.uAmbCol, uFogCol: U.uFogCol, uSunDir: U.uSunDir,
        uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale, uSnow: U.uSnow,
        uCamPos: U.uCamPos, uSway: { value: swayMul }, uAspect: { value: spriteAspect(kind) },
        uCrown: { value: spriteCrown(kind) },
        uMap: { value: makePropTexture(kind, P, R, { far: !!far }) }
      },
      alphaToCoverage: true, alphaTest: 0.4,
      side: THREE.DoubleSide,
      vertexShader: GLSL['prop.vert'],
      fragmentShader: GLSL['prop.frag']
    });
}

function buildProps(scene, P, R, U, H) {
  App.propMeshes = [];
  var lim = scatterLim(P);
  var specs = P.props.slice();
  if (P.treeline) {
    specs.push({ kind: P.treelineKind, count: R.int(26, 60), size: [9, 18],
                 r: [150, 430], line: true });
  }
  /* An oasis's palms and bushes stand round its water, P.palmCount of the
     palms, from the shore out to where the ground water gives out; none out
     on the dunes. Its own stream. */
  if (P.oasisW) {
    var OR = RNG(P.base + '/build/oasis' + (P.nonce ? '/' + P.nonce : ''));
    for (var os = 0; os < specs.length; os++) {
      var osp = specs[os];
      if (osp.kind !== 'palm' && osp.kind !== 'shrub') continue;
      var want = osp.kind === 'palm' ? P.palmCount : osp.count, ring = [];
      for (var og = 0; og < want * 40 && ring.length < want; og++) {
        var oa = OR.range(0, 6.283), orr = P.oasisW * (osp.kind === 'palm' ? OR.range(0.7, 1.45) : OR.range(0.6, 1.9));
        var ox = P.oasisX + Math.cos(oa) * orr, oz = P.oasisZ + Math.sin(oa) * orr;
        if (Math.abs(Math.atan2(ox, -oz)) > lim || !plantable(P, H, ox, oz, 0.45) || H(ox, oz) > P.waterY + 5.5) continue;
        ring.push([ox, oz, OR.range(osp.size[0], osp.size[1])]);
      }
      specs[os] = { kind: osp.kind, count: ring.length, size: osp.size, r: osp.r, seed: osp.seed, preset: ring };
    }
  }
  /* A river through dry country is lined with green: willow and tamarisk
     thickets along both banks of the channel, nothing beyond. Its own
     stream, laid along the channel itself. */
  if (P._chanXZ && P.hasCanyonRiver) {
    var RP = RNG(P.base + '/build/riparian' + (P.nonce ? '/' + P.nonce : '')), rip = [];
    for (var ra = -1400; ra < 1400; ra += RP.range(4, 16)) {
      for (var rs = -1; rs <= 1; rs += 2) {
        if (RP.f() < 0.25) continue;
        var rq = P._chanXZ(ra, rs * ((P.chanW || 12) * 0.9 + RP.range(0, 9)));
        var rd = Math.hypot(rq[0], rq[1]);
        if (rd > 1100 || Math.abs(Math.atan2(rq[0], -rq[1])) > lim) continue;
        if (P._inRiver(rq[0], rq[1]) || slopeAt(H, rq[0], rq[1]) > 0.35) continue;
        rip.push([rq[0], rq[1], RP.range(2.5, 7)]);
      }
    }
    if (rip.length) specs.push({ kind: 'shrub', count: rip.length, size: [2.5, 7], r: [0, 1200], preset: rip });
  }
  for (var si = 0; si < specs.length; si++) {
    var spec = specs[si];
    if (!spec.count) continue;
    if (spec.kind === 'cactus') { buildCacti(scene, P, R, U, H, spec); continue; }
    if (spec.kind === 'wall') { buildWalls(scene, P, R, U, H, spec); continue; }
    if (spec.kind === 'city') { buildCity(scene, P, R, U, H); continue; }
    if (spec.kind === 'blocks') { buildBlocks(scene, P, R, U, H); continue; }
    if (spec.kind === 'bridge') { buildBridge(scene, P, R, U, H); continue; }
    if (spec.kind === 'rock') { buildRocks(scene, P, R, U, H, spec); continue; }
    /* in town the hedges are the gardens' own (buildCityHouses) */
    if (spec.kind === 'hedge' && cityPlan(P)) continue;
    if (spec.kind === 'hedge') {
      /* Hedgerows round the fields, square to the crop rows: these were bushes
         snapped onto the rows and stood in the crop like shrubs. The count
         was bushes; a few metres of hedge apiece. */
      var HR = RNG(P.base + '/build/hedgerows/' + si + (P.nonce ? '/' + P.nonce : ''));
      var hl = [], hA = P.rowAngle || HR.range(-0.4, 0.4), nH = clamp(Math.round(spec.count / 45), 2, 6);
      for (var hi = 0; hi < nH; hi++) {
        var across = hi % 2 === 1, a2 = hA + (across ? Math.PI / 2 : 0) + HR.range(-0.05, 0.05);
        var off = HR.range(35, 260) * (HR.f() < 0.5 ? -1 : 1);
        hl.push({ x: HR.range(-0.6, 0.6) * Math.abs(off), z: -40 - Math.abs(off), ca: Math.cos(a2), sa: Math.sin(a2), half: HR.range(90, 300) });
      }
      buildHedgeLines(scene, P, U, H, hl, HR.range(spec.size[0], spec.size[1]), HR);
      continue;
    }
    var items = [];
    var guard = 0;
    var lineR = spec.line ? R.range(spec.r[0], spec.r[1]) : 0;
    var grow = SCATTER[spec.kind];
    if (spec.preset) {
      items = spec.preset;
    } else if (spec.line) {
      items = treelineItems(P, H, spec, lim, lineR,
        RNG(P.base + '/build/treeline' + (P.nonce ? '/' + P.nonce : '')));
    } else if (spec.rows || !grow) {
      while (items.length < spec.count && guard < spec.count * 60) {
        guard++;
        var a = R.range(-lim, lim);
        var rr = spec.line ? lineR * R.range(0.85, 1.3)
                           : spec.r[0] + Math.pow(R.f(), 1.35) * (spec.r[1] - spec.r[0]);
        var x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
        if (spec.rows && P.rowSpacing) {
          var A3 = P.rowAngle, sp3 = P.rowSpacing * (spec.rowMul || 1);
          var pp3 = x * Math.cos(A3) + z * Math.sin(A3);
          var sn3 = Math.round(pp3 / sp3) * sp3;
          x += (sn3 - pp3) * Math.cos(A3);
          z += (sn3 - pp3) * Math.sin(A3);
        }
        if (!plantable(P, H, x, z, spec.line ? 0 : 0.65)) continue;
        /* pines and broadleaves stop at the snow line */
        if ((spec.kind === 'pine' || spec.kind === 'broadleaf') && P.snowLine != null
            && H(x, z) > P.snowLine * R.range(0.6, 0.95)) continue;
        items.push([x, z, R.range(spec.size[0], spec.size[1])]);
      }
    } else {
      items = scatterGroups(P, H, spec, grow, lim,
        RNG(P.base + '/build/scatter/' + si + spec.kind + (P.nonce ? '/' + P.nonce : '')));
    }
    if (!items.length) continue;

    /* The nearest trees are built solid; everything beyond stays a billboard.
       Between 36 and 48 m each tree is one or the other by a coin weighted by
       its distance, so there is no line on the ground where trees change
       kind. (Fading one into the other left every tree in the band half
       transparent.) Both are lit as the same rounded crown. */
    var treeish = /broadleaf|olive|blossom|acacia|pine/.test(spec.kind);
    var nearItems = [];
    if (treeish) {
      var farItems = [];
      for (var ni = 0; ni < items.length; ni++) {
        var dn = Math.hypot(items[ni][0], items[ni][1]);
        var coin = ihash(Math.round(items[ni][0] * 10), Math.round(items[ni][1] * 10), 4242);
        (dn < 36 || (dn < 48 && coin >= smoothstep(36, 48, dn)) ? nearItems : farItems).push(items[ni]);
      }
      items = farItems;
      if (!items.length && !nearItems.length) continue;
    }
    /* the band's billboards take their seed from a stream of their own, so the
       builder's stream is drawn exactly as before */
    var BS = RNG(P.base + '/build/band/' + si + (P.nonce ? '/' + P.nonce : ''));

    var quad = new THREE.PlaneGeometry(1, 1);
    quad.translate(0, 0.5, 0);
    var geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    geo.setAttribute('uv', quad.attributes.uv);
    var iPos = new Float32Array(items.length * 3);
    var iAttr = new Float32Array(items.length * 3);
    for (var i = 0; i < items.length; i++) {
      var di = Math.hypot(items[i][0], items[i][1]);
      iPos[i * 3] = items[i][0];
      /* on a slope the card's downhill corner would stand on air: sink it by
         the drop across its own half-width */
      iPos[i * 3 + 1] = H(items[i][0], items[i][1]) - items[i][2] * ((spec.line ? 0.09 : 0.03) + (items[i][3] || 0)) + (spec.lift || 0) * items[i][2]
        - slopeAt(H, items[i][0], items[i][1]) * items[i][2] * spriteAspect(spec.kind) * 0.5;
      iPos[i * 3 + 2] = items[i][1];
      iAttr[i * 3] = items[i][2];
      iAttr[i * 3 + 1] = (spec.preset || (treeish && di < 42)) ? BS.range(0, 6.283) : R.range(0, 6.283);
      iAttr[i * 3 + 2] = 1;
    }
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
    geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 3));
    geo.instanceCount = items.length;

    /* rocks don't sway; palms and fronds do, a lot */
    var swayMul = spec.kind === 'rock' ? 0.0 : (spec.kind === 'palm' ? 0.09
                : (spec.kind === 'cactus' ? 0.004 : 0.035));
    var mat = propMat(U, P, spec.preset ? RNG(P.base + '/build/preset/' + spec.kind) : R, spec.kind, swayMul, spec.line);

    mat.uniforms.uFogCol = U.uFogCol;
    var m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    scene.add(m);
    App.propMeshes.push(m);
    /* remember how to make this kind's material, for leaf cards */
    App._cardMat = App._cardMat || function () { return null; };
    (function (kind, mk) { var prev = App._cardMat; App._cardMat = function (k) { return k === kind ? mk() : prev(k); }; })(
      spec.kind, function () {
        var mm = mat.clone();
        mm.uniforms = {};
        for (var uk in mat.uniforms) mm.uniforms[uk] = mat.uniforms[uk];
        mm.uniforms.uMap = { value: makePropTexture(spec.kind, P, R, { crownOnly: true }) };
        mm.uniforms.uSway = { value: 0.05 };
        return mm;
      });
    if (nearItems.length) buildNearTrees(scene, P, R, U, H, spec.kind, nearItems, spec);
    for (var si2 = 0; si2 < items.length; si2++) {
      if (items[si2][3]) continue;                /* a sunk crown in the wood band */
      /* (the solid trees, nearItems, cast their own; these are all billboards,
         those in the 36-48 m band that lost the coin included) */
      /* a bush near the window casts its own open shape in the near map,
         its foot's shade staying in the coarse one */
      var ix = items[si2][0], iz = items[si2][1], iy = H(ix, iz), isz = items[si2][2];
      var bushK = { creosote: 0.45, brittlebush: 0.75, deadbush: 0.3, shrub: 0.8 }[spec.kind];
      var nearB = bushK && inNear(ix, iz) ? 1 : 0;
      App._shadows.push([ix, iy, iz, isz * (spec.kind === 'rock' ? 0.55 : 0.34),
                         spec.kind === 'rock' ? 0.8 : 1.0, isz * (spec.kind === 'rock' ? 0.6 : 0.85), nearB]);
      if (nearB) App._casters.push([ix, iy + isz * 0.25, iz, ix, iy + isz * 0.72, iz, isz * 0.42 * spriteAspect(spec.kind), bushK]);
    }
  }
  buildRoadPoles(scene, P, U, H);
}

/* Telegraph poles down one side of a country lane, two wires slung between
   each pair. Wires are a pixel or so wide at most distances: drawn as
   ribbons that widen to keep at least that, and fade as they widen, so they
   neither break up nor thicken into ropes far off. */
function buildRoadPoles(scene, P, U, H) {
  if (P.pathKind !== 'lane') return;
  var TR = RNG(P.base + '/build/poles' + (P.nonce ? '/' + P.nonce : ''));
  var sa = Math.sin(P.pathAng), ca = Math.cos(P.pathAng);
  var side = TR.chance(0.5) ? 1 : -1, gap = TR.range(42, 52), off = P.pathW + TR.range(2.2, 3.2), u0 = TR.range(0, gap);
  var lim = Math.max(visibleHalfAngle(P) * 1.3, 0.9);
  var poles = [], tops = [];
  for (var u = -1400 + u0; u < 1400; u += gap) {
    var dv = (pathCentre(P, u + 0.5) - pathCentre(P, u - 0.5));
    var tx = sa + dv * ca, tz = -ca + dv * sa, tl = Math.sqrt(tx * tx + tz * tz);
    var nx = -tz / tl, nz = tx / tl;
    var v = pathCentre(P, u) + side * off * Math.sqrt(1 + dv * dv);
    var x = P.pathX + u * sa + v * ca, z = P.pathZ - u * ca + v * sa;
    var d = Math.sqrt(x * x + z * z), ok = z < -6 && d < 650 && Math.abs(Math.atan2(x, -z)) < lim;
    var y = ok ? H(x, z) : 0;
    if (ok && P.waterY != null && y < P.waterY + 0.5) ok = false;
    if (!ok) { tops.push(null); continue; }
    var sy = TR.range(0.95, 1.08);
    poles.push([x, y - 0.4, z, 1, Math.atan2(nz, nx), sy, 1]);
    tops.push([x, y - 0.4 + 7.55 * sy, z, nx, nz]);
  }
  if (!poles.length) return;
  var B = { pos: [], nor: [], idx: [], rib: [] };
  pushCyl(B, 0, 0, 0, 0.14, 0.11, 7.9, 6);
  pushBox(B, 0, 7.55, 0, 0.85, 0.06, 0.07, 0);
  pushBox(B, -0.7, 7.68, 0, 0.04, 0.08, 0.04, 0); pushBox(B, 0.7, 7.68, 0, 0.04, 0.08, 0.04, 0);
  instanceSolid(scene, finishGeo(B), poles, solidMat(U, '#5b4b3c', { rib: 0, grain: 1, spines: 0, barkN: 10, barkPlate: 3, aoH: 0.4 }));
  var pos = [], bb = [], pp = [], idx = [], SEG = 12;
  for (var i = 1; i < tops.length; i++) {
    var A = tops[i - 1], Bt = tops[i];
    if (!A || !Bt) continue;
    for (var w = -1; w <= 1; w += 2) {
      var ax = A[0] + A[3] * 0.7 * w, az = A[2] + A[4] * 0.7 * w, bx = Bt[0] + Bt[3] * 0.7 * w, bz = Bt[2] + Bt[4] * 0.7 * w;
      var base = pos.length / 3, sag = gap * TR.range(0.012, 0.018);
      for (var k = 0; k <= SEG; k++) for (var e = -1; e <= 1; e += 2) {
        pos.push(ax, A[1] + 0.16, az); bb.push(bx, Bt[1] + 0.16, bz); pp.push(k / SEG, e, sag);
      }
      for (k = 0; k < SEG; k++) { var o = base + k * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); }
    }
  }
  if (!idx.length) return;
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('aB', new THREE.Float32BufferAttribute(bb, 3));
  geo.setAttribute('aP', new THREE.Float32BufferAttribute(pp, 3));
  geo.setIndex(idx);
  var mat = new THREE.ShaderMaterial({
    uniforms: { uFogCol: U.uFogCol, uFogDensity: U.uFogDensity, uSunDir: U.uSunDir, uSunCol: U.uSunCol, uHazeK: U.uHazeK },
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    vertexShader: GLSL['road-poles.vert'],
    fragmentShader: GLSL['road-poles.frag']
  });
  var m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  m.renderOrder = 4;
  scene.add(m);
  App.propMeshes.push(m);
}

