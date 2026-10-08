/* ============================================================
   5. canvas texture factories
   ============================================================ */
var TEXCACHE = {}, TEXORDER = [], TEXCAP = 14;
function cached(key, make) {
  /* a texture in use moves to the back of the queue, so the ones worlds
     share are not pushed out by the ones each world makes for itself */
  if (TEXCACHE[key]) { TEXORDER.splice(TEXORDER.indexOf(key), 1); TEXORDER.push(key); return TEXCACHE[key]; }
  var t = make();
  if (!t.userData) t.userData = {};
  t.userData.cacheKey = key;
  TEXCACHE[key] = t;
  TEXORDER.push(key);
  /* bounded, or a long session with auto-refresh would hoard textures */
  while (TEXORDER.length > TEXCAP) {
    var old = TEXORDER.shift();
    if (TEXCACHE[old]) { TEXCACHE[old].userData.cacheKey = null; TEXCACHE[old].dispose(); delete TEXCACHE[old]; }
  }
  return t;
}

function cnv(w, h) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function tex(canvas, repeat) {
  var t = new THREE.CanvasTexture(canvas);
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = App.maxAniso || 4;
  return t;
}
function hexToRgb(hex) {
  var c = new THREE.Color(hex);
  return [c.r * 255, c.g * 255, c.b * 255];
}

function makeCloudTexture(seed, size, puffy) {
  var S = size || 256;
  var f = tileFBM(S, seed, 5, 3);
  if (puffy) f = billowClouds(f, S, seed);
  var c = cnv(S, S), ctx = c.getContext('2d');
  var img = ctx.createImageData(S, S);
  for (var i = 0; i < S * S; i++) {
    var v = clamp(f[i] * 1.25 - 0.12, 0, 1);
    v = v * v * (3 - 2 * v);
    var b = Math.round(v * 255);
    img.data[i * 4] = b; img.data[i * 4 + 1] = b; img.data[i * 4 + 2] = b; img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, true);
}

function makeGroundTexture(P, seed, size) {
  /* Noise gives colour variation but no structure. The eye wants blades,
     pebbles, ripples and cracks, so these are stamped on top, tiling across
     the edges so the texture repeats cleanly. */
  var S = size || 256;
  var a = tileFBM(S, seed, 5, 4);
  var b = tileFBM(S, seed + 313, 4, 16);
  /* the grass reads this canvas back for its blades' colour (buildGrass) */
  var c = cnv(S, S), ctx = c.getContext('2d', { willReadFrequently: true });
  var img = ctx.createImageData(S, S);
  var base = hexToRgb(P.grass.base), tip = hexToRgb(P.grass.tip),
      soil = hexToRgb(P.grass.soil), dry = hexToRgb(P.grass.dry);
  for (var i = 0; i < S * S; i++) {
    var m = clamp(a[i] * 0.75 + b[i] * 0.35, 0, 1);
    var d = clamp((a[i] - 0.55) * 2.4, 0, 1) * P.patchiness;
    var r, g, bl, t2 = clamp(m * 1.25, 0, 1);
    r = lerp(base[0], tip[0], t2); g = lerp(base[1], tip[1], t2); bl = lerp(base[2], tip[2], t2);
    r = lerp(r, dry[0], d); g = lerp(g, dry[1], d); bl = lerp(bl, dry[2], d);
    var sl = clamp((0.28 - a[i]) * 3.0, 0, 1) * 0.55;
    r = lerp(r, soil[0], sl); g = lerp(g, soil[1], sl); bl = lerp(bl, soil[2], sl);
    var sp = ihash(i % S, (i / S) | 0, seed) * 0.18 - 0.09;
    img.data[i * 4] = clamp(r * (1 + sp), 0, 255);
    img.data[i * 4 + 1] = clamp(g * (1 + sp), 0, 255);
    img.data[i * 4 + 2] = clamp(bl * (1 + sp), 0, 255);
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);

  var R = RNG(P.base + '/ground/' + seed);
  var kind = P.terrainKind || P.biome.terrain;
  var rgba = function (arr, al) { return 'rgba(' + (arr[0] | 0) + ',' + (arr[1] | 0) + ',' + (arr[2] | 0) + ',' + al + ')'; };
  /* draw once and again wrapped, so stamps that cross an edge continue on the other side */
  var stamp = function (x, y, fn) {
    var offs = [[0, 0]];
    if (x < S * 0.08) offs.push([S, 0]); if (x > S * 0.92) offs.push([-S, 0]);
    if (y < S * 0.08) offs.push([0, S]); if (y > S * 0.92) offs.push([0, -S]);
    for (var o = 0; o < offs.length; o++) { ctx.save(); ctx.translate(x + offs[o][0], y + offs[o][1]); fn(); ctx.restore(); }
  };
  var scale = S / 256;
  ctx.lineCap = 'round';

  if (kind === 'beach' || kind === 'dunes' || kind === 'salt' || kind === 'oasis' || kind === 'canyon') {
    /* Sand and bare rock: the noise alone. Wind ripples used to be painted
       in here at one angle, and repeated across the land as stripes; they
       are drawn in the terrain shader now, square to the wind, and only on
       sand. Pebbles painted here became orange blobs a hand across once the
       tile was stretched over 26 m; the stones are drawn by the shader and
       the ground cards. A salt pan's polygons are drawn by the shader too. */
  } else if (kind === 'urban' || kind === 'skyline') {
    /* pavement and asphalt: cracks and patching, no grass blades */
    for (var cr2 = 0; cr2 < 30; cr2++) {
      var ux = R.f() * S, uy = R.f() * S, ua = R.f() * 6.283;
      ctx.strokeStyle = rgba(soil, 0.5); ctx.lineWidth = R.range(0.7, 1.4) * scale;
      stamp(ux, uy, function () {
        ctx.beginPath(); ctx.moveTo(0, 0); var qx = 0, qy = 0, ab = ua;
        for (var sg2 = 0; sg2 < 5; sg2++) { ab += R.range(-0.5, 0.5); qx += Math.cos(ab) * 18 * scale; qy += Math.sin(ab) * 18 * scale; ctx.lineTo(qx, qy); }
        ctx.stroke();
      });
    }
  } else {
    /* blades: thousands of short curved strokes, light over dark */
    var n = Math.round(S * S / 38);
    for (var bl2 = 0; bl2 < n; bl2++) {
      var bx = R.f() * S, by = R.f() * S, ba = R.range(-0.9, 0.9) - 1.57, ln = R.range(3, 8) * scale;
      var colA = R.f() < 0.55 ? tip : base;
      ctx.strokeStyle = rgba(colA, R.range(0.24, 0.48)); ctx.lineWidth = R.range(1.1, 2.4) * scale;
      stamp(bx, by, function () {
        ctx.beginPath(); ctx.moveTo(0, 0);
        ctx.quadraticCurveTo(Math.cos(ba) * ln * 0.5 + 1.2, Math.sin(ba) * ln * 0.5, Math.cos(ba) * ln + 2.4, Math.sin(ba) * ln);
        ctx.stroke();
      });
    }
    for (var st = 0; st < 26 * scale; st++) {
      var sx = R.f() * S, sy = R.f() * S, sr = R.range(1, 2.6) * scale;
      ctx.fillStyle = rgba(soil, 0.65);
      stamp(sx, sy, function () { ctx.beginPath(); ctx.ellipse(0, 0, sr, sr * 0.7, R.f() * 3, 0, 6.283); ctx.fill(); });
    }
  }
  return tex(c, true);
}

function makeFlowerTexture(sp, R) {
  /* Four flowers of the species side by side, in the same 0.8 : 3.0 proportion
     as the quad they will be drawn on, so nothing is stretched. Each is seen
     from a different angle: face on, three-quarter, side, and a bud. The head
     is about a third of the card's width, on a stem as tall as the grass: a
     head two-thirds of it on a short stalk read as a lollipop. */
  var W = 96, Hh = 360, c = cnv(W * 4, Hh), g = c.getContext('2d');
  g.clearRect(0, 0, W * 4, Hh);
  var views = [
    { squash: 1.0,  scale: 1.0,  petals: 0,  bud: false },
    { squash: 0.72, scale: 0.95, petals: 1,  bud: false },
    { squash: 0.42, scale: 0.9,  petals: -1, bud: false },
    { squash: 0.8,  scale: 0.55, petals: 0,  bud: true }
  ];
  for (var v = 0; v < 4; v++) {
    var V = views[v], ox = v * W;
    var cx = ox + W / 2, cy = Hh * 0.075, rr = W * 0.21 * V.scale * (sp.kind === 'spike' ? 1.6 : 1);
    g.strokeStyle = 'rgba(74,92,45,0.95)'; g.lineWidth = W * 0.035; g.lineCap = 'round';
    g.beginPath(); g.moveTo(cx + R.range(-3, 3), Hh);
    g.quadraticCurveTo(cx + R.range(-8, 8), Hh * 0.62, cx, cy + rr * 0.3); g.stroke();
    g.fillStyle = 'rgba(86,110,52,0.9)';
    for (var lf = 0; lf < 1 + (R.f() < 0.6 ? 1 : 0); lf++) {
      var ly = Hh * R.range(0.45, 0.85), side = R.f() < 0.5 ? -1 : 1;
      g.save(); g.translate(cx, ly); g.rotate(side * R.range(0.5, 1.1));
      g.beginPath(); g.ellipse(side * W * 0.08, 0, W * 0.11, W * 0.035, 0, 0, 6.283); g.fill(); g.restore();
    }
    g.save(); g.translate(cx, cy); g.scale(1, V.squash); g.translate(-cx, -cy);
    g.fillStyle = sp.petal;
    if (V.bud) {
      g.fillStyle = sp.mid;
      g.beginPath(); g.ellipse(cx, cy, rr * 0.45, rr * 0.6, 0, 0, 6.283); g.fill();
      g.fillStyle = sp.petal;
      g.beginPath(); g.ellipse(cx, cy - rr * 0.15, rr * 0.32, rr * 0.45, 0, 0, 6.283); g.fill();
    } else if (sp.kind === 'round') {
      var n = 7 + Math.floor(R.f() * 4) + V.petals, rot = R.f() * 6.283;
      for (var i = 0; i < n; i++) {
        var a = rot + (i / n) * 6.283 + R.f() * 0.1;
        g.beginPath();
        g.ellipse(cx + Math.cos(a) * rr * 0.55, cy + Math.sin(a) * rr * 0.55, rr * 0.46, rr * 0.28, a, 0, 6.283);
        g.fill();
      }
      g.fillStyle = sp.mid;
      g.beginPath(); g.arc(cx, cy, rr * 0.30, 0, 6.283); g.fill();
    } else if (sp.kind === 'puff') {
      for (var j = 0; j < 22; j++) {
        var aa = R.f() * 6.283, rad = Math.sqrt(R.f()) * rr * 0.85;
        g.fillStyle = j % 3 === 0 ? sp.mid : sp.petal;
        g.beginPath(); g.arc(cx + Math.cos(aa) * rad, cy + Math.sin(aa) * rad * 0.85, rr * 0.20, 0, 6.283); g.fill();
      }
    } else if (sp.kind === 'flat') {
      for (var k = 0; k < 26; k++) {
        var ax = cx + (R.f() - 0.5) * rr * 2.0, ay = cy + (R.f() - 0.5) * rr * 0.8;
        g.fillStyle = k % 4 === 0 ? sp.mid : sp.petal;
        g.beginPath(); g.arc(ax, ay, rr * 0.16, 0, 6.283); g.fill();
      }
    } else {
      for (var m = 0; m < 16; m++) {
        var t = m / 16;
        var sy = cy - rr * 0.9 + t * rr * 2.2;
        var sw = rr * (0.75 - t * 0.35);
        g.fillStyle = m % 2 ? sp.mid : sp.petal;
        g.beginPath(); g.ellipse(cx + (R.f() - 0.5) * 3, sy, sw * 0.5, rr * 0.16, 0, 0, 6.283); g.fill();
      }
    }
    g.restore();
  }
  return tex(c, false);
}


/* ---------- foliage ----------
   A crown is branches with sprays of leaves on them, not a pile of circles.
   Sprays are drawn dark-to-light so the back of the crown recedes, the sun
   side is brighter, and the silhouette is ragged with gaps that show sky. */
function leafSpray(g, x, y, r, col, lite, n, leafW, leafL, R) {
  for (var i = 0; i < n; i++) {
    var a = R.f() * 6.283, d = Math.sqrt(R.f()) * r;
    var lx = x + Math.cos(a) * d, ly = y + Math.sin(a) * d * 0.8;
    var c = col.clone().lerp(lite, R.range(0, 0.6) * (0.4 + 0.6 * (1 - d / r)));
    g.fillStyle = 'rgb(' + ((c.r * 255) | 0) + ',' + ((c.g * 255) | 0) + ',' + ((c.b * 255) | 0) + ')';
    g.save(); g.translate(lx, ly); g.rotate(R.f() * 6.283);
    g.beginPath(); g.ellipse(0, 0, leafL, leafW, 0, 0, 6.283); g.fill();
    g.restore();
  }
}
function drawBranches(g, S, x0, y0, len, ang, width, depth, R, col, tips) {
  if (depth <= 0 || width < 0.6) { if (tips) tips.push([x0, y0]); return; }
  var x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
  g.strokeStyle = col; g.lineWidth = width; g.lineCap = 'round';
  g.beginPath(); g.moveTo(x0, y0);
  g.quadraticCurveTo(x0 + Math.cos(ang + R.range(-0.3, 0.3)) * len * 0.5, y0 + Math.sin(ang) * len * 0.5, x1, y1);
  g.stroke();
  var forks = depth > 1 ? 2 + (R.f() < 0.4 ? 1 : 0) : 0;
  if (!forks) { if (tips) tips.push([x1, y1]); return; }
  for (var f = 0; f < forks; f++) {
    /* a limb may spread but never turn back down: a downward fork ends up
       outside the crown, where no leaves are drawn, and reads as a bare stick */
    var na = ang + R.range(-0.75, 0.75) - 0.18;
    na = Math.max(Math.min(na, -0.12), -Math.PI + 0.12);
    drawBranches(g, S, x1, y1, len * R.range(0.55, 0.75), na, width * 0.62, depth - 1, R, col, tips);
  }
}
function drawCrown(g, S, kind, P, R, cx, cy, rx, ry, base, lite, opts) {
  var dark = base.clone().multiplyScalar(0.55);
  var sprays = [];
  var n = opts.sprays || 60;
  /* every branch end gets its own foliage, so no limb is left bare */
  var tips = opts.tips || [];
  for (var ti = 0; ti < tips.length; ti++) {
    var tp = tips[ti];
    /* lighter toward the outside of the crown, where leaves see the sky;
       which side the sun is on is the shader's business */
    var side0 = Math.abs(tp[0] - cx) / Math.max(rx, 1);
    var lit0 = 0.42 + 0.32 * (1 - (tp[1] - (cy - ry)) / (2 * ry)) + 0.12 * side0;
    sprays.push([tp[0], tp[1], lit0 + R.range(-0.1, 0.1), 1]);
    if (R.f() < 0.75) sprays.push([tp[0] + R.range(-1, 1) * S * 0.035, tp[1] + R.range(-1, 1) * S * 0.035, lit0 + R.range(-0.15, 0.1), 1]);
  }
  for (var i = 0; i < n; i++) {
    var a = R.f() * 6.283, d = Math.pow(R.f(), 0.55);
    var px = cx + Math.cos(a) * d * rx, py = cy + Math.sin(a) * d * ry;
    if (opts.flatTop && py < cy - ry * 0.15) py = cy - ry * 0.15 + (py - cy + ry * 0.15) * 0.25;
    var lit = 0.35 + 0.35 * (1 - (py - (cy - ry)) / (2 * ry)) + 0.20 * d;
    sprays.push([px, py, lit + R.range(-0.12, 0.12), d]);
  }
  sprays.sort(function (p, q) { return p[2] - q[2]; });
  for (var k = 0; k < sprays.length; k++) {
    var sp = sprays[k], l = clamp(sp[2], 0, 1);
    var col = dark.clone().lerp(base, Math.min(1, l * 1.4));
    var lt = base.clone().lerp(lite, clamp((l - 0.5) * 2, 0, 1));
    leafSpray(g, sp[0], sp[1], S * (opts.sprayR || 0.06), col, lt, opts.leaves || 12, S * (opts.leafW || 0.010), S * (opts.leafL || 0.018), R);
  }
}

/* One sprite of a kind, drawn into an S square at the context's origin. */
function drawPropSprite(g, S, kind, P, R, opts) {
  var rgb = function (col) {
    return 'rgb(' + Math.round(col.r * 255) + ',' + Math.round(col.g * 255) + ',' + Math.round(col.b * 255) + ')';
  };
  g.lineCap = 'round'; g.lineJoin = 'round';

  if (kind === 'cactus') {
    var gc = new THREE.Color(R.pick(['#4e7f4a', '#427043', '#59864e', '#3e6b3f']).replace(' ', ''));
    var outline = gc.clone().multiplyScalar(0.42);
    var limbs = [];
    if (R.f() < 0.26) {
      /* prickly pear: a cluster of pads */
      var pads = R.int(4, 8);
      for (var q = 0; q < pads; q++) {
        var t = q / pads;
        limbs.push({ pad: true,
          x: S / 2 + R.range(-0.26, 0.26) * S * (0.4 + t),
          y: S * (0.94 - t * R.range(0.28, 0.62)),
          w: S * R.range(0.085, 0.15), h: S * R.range(0.11, 0.20),
          rot: R.range(-0.6, 0.6) });
      }
    } else {
      /* saguaro: a ribbed column with arms that elbow out and turn up */
      var tw = S * R.range(0.125, 0.185);
      var topY = S * R.range(0.05, 0.19);
      limbs.push({ w: tw, pts: [[S / 2, S + tw * 0.2], [S / 2, topY + tw / 2]] });
      var arms = R.int(0, 3), used = [];
      for (var ai = 0; ai < arms; ai++) {
        var side = (ai === 0) ? (R.f() < 0.5 ? -1 : 1) : (used.indexOf(-1) < 0 ? -1 : (used.indexOf(1) < 0 ? 1 : (R.f() < 0.5 ? -1 : 1)));
        used.push(side);
        var ay = S * R.range(0.44, 0.72);
        var reach = S * R.range(0.14, 0.27);
        var rise = S * R.range(0.20, 0.44);
        var aw = tw * R.range(0.58, 0.8);
        limbs.push({ w: aw, curve: true, pts: [
          [S / 2 + side * tw * 0.15, ay],
          [S / 2 + side * reach * 0.95, ay + S * 0.015],
          [S / 2 + side * reach, ay - rise * 0.30],
          [S / 2 + side * reach, ay - rise]
        ] });
      }
    }
    var drawLimbs = function (grow, col) {
      g.strokeStyle = col; g.fillStyle = col;
      for (var i = 0; i < limbs.length; i++) {
        var L = limbs[i];
        if (L.pad) {
          g.beginPath();
          g.ellipse(L.x, L.y, L.w + grow, L.h + grow, L.rot, 0, 6.283);
          g.fill();
        } else {
          g.lineWidth = L.w + grow * 2;
          g.beginPath();
          g.moveTo(L.pts[0][0], L.pts[0][1]);
          if (L.curve) g.bezierCurveTo(L.pts[1][0], L.pts[1][1], L.pts[2][0], L.pts[2][1], L.pts[3][0], L.pts[3][1]);
          else g.lineTo(L.pts[1][0], L.pts[1][1]);
          g.stroke();
        }
      }
    };
    drawLimbs(3.0, rgb(outline));
    drawLimbs(0, rgb(gc));
    /* volume, ribs and spines, painted only where the plant already is */
    g.globalCompositeOperation = 'source-atop';
    var lg = g.createLinearGradient(0, 0, S, 0);
    lg.addColorStop(0.00, 'rgba(0,0,0,0.42)');
    lg.addColorStop(0.33, 'rgba(255,255,255,0.24)');
    lg.addColorStop(0.60, 'rgba(0,0,0,0.10)');
    lg.addColorStop(1.00, 'rgba(0,0,0,0.44)');
    g.fillStyle = lg; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(18,38,20,0.20)'; g.lineWidth = 1.7;
    for (var rb = 0; rb < 16; rb++) {
      var rx = (rb + 0.5) / 16 * S;
      g.beginPath(); g.moveTo(rx, 0); g.lineTo(rx, S); g.stroke();
    }
    g.fillStyle = 'rgba(242,234,198,0.45)';
    for (var sp2 = 0; sp2 < 150; sp2++) g.fillRect(R.f() * S, R.f() * S, 1.7, 1.7);
    g.globalCompositeOperation = 'source-over';

  } else if (kind === 'palm') {
    var lean = R.range(-0.20, 0.20);
    var crownX = S / 2 + lean * S * 0.8, crownY = S * 0.38;
    g.strokeStyle = '#6b5740'; g.lineWidth = S * 0.042;
    g.beginPath(); g.moveTo(S / 2, S);
    g.quadraticCurveTo(S / 2 + lean * S * 0.35, S * 0.68, crownX, crownY);
    g.stroke();
    g.strokeStyle = 'rgba(96,80,56,0.55)'; g.lineWidth = 2;
    for (var r0 = 0; r0 < 7; r0++) {
      var ft = r0 / 7, fx = S / 2 + (crownX - S / 2) * (1 - ft) * 0.9, fy = S - (S - crownY) * (1 - ft) * 0.92;
      g.beginPath(); g.moveTo(fx - 6, fy); g.lineTo(fx + 6, fy); g.stroke();
    }
    var base = new THREE.Color(P.grass.ct || P.grass.tip);
    var fronds = 9 + Math.floor(R.f() * 4);
    for (var i2 = 0; i2 < fronds; i2++) {
      var a = -Math.PI * 0.06 - (i2 / (fronds - 1)) * Math.PI * 0.88 + R.range(-0.08, 0.08);
      var len = S * R.range(0.24, 0.35);
      var midx = crownX + Math.cos(a) * len * 0.55;
      var midy = crownY + Math.sin(a) * len * 0.5 - len * 0.16;
      var tipx = crownX + Math.cos(a) * len;
      var tipy = crownY + Math.sin(a) * len * 0.88 + len * 0.30;
      var shade = base.clone().lerp(new THREE.Color('#1c3a1f'), R.range(0.05, 0.55));
      g.strokeStyle = rgb(shade);
      g.lineWidth = S * R.range(0.030, 0.05);
      g.beginPath(); g.moveTo(crownX, crownY);
      g.quadraticCurveTo(midx, midy, tipx, tipy);
      g.stroke();
      /* leaflets along the spine */
      g.lineWidth = 1.8;
      for (var lf = 1; lf < 6; lf++) {
        var u = lf / 6;
        var bx = crownX + (midx - crownX) * 2 * u * (1 - u) + (tipx - crownX) * u * u;
        var by = crownY + (midy - crownY) * 2 * u * (1 - u) + (tipy - crownY) * u * u;
        g.beginPath(); g.moveTo(bx, by);
        g.lineTo(bx + Math.cos(a + 1.5) * len * 0.10, by + Math.sin(a + 1.5) * len * 0.10);
        g.stroke();
      }
    }
    g.fillStyle = '#7d6a3c';
    for (var nq = 0; nq < 5; nq++) {
      g.beginPath(); g.arc(crownX + R.range(-9, 9), crownY + R.range(6, 16), 4, 0, 6.283); g.fill();
    }

  } else if (kind === 'pine') {
    g.strokeStyle = '#3f3024'; g.lineWidth = S * 0.032; g.lineCap = 'round';
    g.beginPath(); g.moveTo(S / 2, S); g.lineTo(S / 2, S * 0.10); g.stroke();
    var pdark = new THREE.Color(R.pick(['#1b3324', '#203a2a', '#182f22'])).multiplyScalar(P.treeTint);
    var plite = pdark.clone().lerp(new THREE.Color('#7fa066'), 0.5);
    var tiers = 10 + R.int(0, 4);
    for (var ti = 0; ti < tiers; ti++) {
      var f2 = ti / (tiers - 1);
      var yb = S * (0.86 - f2 * 0.74);
      var span = S * (0.30 - f2 * 0.24) * R.range(0.85, 1.15);
      for (var side = -1; side <= 1; side += 2) {
        var lit2 = 0.62 + f2 * 0.2;
        var nn = 10 + Math.floor(span / S * 40);
        for (var q = 0; q < nn; q++) {
          var t = q / nn, bx = S / 2 + side * span * t, by = yb + t * t * span * 0.35;
          var pc = pdark.clone().lerp(plite, clamp(lit2 + R.range(-0.2, 0.15), 0, 1));
          g.strokeStyle = 'rgb(' + ((pc.r * 255) | 0) + ',' + ((pc.g * 255) | 0) + ',' + ((pc.b * 255) | 0) + ')';
          g.lineWidth = R.range(1.1, 2.2);
          var na = 1.2 + R.range(-0.5, 0.5), nl = S * R.range(0.03, 0.06) * (1 - t * 0.4);
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + side * Math.cos(na) * nl * 0.3, by + Math.sin(na) * nl); g.stroke();
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + side * nl * 0.5, by - nl * 0.25); g.stroke();
        }
      }
    }
  } else if (kind === 'olive' || kind === 'blossom') {
    var isB = kind !== 'olive';
    g.strokeStyle = isB ? '#5a4736' : '#6b6152'; g.lineWidth = S * 0.05; g.lineCap = 'round';
    g.beginPath(); g.moveTo(S / 2, S);
    g.quadraticCurveTo(S / 2 + R.range(-14, 14), S * 0.8, S / 2 + R.range(-8, 8), S * 0.60); g.stroke();
    var nb2 = 4 + R.int(0, 2);
    var otips = [];
    for (var b2 = 0; b2 < nb2; b2++) {
      var ba2 = -Math.PI * (0.2 + (b2 / (nb2 - 1)) * 0.6) + R.range(-0.2, 0.2);
      drawBranches(g, S, S / 2, S * R.range(0.55, 0.64), S * R.range(0.14, 0.22), ba2, S * 0.02, 3, R, isB ? '#5a4736' : '#6b6152', otips);
    }
    var ocol = new THREE.Color(isB ? (P.blossomCol || '#f2d3de') : '#6f7d5c');
    var olite = new THREE.Color(isB ? '#ffffff' : '#b9c2a0');
    drawCrown(g, S, kind, P, R, S / 2, S * 0.40, S * 0.34, S * 0.27, ocol, olite,
      isB ? { sprays: 90, sprayR: 0.05, leaves: 14, leafW: 0.007, leafL: 0.009, tips: otips }
          : { sprays: 60, sprayR: 0.06, leaves: 14, leafW: 0.005, leafL: 0.016, tips: otips });
  } else if (kind === 'vine' || kind === 'shrub') {
    var vc = new THREE.Color(kind === 'shrub' ? '#54603c' : '#4a6234');
    var vl = vc.clone().lerp(new THREE.Color('#a8bd7e'), 0.45);
    var wide = 0.30, tall = 0.42;
    if (kind === 'vine') {
      g.strokeStyle = '#6a5540'; g.lineWidth = S * 0.03;
      g.beginPath(); g.moveTo(S / 2, S); g.lineTo(S / 2, S * 0.62); g.stroke();
    }
    for (var vb = 0; vb < 90; vb++) {
      var vx = S / 2 + (R.f() - 0.5) * S * wide * 2;
      var vy = S * (1 - R.f() * tall) - S * 0.02;
      g.fillStyle = rgb(vc.clone().lerp(vl, R.f()));
      g.beginPath(); g.arc(vx, vy, S * R.range(0.028, 0.055), 0, 6.283); g.fill();
    }

  } else if (kind === 'creosote') {
    /* An open vase of thin grey stems from one crown, reaching the top of
       the card (a creosote stands one to three metres), with small dark
       olive leaves in loose clusters along their upper part: you see through
       it to the ground behind. */
    var cc = new THREE.Color(R.pick(['#4f5a30', '#58643a', '#4a552e']));
    var cl = cc.clone().lerp(new THREE.Color('#a3ab68'), 0.45);
    g.lineCap = 'round';
    var nst = R.int(14, 22);
    for (var st = 0; st < nst; st++) {
      var tilt = R.range(-0.62, 0.62), sl = S * R.range(0.55, 0.94) * (1 - Math.abs(tilt) * 0.3);
      var x0 = S / 2 + R.range(-0.04, 0.04) * S, bend = R.range(-0.12, 0.12);
      var ex2 = x0 + Math.sin(tilt) * sl, ey2 = S - Math.cos(tilt) * sl;
      var mx2 = x0 + Math.sin(tilt + bend) * sl * 0.5, my2 = S - Math.cos(tilt + bend) * sl * 0.5;
      g.strokeStyle = '#6e6250'; g.lineWidth = R.range(1.0, 2.2);
      g.beginPath(); g.moveTo(x0, S); g.quadraticCurveTo(mx2, my2, ex2, ey2); g.stroke();
      for (var lc = 0; lc < 4; lc++) {
        var tq = R.range(0.45, 1.0), lx2 = (1 - tq) * (1 - tq) * x0 + 2 * (1 - tq) * tq * mx2 + tq * tq * ex2;
        var ly2 = (1 - tq) * (1 - tq) * S + 2 * (1 - tq) * tq * my2 + tq * tq * ey2;
        leafSpray(g, lx2, ly2, S * R.range(0.035, 0.06), cc, cl, 9, S * 0.0045, S * 0.010, R);
      }
    }
  } else if (kind === 'brittlebush') {
    /* a low dome of silvery felted leaves, wider than tall (the card is
       wider than drawn), and in spring yellow daisies held above it on bare
       stalks; dry brown stalks the rest of the year */
    var bc = new THREE.Color('#8e9a80'), bl2 = new THREE.Color('#d5d9c0');
    var drx = S * R.range(0.40, 0.46), dry = S * R.range(0.62, 0.78);
    for (var bs = 0; bs < 110; bs++) {
      var ba2 = -Math.PI * R.f(), bd = Math.sqrt(R.f());
      /* up from the foot: the angle runs below the horizontal */
      var bx3 = S / 2 + Math.cos(ba2) * bd * drx, by3 = S - Math.abs(Math.sin(ba2)) * bd * dry * 0.95;
      leafSpray(g, bx3, by3, S * 0.05, bc.clone().multiplyScalar(0.62 + 0.38 * (S - by3) / dry), bl2, 9, S * 0.009, S * 0.016, R);
    }
    var bloom = P.seasonKey === 'spring' ? 1 : (P.seasonKey === 'summer' ? 0.35 : 0);
    for (var fl = 0; fl < 22; fl++) {
      var fx3 = S / 2 + R.range(-0.8, 0.8) * drx, fy3 = S - dry * R.range(0.95, 1.18) * Math.sqrt(Math.max(0.05, 1 - Math.pow((fx3 - S / 2) / drx, 2)));
      g.strokeStyle = bloom > 0.5 ? '#7d8668' : '#8a7652'; g.lineWidth = 1.1;
      g.beginPath(); g.moveTo(fx3, fy3 + S * 0.08); g.lineTo(fx3, fy3); g.stroke();
      if (R.f() < bloom) { g.fillStyle = '#e8c53a'; g.beginPath(); g.arc(fx3, fy3, S * 0.014, 0, 6.283); g.fill(); }
    }
  } else if (kind === 'acacia') {
    var ac = new THREE.Color(R.pick(['#4e5a2e', '#586633', '#46512a'])).multiplyScalar(P.treeTint);
    var alite = ac.clone().lerp(new THREE.Color('#b3ba78'), 0.5);
    g.strokeStyle = '#5d4c34'; g.lineWidth = S * 0.030; g.lineCap = 'round';
    var forkY = S * R.range(0.50, 0.60);
    g.lineWidth = S * 0.042;
    g.beginPath(); g.moveTo(S / 2 + R.range(-5, 5), S);
    g.quadraticCurveTo(S / 2 + R.range(-6, 6), S * 0.78, S / 2, forkY); g.stroke();
    /* an acacia's crown is three times wider than it is tall, so its limbs must
       carry that far out or the leaves sit over nothing */
    var atips = [];
    for (var br = 0; br < 7; br++) {
      var bang = -Math.PI * (0.10 + br * 0.133) + R.range(-0.06, 0.06);
      /* The more upright a limb is, the shorter it runs. An acacia spreads
         out rather than up, and at three levels of branching an upright limb
         reached twice its own length and carried the crown clean off the top
         of the card. */
      var upness = Math.abs(Math.sin(bang));
      drawBranches(g, S, S / 2, forkY, S * R.range(0.26, 0.34) * (1 - 0.46 * upness),
        bang, S * 0.024, 2, R, '#5d4c34', atips);
    }
    /* The leaves were set to 0.004 by 0.007 of the card against a usual
       0.010 by 0.018, which is a sixth of the area each, so the crown was
       thin enough to see the limbs through.

       The crown was also a fixed band across the middle of the card, while
       the limbs branch three deep and reach about twice their own length, so
       they ran on well above it: the tree wore its foliage round its waist
       and stood bare against the sky above that. Fit the crown to where the
       limbs actually got to. flatTop squashes the upper part of the ellipse
       into a flat head, so the ellipse has to be tall enough that the
       squashed top still reaches the highest tip. */
    var ax0 = 1e9, ax1 = -1e9, ay0 = 1e9, ay1 = -1e9;
    for (var ai = 0; ai < atips.length; ai++) {
      var atp = atips[ai];
      if (atp[0] < ax0) ax0 = atp[0];
      if (atp[0] > ax1) ax1 = atp[0];
      if (atp[1] < ay0) ay0 = atp[1];
      if (atp[1] > ay1) ay1 = atp[1];
    }
    ay0 = Math.max(ay0 - S * 0.035, S * 0.05); ay1 += S * 0.02;
    var ary = Math.max((ay1 - ay0) / 1.3625, S * 0.10);
    var arx = Math.min(Math.max((ax1 - ax0) * 0.5 + S * 0.05, S * 0.26), S * 0.46);
    drawCrown(g, S, 'acacia', P, R, (ax0 + ax1) * 0.5, ay1 - ary, arx, ary, ac, alite,
      { sprays: 170, sprayR: 0.072, leaves: 14, leafW: 0.008, leafL: 0.013, flatTop: true, tips: atips });
  } else if (kind === 'rock') {
    var rc = new THREE.Color(P.rockCol);
    var top = S * R.range(0.30, 0.52);
    var pts = [], nseg = 11;
    for (var si = 0; si <= nseg; si++) {
      var aa = (si / nseg) * Math.PI;
      pts.push([S / 2 - Math.cos(aa) * S * R.range(0.34, 0.47),
                S - Math.sin(aa) * (S - top) * R.range(0.78, 1.0)]);
    }
    g.fillStyle = rgb(rc);
    g.beginPath(); g.moveTo(S * 0.06, S);
    for (var pi2 = 0; pi2 < pts.length; pi2++) g.lineTo(pts[pi2][0], pts[pi2][1]);
    g.lineTo(S * 0.94, S); g.closePath(); g.fill();
    g.fillStyle = rgb(rc.clone().multiplyScalar(1.28));
    g.beginPath(); g.moveTo(S * 0.26, S * 0.86);
    g.lineTo(S * 0.48, top + S * 0.05); g.lineTo(S * 0.64, S * 0.9); g.closePath(); g.fill();
    g.fillStyle = rgb(rc.clone().multiplyScalar(0.66));
    g.beginPath(); g.moveTo(S * 0.60, S); g.lineTo(S * 0.72, S * 0.68);
    g.lineTo(S * 0.94, S); g.closePath(); g.fill();

  } else if (kind === 'deadbush') {
    g.strokeStyle = '#8b7444';
    for (var b2 = 0; b2 < 34; b2++) {
      var an = -Math.PI * R.range(0.12, 0.88);
      var ln = S * R.range(0.10, 0.28);
      var x1 = S / 2 + R.range(-0.06, 0.06) * S, y1 = S;
      g.lineWidth = R.range(1.2, 2.6);
      g.beginPath(); g.moveTo(x1, y1);
      for (var sg = 0; sg < 3; sg++) {
        an += R.range(-0.45, 0.45);
        x1 += Math.cos(an) * ln * 0.45; y1 += Math.sin(an) * ln * 0.45;
        g.lineTo(x1, y1);
      }
      g.stroke();
    }

  } else {
    /* broadleaf: a trunk, a fan of branches, then leaves on them */
    var bcol = new THREE.Color(P.leafDark || P.grass.base).multiplyScalar(0.9 * P.treeTint);
    var blite = new THREE.Color(P.leafLight || P.grass.tip).multiplyScalar(0.95 * P.treeTint);
    g.strokeStyle = '#4b3a2b'; g.lineWidth = S * 0.062; g.lineCap = 'round';
    g.beginPath(); g.moveTo(S / 2 + R.range(-3, 3), S);
    g.quadraticCurveTo(S / 2 + R.range(-5, 5), S * 0.76, S / 2 + R.range(-4, 4), S * 0.56); g.stroke();
    var nb = 5 + R.int(0, 2), btips = [];
    for (var bb = 0; bb < nb; bb++) {
      var ba = -Math.PI * (0.25 + (bb / (nb - 1)) * 0.5) + R.range(-0.15, 0.15);
      drawBranches(g, S, S / 2, S * R.range(0.54, 0.62), S * R.range(0.17, 0.26), ba, S * 0.026, 3, R, '#4b3a2b', btips);
    }
    drawCrown(g, S, 'broadleaf', P, R, S / 2, S * 0.38, S * 0.36, S * 0.30, bcol, blite, { sprays: 70, sprayR: 0.062, leaves: 13, tips: btips });
  }
  if (opts && opts.far && kind !== 'palm') {
    /* at three hundred metres a real trunk is thinner than a pixel; this one
       is not, and the dark skirt is the undergrowth a treeline stands in */
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = kind === 'pine' ? '#3a2f25' : '#4a3a2c';
    g.fillRect(S * 0.46, S * 0.55, S * 0.08, S * 0.45);
    var sk = g.createLinearGradient(0, S * 0.80, 0, S);
    sk.addColorStop(0, 'rgba(38,48,30,0)'); sk.addColorStop(0.5, 'rgba(38,48,30,0.85)'); sk.addColorStop(1, 'rgba(30,38,24,0.95)');
    g.fillStyle = sk; g.fillRect(S * 0.12, S * 0.80, S * 0.76, S * 0.20);
    g.globalCompositeOperation = 'source-over';
  }
  if (opts && opts.crownOnly) {
    /* erase the trunk below the crown so cards carry foliage only */
    g.globalCompositeOperation = 'destination-out';
    var tw = kind === 'pine' ? 0.08 : 0.22;
    g.fillRect(S * (0.5 - tw / 2), S * (kind === 'pine' ? 0.80 : 0.64), S * tw, S);
    g.globalCompositeOperation = 'source-over';
  }
}

/* Four of a kind on a 2x2 atlas, 256 square each (a power of two, so WebGL
   keeps the proportions drawn), and each instance takes one of them, perhaps
   mirrored: a wood is no longer one tree stamped out. The first is drawn from
   the builder's stream as it always was; the others from streams of their
   own, so nothing else in the world moves. Light is not painted in: the sun
   moves, and goes down, and the shader lights the crown (spriteLight). */
var SPRITE_OWN = { creosote: 1, brittlebush: 1 };
function makePropTexture(kind, P, R, opts) {
  var S = 256, c = cnv(S * 2, S * 2), g = c.getContext('2d');
  for (var v = 0; v < 4; v++) {
    g.save();
    g.translate((v & 1) * S, (v >> 1) * S);
    g.beginPath(); g.rect(0, 0, S, S); g.clip();
    g.lineCap = 'round'; g.lineJoin = 'round';
    /* redrawn desert kinds draw their first tile from a stream of their own too */
    drawPropSprite(g, S, kind, P, v || SPRITE_OWN[kind] ? RNG(P.base + '/sprite/' + kind + '/' + v) : R, opts);
    g.restore();
  }
  return tex(c, false);
}

/* Card width as a fraction of its height. The sprites are drawn to their
   true proportions on a square canvas, so most kinds want a square card; a
   fixed narrow card squeezed every tree and bush into a column. Conifers stay
   a little narrower than drawn, and an acacia's crown spreads wider. */
var SPRITE_ASPECT = { pine: 0.72, acacia: 1.4, creosote: 1.15, brittlebush: 1.3, cactus: 0.62 };
function spriteAspect(kind) { return SPRITE_ASPECT[kind] || 1.0; }
/* Where the bulk of each kind sits on its card, as an ellipse in card
   coordinates (x across, y up, centre and radii), for the shader to light
   it as a solid: a crown rounds away from the sun, darkens underneath and
   glows at its ragged edge when the sun is behind it. */
var SPRITE_CROWN = {
  broadleaf: [0.5, 0.62, 0.38, 0.32], olive: [0.5, 0.60, 0.36, 0.30], blossom: [0.5, 0.60, 0.36, 0.30],
  pine: [0.5, 0.50, 0.27, 0.42], acacia: [0.5, 0.58, 0.46, 0.22], palm: [0.5, 0.60, 0.34, 0.24],
  shrub: [0.5, 0.20, 0.32, 0.24], vine: [0.5, 0.24, 0.32, 0.22],
  creosote: [0.5, 0.55, 0.40, 0.40], brittlebush: [0.5, 0.30, 0.44, 0.34], deadbush: [0.5, 0.10, 0.30, 0.22],
  cactus: [0.5, 0.5, 0.15, 4.0], rock: [0.5, 0.18, 0.44, 0.40]
};
function spriteCrown(kind) { var c = SPRITE_CROWN[kind] || SPRITE_CROWN.broadleaf; return new THREE.Vector4(c[0], c[1], c[2], c[3]); }
/* src/shaders/sprite.vert.glsl */
/* src/shaders/sprite.frag.glsl */

function makeBirdTexture() {
  var S = 64, c = cnv(S, S), g = c.getContext('2d');
  g.strokeStyle = 'rgba(30,32,36,0.9)';
  g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath();
  g.moveTo(6, 40); g.quadraticCurveTo(20, 20, 32, 34);
  g.quadraticCurveTo(44, 20, 58, 40);
  g.stroke();
  return tex(c, false);
}

function makeSoftDot() {
  var S = 64, c = cnv(S, S), g = c.getContext('2d');
  var grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, S, S);
  return tex(c, false);
}

function makeFinishTexture(fin, R) {
  var S = 256, c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = fin.col; g.fillRect(0, 0, S, S);
  var col = new THREE.Color(fin.col);
  if (fin.type === 'wood') {
    for (var i = 0; i < 190; i++) {
      var y = R.f() * S;
      var d = R.range(-0.22, 0.14);
      var cc = col.clone().offsetHSL(0, 0, d * 0.35);
      g.strokeStyle = 'rgba(' + Math.round(cc.r * 255) + ',' + Math.round(cc.g * 255) + ',' + Math.round(cc.b * 255) + ',' + R.range(0.06, 0.3) + ')';
      g.lineWidth = R.range(0.6, 3.4);
      g.beginPath();
      g.moveTo(0, y);
      g.bezierCurveTo(S * 0.33, y + R.range(-8, 8), S * 0.66, y + R.range(-8, 8), S, y + R.range(-5, 5));
      g.stroke();
    }
  } else if (fin.type === 'metal') {
    for (var j = 0; j < 3000; j++) {
      g.fillStyle = 'rgba(255,255,255,' + (R.f() * 0.05) + ')';
      g.fillRect(R.f() * S, R.f() * S, 1.6, 1);
    }
    var lg = g.createLinearGradient(0, 0, S, S);
    lg.addColorStop(0, 'rgba(255,255,255,0.08)');
    lg.addColorStop(0.5, 'rgba(0,0,0,0.06)');
    lg.addColorStop(1, 'rgba(255,255,255,0.05)');
    g.fillStyle = lg; g.fillRect(0, 0, S, S);
  } else { /* paint */
    for (var k = 0; k < 6000; k++) {
      g.fillStyle = 'rgba(' + (R.f() < 0.5 ? '0,0,0,' : '255,255,255,') + (R.f() * 0.045) + ')';
      g.fillRect(R.f() * S, R.f() * S, 2, 2);
    }
    /* fine cracks & wear */
    var wear = fin.wear;
    for (var m = 0; m < 34 * wear; m++) {
      g.strokeStyle = 'rgba(0,0,0,' + R.range(0.03, 0.12) + ')';
      g.lineWidth = R.range(0.5, 1.3);
      var x = R.f() * S, y2 = R.f() * S;
      g.beginPath(); g.moveTo(x, y2);
      for (var s = 0; s < 4; s++) { x += R.range(-22, 22); y2 += R.range(-22, 22); g.lineTo(x, y2); }
      g.stroke();
    }
  }
  var t = tex(c, true);
  t.repeat.set(2, 2);
  return t;
}

function makeWallTexture(P, R, wallW, wallH) {
  var S = 512, c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, S, S);
  /* plaster grain */
  var f = tileFBM(128, R.int(1, 99999), 4, 8);
  var im = g.getImageData(0, 0, S, S);
  for (var y = 0; y < S; y++) {
    for (var x = 0; x < S; x++) {
      var n = f[((y >> 2) % 128) * 128 + ((x >> 2) % 128)];
      var v = 210 + n * 46;
      var i = (y * S + x) * 4;
      im.data[i] = v; im.data[i + 1] = v; im.data[i + 2] = v; im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  /* soft spill of daylight around the opening + darkening toward the room edges */
  var px = function (wx) { return (wx / wallW + 0.5) * S; };
  var py = function (wy) { return (0.5 - (wy - P.win.cy) / wallH) * S; };
  var gx0 = px(-P.win.w / 2), gx1 = px(P.win.w / 2);
  var gy0 = py(P.win.cy + P.win.h / 2), gy1 = py(P.win.cy - P.win.h / 2);
  var cx = (gx0 + gx1) / 2, cy = (gy0 + gy1) / 2;
  var rad = Math.max(gx1 - gx0, gy1 - gy0);
  var glow = g.createRadialGradient(cx, cy, rad * 0.45, cx, cy, rad * 2.4);
  glow.addColorStop(0, 'rgba(255,255,255,0.55)');
  glow.addColorStop(0.35, 'rgba(255,255,255,0.16)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(0, 0, S, S);
  var dark = g.createRadialGradient(cx, cy, rad * 0.9, cx, cy, rad * 3.1);
  dark.addColorStop(0, 'rgba(0,0,0,0)');
  dark.addColorStop(1, 'rgba(0,0,0,0.72)');
  g.fillStyle = dark; g.fillRect(0, 0, S, S);
  return tex(c, false);
}

function makeGlassTexture(R) {
  /* what a pane actually shows of the room: a broad soft sheet of light
     from one side, brighter toward the top, and nothing sharp */
  var S = 256, c = cnv(S, S), g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, S, S);
  var ang = R.range(-0.7, -0.35), x0 = R.range(0.1, 0.5) * S;
  var lg = g.createLinearGradient(x0, 0, x0 + Math.cos(ang) * S * 1.6, S);
  lg.addColorStop(0.0, 'rgba(255,255,255,0)');
  lg.addColorStop(0.40, 'rgba(255,255,255,' + R.range(0.05, 0.09) + ')');
  lg.addColorStop(0.55, 'rgba(255,255,255,' + R.range(0.04, 0.07) + ')');
  lg.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = lg; g.fillRect(0, 0, S, S);
  var vg = g.createLinearGradient(0, 0, 0, S);
  vg.addColorStop(0, 'rgba(255,255,255,0.06)');
  vg.addColorStop(0.5, 'rgba(255,255,255,0.0)');
  g.fillStyle = vg; g.fillRect(0, 0, S, S);
  return tex(c, false);
}

