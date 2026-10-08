/* ============================================================
   6. shared GLSL
   ============================================================ */
/* The shaders live in src/shaders/ and build.js inlines them as the GLSL
   table. A material reads the table by file name when the source is fixed, or
   goes through shader(name, { KEY: value }) when the file holds {{KEY}} tokens
   for numbers the script owns. A token with no value, or a value with no token, is a
   mistake and throws. Shared pieces are pulled in with #include "x.glsl". A line
   starting /// in a shader file is a note for the reader: build.js drops it. */
function shader(name, vars) {
  var src = GLSL[name], used = {};
  vars = vars || {};
  src = src.replace(/\{\{(\w+)\}\}/g, function (all, key) {
    if (!Object.prototype.hasOwnProperty.call(vars, key)) throw new Error('shader ' + name + ' wants ' + key);
    used[key] = true;
    return String(vars[key]);
  });
  Object.keys(vars).forEach(function (key) { if (!used[key]) throw new Error('shader ' + name + ' has no ' + key); });
  return src;
}
/* src/shaders/tone.glsl */

/* src/shaders/horizon.glsl */

/* src/shaders/common.glsl */

/* ---------- preferences ----------
   localStorage first, a cookie second, memory last. A sandboxed frame has an
   opaque origin and will throw on both, so nothing here may be assumed. */
var Prefs = {
  key: 'window-prefs-v1', mem: null,
  read: function () {
    if (this.mem) return this.mem;
    var out = null;
    try { var raw = window.localStorage.getItem(this.key); if (raw) out = JSON.parse(raw); } catch (e) {}
    if (!out) {
      try {
        var m = document.cookie.match(/(?:^|;\s*)windowprefs=([^;]*)/);
        if (m) out = JSON.parse(decodeURIComponent(m[1]));
      } catch (e2) {}
    }
    this.mem = out || {};
    return this.mem;
  },
  write: function () {
    var json = JSON.stringify(this.mem || {});
    try { window.localStorage.setItem(this.key, json); return 'local'; } catch (e) {}
    try {
      document.cookie = 'windowprefs=' + encodeURIComponent(json) + ';path=/;max-age=31536000;SameSite=Lax';
      if (document.cookie.indexOf('windowprefs=') >= 0) return 'cookie';
    } catch (e2) {}
    return 'memory';
  },
  set: function (k, v) { this.read(); this.mem[k] = v; return this.write(); },
  get: function (k, dflt) { var o = this.read(); return o[k] === undefined ? dflt : o[k]; }
};

