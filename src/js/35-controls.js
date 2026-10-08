/* ============================================================
   13. controls
   ============================================================ */
var wakeTimer = null, hudHeld = false, setPickOpen = function () {};
function wake(hold) {
  var hud = document.getElementById('hud');
  hud.classList.add('awake');
  clearTimeout(wakeTimer);
  if (hold || hudHeld || App.pinned) return;
  wakeTimer = setTimeout(function () {
    var focused = hud.contains && document.activeElement && hud.contains(document.activeElement);
    if (hudHeld || focused) return;
    hud.classList.remove('awake');
    /* the panel is part of the bar: it goes when the bar goes */
    var panel = document.getElementById('pick');
    if (panel && !panel.hidden) setPickOpen(false, true);
  }, 2800);
}
/* Put the bar away now rather than waiting out its timer. Three things hold
   it open - the pointer resting on it, focus inside it, and the pin - so all
   three have to be let go of, or it would come straight back. */
function hideHud() {
  var hud = document.getElementById('hud');
  clearTimeout(wakeTimer);
  hudHeld = false;
  if (App.pinned) {
    App.pinned = false;
    Prefs.set('pinned', false);
    var pin = document.getElementById('bPin');
    pin.classList.remove('pinned');
    pin.setAttribute('aria-pressed', 'false');
    pin.title = 'Keep this bar on screen';
  }
  if (document.activeElement && hud.contains(document.activeElement)) document.activeElement.blur();
  var panel = document.getElementById('pick');
  if (panel && !panel.hidden) setPickOpen(false, true);
  hud.classList.remove('awake');
}

var switching = false;
/* every world swap goes through here, so two can never overlap and strand the
   curtain or the flag */
function transition(build, delay) {
  if (switching) return false;
  switching = true;
  var curtain = document.getElementById('curtain');
  curtain.classList.remove('gone');
  setTimeout(function () {
    try { build(); renderFrame(); }
    catch (e) { switching = false; curtain.classList.add('gone'); throw e; }
    requestAnimationFrame(function () { curtain.classList.add('gone'); switching = false; });
  }, delay || 440);
  return true;
}
function go(seed) {
  if (!parseSeed(seed).valid) return false;
  return transition(function () { buildWorld(seed); });
}

function applyView() {
  var v = App.locks.view;
  App.sashOpen = v === 'open';
  App.bare = v === 'bare';
  if (App.room) App.room.visible = !App.bare;
}

function setLabel(id, text) {
  var el = document.getElementById(id);
  if (!el) return;
  var sp = el.querySelector ? el.querySelector('span') : null;
  if (sp) sp.textContent = text; else el.textContent = text;
}

function syncPicks() {
  var map = { selBiome: 'biome', selWeather: 'weather', selTime: 'time', selWindow: 'window',
              selFinish: 'finish', selSeason: 'season' };
  for (var id in map) {
    var el = document.getElementById(id);
    if (el) el.value = App.locks[map[id]] || '';
  }
  var nEl = document.getElementById('selNight');
  if (nEl) nEl.value = App.locks.night || '';
  var vEl = document.getElementById('selView');
  if (vEl) vEl.value = App.locks.view || '';
}

function updateHUD(P) {
  var windWord = P.windBase > 0.9 ? 'a hard' : (P.windBase > 0.55 ? 'a steady' : 'a light');
  var hour = App.liveClock ? (App.liveLabel ? TIMES[App.liveLabel].label + ' (your time)' : 'your local time')
    : TIMES[P.timeA].label;
  var EXTRA = '';
  if (P.biomeKey === 'bridge') EXTRA = ' &middot; a ' + { suspension: 'suspension bridge', arch: 'steel arch', girder: 'girder bridge', stone: 'stone viaduct' }[P.bridgeKind];
  if (P.biomeKey === 'penthouse') EXTRA = ' &middot; ' + Math.round(P.storey / 3.2) + ' floors up';
  if (P.biomeKey === 'cascade') EXTRA = ' &middot; ' + (P.fallDrops > 1 ? P.fallDrops + '-step cascade' : Math.round(P.fallH) + 'm drop');
  if (P.biomeKey === 'canyon') EXTRA = ' &middot; ' + Math.round(P.canyonDepth) + 'm deep' + (P.hasCanyonRiver ? ', river below' : '');
  if (P.biomeKey === 'oasis' && P.hasCamp) EXTRA = ' &middot; a camp by the water';
  var LMNAME = { lighthouse: 'a lighthouse', windmill: 'a windmill', tower: 'an old tower', barn: 'a barn',
    house: 'an empty house', smokestack: 'a chimney stack',
    silo: 'a grain silo', cabin: 'a cabin', pagoda: 'a pagoda', watertank: 'a water tank', jetty: 'a jetty' };
  document.getElementById('note').innerHTML = P.biome.label + ' in ' + P.season.label + ' &middot; ' + P.weather.label +
    ' &middot; ' + hour + ' &middot; ' + windWord + ' ' + P.windName +
    EXTRA + (P.landmarkName && LMNAME[P.landmarkName] ? ' &middot; ' + LMNAME[P.landmarkName] + ' in the distance' : '');
  if (App.refreshCode) App.refreshCode();
  setLabel('bSound', Sound.on ? 'sound: on' : 'sound: off');
  setLabel('bPanes', App.clearPanes ? 'panes: off' : 'panes: on');
  setLabel('bMotion', App.mouseMotion ? 'motion: on' : 'motion: off');
  setLabel('bQual', 'detail: ' + (App.qAuto ? 'auto\u00b7' + Q().name : Q().name));
  var pinBtn = document.getElementById('bPin');
  pinBtn.classList.toggle('pinned', !!App.pinned);
  pinBtn.setAttribute('aria-pressed', App.pinned ? 'true' : 'false');
  syncPicks();

  App.autoTxt = null;
  setLabel('bAuto', App.autoMin ? 'auto: ' + App.autoMin + ':00' : 'auto: off');
  wake();
}

function bindUI() {
  var codeval = document.getElementById('codeval');
  var refreshCode = function () { if (App.P) codeval.textContent = encodeScene(); };
  App.refreshCode = refreshCode;

  var copyText = function (text, btn, iconHtml) {
    var done = function () {
      btn.innerHTML = TICK_ICON; btn.classList.add('done');
      setTimeout(function () { btn.innerHTML = iconHtml; btn.classList.remove('done'); }, 1500);
    };
    var fallback = function () {
      var ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); } catch (e) {}
      document.body.removeChild(ta); done();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
  };
  var COPY_ICON = document.getElementById('bCopy').innerHTML;
  document.getElementById('bCopy').addEventListener('click', function () { copyText(encodeScene(), this, COPY_ICON); });

  /* the paste dialog takes a full Ingredients-Seed or a bare seed */
  var paste = document.getElementById('paste'), pasteIn = document.getElementById('pasteIn'), pasteMsg = document.getElementById('pasteMsg');
  var openPaste = function () {
    paste.hidden = false; pasteMsg.textContent = '';
    pasteIn.value = '';
    if (pasteIn.focus) pasteIn.focus();
    if (navigator.clipboard && navigator.clipboard.readText) {
      navigator.clipboard.readText().then(function (t) {
        if (t && (isSceneCode(t) || parseSeed(t).valid)) pasteIn.value = t.trim();
      }, function () {});
    }
  };
  var closePaste = function () { paste.hidden = true; wake(); };
  var submitPaste = function () {
    var v = pasteIn.value.trim();
    var valid = isSceneCode(v) || parseSeed(v).valid;
    if (!valid) { pasteMsg.textContent = 'That is not an Ingredients-Seed or a seed. A seed is up to eight hex characters.'; return; }
    closePaste();
    /* a build may already be under way; if so, try again once it has landed */
    var attempt = function (n) {
      var ok = isSceneCode(v) ? applyScene(v) : go(v);
      if (!ok && n > 0) setTimeout(function () { attempt(n - 1); }, 600);
    };
    attempt(4);
  };
  document.getElementById('bPaste').addEventListener('click', openPaste);
  document.getElementById('pasteGo').addEventListener('click', submitPaste);
  document.getElementById('pasteNo').addEventListener('click', closePaste);
  pasteIn.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') submitPaste();
    if (e.key === 'Escape') closePaste();
  });
  paste.addEventListener('click', function (e) { if (e.target === paste) closePaste(); });

  var newView = function (e) {
    /* plain click keeps your choices; shift-click throws them away too */
    go(seedString(randomSeed(), 0, e && e.shiftKey ? {} : App.locks));
  };
  document.getElementById('bNew').addEventListener('click', newView);
  document.getElementById('bRefresh').addEventListener('click', newView);
  var TICK_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

  document.getElementById('bSound').addEventListener('click', function () {
    var on = Sound.toggle();
    Prefs.set('sound', on);
    setLabel('bSound', on ? 'sound: on' : 'sound: off');
  });
  /* the choose panel: pin any ingredient, leave the rest to the seed */
  var fill = function (id, items, key) {
    var sel = document.getElementById(id);
    var html = '<option value="">any</option>';
    for (var i = 0; i < items.length; i++) {
      html += '<option value="' + items[i][0] + '">' + items[i][1] + '</option>';
    }
    sel.innerHTML = html;
    sel.addEventListener('change', function () {
      App.locks[key] = sel.value || null;
      var cur = parseSeed(App.P.seed);
      go(seedString(cur.base, cur.nonce, App.locks));
    });
    return sel;
  };
  var bl = [], wl = [], tl = [], winl = [], fl = [], sl = [], k;
  for (var si3 = 0; si3 < SEASON_ORDER.length; si3++) sl.push([SEASON_ORDER[si3], SEASONS[SEASON_ORDER[si3]].label]);
  for (k in BIOMES) bl.push([k, BIOMES[k].label]);
  bl.sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
  for (k in WEATHERS) wl.push([k, WEATHERS[k].label]);
  for (var ti = 0; ti < TIME_ORDER.length; ti++) tl.push([TIME_ORDER[ti], TIMES[TIME_ORDER[ti]].label]);
  for (var wi = 0; wi < WINDOW_TYPES.length; wi++) winl.push([WINDOW_TYPES[wi].name, WINDOW_TYPES[wi].name]);
  for (var fi = 0; fi < FINISHES.length; fi++) fl.push([FINISHES[fi].name, FINISHES[fi].name]);
  fill('selBiome', bl, 'biome');
  fill('selWeather', wl, 'weather');
  fill('selTime', tl, 'time');
  fill('selWindow', winl, 'window');
  fill('selFinish', fl, 'finish');
  fill('selSeason', sl, 'season');

  var pickBtn = document.getElementById('bPick');
  setPickOpen = function (open, quiet) {
    var panel = document.getElementById('pick');
    panel.hidden = !open;
    pickBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    pickBtn.title = open ? 'Close the choices' : 'Choose the ingredients yourself';
    if (open) { var f = document.getElementById('selBiome'); if (f && f.focus) f.focus(); }
    else if (!quiet && pickBtn.focus) pickBtn.focus();
    if (!quiet) wake();
  };
  pickBtn.addEventListener('click', function () {
    setPickOpen(document.getElementById('pick').hidden);
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !document.getElementById('pick').hidden) setPickOpen(false);
  });
  document.getElementById('selNight').addEventListener('change', function () {
    App.locks.night = this.value === 'off' ? 'off' : null;
    var c1 = parseSeed(App.P.seed);
    go(seedString(c1.base, c1.nonce, App.locks));
  });
  document.getElementById('selClock').addEventListener('change', function () {
    App.liveClock = this.value === 'live';
    updateHUD(App.P);
  });
  document.getElementById('selView').addEventListener('change', function () {
    App.locks.view = this.value || null;
    applyView();
    var c2 = parseSeed(App.P.seed);
    writeSeedToUrl(seedString(c2.base, c2.nonce, App.locks));
    App.P.seed = seedString(c2.base, c2.nonce, App.locks);
    updateHUD(App.P);
  });

  document.getElementById('bClear').addEventListener('click', function () {
    for (var key in App.locks) App.locks[key] = null;
    syncPicks();
    var cur0 = parseSeed(App.P.seed);
    go(seedString(cur0.base, cur0.nonce, App.locks));
  });

  document.getElementById('bShuffle').addEventListener('click', function () {
    var sp = parseSeed(App.P.seed);
    go(seedString(sp.base, sp.nonce + 1, sp.locks));
  });

  var Q_STEPS = ['auto', 'low', 'medium', 'high', 'ultra'];
  document.getElementById('bQual').addEventListener('click', function () {
    var cur = App.qAuto ? 0 : App.qTier + 1;
    var next = (cur + 1) % Q_STEPS.length;
    if (next === 0) {
      App.qAuto = true; App.qChanges = 0; App.qSettle = 0;
      Prefs.set('qAuto', true);
      updateHUD(App.P);
    } else {
      Prefs.set('qAuto', false);
      Prefs.set('qTier', next - 1);
      setTier(next - 1, false);
    }
  });

  document.getElementById('bMotion').addEventListener('click', function () {
    App.mouseMotion = !App.mouseMotion;
    Prefs.set('motion', App.mouseMotion);
    setLabel('bMotion', App.mouseMotion ? 'motion: on' : 'motion: off');
    if (!App.mouseMotion) { App.pointer.tx = 0; App.pointer.ty = 0; }
  });

  document.getElementById('bPin').addEventListener('click', function () {
    App.pinned = !App.pinned;
    Prefs.set('pinned', App.pinned);
    this.classList.toggle('pinned', App.pinned);
    this.setAttribute('aria-pressed', App.pinned ? 'true' : 'false');
    this.title = App.pinned ? 'Let the bar fade again' : 'Keep this bar on screen';
    wake();
  });

  document.getElementById('bClose').addEventListener('click', hideHud);

  document.getElementById('bTools').addEventListener('click', function () {
    App.showTools = !App.showTools;
    Prefs.set('tools', App.showTools);
    document.getElementById('hud').classList.toggle('notools', !App.showTools);
    this.setAttribute('aria-expanded', App.showTools ? 'true' : 'false');
    wake();
  });

  document.getElementById('bPanes').addEventListener('click', function () {
    App.clearPanes = !App.clearPanes;
    Prefs.set('panes', App.clearPanes);
    setLabel('bPanes', App.clearPanes ? 'panes: off' : 'panes: on');
    sizeWindow(App.P, App.camera.aspect);
    rebuildRoom();
  });

  var AUTO_STEPS = [0, 5, 15, 30];
  document.getElementById('bAuto').addEventListener('click', function () {
    var i = (AUTO_STEPS.indexOf(App.autoMin) + 1) % AUTO_STEPS.length;
    App.autoMin = AUTO_STEPS[i];
    Prefs.set('autoMin', App.autoMin);
    App.elapsed = 0;
    App.autoTxt = null;
    setLabel('bAuto', App.autoMin ? 'auto: ' + App.autoMin + ':00' : 'auto: off');
    this.title = App.autoMin
      ? 'A new view every ' + App.autoMin + ' minutes'
      : 'Change the view on a timer';
  });

  var hud = document.getElementById('hud');
  hud.addEventListener('pointerenter', function () { hudHeld = true; wake(true); });
  hud.addEventListener('pointerleave', function () { hudHeld = false; wake(); });

  window.addEventListener('keydown', function (e) {
    if (e.target.tagName === 'INPUT' || !document.getElementById('paste').hidden) return;
    if (e.key === 'r' || e.key === 'R') go(randomSeed());
    if (e.key === 'c' || e.key === 'C') document.getElementById('bCopy').click();
    wake();
  });
  window.addEventListener('touchstart', function () { wake(); }, { passive: true });
  window.addEventListener('pointerdown', function () { wake(); }, { passive: true });
  window.addEventListener('focusin', function (e) {
    if (document.getElementById('hud').contains(e.target)) wake(true);
  });
  wake();
}

if (window.THREE) start();
else {
  document.getElementById('fallback').style.display = 'grid';
  document.getElementById('curtain').style.display = 'none';
