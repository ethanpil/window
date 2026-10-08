/* ============================================================
   9. weather over time
   ============================================================ */
var _c1 = new THREE.Color(), _c2 = new THREE.Color(), _cw = new THREE.Color();
function mixHex(out, a, b, t) {
  _c1.set(a); _c2.set(b);
  out.copy(_c1).lerp(_c2, t);
  return out;
}
function desat(c, amount) {
  var l = c.r * 0.30 + c.g * 0.59 + c.b * 0.11;
  c.r = lerp(c.r, l, amount); c.g = lerp(c.g, l, amount); c.b = lerp(c.b, l, amount);
  return c;
}

/* how deep a snowfall settles if it keeps going */
function snowTarget(W) { return clamp(0.35 + W.snow * 0.55, 0, 0.92); }

function updateWeather(t) {
  var P = App.P, U = App.U, W = P.weather;
  var A = TIMES[P.timeA], B = TIMES[P.timeB];
  var k;

  /* the light breathes slowly between two hours of the day */
  k = 0.5 - 0.5 * Math.cos((t / P.driftPeriod) * 6.283 + P.driftPhase);
  k *= P.driftAmount;
  var elev = lerp(A.elev, B.elev, k) * Math.PI / 180;

  /* weather intensity also wanders, so nothing loops */
  var mood = 0.5 + 0.5 * Math.sin(t * 0.0121 + 1.3) * 0.6 + 0.5 * Math.sin(t * 0.0043 - 0.7) * 0.4;
  mood = clamp(mood, 0, 1);

  var az = P.sunAz;

  /* a live clock overrides the seeded hour with the viewer's own */
  if (App.liveClock) {
    var now = new Date();
    var hr = now.getHours() + now.getMinutes() / 60;
    elev = (62 * Math.sin((hr - 6) / 12 * Math.PI)) * Math.PI / 180;
    var deg = elev * 180 / Math.PI;
    var rising = hr < 12;
    var key = deg < -8 ? 'night' : (deg < 4 ? (rising ? 'dawn' : 'dusk')
      : (deg < 16 ? (rising ? 'dawn' : 'golden')
      : (deg < 38 ? (rising ? 'morning' : 'afternoon') : 'midday')));
    A = B = TIMES[key];
    k = 0;
    App.liveLabel = key;
  } else App.liveLabel = null;

  var night = clamp((-elev * 180 / Math.PI - 1) / 9, 0, 1);
  var sd = U.uSunDir.value;
  if (night > 0.02) {
    /* after sunset the moon takes over as the light, from the other side */
    var mel = (12 + 34 * night) * Math.PI / 180;
    var maz = az + Math.PI;
    sd.set(Math.sin(maz) * Math.cos(mel), Math.sin(mel), -Math.cos(maz) * Math.cos(mel)).normalize();
    App.skyU.uMoonDir.value.copy(sd);
  } else {
    sd.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev)).normalize();
    App.skyU.uMoonDir.value.set(Math.sin(az + Math.PI), 0.5, -Math.cos(az + Math.PI)).normalize();
  }
  App.skyU.uNight.value = night;

  var lightMul = W.lightMul * (1 - 0.14 * mood);
  var sunI = lerp(A.sunI, B.sunI, k) * lightMul;
  /* x1.1: the sun no longer leaks into baked shadow, so the sky that does
     light it is a little stronger */
  var ambI = lerp(A.ambI, B.ambI, k) * W.ambMul * 1.1;

  mixHex(U.uSunCol.value, A.sun, B.sun, k).multiplyScalar(sunI * 0.95);
  desat(U.uSunCol.value, W.desat * 0.7);
  mixHex(U.uAmbCol.value, A.amb, B.amb, k).multiplyScalar(ambI);
  desat(U.uAmbCol.value, W.desat * 0.5);

  /* haze thickens and thins; dry air on a fine day carries much less of it */
  /* a city's own air shows in dry weather; rain and snow wash it out */
  var cityAir = P.cityHaze && !W.rain && !W.snow;
  U.uFogDensity.value = W.fogD * P.hazeMul * (0.72 + 0.55 * mood) * (cityAir ? P.cityHazeK : 1)
    * (P.dryClear ? 0.5 : 1);
  /* the glow in the haze toward the sun needs a sun to glow from */
  U.uHazeK.value = clamp(lightMul * 1.15, 0, 1) * (0.3 + 0.7 * W.cover);   /* cover is high for a clear sky */
  /* a rainbow needs rain in the air, a low sun, and the sun behind the window */
  /* the bow is a circle of 42 degrees around the point opposite the sun, so it
     shows only when the sun is behind the window and low enough to lift that
     point's arc above the horizon */
  var elevSin = Math.sin(elev);
  var wet = Math.max(W.rain, App.wetness || 0);
  var behind = U.uSunDir.value.z;
  var bow = wet * smoothstep(0.03, 0.18, elevSin) * (1 - smoothstep(0.50, 0.78, elevSin))
          * clamp(lightMul * 1.5, 0, 1) * smoothstep(0.05, 0.45, behind) * (1 - night);
  /* the ground dries by the clock, as snow gathers (wdt, below), not by the
     frame: it took 12 s on a fast screen and close to a minute on a slow one */
  var wdt = App._wxT == null ? 0 : clamp(t - App._wxT, 0, 0.25);
  App._wxT = t;
  App.wetness = W.rain > 0.1 ? 1 : Math.max(0, (App.wetness || 0) - 0.036 * wdt);
  /* frozen ground is not wet */
  U.uWet.value = App.wetness * (1 - smoothstep(0.1, 0.4, U.uSnow.value));
  App.bowTarget = clamp(bow * 1.5, 0, 1);
  App.skyU.uBow.value += (App.bowTarget - App.skyU.uBow.value) * 0.02;
  /* snow under fog is a whiteout with nothing to look at; keep the world in reach */
  if (U.uSnow.value > 0.35) U.uFogDensity.value = Math.min(U.uFogDensity.value, 0.0048);
  /* the skyline must always be there to look at */
  if (P.biomeKey === 'urban') U.uFogDensity.value = Math.min(U.uFogDensity.value, 0.0026);
  U.uShadow.value = W.shadow * (0.7 + 0.6 * (1 - mood)) * (1 - night * 0.85);
  /* where the sun's ray from the ground meets the cloud deck, per deck height */
  U.uCloudShift.value.set(sd.x, sd.z).divideScalar(Math.max(sd.y, 0.08));

  var S = App.skyU;
  mixHex(S.uZenith.value, A.zen, B.zen, k);
  desat(S.uZenith.value, W.desat);
  S.uZenith.value.multiplyScalar(lerp(0.72, 1.0, lightMul));
  mixHex(S.uHorizon.value, A.hor, B.hor, k);
  desat(S.uHorizon.value, W.desat * 0.85);
  S.uHorizon.value.multiplyScalar(lerp(0.80, 1.0, lightMul));
  /* the landscape's own air tints the horizon a little: dust warm, sea cool.
     Dry country is dusty only when the wind lifts it, or in a dust haze;
     on a still clear day its air is the cleanest there is, and its sky the
     deepest blue */
  var hz = cityAir ? P.cityHaze : P.biome.haze;
  var dustK = P.biome.dryAir && !cityAir ? ((P.weatherKey === 'breezy' || P.weatherKey === 'mist') ? 1 : 0.25) : 1;
  S.uHorizon.value.r *= lerp(1, hz[0], 0.6 * dustK); S.uHorizon.value.g *= lerp(1, hz[1], 0.6 * dustK); S.uHorizon.value.b *= lerp(1, hz[2], 0.6 * dustK);
  if (P.dryClear) {
    var dz = smoothstep(-2, 12, elev * 180 / Math.PI);
    S.uZenith.value.r *= lerp(1, 0.85, dz); S.uZenith.value.g *= lerp(1, 0.92, dz); S.uZenith.value.b *= lerp(1, 1.06, dz);
  }
  /* Over hot flat ground on a clear day the air just above it bends the low
     sky down: a band of sky lies on the ground at the horizon, the "water"
     of a mirage. Still, not a shimmer. */
  App.U.uMirage.value = P.mirageK ? smoothstep(22, 40, elev * 180 / Math.PI) * P.mirageK : 0;
  /* the far ground fades to the sky it meets: one colour, so there is no seam */
  U.uFogCol.value.copy(S.uHorizon.value);
  /* Away from a low sun the horizon is not the sun's orange: it is a cooler
     band, going pink under the earth's blue shadow at dusk. High sun, cloud or
     night: the same all round. */
  var elevD = elev * 180 / Math.PI;
  var low = (1 - smoothstep(6, 32, elevD)) * smoothstep(-6, 1, elevD) * clamp(lightMul * 1.3 - 0.3, 0, 1);
  var hl = S.uHorizon.value.r * 0.30 + S.uHorizon.value.g * 0.59 + S.uHorizon.value.b * 0.11;
  var pink = 1 - smoothstep(2, 14, elevD);
  _cw.setRGB(lerp(0.86, 1.04, pink), lerp(0.93, 0.88, pink), lerp(1.10, 1.00, pink)).multiplyScalar(hl * 0.94);
  S.uHorizonAway.value.copy(S.uHorizon.value).lerp(_cw, low);
  U.uFogAway.value.copy(S.uHorizonAway.value);
  /* the near air scatters the sky's blue before it turns to horizon haze */
  U.uInScat.value.copy(S.uHorizon.value).lerp(S.uZenith.value, 0.3);
  /* the ground's bounce: its colour, lit by what reaches it */
  var sunUp = Math.max(Math.sin(elev), 0) * (night > 0.5 ? 0 : 1);
  var snowK = clamp(U.uSnow.value * 1.4, 0, 1);
  _c1.copy(App.albedo).lerp(U.uSnowCol.value, snowK * 0.8);
  _c2.copy(U.uSunCol.value).multiplyScalar(sunUp * (1 - 0.5 * W.shadow)).add(U.uAmbCol.value);
  U.uGroundCol.value.setRGB(_c1.r * _c2.r, _c1.g * _c2.g, _c1.b * _c2.b).multiplyScalar(0.9);
  mixHex(S.uCloudL.value, A.cl, B.cl, k).multiplyScalar(lerp(0.62, 1.0, lightMul));
  mixHex(S.uCloudD.value, A.cd, B.cd, k).multiplyScalar(lerp(0.55, 1.0, lightMul));
  S.uSunCol.value.copy(U.uSunCol.value).multiplyScalar(1.5);
  S.uSunVis.value = clamp(lightMul * 1.15, 0, 1) * smoothstep(-0.02, 0.06, Math.sin(elev));
  S.uCover.value = clamp(W.cover + (mood - 0.5) * 0.14, 0.0, 0.95);

  /* snow gathers on the ground, and eases off if it stops. By the clock, not
     per frame, so a slow GPU does not get a slower snowfall */
  if (W.snow > 0) {
    U.uSnow.value += (snowTarget(W) - U.uSnow.value) * (1 - Math.exp(-wdt * 0.054));
  } else if (P.baseSnow) {
    U.uSnow.value += (P.baseSnow - U.uSnow.value) * (1 - Math.exp(-wdt * 0.12));
  }

  /* a strike whitens the sky and throws hard light across everything */
  var fl = App.flash || 0;
  if (fl > 0.002) {
    U.uAmbCol.value.multiplyScalar(1 + fl * 3.4);
    U.uSunCol.value.multiplyScalar(1 + fl * 0.6);
    U.uFogCol.value.lerp(new THREE.Color(0.86, 0.90, 1.0), fl * 0.55);
    /* all round the horizon, not just toward the sun, and the air's own blue */
    U.uFogAway.value.lerp(new THREE.Color(0.86, 0.90, 1.0), fl * 0.55);
    U.uInScat.value.lerp(new THREE.Color(0.86, 0.90, 1.0), fl * 0.55);
    S.uZenith.value.lerp(new THREE.Color(0.80, 0.86, 1.0), fl * 0.8);
    S.uHorizon.value.lerp(new THREE.Color(0.92, 0.94, 1.0), fl * 0.8);
    S.uHorizonAway.value.lerp(new THREE.Color(0.92, 0.94, 1.0), fl * 0.8);
    S.uCloudL.value.lerp(new THREE.Color(1.0, 1.0, 1.0), fl * 0.7);
    S.uCloudD.value.lerp(new THREE.Color(0.75, 0.78, 0.86), fl * 0.7);
  }

  /* room lights follow the sun */
  App.sun.position.copy(sd).multiplyScalar(60);
  App.sun.target.position.set(0, P.win.cy, 0);
  App.sun.color.copy(U.uSunCol.value);
  /* the sun lights the room only through the window, not through the back
     wall, and only while it is up */
  App.sun.intensity = 0.9 * smoothstep(0.05, -0.15, sd.z) * smoothstep(0.0, 0.06, sd.y);
  App.fill.color.copy(U.uAmbCol.value);
  /* the room is dimmer than the day outside, so the view glows out of it */
  App.fill.intensity = 0.78;
  for (var sl = 0; sl < App.skyLights.length; sl++) {
    App.skyLights[sl].color.copy(U.uInScat.value);
    App.skyLights[sl].intensity = 0.42;
  }
  App.amb.color.copy(U.uFogCol.value);
  App.amb.intensity = 0.40;
  if (App.glassMat) App.glassMat.opacity = (0.14 + 0.18 * lightMul) * (1 - night * 0.55);
}

