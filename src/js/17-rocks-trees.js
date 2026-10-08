/* ---------- rocks: displaced icosahedra ---------- */
function rockTemplate(R, kind, blocky) {
  /* A boulder is rounded, a block is angular with a flat top, a slab lies
     long and low, a shard stands. Each vertex is pushed by its own noise, and
     the mesh is left unindexed so every face keeps its own flat normal. */
  var detail = kind === 'boulder' ? 2 : 1;
  var geo = new THREE.IcosahedronGeometry(1, detail);
  var pos = geo.attributes.position, seed = R.int(1, 9999);
  var sx = kind === 'slab' ? R.range(1.3, 1.9) : R.range(0.8, 1.2);
  var sy = kind === 'slab' ? R.range(0.32, 0.5) : (kind === 'shard' ? R.range(1.4, 2.1) : R.range(0.62, 0.95));
  var sz = kind === 'slab' ? R.range(0.9, 1.5) : R.range(0.7, 1.15);
  var rough = kind === 'boulder' ? 0.22 : (kind === 'block' ? 0.34 : 0.28);
  for (var i = 0; i < pos.count; i++) {
    var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    /* Two scales of displacement. The fine one roughens the surface; without
       the coarse one the rock keeps the outline of the sphere it started as,
       and scaling that by three numbers only makes it an egg. */
    var n = 1 + fbm2(x * 1.9 + seed, z * 1.9 + y * 1.3, seed, 3) * rough
              + fbm2(x * 0.8 + seed * 0.37, z * 0.8 + y * 0.55, seed + 61, 2) * rough * 0.9;
    /* blocks have a flat top; shards lean */
    var yy = y * n * sy;
    if (kind === 'block' && yy > sy * 0.55) yy = sy * 0.55 + (yy - sy * 0.55) * 0.25;
    var xx = x * n * sx + (kind === 'shard' ? yy * 0.25 : 0), zz = z * n * sz;
    /* Dry rock breaks along its joints and beds into blocks: square the
       sides off too, leaving the corners rounded by the weather */
    if (blocky && kind !== 'boulder') {
      var cap = function (v, m) { return Math.abs(v) > m ? (v < 0 ? -1 : 1) * (m + (Math.abs(v) - m) * 0.2) : v; };
      xx = cap(xx, sx * 0.62); zz = cap(zz, sz * 0.62);
      if (yy < -sy * 0.5) yy = -sy * 0.5 + (yy + sy * 0.5) * 0.3;
    }
    pos.setXYZ(i, xx, yy + sy * 0.55, zz);
  }
  geo.computeVertexNormals();
  var g2 = new THREE.BufferGeometry();
  g2.setAttribute('position', geo.attributes.position);
  g2.setAttribute('normal', geo.attributes.normal);
  g2.setAttribute('rib', new THREE.Float32BufferAttribute(new Float32Array(pos.count), 1));
  g2.setIndex(geo.index);
  return g2;
}
function buildRocks(scene, P, R, U, H, spec) {
  var rc = new THREE.Color(P.rockCol);
  var second = rc.clone().offsetHSL(R.range(-0.04, 0.04), R.range(-0.1, 0.1), R.range(-0.16, 0.14));
  var lichen = R.pick(['#8f9a3c', '#b8a23a', '#c8742e', '#7f9560', '#9aa15a']);
  var dryRock = !!P.biome.dryAir && P.biome.ground === 'sand';
  var mat = solidMat(U, P.rockCol, { rib: 0, grain: 2, body2: '#' + second.getHexString(), lichen: lichen, varnish: dryRock });
  var kinds = dryRock ? ['block', 'block', 'slab', 'block', 'boulder'] : ['boulder', 'boulder', 'block', 'slab', 'shard'];
  var per = Math.ceil(spec.count / kinds.length);
  var lim = scatterLim(P);
  for (var t = 0; t < kinds.length; t++) {
    var tpl = rockTemplate(R, kinds[t], dryRock), items = [], guard = 0;
    /* The size in the biome spec was multiplying a template that is itself
       anywhere from 0.7 to 3.9 units tall, so the same number meant a boulder
       to one kind and a standing stone to another: a shard on the moor came
       out nearly seven metres. Read the spec as the height the rock should
       be, and hold even the big ones to something a person could climb. */
    tpl.computeBoundingBox();
    var tplH = Math.max(tpl.boundingBox.max.y - tpl.boundingBox.min.y, 0.01);
    while (items.length < per && guard < per * 40) {
      guard++;
      var a = R.range(-lim, lim);
      var rr = spec.r[0] + Math.pow(R.f(), 1.35) * (spec.r[1] - spec.r[0]);
      var x = Math.sin(a) * rr, z = -Math.cos(a) * rr;
      if (!plantable(P, H, x, z, 0.6)) continue;
      /* mostly modest, now and then a boulder the size of a car */
      var big = R.f() < 0.10;
      var want = R.range(spec.size[0], spec.size[1]) * 0.62 * (big ? R.range(1.35, 1.8) : 1);
      var sz = Math.min(want, 2.2) / tplH;
      var y = H(x, z) - sz * (kinds[t] === 'slab' ? 0.12 : 0.30);       /* bedded into the ground */
      items.push([x, y, z, sz, R.range(0, 6.283), R.range(0.8, 1.15), R.range(0.75, 1.25)]);
      App._shadows.push([x, H(x, z), z, sz * 0.9, 0.7, sz * 0.9]);
      /* a rock often has smaller ones fallen beside it */
      if (R.f() < 0.35) {
        var na = R.range(0, 6.283), nd = sz * R.range(1.2, 2.0), nx = x + Math.cos(na) * nd, nz = z + Math.sin(na) * nd;
        if (plantable(P, H, nx, nz)) items.push([nx, H(nx, nz) - sz * 0.1, nz, sz * R.range(0.25, 0.45), R.range(0, 6.283), 1, 1]);
      }
    }
    if (items.length) instanceSolid(scene, tpl, items, mat);
  }
  /* Talus: what a cliff sheds lies in a fan of blocks at its foot. Look for
     ground that is still walkable with a cliff close above it, and heap a
     few blocks there. A stream of its own, so nothing else moves. */
  if (!dryRock) return;
  var TS = RNG(P.base + '/build/talus' + (P.nonce ? '/' + P.nonce : ''));
  var ttpl = rockTemplate(TS, 'block', true), tItems = [];
  ttpl.computeBoundingBox();
  var tH = Math.max(ttpl.boundingBox.max.y - ttpl.boundingBox.min.y, 0.01);
  for (var tg = 0; tg < 900 && tItems.length < 160; tg++) {
    var ta = TS.range(-lim, lim), tr = TS.range(20, 320);
    var tx = Math.sin(ta) * tr, tz = -Math.cos(ta) * tr;
    var s0 = slopeAt(H, tx, tz);
    if (s0 > 0.55 || !plantable(P, H, tx, tz)) continue;
    /* which way is uphill, and is there a cliff within ten metres of it? */
    var gx = H(tx + 2, tz) - H(tx - 2, tz), gz = H(tx, tz + 2) - H(tx, tz - 2), gl = Math.sqrt(gx * gx + gz * gz);
    if (gl < 1e-3) continue;
    var ux = tx + gx / gl * 8, uz = tz + gz / gl * 8;
    if (slopeAt(H, ux, uz) < 1.0) continue;
    var nB = TS.int(3, 9);
    for (var tb = 0; tb < nB; tb++) {
      var bx = tx + TS.gauss() * 3, bz = tz + TS.gauss() * 3, bs = TS.range(0.25, 1.6) * (TS.f() < 0.12 ? 2 : 1) / tH;
      if (!plantable(P, H, bx, bz)) continue;
      tItems.push([bx, H(bx, bz) - bs * 0.3, bz, bs, TS.range(0, 6.283), TS.range(0.7, 1.1), TS.range(0.8, 1.3)]);
    }
  }
  if (tItems.length) instanceSolid(scene, ttpl, tItems, mat);
}

/* ---------- near trees: a real trunk and branches, leaf cards for the crown ---------- */
/* Five ways a trunk grows. A tree is mostly recognised by its silhouette, so
   these differ in lean, curve, root flare and taper rather than in detail. */
var TRUNK_SHAPES = ['straight', 'leaning', 'sinuous', 'buttressed', 'forked'];
function trunkTemplate(R, kind) {
  var B = { pos: [], nor: [], idx: [], rib: [] };
  var shape = kind === 'pine' ? (R.f() < 0.7 ? 'straight' : 'leaning')
            : (kind === 'olive' ? (R.f() < 0.5 ? 'sinuous' : 'buttressed') : R.pick(TRUNK_SHAPES));
  var top = kind === 'pine' ? R.range(0.76, 0.88) : R.range(0.46, 0.66);
  /* A trunk a twentieth of the tree's height across read as a post: real
     ones are nearer a fortieth, and flare only a little at the foot. */
  var baseR = kind === 'pine' ? R.range(0.012, 0.018) : R.range(0.016, 0.024);
  var lean = 0, lean2 = 0, curve = 0, flare = 0.5, flareK = 6.0, taper = 0.35, sides = 20;

  if (shape === 'leaning')     { lean = R.range(0.10, 0.22) * (R.f() < 0.5 ? -1 : 1); lean2 = R.range(-0.08, 0.08); }
  else if (shape === 'sinuous'){ curve = R.range(0.05, 0.11); lean = R.range(-0.07, 0.07); }
  else if (shape === 'buttressed') { flare = R.range(0.45, 0.75); flareK = R.range(3.2, 4.6); baseR *= 1.15; taper = 0.45; sides = 22; }
  else                          { lean = R.range(-0.05, 0.05); lean2 = R.range(-0.05, 0.05); }

  var ph = R.range(0, 6.283), ph2 = R.range(0, 6.283);
  var mk = function (h, lx, lz, r0, tp) {
    var path = [], radii = [], segs = 10;
    for (var i = 0; i <= segs; i++) {
      var t = i / segs;
      var x = lx * t * t + curve * Math.sin(t * 3.4 + ph) * (0.25 + t * 0.75);
      var zz = lz * t * t + curve * 0.7 * Math.sin(t * 2.7 + ph2) * (0.25 + t * 0.75);
      path.push([x, -0.04 + t * (h + 0.04), zz]);
      /* The flare dies away, then the trunk tapers - but not evenly. An even
         taper over a perfect circle is a bollard, so most of the narrowing is
         saved for higher up and the girth swells and pinches on the way. */
      radii.push(r0 * (1 + flare * Math.exp(-t * flareK)) * (1 - tp * Math.pow(t, 1.4))
        * (1 + 0.09 * Math.sin(t * 7.0 + ph) + 0.05 * Math.sin(t * 17.0 + ph2)));
    }
    return { path: path, radii: radii, tipX: path[segs][0], tipZ: path[segs][2] };
  };

  /* A trunk is not a turned post. A few shallow lobes down its length are
     what tell the eye it grew rather than being machined. */
  var lobes = { n: R.int(3, 6), amp: R.range(0.05, 0.10) };
  var main = mk(top, lean, lean2, baseR, taper);
  pushTube(B, main.path, main.radii, sides, lobes);
  var tips = [[main.tipX, top, main.tipZ]];

  if (shape === 'forked') {
    /* a second stem of nearly equal weight, leaving low down */
    var fa = R.range(0, 6.283), fr = R.range(0.10, 0.20), fh = top * R.range(0.85, 1.05);
    var f2 = mk(fh, Math.cos(fa) * fr, Math.sin(fa) * fr, baseR * R.range(0.72, 0.88), taper);
    for (var k = 0; k < f2.path.length; k++) { f2.path[k][1] = -0.04 + (k / (f2.path.length - 1)) * (fh + 0.04); }
    pushTube(B, f2.path, f2.radii, sides, lobes);
    tips.push([f2.tipX, fh, f2.tipZ]);
  }

  var arms = kind === 'pine' ? 0 : R.int(6, 9), sp;
  for (var a = 0; a < arms; a++) {
    var th = (a / arms) * 6.283 + R.range(-0.4, 0.4);
    var y0 = top * R.range(0.55, 0.95), reach = R.range(0.18, 0.32), rise = R.range(0.12, 0.30);
    /* start on the trunk's surface where it actually is at that height */
    var tq = (y0 + 0.04) / (top + 0.04);
    var ax = lean * tq * tq + curve * Math.sin(tq * 3.4 + ph) * (0.25 + tq * 0.75);
    var az = lean2 * tq * tq + curve * 0.7 * Math.sin(tq * 2.7 + ph2) * (0.25 + tq * 0.75);
    var ex = ax + Math.cos(th) * reach, ez = az + Math.sin(th) * reach;
    var br = limbPath([ax, y0, az], [ex, y0 + rise, ez], [(ax + ex) * 0.5, y0 + rise * 0.3, (az + ez) * 0.5], baseR * 0.55, 5);
    pushTube(B, br.path, br.radii, 8);
    tips.push([ex, y0 + rise, ez]);
    tips.push([(ax + ex) * 0.62, y0 + rise * 0.55, (az + ez) * 0.62]);
    /* Sprays along the limb as well as at its end. Leaves only at the tips
       left every branch bare along its length and the middle of the crown
       hollow, so the tree read as a frame with tufts hung on it. The fourth
       number marks a spray inside the crown, which needs fewer cards. */
    for (sp = 2; sp <= 4; sp++) tips.push([br.path[sp][0], br.path[sp][1], br.path[sp][2], 1]);
    var th2 = th + R.range(-1.1, 1.1), r2 = reach * R.range(0.35, 0.55);
    var fx = ex + Math.cos(th2) * r2, fz = ez + Math.sin(th2) * r2, fy = y0 + rise + R.range(0.04, 0.14);
    var br2 = limbPath([ex * 0.85 + ax * 0.15, y0 + rise * 0.8, ez * 0.85 + az * 0.15], [fx, fy, fz],
                       [(ex + fx) * 0.5, y0 + rise * 0.9, (ez + fz) * 0.5], baseR * 0.34, 4);
    pushTube(B, br2.path, br2.radii, 6);
    tips.push([fx, fy, fz]);
    for (sp = 2; sp <= 3; sp++) tips.push([br2.path[sp][0], br2.path[sp][1], br2.path[sp][2], 1]);
  }
  var geo = finishGeo(B);
  geo.userData.tips = tips;
  geo.userData.shape = shape;
  return geo;
}

function buildNearTrees(scene, P, R, U, H, kind, items, spec) {
  if (!items.length) return;
  /* a stream of its own, so how these are grown moves nothing else */
  var NR = RNG(P.base + '/build/near/' + kind + (P.nonce ? '/' + P.nonce : ''));
  var bark = kind === 'pine' ? '#4a3a2c' : (kind === 'olive' ? '#6b6152' : (kind === 'palm' ? '#6f5b3f' : '#5a4636'));
  /* pines are deeply fissured, olives finely so, a broadleaf in between */
  var barkN = kind === 'pine' ? NR.range(11, 15) : (kind === 'olive' ? NR.range(22, 30) : NR.range(15, 22));
  var mat = solidMat(U, bark, { rib: 0, grain: 1, barkN: barkN, barkPlate: kind === 'pine' ? 3.5 : 6.0, aoH: 0.6 });
  /* One trunk served every tree in the world, so a wood was the same tree
     stamped out and turned: the same lean, the same curve, the same ratio.
     Grow a few and deal them out. */
  var forms = Math.min(items.length, kind === 'pine' ? 3 : 4), f;
  var tpls = [];
  for (f = 0; f < forms; f++) tpls.push(trunkTemplate(NR, kind));
  var solids = [], rots = [], form = [];
  for (var i = 0; i < items.length; i++) {
    var rot0 = NR.range(0, 6.283);
    rots.push(rot0);
    form.push(i % forms);
    solids.push([items[i][0], H(items[i][0], items[i][1]) - 0.05, items[i][1], items[i][2], rot0, 1, 1]);
    /* the solid tree casts its own shadow (the billboard of the same tree
       in the hand-over band does not) */
    App._shadows.push([items[i][0], H(items[i][0], items[i][1]), items[i][1], items[i][2] * 0.34, 1.0, items[i][2] * 0.85]);
  }
  for (f = 0; f < forms; f++) {
    var part = [];
    for (i = 0; i < items.length; i++) if (form[i] === f) part.push(solids[i]);
    if (part.length) instanceSolid(scene, tpls[f], part, mat);
  }
  /* The crown: a volume of leaf sprays, each card a hand's span of twigs
     rather than a third of the tree. Every card knows the middle of its
     crown and how big it is, and is lit in the shader as part of that
     volume: rounding away from the sun, darker deep inside and underneath,
     glowing at the edge when the sun is behind it. */
  var cards = [];
  for (var k = 0; k < items.length; k++) {
    var sz = items[k][2], rot = rots[k], cr = Math.cos(rot), sr = Math.sin(rot);
    var tips = tpls[form[k]].userData.tips || [];
    var treePh = items[k][0] * 0.3 + items[k][1] * 0.2;
    var wide = kind === 'acacia' ? 1.7 : 1;
    var mine = [];
    if (kind === 'pine') {
      /* tiers of sprays hugging the trunk, wider at the bottom */
      var n = 32;
      for (var c = 0; c < n; c++) {
        var tt = c / (n - 1), th = NR.range(0, 6.283), rad = sz * 0.17 * (1.1 - tt) * NR.range(0.45, 1.0);
        var ox = Math.cos(th) * rad, oz = Math.sin(th) * rad, oy = sz * (0.22 + tt * 0.62);
        var cs = sz * 0.20 * (1.05 - tt * 0.35);
        mine.push([items[k][0] + ox, items[k][1] + oz, cs, oy - cs * 0.5, NR.range(0, 6.283), treePh + NR.range(-1.4, 1.4)]);
      }
    } else {
      /* sprays on every branch tip and along the limbs, so nothing hangs in air */
      for (var ti = 0; ti < tips.length; ti++) {
        var tp = tips[ti];
        var lx = tp[0] * sz, ly = tp[1] * sz, lz = tp[2] * sz;
        var wx = (lx * cr - lz * sr) * wide, wz = (lx * sr + lz * cr) * wide;   /* the tree's own rotation */
        var reps = ti === 0 ? 6 : (tp[3] ? 2 : (NR.f() < 0.5 ? 3 : 5));
        for (var q2 = 0; q2 < reps; q2++) {
          var cs2 = sz * NR.range(0.16, 0.24) * (kind === 'acacia' ? 0.85 : 1);
          var jx = NR.range(-0.5, 0.5) * cs2, jy = NR.range(-0.3, 0.5) * cs2 * 0.7, jz = NR.range(-0.5, 0.5) * cs2;
          mine.push([items[k][0] + wx + jx, items[k][1] + wz + jz, cs2, ly + jy - cs2 * 0.5, NR.range(0, 6.283), treePh + NR.range(-1.4, 1.4)]);
        }
      }
    }
    /* the crown's middle and reach, from the cards themselves */
    var gx = 0, gy = 0, gz = 0, m2;
    for (m2 = 0; m2 < mine.length; m2++) { gx += mine[m2][0]; gy += mine[m2][3] + mine[m2][2] * 0.5; gz += mine[m2][1]; }
    gx /= mine.length; gy /= mine.length; gz /= mine.length;
    var reach = 0.1, reachY = 0.1;
    for (m2 = 0; m2 < mine.length; m2++) {
      reach = Math.max(reach, Math.hypot(mine[m2][0] - gx, mine[m2][1] - gz) + mine[m2][2] * 0.35);
      reachY = Math.max(reachY, Math.abs(mine[m2][3] + mine[m2][2] * 0.5 - gy) + mine[m2][2] * 0.35);
    }
    var base = H(items[k][0], items[k][1]);
    for (m2 = 0; m2 < mine.length; m2++) cards.push(mine[m2].concat([gx, base + gy, gz, reach, reachY, base]));
  }
  var quad = new THREE.PlaneGeometry(1, 1); quad.translate(0, 0.5, 0);
  var geo = new THREE.InstancedBufferGeometry();
  geo.index = quad.index; geo.setAttribute('position', quad.attributes.position); geo.setAttribute('uv', quad.attributes.uv);
  var iPos = new Float32Array(cards.length * 3), iAttr = new Float32Array(cards.length * 3);
  var iCrown = new Float32Array(cards.length * 4), iRy = new Float32Array(cards.length);
  for (var q = 0; q < cards.length; q++) {
    var cd = cards[q];
    /* hung from the trunk's foot, not the ground under each card: on a
       slope that sheared the crown off its limbs and its own middle */
    iPos[q * 3] = cd[0]; iPos[q * 3 + 1] = cd[11] + cd[3]; iPos[q * 3 + 2] = cd[1];
    iAttr[q * 3] = cd[2]; iAttr[q * 3 + 1] = cd[4]; iAttr[q * 3 + 2] = cd[5];
    iCrown[q * 4] = cd[6]; iCrown[q * 4 + 1] = cd[7]; iCrown[q * 4 + 2] = cd[8]; iCrown[q * 4 + 3] = cd[9];
    iRy[q] = cd[10];
  }
  geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(iPos, 3));
  geo.setAttribute('iAttr', new THREE.InstancedBufferAttribute(iAttr, 3));
  geo.setAttribute('iCrown', new THREE.InstancedBufferAttribute(iCrown, 4));
  geo.setAttribute('iRy', new THREE.InstancedBufferAttribute(iRy, 1));
  geo.instanceCount = cards.length;
  var cmat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: U.uTime, uWind: U.uWind, uGust: U.uGust, uWindDir: U.uWindDir,
      uSunDir: U.uSunDir, uSunCol: U.uSunCol, uAmbCol: U.uAmbCol, uFogCol: U.uFogCol,
      uFogDensity: U.uFogDensity, uHazeK: U.uHazeK, uShadow: U.uShadow, uShadowMap: U.uShadowMap, uShadowOrigin: U.uShadowOrigin, uShadowScale: U.uShadowScale,
      uSnow: U.uSnow, uCamPos: U.uCamPos,
      uMap: { value: makeSprayTexture(kind, P, NR) }
    },
    alphaToCoverage: true, alphaTest: 0.4, side: THREE.DoubleSide,
    vertexShader: [
      'attribute vec3 iPos; attribute vec3 iAttr; attribute vec4 iCrown; attribute float iRy;',
      'uniform float uTime, uWind, uGust, uFogDensity, uShadow, uSnow;',
      'uniform vec2 uWindDir; uniform vec3 uCamPos, uSunDir, uSunCol, uAmbCol, uFogCol;',
      'varying vec2 vUv; varying float vFog; varying vec3 vHaze;',
      'varying vec3 vWp; varying vec4 vCrown; varying float vRy, vSh; varying vec3 vAmb;',
      GLSL_COMMON,
      'void main(){',
      '  float size = iAttr.x, spin = iAttr.y, ph = iAttr.z;',
      '  vec3 toCam = normalize(uCamPos - iPos);',
      '  vec3 right = normalize(cross(vec3(0.0,1.0,0.0), toCam));',
      '  vec3 up = normalize(cross(toCam, right));',
      '  float c = cos(spin), s = sin(spin);',
      '  vec2 q = vec2(position.x * c - (position.y - 0.5) * s, position.x * s + (position.y - 0.5) * c);',
      '  vec3 lp = right * q.x * size + up * q.y * size;',
      /* a slow common sway from the gust wave, a quicker rustle per spray */
      '  float gustW = gustWave(iPos.xz, uWindDir, uTime, 0.22, 1.55, 0.0);',
      '  float sway = gustW * 0.55 + sin(uTime * 1.9 + ph) * 0.30 + sin(uTime * 0.8 + ph * 1.4) * 0.15;',
      '  lp.xz += uWindDir * sway * uWind * (0.3 + 0.7 * uGust) * size * 0.12;',
      '  vec3 wp = iPos + vec3(0.0, size * 0.5, 0.0) + lp;',
      '  vec2 bk = bakedRG(wp.xz);',
      '  vSh = mix(1.0 - uShadow, 1.0, cloudShade(wp.xz, uTime)) * mix(0.03, 1.0, bk.x);',
      '  vAmb = uAmbCol * mix(1.0, bk.y, 0.5) * (1.0 - uSnow * 0.2);',
      '  vWp = wp; vCrown = iCrown; vRy = iRy;',
      '  vUv = uv;',
      '  vec4 mv = modelViewMatrix * vec4(wp, 1.0);',
      '  vFog = fogAmtH(-mv.z, uFogDensity, wp.y);',
      '  vHaze = hazeAt(uFogCol, normalize(wp - cameraPosition), uSunDir, uSunCol, vFog);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      GLSL_TONE,
      'uniform sampler2D uMap; uniform vec3 uSunDir, uSunCol, uCamPos;',
      'varying vec2 vUv; varying float vFog; varying vec3 vHaze;',
      'varying vec3 vWp; varying vec4 vCrown; varying float vRy, vSh; varying vec3 vAmb;',
      GLSL_COMMON,
      'void main(){',
      '  vec4 t = texture2D(uMap, vUv);',
      '  if (t.a < 0.25) discard;',
      /* where this pixel sits in its crown, as a fraction of the crown */
      '  vec3 e = (vWp - vCrown.xyz) / vec3(vCrown.w, vRy, vCrown.w);',
      '  float r = length(e);',
      '  vec3 N = e / max(r, 1e-3);',
      '  vec3 L = normalize(uSunDir), V = normalize(uCamPos - vWp);',
      '  float wrap = max((dot(N, L) + 0.5) / 1.5, 0.0);',
      /* deep inside, the leaves see neither sun nor sky; at the rim, light
         comes through them from behind */
      '  float inner = smoothstep(0.1, 0.9, r);',
      '  float under = mix(0.68, 1.0, smoothstep(-0.9, 0.3, N.y));',
      '  float trans = pow(max(dot(-V, L), 0.0), 2.0) * smoothstep(0.55, 1.05, r) * 0.7;',
      '  vec3 light = hemi(N, vAmb * 1.1) * mix(0.62, 1.0, inner) * under + uSunCol * (wrap * 1.1 * mix(0.5, 1.0, inner) * under + trans) * vSh;',
      '  gl_FragColor = vec4(mix(t.rgb * light, vHaze, vFog), smoothstep(0.3, 0.7, t.a));',
      '  gl_FragColor.rgb = tone(gl_FragColor.rgb);',
      '}'
    ].join('\n')
  });
  var m = new THREE.Mesh(geo, cmat);
  m.frustumCulled = false;
  m.userData.noTrim = true;              /* the trunks are solids and keep all their crowns */
  scene.add(m);
  App.propMeshes.push(m);
}



