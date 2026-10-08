/* ============================================================
   10. rain on the glass, frost, dust  (2D overlay)
   ============================================================ */
var FROSTCACHE = {};
function makeFrostCanvas(P) {
  /* crystal creeping in from the edges: dense in the corners, thinning fast,
     nothing at all across the middle of the pane */
  if (FROSTCACHE[P.base]) return FROSTCACHE[P.base];
  var fkeys = Object.keys(FROSTCACHE);
  if (fkeys.length > 8) delete FROSTCACHE[fkeys[0]];
  var R = RNG(P.base + '/frost');
  var S = 256, c = cnv(S, S), g = c.getContext('2d');
  var f1 = tileFBM(S, R.int(1, 99999), 5, 4), f2 = tileFBM(S, R.int(1, 99999), 4, 14);
  var img = g.createImageData(S, S);
  for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
    var i = y * S + x, u = x / (S - 1), v = y / (S - 1);
    var ex = Math.min(u, 1 - u) * 2, ey = Math.min(v, 1 - v) * 2;
    var edge = clamp(1 - Math.min(1, Math.pow(ex, 0.55) * 0.9 + Math.pow(ey, 0.55) * 0.9), 0, 1);
    edge = Math.pow(edge, 1.6);
    var n = f1[i] * 0.68 + f2[i] * 0.32;
    var a = smoothstep(0.42, 0.78, n * 0.5 + edge * 0.85) * edge;
    var lum = 236 + Math.round(f2[i] * 16);
    img.data[i * 4] = lum; img.data[i * 4 + 1] = lum + 3; img.data[i * 4 + 2] = 255;
    img.data[i * 4 + 3] = Math.round(clamp(a, 0, 1) * 220);
  }
  g.putImageData(img, 0, 0);
  var out = cnv(S, S), og = out.getContext('2d');
  if (typeof og.filter !== 'undefined') og.filter = 'blur(1.4px)';
  og.drawImage(c, 0, 0);
  og.filter = 'none';
  FROSTCACHE[P.base] = out;
  return out;
}
var FX = {
  init: function (P, R) {
    this.P = P;
    this.canvas = document.getElementById('fx');
    this.ctx = this.canvas.getContext('2d');
    this.R = RNG(P.base + '/fx');
    this.motes = [];   /* kept for the reduced-motion check; the specks are 3D now */
    this.frost = 0;
    var rain = P.weather.rain, snow = P.weather.snow;
    this.rain = rain; this.snowy = snow;
    this.frostTarget = 0;
    this.frostCanvas = null;
    if (rain === 0 && snow === 0 && P.weather.lightMul > 0.8) {
      for (var m = 0; m < 26; m++) {
      }
    }
  },
  resize: function () {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.canvas.width = Math.round(window.innerWidth * dpr);
    this.canvas.height = Math.round(window.innerHeight * dpr);
    this.dpr = dpr;
  },
  paneRect: function () {
    var P = this.P, cam = App.camera;
    var w = P.win.w / 2 - P.win.frame, hh = P.win.h / 2 - P.win.frame;
    var z = -P.win.wallDepth * P.win.setback;
    if (!this._pts) this._pts = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    var pts = this._pts;
    pts[0].set(-w, P.win.cy - hh, z); pts[1].set(w, P.win.cy - hh, z);
    pts[2].set(w, P.win.cy + hh, z); pts[3].set(-w, P.win.cy + hh, z);
    var minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (var i = 0; i < 4; i++) {
      var p = pts[i].project(cam);
      var sx = (p.x * 0.5 + 0.5) * this.canvas.width;
      var sy = (-p.y * 0.5 + 0.5) * this.canvas.height;
      minx = Math.min(minx, sx); maxx = Math.max(maxx, sx);
      miny = Math.min(miny, sy); maxy = Math.max(maxy, sy);
    }
    return { x: minx, y: miny, w: maxx - minx, h: maxy - miny };
  },
  update: function (dt, t) {
    /* The overlay used to draw the light-motes here, on top of everything, so
       they appeared in front of the frame. They are part of the scene now and
       the mullions occlude them; nothing else needs this canvas. */
    var C = this.canvas;
    this.ctx.clearRect(0, 0, C.width, C.height);
  }
};

