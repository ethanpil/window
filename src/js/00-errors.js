/* Anything that goes wrong is written to the screen, so it can be read and
   reported. Shader failures come through console.error, so that is hooked too. */
var ERRLOG = [];
function showError(msg) {
  msg = String(msg || '').slice(0, 600);
  if (ERRLOG.indexOf(msg) >= 0) return;
  ERRLOG.push(msg);
  var el = document.getElementById('err');
  if (!el) return;
  el.textContent = ERRLOG.slice(-4).join('\n\n') + '\n\n(click to dismiss)';
  el.hidden = false;
}
window.addEventListener('error', function (e) {
  showError((e.message || 'error') + (e.filename ? '' : '') + (e.lineno ? '  @' + e.lineno + ':' + (e.colno || 0) : ''));
});
window.addEventListener('unhandledrejection', function (e) {
  showError('unhandled: ' + (e.reason && e.reason.message ? e.reason.message : e.reason));
});
(function () {
  var orig = console.error;
  console.error = function () {
    try { showError(Array.prototype.map.call(arguments, function (a) { return typeof a === 'string' ? a : (a && a.message) || String(a); }).join(' ')); } catch (x) {}
    return orig.apply(console, arguments);
  };
})();
document.addEventListener('DOMContentLoaded', function () {
  var el = document.getElementById('err');
  if (el) el.addEventListener('click', function () { el.hidden = true; });
});

