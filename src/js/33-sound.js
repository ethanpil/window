/* ============================================================
   11. ambient sound (opt-in)
   ============================================================ */
var Sound = {
  ready: false, on: false, layers: [], voices: 0,

  /* ---- one-time graph: sources -> pan -> dry + reverb -> master -> limiter ---- */
  build: function () {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = new AC();
      this.ctx = ctx;

      var comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 3;
      comp.attack.value = 0.02; comp.release.value = 0.4;
      comp.connect(ctx.destination);

      var master = ctx.createGain();
      master.gain.value = 0;
      master.connect(comp);
      this.master = master;

      this.dry = ctx.createGain(); this.dry.gain.value = 0.82;
      this.wet = ctx.createGain(); this.wet.gain.value = 0.30;
      /* the closed window: everything outside passes through the glass */
      this.room = ctx.createBiquadFilter();
      this.room.type = 'lowpass'; this.room.frequency.value = 3400; this.room.Q.value = 0.5;
      this.dry.connect(this.room); this.room.connect(master);
      if (ctx.listener) {
        try {
          if (ctx.listener.forwardX) {
            ctx.listener.forwardX.value = 0; ctx.listener.forwardY.value = 0; ctx.listener.forwardZ.value = -1;
            ctx.listener.upX.value = 0; ctx.listener.upY.value = 1; ctx.listener.upZ.value = 0;
          } else ctx.listener.setOrientation(0, 0, -1, 0, 1, 0);
        } catch (e) {}
      }
      var verb = ctx.createConvolver();
      verb.buffer = this.impulse(2.4);
      this.wet.connect(verb); verb.connect(master);
      this.verb = verb;

      this.buf = this.noise(19, 'pink');   /* long enough that the loop is inaudible */
      this.bufs = { pink: this.buf, brown: this.noise(17, 'brown'), white: this.noise(13, 'white') };
      this.layers = [];
      this.buildLayers();
      this.ready = true;
    } catch (e) { this.ctx = null; }
  },

  /* stereo pink noise; the two channels are independent so it sits around you */
  /* wind and surf want brown (heavy), the middle wants pink, rain and spray want white:
     three grains so nothing shares a texture with anything else */
  noise: function (secs, colour) {
    var ctx = this.ctx, len = Math.floor(ctx.sampleRate * secs);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, br = 0;
      for (var i = 0; i < len; i++) {
        var w = Math.random() * 2 - 1;
        if (colour === 'white') { d[i] = w * 0.22; continue; }
        if (colour === 'brown') { br = (br + w * 0.02) * 0.998; d[i] = br * 3.2; continue; }
        b0 = 0.99886 * b0 + w * 0.0555179;
        b1 = 0.99332 * b1 + w * 0.0750759;
        b2 = 0.96900 * b2 + w * 0.1538520;
        b3 = 0.86650 * b3 + w * 0.3104856;
        b4 = 0.55000 * b4 + w * 0.5329522;
        b5 = -0.7616 * b5 - w * 0.0168980;
        d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.055;
      }
    }
    return buf;
  },

  /* a plausible outdoor tail: noise under an exponential decay, with a little pre-delay */
  impulse: function (secs) {
    var ctx = this.ctx, len = Math.floor(ctx.sampleRate * secs);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    var pre = Math.floor(ctx.sampleRate * 0.018);
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        if (i < pre) { d[i] = 0; continue; }
        var t = (i - pre) / (len - pre);
        var decay = Math.pow(1 - t, 2.6);
        /* thin the tail as it decays, the way air absorbs the top end */
        d[i] = (Math.random() * 2 - 1) * decay * (1 - t * 0.55);
      }
    }
    return buf;
  },

  /* a point in the world, heard through the head: above, behind, off to a side */
  place: function (node, x, y, z, refDist) {
    var ctx = this.ctx;
    if (!ctx.createPanner) return node;
    var pn = ctx.createPanner();
    pn.panningModel = 'HRTF'; pn.distanceModel = 'inverse';
    pn.refDistance = refDist || 6; pn.rolloffFactor = 0.8; pn.maxDistance = 400;
    try {
      if (pn.positionX) { pn.positionX.value = x; pn.positionY.value = y; pn.positionZ.value = z; }
      else pn.setPosition(x, y, z);
    } catch (e) {}
    node.connect(pn);
    return pn;
  },
  layer: function (o) {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = (this.bufs && this.bufs[o.src]) || this.buf; src.loop = true;
    /* every layer reads a different part of the buffer at a slightly different
       rate, so nothing ever phase-locks with anything else */
    src.playbackRate.value = 0.94 + Math.random() * 0.12;
    var flt = ctx.createBiquadFilter();
    flt.type = o.type; flt.frequency.value = o.freq; flt.Q.value = o.Q == null ? 0.6 : o.Q;
    var gn = ctx.createGain(); gn.gain.value = o.gain;
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (pan) pan.pan.value = o.pan == null ? (Math.random() * 1.2 - 0.6) : o.pan;
    src.connect(flt); flt.connect(gn);
    var tail = pan ? (gn.connect(pan), pan) : gn;
    if (o.at) tail = this.place(tail, o.at[0], o.at[1], o.at[2], o.ref);
    tail.connect(this.dry);
    var send = ctx.createGain(); send.gain.value = o.wet == null ? 0.35 : o.wet;
    tail.connect(send); send.connect(this.wet);
    try { src.start(0, Math.random() * 15); } catch (e) { src.start(); }
    if (o.drift) {
      /* a resonant peak that wanders is what makes wind sound like wind */
      var lfo = ctx.createOscillator(); lfo.frequency.value = o.drift.rate;
      var lg = ctx.createGain(); lg.gain.value = o.drift.depth;
      lfo.connect(lg); lg.connect(flt.frequency); lfo.start();
      this.layers.push({ src: src, gain: gn, filter: flt, lfo: lfo, send: send });
    } else {
      this.layers.push({ src: src, gain: gn, filter: flt, send: send });
    }
    return { filter: flt, gain: gn, send: send, pan: pan };
  },

  buildLayers: function () {
    if (!this.ctx) return;
    var P = this.P, W = P.weather, B = P.biomeKey;

    /* The bed is what a place sounds like with nothing happening. An open moor
       roars; a forest is nearly silent until a gust moves the leaves; a desert
       is a thin dry hiss you have to listen for. */
    var BEDS = {
      open:   { src: 'brown', type: 'lowpass',  freq: 420,  Q: 0.5, gain: 0.26, gust: 0.32 },
      shore:  { src: 'brown', type: 'lowpass',  freq: 300,  Q: 0.5, gain: 0.16, gust: 0.20 },
      field:  { src: 'pink',  type: 'lowpass',  freq: 700,  Q: 0.5, gain: 0.09, gust: 0.20 },
      forest: { src: 'white', type: 'bandpass', freq: 2200, Q: 0.7, gain: 0.030, gust: 0.18 },
      water:  { src: 'pink',  type: 'lowpass',  freq: 600,  Q: 0.6, gain: 0.07, gust: 0.14 },
      dry:    { src: 'white', type: 'bandpass', freq: 1600, Q: 0.5, gain: 0.022, gust: 0.06 },
      cold:   { src: 'pink',  type: 'highpass', freq: 900,  Q: 0.6, gain: 0.05, gust: 0.12 },
      town:   { src: 'pink',  type: 'lowpass',  freq: 900,  Q: 0.5, gain: 0.05, gust: 0.09 }
    };
    var bedKind = { alpine: 'open', fjord: 'open', moor: 'open', cliffcoast: 'open', savanna: 'open',
      coast: 'shore', meadow: 'field', farmland: 'field', lavender: 'field', flowerfield: 'field',
      autumn: 'forest', orchard: 'forest', blossom: 'forest',
      river: 'water', lakefront: 'water', marsh: 'water', terraces: 'water',
      desert: 'dry', saltflat: 'dry', tundra: 'cold', urban: 'town',
      penthouse: 'town', bridge: 'water', cascade: 'water', canyon: 'open',
      oasis: 'dry', hayfield: 'field' }[B] || 'field';
    var bd = BEDS[bedKind];
    this.bed = bd;
    var bed = this.layer({ src: bd.src, type: bd.type, freq: bd.freq, Q: bd.Q, gain: bd.gain, pan: -0.15, wet: bedKind === 'forest' ? 0.45 : 0.25 });
    this.windFilter = bed.filter; this.windGain = bed.gain;
    this.bedBase = bd.freq;
    var voice = {
      pines:  [[2600, 1.2, 0.05, 'white'], [4200, 1.6, 0.03, 'white']],        /* hiss through needles */
      grass:  [[160, 2.2, 0.10, 'brown'], [340, 3.0, 0.06, 'pink']],           /* a low roar over open ground */
      corner: [[820, 6.0, 0.05, 'pink'], [1400, 7.0, 0.03, 'pink']],            /* whistle past an edge */
      dry:    [[1100, 1.4, 0.05, 'white'], [2300, 2.0, 0.03, 'white']],         /* sand and grit */
      water:  [[240, 2.6, 0.08, 'brown'], [700, 3.5, 0.05, 'pink']],
      leaves: [[1900, 1.4, 0.06, 'white'], [3300, 2.2, 0.035, 'white']]
    };
    var wv = { alpine: 'pines', fjord: 'pines', lakefront: 'pines', urban: 'corner', cliffcoast: 'corner',
      desert: 'dry', saltflat: 'dry', tundra: 'dry', coast: 'water', river: 'water', marsh: 'water',
      autumn: 'leaves', orchard: 'leaves', blossom: 'leaves', savanna: 'grass',
      penthouse: 'corner', bridge: 'water', cascade: 'water', canyon: 'corner',
      oasis: 'dry', hayfield: 'grass' }[B] || 'grass';
    var v = voice[wv];
    var vo = 0.9 + Math.random() * 0.2;
    this.res1 = this.layer({ src: v[0][3], type: 'bandpass', freq: v[0][0] * vo, Q: v[0][1], gain: v[0][2], pan: 0.35, wet: 0.5,
      drift: { rate: 0.037, depth: v[0][0] * 0.25 } });
    this.res2 = this.layer({ src: v[1][3], type: 'bandpass', freq: v[1][0] * vo, Q: v[1][1], gain: v[1][2], pan: -0.4, wet: 0.55,
      drift: { rate: 0.023, depth: v[1][0] * 0.22 } });

    /* leaves and grass answering the gust, a beat after you see it move */
    this.rustle = this.layer({ type: 'bandpass', freq: 2600, Q: 0.7, gain: 0.0, pan: 0.1, wet: 0.4 });

    if (W.rain > 0) {
      /* near: on the glass and the sill, bright and dry. mid: the field. far: a wash. */
      this.layer({ src: 'white', type: 'highpass', freq: 3200, Q: 0.6, gain: 0.05 + W.rain * 0.09, wet: 0.08, at: [0.4, 0.3, -0.4], ref: 1 });
      this.layer({ src: 'white', type: 'bandpass', freq: 1600 + W.rain * 1200, Q: 0.35, gain: 0.11 + W.rain * 0.18, pan: 0.2, wet: 0.3 });
      this.layer({ src: 'brown', type: 'lowpass', freq: 500, Q: 0.7, gain: 0.06 + W.rain * 0.12, pan: -0.25, wet: 0.5 });
    }
    if (B === 'coast' || B === 'cliffcoast') {
      var sside = Math.random() < 0.5 ? -1 : 1;
      /* far swell as a bed, mid break, near foam placed off to one side */
      this.layer({ src: 'brown', type: 'lowpass', freq: 160, Q: 0.7, gain: 0.10, pan: 0.0, wet: 0.6 });
      this.surfLow = this.layer({ src: 'brown', type: 'lowpass', freq: 240, Q: 0.8, gain: 0.0, pan: -0.2 * sside, wet: 0.45 });
      this.surfHi = this.layer({ src: 'white', type: 'bandpass', freq: 1800, Q: 0.5, gain: 0.0, wet: 0.35, at: [sside * 22, 0, -30], ref: 10 });
      this.scheduleSwell();
    } else if (B === 'river') {
      /* the burble is close and to one side; the wash is everywhere */
      var rside = P.riverOffset < 0 ? -1 : 1;
      this.layer({ src: 'pink', type: 'bandpass', freq: 700, Q: 5, gain: 0.10, wet: 0.35, at: [rside * 14, -0.5, -18], ref: 8, drift: { rate: 0.11, depth: 120 } });
      this.layer({ src: 'pink', type: 'bandpass', freq: 1350, Q: 6, gain: 0.07, wet: 0.4, at: [rside * 10, -0.5, -26], ref: 8, drift: { rate: 0.083, depth: 200 } });
      this.layer({ src: 'brown', type: 'lowpass', freq: 380, Q: 0.7, gain: 0.07, pan: rside * 0.3, wet: 0.55 });
    } else if ((B === 'alpine' || B === 'fjord') && P.falls) {
      this.layer({ src: 'white', type: 'bandpass', freq: 2200, Q: 0.45, gain: 0.04 + P.falls * 0.012, wet: 0.65, at: [Math.random() < 0.5 ? -60 : 60, 20, -120], ref: 40 });
      this.layer({ src: 'brown', type: 'lowpass', freq: 200, Q: 0.7, gain: 0.06, pan: 0.35, wet: 0.6 });
    } else if (B === 'marsh' || B === 'lakefront') {
      this.layer({ type: 'bandpass', freq: 480, Q: 2.2, gain: 0.05, pan: -0.3, wet: 0.5, drift: { rate: 0.052, depth: 70 } });
    } else if (B === 'desert' || B === 'saltflat') {
      this.layer({ type: 'highpass', freq: 1100, Q: 0.5, gain: 0.035, pan: 0.2, wet: 0.25 });
    }

    /* what a place sounds like when the birds are quiet */
    var dusk = P.timeA === 'dusk' || P.timeA === 'night' || P.timeA === 'golden';
    var warm = { meadow: 1, savanna: 1, farmland: 1, orchard: 1, blossom: 1, lavender: 1, flowerfield: 1, desert: 1, urban: 1, autumn: 1, olivegrove: 1 };
    if (dusk && warm[B] && W.rain < 0.3 && P.seasonKey !== 'winter') this.startCrickets();
    if (dusk && (B === 'marsh' || B === 'lakefront' || B === 'river') && W.rain < 0.5) this.scheduleFrogs();
    if (B === 'urban') {
      this.layer({ type: 'lowpass', freq: 95, Q: 0.9, gain: 0.16, pan: 0.0, wet: 0.3 });
      this.layer({ type: 'bandpass', freq: 420, Q: 0.6, gain: 0.07, pan: 0.3, wet: 0.45, drift: { rate: 0.05, depth: 90 } });
    }
    if (B === 'penthouse') {
      /* the city heard from above: a deep hum, and the streets far below */
      this.layer({ src: 'brown', type: 'lowpass', freq: 80, Q: 0.9, gain: 0.20, pan: 0.0, wet: 0.35 });
      this.layer({ src: 'pink', type: 'bandpass', freq: 340, Q: 0.5, gain: 0.09, wet: 0.6, at: [0, -50, -40], ref: 40, drift: { rate: 0.04, depth: 70 } });
      this.layer({ src: 'white', type: 'highpass', freq: 2600, Q: 0.6, gain: 0.020, pan: -0.3, wet: 0.4 });
    }
    if (B === 'bridge') {
      /* the river below, and tyres crossing the deck above it */
      this.layer({ src: 'brown', type: 'lowpass', freq: 260, Q: 0.8, gain: 0.13, wet: 0.65, at: [0, -20, -40], ref: 20 });
      this.layer({ src: 'pink', type: 'bandpass', freq: 900, Q: 3, gain: 0.07, wet: 0.5, at: [10, -18, -55], ref: 22, drift: { rate: 0.09, depth: 140 } });
    }
    if (B === 'cascade') {
      /* close to a big fall: full spectrum, loud, and all around you */
      this.layer({ src: 'brown', type: 'lowpass', freq: 200, Q: 0.7, gain: 0.30, pan: 0.0, wet: 0.75 });
      this.layer({ src: 'pink', type: 'bandpass', freq: 900, Q: 0.5, gain: 0.20, wet: 0.7, at: [P.fallX, 6, P.fallZ + 20], ref: 30 });
      this.layer({ src: 'white', type: 'highpass', freq: 3000, Q: 0.6, gain: 0.10, wet: 0.6, at: [P.fallX, 10, P.fallZ + 24], ref: 34 });
    }
    if (B === 'canyon') {
      /* a big empty space: a slow moan off the walls and very little else */
      this.layer({ src: 'brown', type: 'lowpass', freq: 150, Q: 1.4, gain: 0.09, pan: -0.2, wet: 0.8, drift: { rate: 0.017, depth: 40 } });
      this.layer({ src: 'pink', type: 'bandpass', freq: 520, Q: 5.5, gain: 0.035, pan: 0.35, wet: 0.85, drift: { rate: 0.011, depth: 120 } });
    }
    if (B === 'oasis') {
      this.layer({ src: 'white', type: 'bandpass', freq: 4200, Q: 1.2, gain: 0.030, pan: 0.2, wet: 0.4, drift: { rate: 0.07, depth: 400 } });
      this.layer({ src: 'pink', type: 'bandpass', freq: 640, Q: 2.4, gain: 0.04, wet: 0.5, at: [0, -1, -60], ref: 25 });
    }
    if (W.rain >= 0.9 && !W.lightning) this.scheduleThunder();
    this.scheduleEvents();

    var songful = { desert: 'hawk', tundra: 'hawk', moor: 'hawk', saltflat: 'hawk',
      meadow: 'fluty', farmland: 'fluty', orchard: 'fluty', blossom: 'trill', lavender: 'trill',
      flowerfield: 'trill', savanna: 'trill', autumn: 'coo', alpine: 'trill',
      river: 'fluty', lakefront: 'coo',
      coast: 'gull', cliffcoast: 'gull', marsh: 'gull',
      bridge: 'fluty', cascade: 'trill', canyon: 'hawk', oasis: 'coo', hayfield: 'fluty' };
    this.voice = songful[B] || null;
    this.birdsong = !!this.voice && W.rain < 0.4 && W.snow < 0.4 && (P.timeA !== 'night' || this.voice === 'hawk');
  },

  /* ---- one short shaped burst of noise, placed in the world ---- */
  burst: function (o) {
    if (!this.on || !this.ctx) return;
    var ctx = this.ctx, t = ctx.currentTime + (o.delay || 0);
    var src = ctx.createBufferSource(); src.buffer = this.bufs[o.src || 'white'];
    var f = ctx.createBiquadFilter(); f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(o.freq, t); f.Q.value = o.Q == null ? 1 : o.Q;
    if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + o.dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(o.gain, 0.001), t + (o.attack || 0.006));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f); f.connect(g);
    var tail = o.at ? this.place(g, o.at[0], o.at[1], o.at[2], o.ref || 6) : g;
    tail.connect(this.dry);
    var send = ctx.createGain(); send.gain.value = o.wet == null ? 0.5 : o.wet;
    tail.connect(send); send.connect(this.wet);
    try { src.start(t, Math.random() * 10); } catch (e) { src.start(t); }
    src.stop(t + o.dur + 0.1);
    setTimeout(function () { try { g.disconnect(); send.disconnect(); tail.disconnect(); } catch (e) {} }, (o.dur + (o.delay || 0) + 0.5) * 1000);
  },
  /* ---- what a place does when nothing else is happening ---- */
  scheduleEvents: function () {
    var self = this;
    clearTimeout(this.eventTimer);
    var P = this.P, B = P.biomeKey, W = P.weather;
    var gap = 1800 + Math.random() * 6000;
    this.eventTimer = setTimeout(function () {
      if (self.on && self.ctx && !document.hidden) {
        var r = Math.random();
        var side = Math.random() < 0.5 ? -1 : 1;
        if (W.rain > 0.2 && r < 0.9) {
          /* drips off the frame, in a little run */
          var n = 2 + Math.floor(Math.random() * 4);
          for (var i = 0; i < n; i++) self.burst({ src: 'white', freq: 3200 + Math.random() * 2600, Q: 6, gain: 0.05 + W.rain * 0.05, dur: 0.045, delay: i * (0.12 + Math.random() * 0.25), at: [side * 0.6, 0.4, -0.3], ref: 1, wet: 0.1 });
        } else if ((B === 'coast' || B === 'cliffcoast') && r < 0.7) {
          /* a wave landing on rock */
          self.burst({ src: 'brown', type: 'lowpass', freq: 900, sweep: 140, Q: 0.7, gain: 0.30, dur: 1.6, attack: 0.05, at: [side * 26, 0, -34], ref: 12, wet: 0.6 });
          self.burst({ src: 'white', freq: 2800, sweep: 900, Q: 0.6, gain: 0.08, dur: 1.2, delay: 0.15, at: [side * 26, 0, -34], ref: 12, wet: 0.5 });
        } else if ((B === 'marsh' || B === 'lakefront' || B === 'river' || B === 'oasis' || B === 'bridge') && r < 0.75) {
          /* a lap, or something small going into the water */
          self.burst({ src: 'pink', type: 'lowpass', freq: 700, sweep: 300, Q: 2, gain: 0.10, dur: 0.22, at: [side * 9, -0.5, -12], ref: 5, wet: 0.5 });
        } else if ((B === 'urban' || B === 'penthouse') && r < 0.8) {
          /* a car passing left to right, or a door somewhere */
          if (Math.random() < 0.7) {
            var carX = -60 * side;
            var g0 = self.burst({ src: 'pink', freq: 380, sweep: 900, Q: 0.6, gain: 0.07, dur: 2.4, attack: 0.9, at: [carX, 0, -160], ref: 60, wet: 0.5 });
            self.burst({ src: 'pink', freq: 900, sweep: 360, Q: 0.6, gain: 0.07, dur: 2.4, attack: 0.9, delay: 2.2, at: [-carX, 0, -160], ref: 60, wet: 0.5 });
          } else self.burst({ src: 'brown', type: 'lowpass', freq: 260, Q: 1.5, gain: 0.14, dur: 0.25, at: [side * 40, 4, -90], ref: 30, wet: 0.7 });
        } else if ((B === 'tundra' || W.snow > 0) && r < 0.5) {
          self.burst({ src: 'white', freq: 5200, Q: 8, gain: 0.03, dur: 0.02, at: [side * 6, 0, -8], ref: 3, wet: 0.2 });
        } else if (/autumn|orchard|blossom|meadow|farmland|lakefront|alpine/.test(B) && r < 0.55) {
          /* a twig, or a stir of leaves */
          if (Math.random() < 0.4) self.burst({ src: 'brown', freq: 1400, Q: 3, gain: 0.08, dur: 0.05, at: [side * 12, 0, -16], ref: 5, wet: 0.35 });
          else self.burst({ src: 'white', freq: 2600, sweep: 1900, Q: 0.8, gain: 0.05, dur: 0.6, attack: 0.15, at: [side * 14, 3, -20], ref: 7, wet: 0.45 });
        } else if ((B === 'desert' || B === 'saltflat') && r < 0.4) {
          self.burst({ src: 'white', freq: 1800, sweep: 900, Q: 0.8, gain: 0.04, dur: 1.4, attack: 0.5, at: [side * 20, 0.5, -14], ref: 8, wet: 0.3 });
        }
      }
      self.scheduleEvents();
    }, gap);
  },
  /* ---- the visitors are heard while they are in view ---- */
  visitorSound: function (t) {
    var vi = App.visitorInfo;
    if (!vi || !this.on || !this.ctx) return;
    var cyc = (t / vi.period + vi.phase) % 1;
    var visible = cyc < vi.cross;
    if (visible && !this.visitorOn) {
      this.visitorOn = true;
      var self = this, side = vi.side;
      if (vi.kind === 'boat') {
        var putt = function () {
          if (!self.visitorOn) return;
          self.burst({ src: 'brown', type: 'lowpass', freq: 180, Q: 1.2, gain: 0.09, dur: 0.09, at: [side * 40, 0, -90], ref: 35, wet: 0.6 });
          self.visitorTimer = setTimeout(putt, 240 + Math.random() * 40);
        };
        putt();
      } else if (vi.kind === 'balloon') {
        var burner = function () {
          if (!self.visitorOn) return;
          self.burst({ src: 'brown', freq: 320, sweep: 900, Q: 0.5, gain: 0.10, dur: 1.4, attack: 0.08, at: [side * 30, 60, -200], ref: 80, wet: 0.7 });
          self.burst({ src: 'white', freq: 2400, Q: 0.5, gain: 0.03, dur: 1.2, at: [side * 30, 60, -200], ref: 80, wet: 0.6 });
          self.visitorTimer = setTimeout(burner, 6000 + Math.random() * 9000);
        };
        burner();
      } else if (vi.kind === 'geese') {
        var honk = function () {
          if (!self.visitorOn) return;
          var n = 2 + Math.floor(Math.random() * 3);
          for (var i = 0; i < n; i++) self.burst({ src: 'pink', freq: 520 + Math.random() * 180, sweep: 360, Q: 4, gain: 0.07, dur: 0.16, delay: i * 0.22, attack: 0.02, at: [side * 40, 60, -180], ref: 70, wet: 0.7 });
          self.visitorTimer = setTimeout(honk, 2500 + Math.random() * 5000);
        };
        honk();
      }
    } else if (!visible && this.visitorOn) {
      this.visitorOn = false;
      clearTimeout(this.visitorTimer);
    }
  },

  /* ---- crickets: a narrow tone pulsed at ~26 Hz, in short chirps ---- */
  startCrickets: function () {
    var ctx = this.ctx;
    var src = ctx.createBufferSource();
    src.buffer = this.buf; src.loop = true;
    src.playbackRate.value = 1.0 + Math.random() * 0.05;
    var flt = ctx.createBiquadFilter();
    flt.type = 'bandpass'; flt.frequency.value = 4300 + Math.random() * 500; flt.Q.value = 14;
    var pulse = ctx.createGain(); pulse.gain.value = 0.0;
    var lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 24 + Math.random() * 6;
    var lg = ctx.createGain(); lg.gain.value = 0.5;
    var chirp = ctx.createGain(); chirp.gain.value = 0.0;
    var gn = ctx.createGain(); gn.gain.value = 0.045;
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    lfo.connect(lg); lg.connect(pulse.gain);
    src.connect(flt); flt.connect(pulse); pulse.connect(chirp); chirp.connect(gn);
    var tail = gn;
    if (pan) { pan.pan.value = Math.random() * 1.2 - 0.6; gn.connect(pan); tail = pan; }
    tail.connect(this.dry);
    var send = ctx.createGain(); send.gain.value = 0.5;
    tail.connect(send); send.connect(this.wet);
    try { src.start(0, Math.random() * 15); } catch (e) { src.start(); }
    lfo.start();
    this.layers.push({ src: src, gain: gn, filter: flt, lfo: lfo, send: send });
    var self = this;
    var gate = function () {
      if (!self.ctx || self.layers.indexOf(entry) < 0) return;
      var t = self.ctx.currentTime;
      chirp.gain.setTargetAtTime(1.0, t, 0.02);
      chirp.gain.setTargetAtTime(0.0, t + 0.22 + Math.random() * 0.25, 0.04);
      self.cricketTimer = setTimeout(gate, 420 + Math.random() * 700);
    };
    var entry = this.layers[this.layers.length - 1];
    clearTimeout(this.cricketTimer);
    gate();
  },

  /* ---- frogs: a low croak, a few in a row, from somewhere off to one side ---- */
  scheduleFrogs: function () {
    var self = this;
    clearTimeout(this.frogTimer);
    this.frogTimer = setTimeout(function () {
      if (self.on && self.ctx && !document.hidden) {
        var ctx = self.ctx, t0 = ctx.currentTime + 0.05;
        var n = 2 + Math.floor(Math.random() * 4), f0 = 150 + Math.random() * 110;
        var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
        var out = ctx.createGain(); out.gain.value = 0.10 + Math.random() * 0.06;
        var node = out;
        if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; out.connect(pan); node = pan; }
        node.connect(self.dry);
        var send = ctx.createGain(); send.gain.value = 0.7; node.connect(send); send.connect(self.wet);
        for (var i = 0; i < n; i++) {
          var st = t0 + i * (0.19 + Math.random() * 0.08);
          var o = ctx.createOscillator(); o.type = 'sawtooth';
          o.frequency.setValueAtTime(f0, st);
          o.frequency.exponentialRampToValueAtTime(f0 * 0.78, st + 0.14);
          var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 2;
          var am = ctx.createOscillator(); am.frequency.value = 24;
          var amg = ctx.createGain(); amg.gain.value = 0.5;
          var g = ctx.createGain();
          g.gain.setValueAtTime(0.0001, st);
          g.gain.exponentialRampToValueAtTime(0.5, st + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, st + 0.16);
          am.connect(amg); amg.connect(g.gain); am.start(st); am.stop(st + 0.2);
          o.connect(lp); lp.connect(g); g.connect(out);
          o.start(st); o.stop(st + 0.2);
        }
        setTimeout(function () { try { out.disconnect(); send.disconnect(); } catch (e) {} }, 2500);
      }
      self.scheduleFrogs();
    }, 2500 + Math.random() * 6000);
  },

  /* ---- thunder: a rolling low rumble; near strikes crack first ---- */
  rumble: function (delay, near) {
    if (!this.on || !this.ctx) return;
    var ctx = this.ctx, t = ctx.currentTime + (delay || 0);
    near = near || 0;
    var src = ctx.createBufferSource(); src.buffer = this.buf;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.value = 110 + near * 700; lp.Q.value = 0.8;
    var g = ctx.createGain();
    var dur = 3 + Math.random() * 4 + near * 2;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 + near * 0.55, t + (near > 0.4 ? 0.06 : 0.6 + Math.random() * 0.8));
    g.gain.exponentialRampToValueAtTime(0.12 + near * 0.15, t + 1.2 + near);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(lp); lp.connect(g); g.connect(this.dry);
    var send = ctx.createGain(); send.gain.value = 0.9; g.connect(send); send.connect(this.wet);
    try { src.start(t, Math.random() * 15); } catch (e) { src.start(t); }
    src.stop(t + dur + 0.5);
    setTimeout(function () { try { g.disconnect(); send.disconnect(); } catch (e) {} }, (delay + dur + 1) * 1000);
  },
  thunderIn: function (delay, near) {
    if (this.ctx && this.ctx.state === 'suspended') return;
    this.rumble(delay, Math.max(0, Math.min(1, near)));
  },
  scheduleThunder: function () {
    var self = this;
    clearTimeout(this.thunderTimer);
    this.thunderTimer = setTimeout(function () {
      if (!document.hidden) self.rumble(0, 0);
      self.scheduleThunder();
    }, 45000 + Math.random() * 90000);
  },

  /* ---- surf: a real swell rises quickly and falls away slowly ---- */
  scheduleSwell: function () {
    var self = this;
    clearTimeout(this.swellTimer);
    var gap = 6500 + Math.random() * 6000;
    this.swellTimer = setTimeout(function () {
      if (self.ctx && self.on && self.surfLow) {
        var t = self.ctx.currentTime, peak = 0.16 + Math.random() * 0.14;
        self.surfLow.gain.gain.cancelScheduledValues(t);
        self.surfLow.gain.gain.setTargetAtTime(peak, t, 0.9);
        self.surfLow.gain.gain.setTargetAtTime(0.03, t + 2.6, 2.2);
        /* the foam hisses a moment after the wave lands */
        self.surfHi.gain.gain.cancelScheduledValues(t);
        self.surfHi.gain.gain.setTargetAtTime(peak * 0.55, t + 0.55, 0.7);
        self.surfHi.gain.gain.setTargetAtTime(0.015, t + 3.1, 2.6);
      }
      self.scheduleSwell();
    }, gap);
  },

  /* ---- birds: partials, vibrato and a syllable rhythm, heard across a field ---- */
  call: function () {
    if (!this.on || !this.ctx || !this.voice || this.voices > 3) return;
    var ctx = this.ctx, self = this;
    var kind = this.voice, t0 = ctx.currentTime + 0.02;
    var out = ctx.createGain();
    var far = ctx.createBiquadFilter();
    far.type = 'lowpass';
    far.frequency.value = 2600 + Math.random() * 3200;   /* distance eats the top end */
    var pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    out.connect(far);
    var node = far;
    if (pan) { pan.pan.value = Math.random() * 1.6 - 0.8; far.connect(pan); node = pan; }
    var lvl = ctx.createGain(); lvl.gain.value = 0.09 + Math.random() * 0.05;
    node.connect(lvl);
    lvl.connect(this.dry);
    var send = ctx.createGain(); send.gain.value = 0.8;   /* birds live in the reverb */
    lvl.connect(send); send.connect(this.wet);

    var notes = [], i;
    if (kind === 'trill') {
      var n = 5 + Math.floor(Math.random() * 6), f0 = 2700 + Math.random() * 1400;
      for (i = 0; i < n; i++) notes.push({ t: i * 0.055, d: 0.045, f: f0 * (1 + (i % 2) * 0.12), g: 1 });
    } else if (kind === 'fluty') {
      var m = 3 + Math.floor(Math.random() * 3), fb = 1500 + Math.random() * 900;
      for (i = 0; i < m; i++) notes.push({
        t: i * (0.20 + Math.random() * 0.12), d: 0.14 + Math.random() * 0.1,
        f: fb * (0.8 + Math.random() * 0.6), slide: 0.85 + Math.random() * 0.35, g: 1
      });
    } else if (kind === 'hawk') {
      /* one long falling cry from somewhere high */
      notes.push({ t: 0, d: 0.75 + Math.random() * 0.35, f: 2300 + Math.random() * 500, slide: 0.58, g: 0.8, harsh: 1 });
    } else if (kind === 'gull') {
      var k = 2 + Math.floor(Math.random() * 2);
      for (i = 0; i < k; i++) notes.push({
        t: i * 0.42, d: 0.34, f: 1250 + Math.random() * 350, slide: 0.55, g: 0.9, harsh: 1
      });
    } else {
      var syl = [0, 0.26, 0.62, 0.92], fc = 380 + Math.random() * 120;
      for (i = 0; i < syl.length; i++) notes.push({ t: syl[i], d: 0.24, f: fc * (i === 1 ? 1.18 : 1), g: i === 1 ? 1 : 0.7 });
    }

    /* somewhere in the trees ahead: the call comes from a point, not a pan */
    if (pan) { try { pan.disconnect(); } catch (e) {} far.connect(lvl); }
    var px = (Math.random() * 2 - 1) * 34, py = 2 + Math.random() * 12, pz = -10 - Math.random() * 40;
    if (kind === 'hawk') { px *= 2.5; py = 40 + Math.random() * 50; pz = -60 - Math.random() * 120; }
    var placed = this.place(lvl, px, py, pz, 8);
    try { lvl.disconnect(this.dry); } catch (e) {}
    placed.connect(this.dry);
    var last = 0;
    for (i = 0; i < notes.length; i++) {
      var nt = notes[i], st = t0 + nt.t;
      last = Math.max(last, nt.t + nt.d);
      /* the source is harmonically rich; the resonators shape it into a voice */
      var o = ctx.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(nt.f, st);
      if (nt.slide) o.frequency.exponentialRampToValueAtTime(nt.f * nt.slide, st + nt.d);
      var vib = ctx.createOscillator(); vib.frequency.value = 14 + Math.random() * 14;
      var vg = ctx.createGain(); vg.gain.value = nt.f * 0.018;
      vib.connect(vg); vg.connect(o.frequency); vib.start(st); vib.stop(st + nt.d + 0.02);
      var r1 = ctx.createBiquadFilter(); r1.type = 'bandpass'; r1.Q.value = nt.harsh ? 5 : 11;
      var r2 = ctx.createBiquadFilter(); r2.type = 'bandpass'; r2.Q.value = nt.harsh ? 4 : 9;
      r1.frequency.setValueAtTime(nt.f * (nt.harsh ? 1.6 : 2.1), st);
      r1.frequency.exponentialRampToValueAtTime(nt.f * (nt.harsh ? 1.2 : 1.7), st + nt.d);
      r2.frequency.setValueAtTime(nt.f * 3.2, st);
      r2.frequency.exponentialRampToValueAtTime(nt.f * 2.6, st + nt.d);
      /* breath: a little air in the tone */
      var ns = ctx.createBufferSource(); ns.buffer = this.bufs.white;
      var nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = nt.f * 2.4; nf.Q.value = 3;
      var ng = ctx.createGain(); ng.gain.value = nt.harsh ? 0.35 : 0.12;
      ns.connect(nf); nf.connect(ng);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, st);
      g.gain.exponentialRampToValueAtTime(Math.max(nt.g * 0.9, 0.001), st + Math.min(0.018, nt.d * 0.25));
      g.gain.exponentialRampToValueAtTime(0.0001, st + nt.d);
      o.connect(r1); r1.connect(g); o.connect(r2); r2.connect(g); ng.connect(g); g.connect(out);
      o.start(st); o.stop(st + nt.d + 0.02);
      try { ns.start(st, Math.random() * 10); } catch (e) { ns.start(st); }
      ns.stop(st + nt.d + 0.02);
    }
    this.voices++;
    setTimeout(function () {
      self.voices--;
      try { out.disconnect(); far.disconnect(); lvl.disconnect(); send.disconnect(); if (pan) pan.disconnect(); } catch (e) {}
    }, (last + 1.2) * 1000);
  },

  scheduleChirp: function () {
    var self = this;
    clearTimeout(this.chirpTimer);
    var gap = self.voice === 'hawk' ? 20000 + Math.random() * 50000 : 4000 + Math.random() * 15000;
    this.chirpTimer = setTimeout(function () {
      if (!document.hidden) self.call();
      self.scheduleChirp();
    }, gap);
  },

  reset: function (P) {
    clearTimeout(this.chirpTimer);
    clearTimeout(this.swellTimer);
    clearTimeout(this.cricketTimer);
    clearTimeout(this.frogTimer);
    clearTimeout(this.thunderTimer);
    clearTimeout(this.eventTimer);
    clearTimeout(this.visitorTimer);
    this.visitorOn = false;
    this.P = P;
    if (!this.ctx) return;
    for (var i = 0; i < this.layers.length; i++) {
      try { this.layers[i].src.stop(); } catch (e) {}
      if (this.layers[i].lfo) { try { this.layers[i].lfo.stop(); } catch (e) {} }
      try {
        this.layers[i].src.disconnect(); this.layers[i].gain.disconnect();
        this.layers[i].send.disconnect();
      } catch (e) {}
    }
    this.layers = [];
    this.surfLow = this.surfHi = this.rustle = null;
    this.buildLayers();
    if (this.on && this.birdsong) this.scheduleChirp();
  },

  toggle: function () {
    if (!this.ready) this.build();
    if (!this.ctx) return false;
    this.on = !this.on;
    if (this.on && this.ctx.state === 'suspended') this.ctx.resume();
    if (this.on && this.birdsong) this.scheduleChirp(); else clearTimeout(this.chirpTimer);
    /* a slow fade in and out: nothing here should ever start abruptly */
    this.master.gain.setTargetAtTime(this.on ? 0.85 : 0, this.ctx.currentTime, this.on ? 1.6 : 0.9);
    return this.on;
  },

  update: function (gust, open) {
    if (!this.on || !this.windFilter) return;
    open = open || 0;
    var ctx = this.ctx, t = ctx.currentTime, w = this.P.windBase;
    /* the sound of a gust reaches you after you have watched it cross the grass */
    this.lag = this.lag == null ? gust : this.lag + (gust - this.lag) * 0.012;
    var g = this.lag;
    var bd = this.bed || { gain: 0.2, gust: 0.34, freq: 420 };
    var f = (bd.freq * (0.6 + g * 1.3 * (0.4 + w))) * (1 + open * 1.4);
    this.windFilter.frequency.setTargetAtTime(f, t, 0.7);
    this.windGain.gain.setTargetAtTime((bd.gain + g * bd.gust * w) * (1 + open * 0.8), t, 0.8);
    var rs = bd.gust / 0.32;
    if (this.res1) this.res1.gain.gain.setTargetAtTime((0.05 + g * 0.10 * w) * rs, t, 1.1);
    if (this.res2) this.res2.gain.gain.setTargetAtTime((0.02 + g * 0.07 * w) * rs, t, 1.3);
    if (this.rustle) this.rustle.gain.gain.setTargetAtTime(Math.max(0, (g - 0.35)) * 0.16 * w * (1 + open), t, 0.5);
    /* opening the sash moves you out of the room and into the weather */
    if (this.dry) this.dry.gain.setTargetAtTime(0.82 + open * 0.25, t, 0.6);
    if (this.room) this.room.frequency.setTargetAtTime(3400 + open * 14000, t, 0.5);
    this.visitorSound(App.t || 0);
    if (this.wet) this.wet.gain.setTargetAtTime(0.30 - open * 0.14, t, 0.6);
    if (this.master) this.master.gain.setTargetAtTime(0.85 + open * 0.4, t, 0.6);
  }
};

