/* ---------- baked shadows ----------
   Marched across the heightfield toward the sun once per world (and again when
   the sun has moved enough to matter), then each tree's crown is dropped along
   the sun onto the same map. Nothing per frame but a texture read. */
var SHADOW = { x0: -300, x1: 300, z0: -600, z1: 30 };
var NEAR = { x0: -32, x1: 32, z0: -66, z1: -2 };
/* Drop capsules ([x0, y0, z0, x1, y1, z1, radius, strength, stem]) along the
   light onto a map of N texels a side over rect M with ground heights hg,
   darkening lit. The ray from a texel up toward the sun passes within the
   radius of the segment: both are projected along the light onto the level
   of the caster's foot, where the capsule's round section becomes an ellipse
   stretched down-sun. wide: no narrower than this, and paler (a coarse map
   would otherwise lose a thin shadow between its texel centres; twice its
   true share of the texel, as the coarse map's soften spreads it again);
   wt(x, z), if given: how much of the shadow this map carries there. */
function dropCapsules(lit, hg, N, M, sunDir, caps, wide, wt) {
  var sx = (M.x1 - M.x0) / N, sz = (M.z1 - M.z0) / N, b = wide ? 0 : 1, i, j, k;
  var dx = sunDir.x, dy = sunDir.y, dz = sunDir.z, hl = Math.sqrt(dx * dx + dz * dz) || 1;
  if (dy <= 0.04 || !caps.length) return;
  var ux = dx / hl, uz = dz / hl, sinE = dy;
  for (k = 0; k < caps.length; k++) {
    var c = caps[k], yb = Math.min(c[1], c[4]), r = Math.max(c[6], wide), str = c[7] * Math.min(1, 2 * c[6] / r);
    var low = c[1] <= c[4] ? 0 : 1;
    /* along the light down to the foot's level: x' = x - d.x (y - yb) / d.y */
    var ax = c[0] - dx * (c[1] - yb) / dy, az = c[2] - dz * (c[1] - yb) / dy;
    var bx = c[3] - dx * (c[4] - yb) / dy, bz = c[5] - dz * (c[4] - yb) / dy;
    var pad = r / sinE + 0.5;
    var i0 = Math.max(b, Math.floor((Math.min(ax, bx) - pad - M.x0) / sx)), i1 = Math.min(N - 1 - b, Math.floor((Math.max(ax, bx) + pad - M.x0) / sx));
    var j0 = Math.max(b, Math.floor((Math.min(az, bz) - pad - M.z0) / sz)), j1 = Math.min(N - 1 - b, Math.floor((Math.max(az, bz) + pad - M.z0) / sz));
    if (i0 > i1 || j0 > j1) continue;
    var lx = bx - ax, lz = bz - az, ll = lx * lx + lz * lz;
    for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
      var idx = j * N + i, gy = hg[idx], tx = M.x0 + (i + 0.5) * sx, tz = M.z0 + (j + 0.5) * sz;
      /* the texel, slid along the light to the foot's level */
      var wx = tx + dx * (yb - gy) / dy, wz = tz + dz * (yb - gy) / dy;
      var t = ll > 1e-8 ? clamp(((wx - ax) * lx + (wz - az) * lz) / ll, 0, 1) : low;
      var qx = wx - (ax + lx * t), qz = wz - (az + lz * t);
      /* A stem (a cactus's trunk; stem 1) does not shade its own sunlit
         side. The map is read at a surface's ground position, so the round
         cap of the shadow at the foot, up-sun of it, and the foot's own
         section (never seen) are the stem itself: leave them lit, or the
         filtering darkens its face. A bush's mass hangs over the ground
         under it, which it does shade. */
      if (c[8] && yb - gy < r + 0.5) {
        var fx = wx - (low ? bx : ax), fz = wz - (low ? bz : az);
        if ((t === low && qx * ux + qz * uz > 0) || fx * fx + fz * fz < c[6] * c[6]) continue;
      }
      var du = (qx * ux + qz * uz) * sinE, dv = -qx * uz + qz * ux;
      var dd = Math.sqrt(du * du + dv * dv);
      if (dd < r * 1.15) {
        var w = wt ? wt(tx, tz) : 1;
        if (w > 0) lit[idx] = Math.min(lit[idx], 1 - str * w * smoothstep(r * 1.15, r * 0.75, dd));
      }
    }
  }
}
/* The near caster map: every capsule in App._casters (a saguaro's trunk and
   each limb of its arms, a bush's mass) dropped onto the ground. */
function bakeNear(H, sunDir) {
  var N = 256, sx = (NEAR.x1 - NEAR.x0) / N, sz = (NEAR.z1 - NEAR.z0) / N, i, j, k;
  if (!App._nearH) {
    App._nearH = new Float32Array(N * N);
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) App._nearH[j * N + i] = H(NEAR.x0 + (i + 0.5) * sx, NEAR.z0 + (j + 0.5) * sz);
  }
  var lit = new Float32Array(N * N);
  for (k = 0; k < N * N; k++) lit[k] = 1;
  dropCapsules(lit, App._nearH, N, NEAR, sunDir, App._casters || [], 0, null);
  var out = new Uint8Array(N * N * 4);
  for (k = 0; k < N * N; k++) { var v = Math.round(lit[k] * 255); out[k * 4] = v; out[k * 4 + 1] = v; out[k * 4 + 2] = v; out[k * 4 + 3] = 255; }
  var tex = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  /* Mip-mapped: further off a texel is smaller than a pixel and its thin
     shadows would crawl. Seen at a grazing angle a plain mip blurs them
     away across the view too; a little anisotropy keeps them. */
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = App.renderer ? Math.min(4, App.renderer.capabilities.getMaxAnisotropy()) : 1;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false; tex.needsUpdate = true;
  var U = App.U;
  if (U.uNearMap.value) U.uNearMap.value.dispose();
  U.uNearMap.value = tex;
}
function bakeStatic(P, H, N, sx, sz) {
  var hg = new Float32Array(N * N), i, j, k;
  for (j = 0; j < N; j++) for (i = 0; i < N; i++)
    hg[j * N + i] = H(SHADOW.x0 + (i + 0.5) * sx, SHADOW.z0 + (j + 0.5) * sz);
  /* A city's buildings are solid boxes, not crowns: raise each footprint to
     its roof in a copy of the heights, and the march shades the street from
     them exactly as it does from a hill. */
  var boxes = App._boxes || [], hc = hg, city = boxes.length > 0, foot = null;
  if (city) {
    hc = new Float32Array(hg);
    foot = new Uint8Array(N * N);       /* 1 inside a footprint */
    for (k = 0; k < boxes.length; k++) {
      var bb = boxes[k], bc = Math.cos(bb[4]), bs = Math.sin(bb[4]);
      var ext = Math.abs(bc) * bb[2] + Math.abs(bs) * bb[3], ezt = Math.abs(bs) * bb[2] + Math.abs(bc) * bb[3];
      var bi0 = Math.max(0, Math.floor((bb[0] - ext - SHADOW.x0) / sx)), bi1 = Math.min(N - 1, Math.floor((bb[0] + ext - SHADOW.x0) / sx));
      var bj0 = Math.max(0, Math.floor((bb[1] - ezt - SHADOW.z0) / sz)), bj1 = Math.min(N - 1, Math.floor((bb[1] + ezt - SHADOW.z0) / sz));
      for (j = bj0; j <= bj1; j++) for (i = bi0; i <= bi1; i++) {
        var ox = SHADOW.x0 + (i + 0.5) * sx - bb[0], oz = SHADOW.z0 + (j + 0.5) * sz - bb[1];
        if (Math.abs(ox * bc + oz * bs) <= bb[2] && Math.abs(-ox * bs + oz * bc) <= bb[3]) {
          foot[j * N + i] = 1;
          if (hc[j * N + i] < bb[5]) hc[j * N + i] = bb[5];
        }
      }
    }
  }
  /* B: how deep the water stands over each texel, for the water shader's
     colour and its fade to nothing at the shore. Square-root encoded (8 m
     full scale) so the first few centimetres, where the edge is, keep their
     precision. Dry ground and no water at all read 0 and 1 respectively. */
  var wd = new Uint8Array(N * N), maxTop = -1e9;
  for (k = 0; k < N * N; k++) {
    wd[k] = P.waterY == null ? 255 : Math.round(Math.sqrt(clamp((P.waterY - hg[k]) / 8, 0, 1)) * 255);
    if (hc[k] > maxTop) maxTop = hc[k];
  }
  return { N: N, hc: hc, city: city, foot: foot, wd: wd, maxTop: maxTop };
}
function bakeShadows(P, H, sunDir) {
  if (App._casters && App._casters.length) bakeNear(H, sunDir);
  var N = Q().grid >= 180 ? 448 : 320;
  var sx = (SHADOW.x1 - SHADOW.x0) / N, sz = (SHADOW.z1 - SHADOW.z0) / N, i, j, k;
  /* Everything here that the sun does not move (the heights, the city
     raised on them, the water's depth and the tallest point) is worked out
     once per world, like the AO: a rebake as the sun moves only marches. */
  var BK = App._bake;
  if (!BK || BK.N !== N) BK = App._bake = bakeStatic(P, H, N, sx, sz);
  var hc = BK.hc, city = BK.city, foot = BK.foot, wd = BK.wd, maxTop = BK.maxTop;
  var lit = new Float32Array(N * N);
  /* For a city, also how high the shadow reaches up each column (the walls
     read it): the highest of each occluder's top less the ray's climb to it.
     A bridge's deck and its cars read it too (bakedSun), so it is worked out
     for the texels under the whole road and its towers as well. */
  var bi0 = N, bi1 = -1, bj0 = N, bj1 = -1;
  if (!city && P.bridgeSpan) {
    var bHalf = P.bridgeRoad * 0.5, bW = P.bridgeW * 0.5 + 8;
    bi0 = Math.max(0, Math.floor((-bHalf - SHADOW.x0) / sx)); bi1 = Math.min(N - 1, Math.floor((bHalf - SHADOW.x0) / sx));
    bj0 = Math.max(0, Math.floor((P.bridgeZ - bW - SHADOW.z0) / sz)); bj1 = Math.min(N - 1, Math.floor((P.bridgeZ + bW - SHADOW.z0) / sz));
  }
  var hsh = city || bi1 >= bi0 ? new Float32Array(N * N) : null;
  if (hsh) for (k = 0; k < N * N; k++) hsh[k] = -1e4;
  var dx = sunDir.x, dy = sunDir.y, dz = sunDir.z;
  if (dy < 0.04) { for (k = 0; k < N * N; k++) lit[k] = 1; }
  else {
    /* towers throw long shadows: a longer, coarser march for a city */
    var step = city ? 5.0 : 3.2, steps = city ? 80 : 70;
    for (j = 0; j < N; j++) {
      for (i = 0; i < N; i++) {
        var px = i + 0.5, pz = j + 0.5, g0 = hc[j * N + i], ray = g0 + 0.35, open = 1, top = g0;
        var tall = city || (i >= bi0 && i <= bi1 && j >= bj0 && j <= bj1);
        for (k = 0; k < steps; k++) {
          px += dx * step / sx; pz += dz * step / sz; ray += dy * step;
          /* above the tallest thing in the map nothing further can shade
             this texel or raise its shadow's height: the rest of the march
             would change nothing */
          if (ray >= maxTop + 0.35) break;
          var ii = px | 0, jj = pz | 0;
          if (ii < 0 || jj < 0 || ii >= N || jj >= N) break;
          var hk = hc[jj * N + ii];
          if (hk > ray) { open = 0; if (!tall) break; }
          if (tall && hk - (ray - g0 - 0.35) > top) top = hk - (ray - g0 - 0.35);
        }
        lit[j * N + i] = open;
        if (tall) hsh[j * N + i] = top;
      }
    }
  }
  /* crowns: an ellipse dropped along the light, a thin trunk line back to the base */
  var casters = App._shadows || [];
  var hx = dx, hz = dz, hl = Math.sqrt(hx * hx + hz * hz) || 1;
  hx /= hl; hz /= hl;
  var tanE = Math.max(dy, 0.12) / hl;
  for (k = 0; k < casters.length; k++) {
    var c = casters[k];
    if (c[6]) continue;                 /* drawn as capsules (below); here only for AO */
    var r = c[3], hgt = c[5] || r * 3, str = c[4] == null ? 1 : c[4];
    str *= 1 - 0.65 * smoothstep(90, 220, Math.sqrt(c[0] * c[0] + c[2] * c[2]));
    var reach = Math.min(hgt * 0.62 / tanE, 80);
    var cx = c[0] - hx * reach, cz = c[2] - hz * reach;
    var rr = Math.max(r, 1.2);
    var i0 = Math.max(0, ((Math.min(cx, c[0]) - rr - SHADOW.x0) / sx) | 0), i1 = Math.min(N - 1, ((Math.max(cx, c[0]) + rr - SHADOW.x0) / sx) | 0);
    var j0 = Math.max(0, ((Math.min(cz, c[2]) - rr - SHADOW.z0) / sz) | 0), j1 = Math.min(N - 1, ((Math.max(cz, c[2]) + rr - SHADOW.z0) / sz) | 0);
    for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
      var wx = SHADOW.x0 + (i + 0.5) * sx, wz = SHADOW.z0 + (j + 0.5) * sz;
      var ex = (wx - cx) / rr, ez = (wz - cz) / rr;
      var crown = 1 - Math.min(1, Math.sqrt(ex * ex + ez * ez));
      /* distance from the trunk line base->crown */
      var lx = c[0] - cx, lz = c[2] - cz, ll = lx * lx + lz * lz || 1;
      var t = ((wx - cx) * lx + (wz - cz) * lz) / ll; t = Math.max(0, Math.min(1, t));
      var qx = cx + lx * t - wx, qz = cz + lz * t - wz;
      var trunk = 1 - Math.min(1, Math.sqrt(qx * qx + qz * qz) / (rr * 0.28));
      var sh = Math.max(crown * crown, trunk * 0.7) * str;
      var idx = j * N + i;
      lit[idx] = Math.min(lit[idx], 1 - sh);
    }
  }
  /* The near casters' shadows belong to the near map, but a low sun throws
     them past its edge: there the same capsules are dropped here too,
     widened to this map's texels, so the shadow runs on instead of ending. */
  dropCapsules(lit, hc, N, SHADOW, sunDir, App._casters || [], 0.6 * sx, function (x, z) {
    return x <= NEAR.x0 || x >= NEAR.x1 || z <= NEAR.z0 || z >= NEAR.z1 ? 1 : 0;
  });
  /* the box footprints are whole texels, so the shadow's edge up a wall
     or across a roof came out in stairs: soften the heights once. A street
     texel only from the street round it and a roof from the roof: the roof's
     own height averaged into the street beside it read as a shadow metres
     up the foot of every sunlit wall. */
  if (city) {
    var hb = new Float32Array(N * N);
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var hacc = 0, hn = 0, f0 = foot[j * N + i];
      for (var hj = -1; hj <= 1; hj++) for (var hi2 = -1; hi2 <= 1; hi2++) {
        var ha = i + hi2, hbb = j + hj;
        if (ha < 0 || hbb < 0 || ha >= N || hbb >= N || foot[hbb * N + ha] !== f0) continue;
        hacc += hsh[hbb * N + ha]; hn++;
      }
      hb[j * N + i] = hacc / hn;
    }
    hsh = hb;
  }
  /* ambient occlusion does not move with the sun: worked out once per world */
  if (!App._ao || App._ao.length !== N * N) App._ao = bakeAO(N, hc, sx, sz, casters);
  var ao = App._ao;
  /* soften once */
  var out = new Uint8Array(N * N * 4);
  for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
    var acc = 0, cnt = 0;
    for (var oj = -1; oj <= 1; oj++) for (var oi = -1; oi <= 1; oi++) {
      var a = i + oi, b = j + oj;
      if (a < 0 || b < 0 || a >= N || b >= N) continue;
      acc += lit[b * N + a]; cnt++;
    }
    var v = Math.round((acc / cnt) * 255);
    var o = (j * N + i) * 4;
    out[o] = v; out[o + 1] = Math.round(ao[j * N + i] * 255); out[o + 2] = wd[j * N + i];
    /* A: the shadow's height up the column, -160 to 480 m (a city, under a
       bridge); 0, no shadow at any height, where nothing reads it */
    out[o + 3] = hsh ? Math.round(clamp((hsh[j * N + i] + 160) / 640, 0, 1) * 255) : 0;
  }
  var tex = new THREE.DataTexture(out, N, N, THREE.RGBAFormat);
  tex.minFilter = THREE.LinearFilter; tex.magFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

/* How much of the sky each texel of ground can see, for the shadow map's G
   channel: hollows (the ground below its own blurred surroundings) see less of
   it, and the ground under anything standing on it less still. */
function bakeAO(N, hg, sx, sz, casters) {
  var R = 6, W = 2 * R + 1, i, j, k;
  var tmp = new Float32Array(N * N), bl = new Float32Array(N * N), ao = new Float32Array(N * N);
  /* separable box blur, edges clamped */
  for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
    var acc = 0;
    for (k = -R; k <= R; k++) acc += hg[j * N + Math.min(N - 1, Math.max(0, i + k))];
    tmp[j * N + i] = acc / W;
  }
  for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
    var acc2 = 0;
    for (k = -R; k <= R; k++) acc2 += tmp[Math.min(N - 1, Math.max(0, j + k)) * N + i];
    bl[j * N + i] = acc2 / W;
  }
  for (k = 0; k < N * N; k++) ao[k] = 1 - 0.45 * smoothstep(0.2, 3.0, bl[k] - hg[k]);
  /* a soft disc of contact shadow under every caster, wider than its crown */
  for (k = 0; k < casters.length; k++) {
    var c = casters[k], rr = Math.max(c[3], 0.6) * 1.5, str = 0.4 * (c[4] == null ? 1 : Math.min(c[4], 1));
    var i0 = Math.max(0, ((c[0] - rr - SHADOW.x0) / sx) | 0), i1 = Math.min(N - 1, ((c[0] + rr - SHADOW.x0) / sx) | 0);
    var j0 = Math.max(0, ((c[2] - rr - SHADOW.z0) / sz) | 0), j1 = Math.min(N - 1, ((c[2] + rr - SHADOW.z0) / sz) | 0);
    for (j = j0; j <= j1; j++) for (i = i0; i <= i1; i++) {
      var dx = SHADOW.x0 + (i + 0.5) * sx - c[0], dz = SHADOW.z0 + (j + 0.5) * sz - c[2];
      var t = 1 - Math.sqrt(dx * dx + dz * dz) / rr;
      if (t > 0) ao[j * N + i] *= 1 - str * t * t;
    }
  }
  return ao;
}

function applyShadowMap(tex) {
  var U = App.U;
  if (App.renderer && App.renderer.capabilities && App.renderer.capabilities.vertexTextures === false) { tex.dispose(); return; }
  if (U.uShadowMap.value && U.uShadowMap.value !== tex) U.uShadowMap.value.dispose();
  U.uShadowMap.value = tex;
  App.bakedSun = App.U.uSunDir.value.clone();
}


