# Window — handoff notes

A procedural window onto a landscape. One HTML file, no build step, no assets,
no dependencies beyond Three.js r128 from a CDN. Every seed produces a different
place, and the same seed always produces the same place.

- **Deliverable:** `window.html` (~418 KB, one file)
- **Runtime:** any browser with WebGL2 (it degrades on WebGL1 — see §5)
- **Nothing is fetched but the page and Three.js.** Every texture is drawn on a
  `<canvas>` at build time; every sound is synthesised from noise buffers.

---

## 1. Working on it

Open `window.html` in a browser. That is the whole story for running it.

For development there is a Node harness that loads the page's script into a
mocked DOM/WebGL environment, so a world can be built and inspected without a
browser.

```
python3 -c "import re; s=open('window.html').read(); \
  open('app.js','w').write(re.findall(r'<script>(.*?)</script>', s, re.S)[-1])"
node --check app.js
node freevars.js
```

> **Edit `window.html`. Never edit `app.js`.** `app.js` is a throwaway extraction
> used only by the checkers, and it is overwritten every time you re-extract.

### The harness

`harness.js` builds a fake `window`, `document` and WebGL renderer, `eval`s the
extracted script, and publishes the internals on `global.__T`. `harness_setup.js`
is the same file truncated before its own test body, so other scripts can
`require('./harness_setup.js')` and get `global.__T`.

To poke at something new from a test, **add it to the `global.__T = { … }` object
at the bottom of `harness.js`**, then regenerate the setup copy:

```
python3 -c "s=open('harness.js').read(); \
  open('harness_setup.js','w').write(s[:s.index('const seeds = [];')])"
```

`harness_srcdoc.js` is the same with `history`/`location` throwing, to prove the
page survives a sandboxed iframe.

`audio_mock.js` is a fake `AudioContext` that records the node graph, so the
sound engine can be tested without audio hardware.

### The test suite

Run all of it before shipping. Almost every one of these exists because a bug got
past me; §7 says which.

| script | what it protects |
|---|---|
| `new_test.js` | builds 900 worlds across every landscape; catches exceptions and non-finite uniforms |
| `nan_test.js` | 66,000 height samples must all be finite |
| `lrsync_test.js` | reshuffling must not change the scene's identity — must read 500/500 |
| `visible_test.js` | every declared feature must lie inside the window's view cone |
| `partial_test.js` | no instance buffer half-filled with garbage at the origin |
| `texcheck.js` | every texture wraps something WebGL can upload |
| `dup_test.js` | no world builder called twice per build |
| `dupdef_test.js` | no top-level name defined twice (dead code masquerading as live) |
| `shadow_test.js` | no `var` that shadows an outer name and is read before it |
| `freevars.js` | no undeclared identifiers |
| `reserved_scan.js` | no GLSL reserved word used as an identifier |
| `extract_shaders.js` + `glslangValidator` | every shader compiles |
| `sandbox_test.js` | boots where `history`/`location` throw |
| `leak_test.js` | repeated builds don't grow the object count |
| `sound_test.js` | the Web Audio graph builds without errors |
| `shuffle_test.js` | layout changes on reshuffle, identity does not |
| `hud_test.js` | no control label overflows its reserved width |
| `ui_test.js`, `feat_test.js`, `season_test.js`, `prefs_test.js` | older feature-level checks |

`extract_shaders.js` inserts `#extension GL_OES_standard_derivatives : enable`
after `#version` for any fragment shader using `fwidth`, because `glslangValidator`
at `#version 100` needs it and three adds it itself at runtime.

### Debugging in the browser

There is an **on-screen error strip**. Anything thrown, any unhandled rejection,
and — importantly — anything three reports through `console.error` appears in a
red bar at the top of the window. Shader compile failures surface that way. Click
to dismiss. This exists because a shader failure is otherwise silent: the ground
simply doesn't draw and you see sky.

---

## 2. Architecture

One IIFE in thirteen numbered sections. The numbering is in the source; keep it.

```
 1. seeded randomness      RNG, layoutRng, noise (fbm2, ridged, tileFBM, vnoise)
 2. seeds                  seedHex, randomSeed, parseSeed, seedString, scene codes
 3. palettes & presets     22 palettes, WEATHERS, SEASONS, TIMES, BIOMES,
                           WINDOW_TYPES, FINISHES, FLOWERS, WIND_NAMES
 4. seed → world params    buildParams: the whole pure-data description
 5. canvas texture factories   every texture, drawn with 2D canvas calls
 6. shared GLSL            GLSL_COMMON, GLSL_TONE — strings pasted into shaders
 7. the world              every builder
 8. layout / framing       window geometry, camera, resize, post-processing
 9. weather over time      updateWeather: drives every uniform from the clock
10. 2D overlay             the canvas above the WebGL view
11. ambient sound          synthesised, opt-in
12. loop                   the animation frame
13. controls               the HUD
```

### Data flow

```
seed string
   ↓  parseSeed          →  { base, nonce, locks, valid }
   ↓  buildParams(P)     →  pure data: biome, weather, colours, counts,
   ↓                        terrain parameters. No Three.js objects.
   ↓  buildWorld
       ├─ clearWorld / disposeDeep
       ├─ makeHeightField(P)  → H(x,z), the analytic ground
       ├─ buildTerrain        → the mesh, and App.Hm, a sampler of the DRAWN mesh
       ├─ H = App.Hm          ← everything after this uses the drawn surface
       ├─ …21 more builders
       ├─ bakeShadows         → a texture every lit shader reads
       └─ writeSeedToUrl
   ↓  updateWeather(t)   →  drives all shared uniforms each frame
   ↓  loop               →  renderFrame
```

**`buildParams` is pure.** Same seed, same object, no outside state touched. This
is what makes scene codes reproducible. Keep it that way.

**Builder order in `buildWorld`** (order matters — later builders read `App._shadows`
and `App.Hm`):

```
clearWorld, applyView, sizeWindow, buildSky, buildTerrain, buildWater,
buildGrass, buildFlowers, buildProps, buildClutter, buildCritters,
buildLandmark, buildBoundaries, buildHerd, buildWaterLife, buildRidges,
buildFlyers, buildMotes, buildDust, buildFalls, buildBirds, buildVisitors,
buildPrecip, buildRoom, updateWeather, applyShadowMap, writeSeedToUrl,
layout, updateHUD
```

### Two random streams — the subtlest thing here

A seed can carry a *layout nonce* (`a1b2c3d4#3`). Reshuffling increments it: it
rearranges **where** things are without changing **what place this is**.

```js
var R  = RNG(base);                                      // identity
var L  = nonce ? RNG(base + '/layout/' + nonce) : null;  // layout
var LR = layoutRng(R, L);                                // layout draws
```

`layoutRng` calls **both** streams and returns `L`'s value when a nonce exists.
Consuming from `R` on every layout draw is what keeps identity aligned.

> **This only works if the NUMBER of `LR` calls is identical for every nonce.**
> A layout draw made conditionally on a layout result desynchronises `R`, and
> reshuffling then changes the scene itself.
>
> ```js
> var want = LR.chance(0.45);
> var a = LR.range(-16, 16), b = LR.range(0, 6.283);   // ALWAYS drawn
> if (want) { P.x = a; P.y = b; }                      // conditionally used
> ```
>
> Loops are the same trap — iterate a fixed maximum and `continue` past the ones
> you don't need. `lrsync_test.js` must read 500/500.

Other seeded streams, each independent so they don't shift each other:
`base + '/build'` (world building), `/ground/n` (ground textures), `/room`,
`/frost`, `/layout/n`.

### Seeds, locks and scene codes

A seed is **32 bits, eight hex characters**. One to eight hex chars are accepted
and left-padded; anything else is rejected outright (`go()` returns false and the
field flashes red).

```
a1b2c3d4                          plain
a1b2c3d4#3                        with a layout nonce
a1b2c3d4#3@b=fjord,s=winter       with locked ingredients
```

Lock keys: `b`=biome `w`=weather `t`=time `n`=window `f`=finish `s`=season
`v`=view `x`=night.

A **scene code** pins the exact moment as well as the place:

```
20058440001813480000-3fa9c21e
└──── settings ────┘ └ seed ┘
```

Both halves are pure hex, so `-` can never collide and the whole thing is
URL-safe unescaped. `?code=…` is read on load and rewritten as the scene runs
(every 15 s, so a copied URL is never more than a few seconds stale).

| field | bits | notes |
|---|---|---|
| version | 4 | currently 2; a decoder refuses anything higher |
| layout nonce | 8 | |
| biome | 6 | 64 slots, 28 used |
| weather | 5 | 32 slots, 10 used |
| time | 3 | 7 used |
| window type | 5 | 32 slots, 9 used |
| finish | 5 | 32 slots, 10 used |
| season | 3 | 4 used |
| view | 2 | window / open / bare |
| night off | 1 | |
| detail tier | 3 | 4 = auto |
| panes | 1 | |
| clock | 16 | seconds |
| reserved | 16 | |

New landscapes take the next biome index. New settings take reserved bits. If
something doesn't fit, bump `CODE_VERSION` and append a third `-` segment — old
codes still decode, because a decoder reads only what its version defines.

Viewer preferences are deliberately **not** in the code. They describe you, not
the scene.

---

## 3. Content inventory

**28 landscapes:** meadow, coast, desert, alpine, savanna, lavender, penthouse,
bridge, hayfield, cascade, canyon, oasis, lakefront, river, flowerfield, marsh,
cliffcoast, terraces, orchard, autumn, moor, tundra, saltflat, bamboo, blossom,
farmland, urban, fjord.

**18 terrain kinds** (`makeHeightField`): rolling, beach, dunes, alpine, fjord,
lake, river, marsh, cliff, terrace, slope, salt, urban, gorge, canyon, cascade,
oasis, skyline. Each returns a closure `H(x, z)`.

**10 weathers:** clear, fair, breezy, overcast, mist, drizzle, rainstorm, storm
(thunder and lightning), snowfall, snowstorm.

**7 times:** night, dawn, morning, midday, afternoon, golden, dusk.
**4 seasons.** `NO_WINTER` marks the tropics, the oasis and the canyon.

**9 window types:** georgian sash, cottage sash, steel casement, crittall grid,
picture window, arched casement, chapel arch, farmhouse light, garden door.
**10 finishes:** painted white, old cream, sage green, dove grey, powder blue,
black steel, dark bronze, walnut, weathered oak, oxblood.

**Three view modes:** window (closed), window open (the sash swings on its hinge
and the sound opens up), and bare (no frame at all).

**Life:** herds (sheep, cattle, goats, deer, camels), flyers (butterflies, bees,
dragonflies, fireflies, small birds), critters (lizards, scorpions), water life
(ducks, herons, a moored boat), visitors that cross over minutes (a balloon, a
boat, deer, geese), and birds overhead.

**Landmarks:** lighthouse, windmill, tower, barn, silo, cabin, pagoda, water
tank, jetty. Barns and cabins smoke; lighthouses sweep a beacon.

**Field boundaries:** hedge, drystone wall, post-and-rail fence, shelter belt.

---

## 4. The scene graph

Everything is instanced. A typical world is **20–34 draw calls** and up to 56,000
instances.

### Shared uniforms

`App.U` holds the uniforms every material shares **by reference**: time, sun
direction and colour, ambient, fog, wind, gust, snow, shadow map, haze factor,
camera position. `updateWeather` writes them once per frame and the whole scene
follows. Add to `App.U` rather than creating parallel state.

`App.skyU` is the sky's own set (zenith, horizon, cloud cover, night, moon phase,
rainbow strength).

### The two height functions

- `H` from `makeHeightField` — the analytic ground, used to build the mesh.
- `App.Hm` — a bilinear sampler of the **mesh that was actually built**.

After `buildTerrain`, `H` is reassigned to `App.Hm`. **Anything that sits on the
ground must use `App.Hm`**, because the mesh cannot resolve fine detail at
distance and an object placed at the analytic height will float.

### Baked shadows

Once per world, and again when the sun moves 7.5°, the sun is marched across the
heightfield into a 320²–448² texture covering the near 600 m; then every tree,
rock, building, cactus, house and bale drops its crown along the light into the
same texture. Every lit shader samples it via `baked(xz)` from `GLSL_COMMON`.
**Zero per-frame cost.** Register casters by pushing `[x, y, z, radius, strength,
height]` into `App._shadows`.

### Disposal

`clearWorld` walks the scene and calls `disposeDeep`, which frees geometries,
materials and any textures held in their uniforms, with a seen-list so a shared
texture isn't freed twice. **Push every mesh you add to `App.propMeshes`** (or
assign it to a named `App.*` slot) or it leaks. `leak_test.js` checks this.

### Animation is free

Per-frame JavaScript is **0.043 ms** of a 16.7 ms budget. Traffic, herds,
butterflies, fireflies, smoke, water, visitors — all compute their position from
`uTime` in a vertex shader. When adding something that moves, do it there.

---

---

## 4a. The toolkit

145 top-level functions. These are the ones you will reach for.

### Randomness and noise

```js
RNG(seedString)   // R.f() R.range(a,b) R.int(a,b) R.pick(arr)
                  // R.chance(p) R.weighted([[value,weight],…]) R.gauss()
layoutRng(R, L)   // the paired stream — see §2, and read that before using it

fbm2(x, y, seed, octaves)        // −1..1 fractal noise
ridged(x, y, seed, octaves)      // 0..1 with sharp crests: mountains, dunes
tileFBM(size, seed, oct, base)   // a Float32Array that tiles seamlessly (textures)
ihash(x, y, seed)                // integer hash → 0..1
smoothstep(e0,e1,x)  clamp(v,lo,hi)  lerp(a,b,t)
mixHex(target, hexA, hexB, t)    // writes into a THREE.Color
desat(colour, amount)            // in place
```

### Placement

```js
plantable(P, H, x, z)      // above water, off the path, not too steep
onPathAt(P, x, z)          // 0..1, how strongly a path covers this spot
visibleHalfAngle(P)        // radians visible through the glass — see §7
```

### Geometry

Everything solid is accumulated into `B = { pos: [], nor: [], idx: [], rib: [] }`
and finished once:

```js
pushBox (B, cx,cy,cz, hx,hy,hz, rot)     // half-extents, rotation about Y
pushCyl (B, cx,cy,cz, r0,r1, h, seg)     // r0 bottom radius, r1 top
pushCone(B, cx,cy,cz, r, h, seg, invert)
pushTube(B, path, radii, seg, ribs)      // ribs = {n, amp} pleats the cross-section
                                         //   {n:16, amp:0.09}  a saguaro
                                         //   {n:2,  amp:0.62}  a flat prickly-pear pad
limbPath(from, to, ctrl, radius, steps) → {path, radii}   // a tapering curve
finishGeo(B) → BufferGeometry            // computes vertex normals
```

`rib` is a free 0..1 coordinate the solid shader interprets per object: around
the trunk for bark, along the axis for a hay bale's net wrap, around the section
for cactus ribs. Choose it to suit the pattern you want.

```js
instanceSolid(scene, geometry, items, material)
// items[i] = [x, y, z, size, rotationY, scaleY, scaleZ]   (last two default to 1)

solidMat(U, colour, opts)
//  rib   0|1    ribbed cross-section        ribN       ribs around
//  grain 0|1|2  1 = bark, 2 = stone         barkN      bark ridges
//  spines 0..2  spine density               barkPlate  bark plate height
//  body2        second tone, mottled in     lichen     lichen colour
//  tipCol / tipMix   colour toward the top  spineCol   nodes
```

### Textures

`cached(key, make)` — a bounded cache (14 ground, 14 cloud, 8 frost).
`tex(canvas, repeat)` — a CanvasTexture at the hardware's maximum anisotropy.
`cnv(w, h)` — a canvas.

Every `make*Texture` draws with 2D canvas calls: `makeGroundTexture`,
`makePropTexture` (tree and shrub sprites), `makeFlowerTexture` (a four-view
atlas), `makeSprayTexture`, `makeClutterTexture`, `makeCritterTexture`,
`makeHerdTexture`, `makeFlyerTexture`, `makeWaterLifeTexture`,
`makeCloudTexture`, `makeGlassTexture`, `makeFrostCanvas`, `makeWallTexture`,
`makeFinishTexture`, `makeVisitorTexture`, `makeBirdTexture`, `makeSoftDot`.

Foliage: `drawBranches` recurses and **records its tip positions**; `drawCrown`
lays sprays across the crown *and* one at every recorded tip, so no limb is bare.

### The builders

`buildWorld` calls these in order. `dup_test.js` fails if any is called twice.

```
clearWorld  applyView  sizeWindow
buildSky  buildTerrain  buildWater  buildGrass  buildFlowers
buildProps  buildClutter  buildCritters  buildLandmark
buildBoundaries  buildHerd  buildWaterLife  buildRidges
buildFlyers  buildMotes  buildDust  buildFalls  buildBirds
buildVisitors  buildPrecip  buildRoom
updateWeather → applyShadowMap → writeSeedToUrl → layout → updateHUD
```

Inside `buildProps`, prop kinds dispatch to `buildRocks`, `buildCacti`,
`buildBamboo`, `buildWalls`, `buildBales`, `buildBridge`, `buildBlocks`,
`buildCity` / `cityMesh` / `buildRoofs`, and `buildNearTrees` for anything within
42 m. `buildFlakes` is the shared engine for rain, snow, leaves and blossom.
`buildTraffic` lays vehicles along a line and is used by both the bridge and the
city streets. `buildSmoke` and `buildBeacon` attach to landmarks.

---

## 4b. State, lifecycle and ordering

### `App` — everything mutable

```
scene camera renderer post              three.js objects
P U skyU                                params, shared uniforms, sky uniforms
H Hm                                    analytic height / sampler of the DRAWN mesh
terrain grass water sky room sash glass glassMat
rain snow leaves dust falls visitor visitorInfo birdMesh
propMeshes[] flowerMeshes[]             disposed on the next build
_shadows[] _features[] _cardMat         build-time scratch, cleared each world
landmark frostMat frostTarget
t elapsed lastChange                    clocks
qTier qAuto qChanges qSettle frameAvg maxAniso
clearPanes mouseMotion pinned showTools wantSound reduceMotion
liveClock noNight autoMin bare
flash flashAgain nextFlash bowTarget wetness    weather events
camDist pointer bakedSun lastCam
pendingT urlOk urlTick codeTick refreshCode
```

### `P` — the world description

```
identity  seed base nonce locks biomeKey biome weatherKey weather
          seasonKey season timeA timeB timeMix grass species props
terrain   terrainKind terrainSeed hillAmp hillFreq waterY shoreZ
          + whatever the kind needs: riverW gorgeDepth canyonSteps
            fallSegs oasisW storey blockW …
cover     coverCount coverStyle coverRows rowSpacing rowAngle rowColour
          grassHeight flowerCount flowerReach patchiness
light     sunAz sunEl lightMul hazeMul windBase windName treeTint
features  pathKind pathW pathGauge landmarkName boundaryKind herdKind
          herdCount hasBoat waterLife falls dust critters
framing   win = { type, finish, w, h, cy, dist, arch, panes… }
```

### Disposal

`clearWorld` disposes geometries, materials **and textures** for
`App.propMeshes`, `App.flowerMeshes` and every named mesh, with a seen-list so
nothing is disposed twice. **Anything added to the scene must be pushed to
`App.propMeshes`, or it leaks.** `leak_test.js` guards this.

### Transitions

```js
transition(build, delay)   // sets a `switching` flag, drops the curtain,
                           // builds behind it, lifts it on the next frame
go(seed)                   // validates the seed, then transitions
applyScene(code)           // decodes a scene code and transitions
```

`transition` refuses to run while another is in flight. **Never call `buildWorld`
from UI code** — call `go()`. A build started while one is running is retried a
few times rather than reported as invalid (this was a real bug in the paste box).

### Render order

Transparent and additive things need explicit ordering:

```
   0  terrain, solids, grass          5  frost on the pane
   1  water                           6  the glass
   2  birds, precipitation            7  motes, fireflies
   3  smoke                           8  the lighthouse beacon
   4  waterfall sheets, flyers      890+ distance ridges
                                     900  the sky sphere
```

The ridges sit between 2,480 and 2,900 m: beyond the terrain's own relief
(±2,400 m) so the two don't interleave, and inside the sky sphere (3,000 m) or
the sky would be nearer than the ridge and cover it.

---

## 4c. Controls, preferences and the shell

**`Prefs`** tries `localStorage`, then a cookie, then memory, so the page works
in a sandboxed iframe. Stored: `panes qTier qAuto autoMin motion pinned tools
sound`. Sound is stored "armed" and starts on the first gesture, because browsers
require one.

**Quality tiers** measure frame time and step up or down, at most 8 times per
session (`qChanges`), with a settling delay so it can't oscillate. `Q()` returns
the current tier; `applyQuality()` rebuilds the post targets and sheds instances.

**Auto-refresh** counts only visible time, then calls `go(randomSeed())`.

**Live clock** maps local time to a solar elevation and picks the matching preset,
so the window tracks your actual day. `noNight` forces daylight.

**Locks** travel in the seed after `@`. `LOCK_KEYS` is the map:

```
b = biome   w = weather   t = time    n = window
f = finish  s = season    v = view    x = night
```

Locked ingredients survive "new view"; shift-clicking discards them.

**The error strip** (`showError`) catches `window.onerror`, unhandled rejections,
**and `console.error`** — which is how three.js reports shader compile failures.
Without it a shader error is silent unless the console is open. It earned its
place during the shimmer work; keep it.

**The 2D overlay** (`#fx`) draws only rain running on the glass now. It sits
*above* the WebGL canvas, so anything drawn there appears in front of the window
frame — which is exactly why the light motes had to move into the 3D scene.

**Accessibility**: `aria-expanded` and focus management on the panels, `aria-live`
on the scene description, Escape closes, keyboard focus wakes the bar,
`prefers-reduced-motion` disables the camera drift and the flyers, and there is a
`<noscript>` fallback.

---

## 5. Rendering

### The post pipeline

```
scene → multisampled target (4×, supersampled 1.35–1.5×)
      → bright pass (9 taps) → separable blur → composite → screen
composite = box downsample + bloom + contrast + colour grade + film grain
```

Two things are load-bearing and were both bugs:

- **`stencilBuffer: true`** on the scene target. In three r128 that is what makes
  the depth buffer 24-bit. Without it you get 16 bits, and at a 7 km far plane
  that resolves depth to 2 cm at 8 m — everything in the near field z-fights.
- **`WebGLMultisampleRenderTarget`.** An ordinary offscreen target has no
  anti-aliasing at all. **If WebGL2 is unavailable the post pass is skipped
  entirely** rather than trading anti-aliasing for bloom — so on WebGL1 you get
  no bloom and no grain, but a clean image.

Camera: 52° vertical FOV, near plane **0.3** (not 0.05 — precision), far 7000.
Terrain is 4800 m across. The sky sphere has radius 3000 — anything placed beyond
that is hidden behind the sky.

### Quality tiers

| tier | grid | texture | supersample | post |
|---|---|---|---|---|
| low | 96 | 256 | 1.0 | off |
| medium | 132 | 256 | 1.35 | on |
| high | 180 | 512 | 1.5 | on |
| ultra | 244 | 512 | 1.5 | on |

Auto mode measures frame time and steps up or down, but **stops after 8 changes**
so it can't oscillate forever.

### Tone and haze

Every fragment shader ends with `tone()`: `1 − exp(−1.42c)` plus a little
saturation, giving highlights a shoulder instead of a hard clip. Applied at 28
sites.

The fog colour is **derived from the sky's horizon colour**
(`uFogCol.copy(uHorizon)`). They used to come from separate palette entries,
which left a visible seam where land met sky. Change one and the other follows.

`hazeToward()` brightens haze toward the sun, scaled by `uHazeK`, which is itself
scaled by how much sun is actually showing through cloud.

### Procedural patterns must be band-limited

A computed pattern has no mip chain. Once its stripes are finer than a pixel it
becomes moiré. Every such pattern measures its own screen-space frequency:

```glsl
float bandLimit(float x, float freq){ float w = fwidth(x) * freq; return 1.0 - smoothstep(0.30, 0.85, w); }
```

Needs `extensions: { derivatives: true }` on the material. Used for cactus ribs,
spine rows, rock speckle, bark fissures, crop rows and canyon strata.

### The 2D overlay

`#fx` is a canvas above the WebGL view carrying rain on the glass. It is *above
everything*, including the window frame — so nothing that belongs to the world
may be drawn there. Light motes used to be, and looked like they were inside the
room; they are 3D now and the overlay does little else.

Frost is a textured plane inside the sash, **behind the glazing bars**, so the
bars occlude it and it reads as being on the outside of the glass.

---

## 6. Audio

Opt-in (browsers require a gesture), synthesised, no samples.

```
three noise buffers (pink 19 s, brown 17 s, white 13 s)
   → per-layer biquad + gain + HRTF panner
   → dry bus → room low-pass → master
   → wet send → convolution reverb (2.4 s stereo IR) → compressor → master
```

- **Per-landscape beds.** A moor roars (brown, 0.26); a forest is near silence
  until a gust (white hiss, 0.03); a desert is 0.02. Sharing one bed made every
  place sound like the sea.
- **Wind has a voice** — resonances tuned to what it blows through: pines hiss at
  2.7 kHz, open grass roars at 150 Hz, a city corner whistles at 855 Hz.
- **Near / mid / far layers** for rain, surf and rivers.
- **Formant birds:** a sawtooth pulse train through two sweeping resonators with
  breath noise. Voices: trill, fluty, gull, coo, hawk. Oscillators alone sound
  like a synthesiser.
- **HRTF placement** for birds, frogs, surf, waterfalls, events and visitors.
- **Events:** drips off the frame, waves on rock, cars passing, twigs, ice ticks,
  frogs, crickets, distant thunder.
- **The room:** a 3.4 kHz low-pass between world and listener while the sash is
  closed, opening to 17 kHz when you open it.
- One `AudioContext` for the session; layers are replaced, never the context.

---

## 7. Bugs fixed, and the traps behind them

### The shimmer saga

Reported many times as "shimmering at the bottom of the window". It was **five
separate bugs**, and for most of that time I was treating symptoms — calming the
grass, reducing motion, blurring things — while the real causes stood untouched.

1. **16-bit depth buffer** on the post target → everything in the near field
   z-fought. Fix: `stencilBuffer: true`.
2. **No multisampling** on the offscreen target. Adding bloom had silently turned
   anti-aliasing off for the whole scene. Fix: `WebGLMultisampleRenderTarget`.
3. **Texture reads inside a per-pixel branch.** GLSL leaves the mip level
   *undefined* there; some drivers pick a different one every frame. Fix: hoist
   all `texture2D` calls out of branches — a scan enforces it.
4. **Alpha-to-coverage on flat grazing-angle cards.** Partial alpha becomes a
   dither pattern that rearranges on every sub-pixel move. Fix: flat ground cards
   blend; only upright cutouts use coverage.
5. **Single-tap bloom bright pass** reading a supersampled image into a
   quarter-size target — small bright things flickered in and out of one sample.
   Fix: nine taps across the footprint.

Two that *looked* like shimmer but weren't: dark grass spikes standing through
white snow (deep snow should bury grass and didn't), and pale litter cards on
green grass mistaken for puddles (blossom litter fell back to a straw colour
instead of petal pink).

> **Lesson.** When an artefact is reported across many different scenes and always
> in the same *place on screen*, suspect the renderer, not the objects. "Only when
> I move the mouse" means sampling, not motion.

### The river NaN

```js
var cx = off + bend * (...);      // 'off' = the river's offset
var off = Math.abs(x - cx);       // ← redeclared, so it hoists
```

`var` hoists, so the first line read `undefined` and every height became NaN. The
entire terrain mesh vanished and river valleys showed nothing but sky. This
shipped for a long time, and I misattributed an early report of it to bloom.
→ `shadow_test.js` (scope-aware, acorn) and `nan_test.js`.

### Half the landmarks were invisible

Landmarks were placed at a fixed 14–58° off the view axis. You can only see about
**36°** either side through the glass — `atan(halfWindowWidth / cameraDistance)`.
130 of 258 landmarks sat behind the wall. The same mistake was in waterfalls,
herds and boats. → `visibleHalfAngle(P)`, and builders now *declare* features into
`App._features` so `visible_test.js` checks facts rather than guessing.

### The reshuffle desync

Described in §2. Identity survived reshuffle in only 176 of 500 seeds. Caught
again immediately when I reintroduced it in the waterfall code.

### A duplicate implementation

A whole second set of builders (boundaries, herds, water life, roofs, ridges,
~26 KB) was written over an existing set I hadn't noticed. Function declarations
hoist and the last wins, so the first copy was dead code that read as live.
→ `dupdef_test.js`.

### A GLSL reserved word

`patch` is legal in GLSL ES 1.00, which my validator ran, but ANGLE also reserves
*future* keywords. The terrain shader failed to compile in Chrome and the ground
simply didn't render. → `reserved_scan.js` checks ANGLE's full list: `flat`,
`sample`, `filter`, `input`, `output`, `buffer`, `patch` and ~40 others.

### A `THREE.Color` where a canvas belonged

```js
var c = cnv(S, S);           // the canvas
for (…) { var c = colour;    // same function scope: overwrites the canvas
```

`texImage2D` then rejected a colour object as an image, and every pine-bearing
landscape crashed. → `texcheck.js`.

### Bloom burning a scene to white

The bright pass glowed everything above 60% luminance. Overcast drizzle fog sits
at 77%, so the whole frame lit up and burned out. Threshold is now the top 14%.

### Others worth knowing

- **Sub-pixel geometry aliases.** Rain streaks were 0.3 px at 45 m. Anything thin
  must widen with distance and fade, or not be drawn.
- **A product of two sines is a grid.** Rock "cracks" from `sin(x)·sin(z)` read as
  woven banding. Cellular noise gives irregular jointing.
- **A grid of horizontal bands on a cylinder is a road marking.** That was the
  first bark shader. Bark runs *up* a tree.
- **Foliage must sit on wood.** Leaves were drawn inside an ellipse while branches
  wandered outside it, leaving bare sticks. Branch ends are recorded during
  drawing and each gets its own foliage.
- **Sprite aspect must match the quad.** Flowers were drawn on a square canvas and
  pasted onto a 0.8 × 1.5 quad — every one stretched 1.9×.
- **Proportion is identity.** Hay bales 2.5× too long read as pipes, not bales.
- **The terrain plane continues through the wall.** The terrain shader discards
  anything with `vW.z > -0.18`.
- **A mesh can't draw what the grid can't resolve.** Near-vertical waterfall
  pitches were smoothed into ramps, leaving the water floating 11 m off the rock.

### Process lessons

- **Measure before fixing.** Floating trees looked like a mesh-resolution problem
  and were a shader compile failure. A white screen looked like fog and was bloom.
  Cylinders in a field looked like a mystery object and were mis-proportioned
  bales. In each case one measurement replaced a wrong guess.
- **Assert on every patch anchor.** A silent no-op edit ships a "fix" that changes
  nothing. When an assert fires mid-script, *nothing* is written — re-run the
  whole patch, don't assume the earlier parts landed.
- **Check the file actually changed** (size, or grep for the new code).
- **Cutting text by searching for the next `}` is dangerous.** I twice deleted
  more than intended, once removing the end of `FX` and the start of `Sound`.
  `freevars.js` caught it both times.
- **Test seeds must be valid seeds.** Two tests silently passed against a single
  degenerate world because their seeds (`'s-1'`) stopped being hex.

---

## 8. Extending it

### A new landscape

1. Add palettes if it needs its own.
2. Add a `BIOMES` entry: label, terrain kind, cover, props, weather weights, haze.
3. New terrain shape → a branch in `makeHeightField` returning a closure.
4. Per-scene parameters go in `buildParams` — **unconditional layout draws**.
5. Sound: add it to the bed map, the wind-voice map and the bird map in
   `Sound.reset`.
6. It takes the next biome index in the scene code automatically.
7. Run the suite.

### A new object

- Instance it; one mesh, many instances.
- Animate it in the vertex shader from `uTime`.
- Sit it on `App.Hm`, not the analytic height.
- Push it to `App.propMeshes` so it is disposed.
- Register a shadow caster in `App._shadows` if it is solid.
- If it is a **feature meant to be looked at**, place it within
  `visibleHalfAngle(P)` and declare it in `App._features`.
- Fill instance buffers completely, or set `instanceCount` to what you actually
  filled.

### Worth doing next

1. **Weather that moves through** — cloud building, a shower crossing, mist
   burning off over ten minutes. The biggest gain for *watching* rather than
   glancing; everything downstream already reads the weather uniforms. **Highest
   regression risk on this list:** it mutates state everything reads and it
   interacts with scene codes, which pin a moment. Give it its own pass and tests.
2. **The window sill** — a plant, a mug, ivy on the frame, a cat. The frame is the
   one constant across all 28 scenes and it is inert.
3. **Telegraph poles** with catenary wires receding to the horizon.
4. **Distant rain shafts** — curtains of rain under a far cloud.
5. **Dawn chorus curve** for birds; **bells on the hour** with the live clock.
6. **Place-specific reverb** (a fjord slaps, a snowfield is dead, a city is hard).

### Would not do

- **More full-screen fragment work.** Supersampling already makes every fragment
  cost 2.25×.
- **Fine high-contrast detail in motion.** That is the entire shimmer history.
- **Water reflections.** Tried, went badly; calm water is better.
- **Screen-space depth of field.** Tried, was disliked, and it blurred by screen
  position rather than distance.

---

## 9. Known gaps and rough edges

- **28 meshes still set `frustumCulled = false`.** Correct for camera-facing
  instanced clouds spanning the view, wasteful for the fixed ones.
- **Auto detail stops adapting after 8 changes** (`App.qChanges < 8`).
- **The oasis camp and city houses are placed with `R`, not `LR`,** so they don't
  move on reshuffle. Harmless but inconsistent.
- **`visible_test.js` only checks declared features.** A new feature is protected
  only once it declares itself into `App._features`.
- **Build time is the one real budget:** 227 ms average, ~800 ms before it's felt.
  Draw calls and instance counts have an order of magnitude of headroom.
- **`ui_test.js`, `feat_test.js`, `season_test.js`, `prefs_test.js`** are older and
  less maintained than the rest; treat their expectations with suspicion before
  their results.

---

## 10. Quick reference

```
Seed              8 hex chars                a1b2c3d4
With layout       + #n                       a1b2c3d4#3
With locks        + @k=v,…                   a1b2c3d4#3@b=fjord,s=winter
Scene code        20 hex - 8 hex             2005…0000-3fa9c21e
URL               ?code=…   or   ?seed=…

Lock keys   b=biome w=weather t=time n=window f=finish s=season v=view x=night
Keyboard    R = new view      C = copy the Ingredients-Seed     Esc = close a panel
Controls    new view · reshuffle · panes · detail · auto · sound · motion
Bottom bar  pin · refresh · controls · ingredients … Ingredients-Seed · copy · paste
Preferences localStorage → cookie → memory, key 'window-prefs-v1'
            stores: panes, tools, pinned, sound, motion, autoMin, qTier, qAuto
Caches      TEXCACHE 14 entries, FROSTCACHE 8
```

**Before shipping:**

```
node --check app.js && node freevars.js && node shadow_test.js &&
node dupdef_test.js && node dup_test.js && node reserved_scan.js &&
node extract_shaders.js && for f in shaders/*; do glslangValidator $f; done &&
node lrsync_test.js && node nan_test.js && node visible_test.js &&
node partial_test.js && node texcheck.js && node new_test.js &&
node sandbox_test.js && node leak_test.js && node sound_test.js
```
