/* ============================================================
   12. loop
   ============================================================ */
function loop() {
  requestAnimationFrame(loop);
  if (document.hidden) return;
  var dt = Math.min(App.clock.getDelta(), 0.05);
  var t = App.t + dt;
  App.t = t;
  var U = App.U, P = App.P;

  /* wind: three incommensurate waves so gusts never repeat */
  var g = 0.42
    + 0.30 * Math.sin(t / P.gustPeriod)
    + 0.18 * Math.sin(t / (P.gustPeriod * 2.71) + 1.1)
    + 0.14 * Math.sin(t / (P.gustPeriod * 0.41) + 2.3);
  var lull = Math.pow(0.5 + 0.5 * Math.sin(t * 0.0093 - 0.4), 2);
  U.uGust.value = clamp(g * (0.55 + 0.75 * lull), 0.05, 1.35);
  U.uWind.value = P.windBase * (0.8 + 0.35 * lull);

  /* the wind slowly changes its mind about direction */
  var ang = P.windAngle + Math.sin(t * 0.0071) * 0.55 + t * P.windTurn * 0.02;
  U.uWindDir.value.set(Math.cos(ang), Math.sin(ang));

  U.uTime.value = t;
  U.uCamPos.value.copy(App.camera.position);

  /* lightning: rare, brief, and followed by its thunder after a distance */
  if (P.weather.lightning) {
    App.nextFlash = App.nextFlash == null ? t + 6 + Math.random() * 14 : App.nextFlash;
    if (t >= App.nextFlash) {
      App.flash = 0.7 + Math.random() * 0.5;
      App.flashAgain = t + 0.08 + Math.random() * 0.12;      /* the second strike */
      App.nextFlash = t + 18 + Math.random() * 45;
      var far = 1.0 + Math.random() * 4.5;                    /* seconds -> roughly km */
      Sound.thunderIn(far, 1.0 - far / 6.5);
    }
    if (App.flashAgain && t >= App.flashAgain) { App.flash = Math.max(App.flash || 0, 0.9); App.flashAgain = null; }
    App.flash = (App.flash || 0) * Math.exp(-dt * 11);
  } else App.flash = 0;

  /* clouds drift by integrating velocity, wrapped into the texture's tile */
  var S = App.skyU;
  var cs = 0.0018 + P.windBase * 0.0030;
  var o1 = S.uOff1.value, o2 = S.uOff2.value;
  o1.x = (o1.x + Math.cos(ang) * cs * dt) % 1;
  o1.y = (o1.y + Math.sin(ang) * cs * dt) % 1;
  o2.x = (o2.x + Math.cos(ang + 0.32) * cs * 2.1 * dt) % 1;
  o2.y = (o2.y + Math.sin(ang + 0.32) * cs * 2.1 * dt) % 1;

  updateWeather(t);
  if (!switching && App.bakedSun && App.H && App.bakedSun.angleTo(U.uSunDir.value) > 0.13) {
    applyShadowMap(bakeShadows(P, App.H, U.uSunDir.value));
  }

  /* a breath of camera movement, plus a whisper of parallax */
  var p = App.pointer;
  p.x += (p.tx - p.x) * Math.min(1, dt * 1.6);
  p.y += (p.ty - p.y) * Math.min(1, dt * 1.6);
  var cam = App.camera;
  var breathe = App.reduceMotion ? 0 : 0.85;
  cam.position.x = p.x * 0.11 + Math.sin(t * 0.079) * 0.007 * breathe;
  cam.position.y = P.win.cy + p.y * -0.05 + Math.sin(t * 0.061 + 1.2) * 0.005 * breathe;
  cam.position.z = App.camDist + Math.sin(t * 0.043) * 0.006 * breathe;
  cam.lookAt(p.x * 0.5, P.win.cy - PITCH * (20 + App.camDist) + p.y * -0.35, -20);
  App.sky.position.copy(cam.position);

  /* the sash swings, and the world gets louder through the gap */
  var wantOpen = App.sashOpen ? 1 : 0;
  App.sashAngle = App.sashAngle == null ? 0 : App.sashAngle;
  App.sashAngle += (wantOpen - App.sashAngle) * Math.min(1, dt * 1.7);
  if (App.sash) App.sash.rotation.y = -App.sashAngle * Math.min(0.62, Math.asin(Math.min(0.9, (App.camDist - 0.55) / Math.max(P.win.w, 0.5))));
  if (App.frostMat) App.frostMat.opacity += (App.frostTarget - App.frostMat.opacity) * Math.min(1, dt * 0.05);
  if (App.glassMat) App.glassMat.opacity *= (1 - App.sashAngle * 0.75);

  Sound.update(U.uGust.value, App.sashAngle);
  FX.update(dt, t);
  renderFrame();

  /* the Ingredients-Seed on the bar follows the scene's clock */
  if (App.refreshCode && (App.codeTick == null || t - App.codeTick >= 1)) { App.codeTick = t; App.refreshCode(); }
  if (App.urlOk && !switching && (App.urlTick == null || t - App.urlTick >= 15)) {
    App.urlTick = t;
    try { history.replaceState({}, '', '?code=' + encodeScene()); } catch (e) {}
  }

  /* change the view on a timer, if asked */
  App.elapsed += dt;
  if (App.autoMin > 0) {
    if (!switching && App.elapsed > App.autoMin * 60) go(randomSeed());
    var left = Math.max(0, Math.ceil(App.autoMin * 60 - App.elapsed));
    var txt = 'auto: ' + Math.floor(left / 60) + ':' + (left % 60 < 10 ? '0' : '') + (left % 60);
    if (txt !== App.autoTxt) {
      App.autoTxt = txt;
      setLabel('bAuto', txt);
    }
  }

  /* keep it smooth: shed pixels, then blades, if the machine is struggling */
  App.frameAvg = App.frameAvg * 0.94 + (dt * 1000) * 0.06;
  if (t - App.lastChange > 2.4) {
    if (App.frameAvg > 26 && App.quality < 3) { App.quality++; applyQuality(); App.lastChange = t; }
    else if (App.frameAvg < 13.5 && App.quality > 0) { App.quality--; applyQuality(); App.lastChange = t; }
  }
  /* in auto, settle on a detail tier once we have seen real frames */
  if (App.qAuto && !switching && App.qChanges < 8) {
    App.qSettle += dt;
    if (App.qSettle > 5) {
      App.qSettle = 0;
      var want = App.qTier;
      if (App.frameAvg > 30 && App.qTier > 0) want = App.qTier - 1;
      else if (App.frameAvg < 11 && App.quality === 0 && App.qTier < QUALITY.length - 1) want = App.qTier + 1;
      if (want !== App.qTier) {
        App.qTier = want;
        App.qChanges++;
        setTier(App.qTier, true);
      }
    }
  }
}

function setTier(tier, keepAuto) {
  if (switching) return;
  var seed = App.P.seed;
  App.qTier = tier;
  if (!keepAuto) { App.qAuto = false; App.qChanges = 99; }
  App.quality = 0;
  App.frameAvg = 16;
  updateHUD(App.P);
  transition(function () { buildWorld(seed); }, 320);
}

function applyQuality() {
  App.renderer.setPixelRatio(qualityRatio());
  App.renderer.setSize(window.innerWidth, window.innerHeight, false);
  setupPost();
  var mul = [1, 1, 0.72, 0.5][App.quality];
  var soft = lerp(1, 0.6, App.quality / 3);
  var trim = function (mesh, factor) {
    if (!mesh || mesh.userData.noTrim || !mesh.geometry.attributes.iPos) return;
    if (mesh.userData.full == null) mesh.userData.full = mesh.geometry.instanceCount;
    mesh.geometry.instanceCount = Math.max(1, Math.floor(mesh.userData.full * factor));
  };
  if (App.grass) App.grass.geometry.instanceCount = Math.floor(App.grassMax * mul);
  trim(App.rain, soft); trim(App.snow, soft); trim(App.leaves, soft);
  trim(App.dust, soft); trim(App.falls, soft); trim(App.birdMesh, soft);
  var lists = (App.propMeshes || []).concat(App.flowerMeshes || []);
  for (var li = 0; li < lists.length; li++) trim(lists[li], mul);
}

