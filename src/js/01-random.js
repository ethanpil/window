/* ============================================================
   1. seeded randomness
   ============================================================ */
function xmur3(str) {
  var h = 1779033703 ^ str.length;
  for (var i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function RNG(seedStr) {
  var seedFn = xmur3(String(seedStr));
  var r = mulberry32(seedFn());
  var api = {
    f: r,
    range: function (a, b) { return a + r() * (b - a); },
    int: function (a, b) { return Math.floor(a + r() * (b - a + 1)); },
    pick: function (arr) { return arr[Math.floor(r() * arr.length)]; },
    chance: function (p) { return r() < p; },
    sign: function () { return r() < 0.5 ? -1 : 1; },
    gauss: function () {
      var u = 0, v = 0;
      while (u === 0) u = r();
      while (v === 0) v = r();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307 * v);
    },
    weighted: function (pairs) {
      var total = 0, i;
      for (i = 0; i < pairs.length; i++) total += pairs[i][1];
      var x = r() * total;
      for (i = 0; i < pairs.length; i++) { x -= pairs[i][1]; if (x <= 0) return pairs[i][0]; }
      return pairs[pairs.length - 1][0];
    },
    sub: function (tag) { return RNG(seedStr + '/' + tag); }
  };
  return api;
}

/* integer hash → value noise, used for terrain + textures */
function ihash(x, y, s) {
  var h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(s | 0, 362437);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  var x0 = Math.floor(x), y0 = Math.floor(y);
  var fx = x - x0, fy = y - y0;
  var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  var a = ihash(x0, y0, s), b = ihash(x0 + 1, y0, s);
  var c = ihash(x0, y0 + 1, s), d = ihash(x0 + 1, y0 + 1, s);
  return (a + (b - a) * sx) + ((c + (d - c) * sx) - (a + (b - a) * sx)) * sy;
}
function fbm2(x, y, s, oct) {
  var v = 0, amp = 0.5, f = 1, norm = 0;
  for (var i = 0; i < oct; i++) {
    v += vnoise(x * f, y * f, s + i * 131) * amp;
    norm += amp; amp *= 0.5; f *= 2.02;
  }
  return (v / norm) * 2 - 1;
}
/* tileable fbm on a square grid, for repeating canvas textures */
function tnoise(x, y, period, s) {
  var x0 = Math.floor(x), y0 = Math.floor(y);
  var fx = x - x0, fy = y - y0;
  var sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  var xa = ((x0 % period) + period) % period, ya = ((y0 % period) + period) % period;
  var xb = (xa + 1) % period, yb = (ya + 1) % period;
  var a = ihash(xa, ya, s), b = ihash(xb, ya, s);
  var c = ihash(xa, yb, s), d = ihash(xb, yb, s);
  var t = a + (b - a) * sx;
  return t + ((c + (d - c) * sx) - t) * sy;
}
function tileFBM(size, seed, octaves, basePeriod) {
  var out = new Float32Array(size * size);
  var amp = 1, norm = 0, o, y, x, p, f;
  for (o = 0; o < octaves; o++) {
    p = basePeriod * Math.pow(2, o);
    f = p / size;
    for (y = 0; y < size; y++) {
      for (x = 0; x < size; x++) {
        out[y * size + x] += tnoise(x * f, y * f, p, seed + o * 977) * amp;
      }
    }
    norm += amp; amp *= 0.52;
  }
  for (var i = 0; i < out.length; i++) out[i] /= norm;
  return out;
}

var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
var lerp = function (a, b, t) { return a + (b - a) * t; };
function smoothstep(e0, e1, x) { var t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); }

