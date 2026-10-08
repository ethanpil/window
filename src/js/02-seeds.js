/* ============================================================
   2. seeds
   ============================================================ */
/* A seed is 32 bits written as hex. Up to eight hex characters are accepted
   and padded on the left; anything else is not a seed. */
function seedHex(str) {
  str = String(str == null ? '' : str).replace(/\s+/g, '');
  if (!/^[0-9a-f]{1,8}$/i.test(str)) return null;
  return ('00000000' + str.toLowerCase()).slice(-8);
}
function randomSeed() {
  var v;
  try { var a = new Uint32Array(1); window.crypto.getRandomValues(a); v = a[0]; }
  catch (e) { v = (Math.random() * 4294967296) >>> 0; }
  return ('00000000' + v.toString(16)).slice(-8);
}

