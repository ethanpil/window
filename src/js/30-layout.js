/* ============================================================
   8. layout / framing
   ============================================================ */
var resizeTimer = null;
function layout() {
  if (!App.P || !App.camera || !App.renderer) return;
  var w = window.innerWidth, h = window.innerHeight;
  var P = App.P, cam = App.camera, r = App.renderer;
  /* A view that has not been laid out yet reports no size at all, and 0/0 is
     NaN. That ran on through the window sizing into the wall texture, where a
     non-finite gradient throws, and the throw left the view black for good.
     Carry on with a plain square until a real size arrives. */
  cam.aspect = (w > 0 && h > 0) ? w / h : 1;
  var changed = sizeWindow(P, cam.aspect);
  App.camDist = P.win.dist;

  cam.position.set(0, P.win.cy, App.camDist);
  cam.lookAt(0, P.win.cy - PITCH * (20 + App.camDist), -20);
  cam.updateProjectionMatrix();
  r.setPixelRatio(qualityRatio());
  r.setSize(Math.max(1, w), Math.max(1, h), false);
  setupPost();
  FX.resize();

  /* the opening changes shape with the screen, so the joinery is rebuilt --
     debounced, since this regenerates geometry and textures */
  if (changed && App.room) {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(rebuildRoom, 220);
  }
}
function rebuildRoom() {
  if (!App.room || !App.P || switching) return;
  App.scene.remove(App.room);
  disposeDeep(App.room);
  App.room = null;
  buildRoom(App.scene, App.P, App.U);
  updateWeather(App.t);
}
function qualityRatio() {
  var dpr = window.devicePixelRatio || 1;
  var step = [1, 0.86, 0.72, 0.60][Math.min(App.quality, 3)];
  return Math.max(0.55, Math.min(dpr, Q().pixel) * step);
}

