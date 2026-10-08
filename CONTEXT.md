# Window — handoff notes

A procedural window onto a landscape. It ships as one HTML file — no assets, no
dependencies beyond Three.js r128 from a CDN — but is edited as many files under
`src/` and joined by a dependency-free build script. Every seed produces a
different place, and the same seed always produces the same place — at any
window size and any detail tier.

- **Deliverable:** `index.html` (~635 KB, one file, built from `src/` and committed)
- **Runtime:** any browser with WebGL2 (it degrades on WebGL1 — see §5)
- **Nothing is fetched but the page and Three.js.** Every texture is drawn on a
  `<canvas>` at build time; every sound is synthesised from noise buffers.

---

## 1. Working on it

Open `index.html` in a browser. That is the whole story for running it — it
works straight from disk and in a sandboxed iframe, which is why it stays one
file.

### The source and the build

```
src/shell.html      the page; @@STYLE@@ and @@APP@@ lines are filled by the build
src/style.css       the stylesheet
src/js/NN-name.js   the script in 36 slices, joined in file-name order inside
                    one function scope ('use strict'); NN follows the numbered
                    sections of §2, with section 7 split by builder
src/shaders/        GLSL: one .vert/.frag per material, shared pieces as .glsl
build.js            node build.js  → writes index.html
                    node build.js --check → fails if index.html is stale
```

**Edit `src/`, then run `node build.js`, and commit `index.html` with it.** CI
fails a push whose `index.html` doesn't match its `src/`.

- The slices are not modules: every top-level `var` and `function` in any file
  is visible to every other, exactly as in one script. Order matters only for
  `var` initialisers that run at load (function declarations hoist), so keep a
  table above the code that reads it at load time, and add new files with a
  number that places them correctly.
- **Shaders** are inlined by the build as a `GLSL` table at the top of the
  script and read as `GLSL['water.frag']`. A line `#include "common.glsl"`
  pulls in a shared piece; the page carries each file once and expands includes
  when it starts. A line starting `///` is a note for the source and is dropped
  — use it freely, it costs nothing in the page or the driver. Where a shader
  needs JavaScript values, write `{{KEY}}` in the file and build it with
  `shader('city.frag', { KEY: value })`, which throws on a missing or unused
  key. The build fails if the script names a shader file that doesn't exist.
- Line endings are LF (`.gitattributes`), because `--check` compares bytes.

### Checking a change

`tests/` holds the checks (Node ≥ 18; its dependencies stay in `tests/`):

```
cd tests && npm install      once
npm run test:static          ~5 s: build --check, node --check on the built
                             script, ESLint (tests/eslint.json) — what CI runs
npm test                     ~15 min: static, then the browser tests
```

- `static.js` — findings already in the code are listed in
  `tests/eslint-known.json` and don't fail; any new error does. Shrink that list,
  never grow it.
- `scenes.js` — every landscape loads with no page error, console error or
  warning, or text in the error strip `#err`. Default: 27 biomes × 2 seeds ×
  `t=afternoon,w=clear,v=bare` and `t=night,w=rainstorm,v=bare`. Narrow it with
  `--biomes urban,desert --seeds 8badf00d --locks "t=golden,w=fair"`, and add
  `--shots out` to write screenshots — then **look** at them.
- `reshuffle.js` — `seed` and `seed#3` give the same scene description (`#note`,
  metre values masked): a reshuffle moves things, it never changes the place.
- `determinism.js` — the same seed at 1600×900 and 2560×1080 builds the same
  world (`App.t − App.elapsed`, wetness, per-mesh instance counts; the window
  frame is cut to the window and is left out).

Browser tests need a WebGL2 Chromium and the network (Three.js comes from a
CDN). The browser is `$BROWSER` (a path), else Playwright's `msedge` channel,
then `chrome`, then its bundled Chromium; Windows uses the GPU through ANGLE,
elsewhere SwiftShader. CI runs only the static half — hosted runners have no GPU.

Not automated, but worth a run after shader work: the same scene loop with
`--disable-webgl2` (a 96×96 texture-resize warning is expected on WebGL1), and a
look at a few scenes at `t=golden`, framed and `s=winter,w=snowfall`.

To read internals from a test, serve a copy with `var App = {};` replaced by
`var App = window.__App = {};` (`tests/lib.js` does this).

### Invariants worth checking by hand

These were each a shipped bug (§7 says which):

- no non-finite heights or uniforms in any landscape;
- every declared feature (`App._features`) inside the view;
- instance buffers filled, or `instanceCount` set to what was filled;
- every texture wraps a canvas or typed array, never a `THREE.Color`;
- no top-level function defined twice (the last one silently wins);
- no `var` read before a same-named redeclaration hoists over it;
- no GLSL identifier on ANGLE's reserved list (`patch`, `sample`, `filter`, …);
- no `texture2D` inside a per-pixel branch;
- repeated builds don't grow the scene's object count;
- the same seed gives the same `App.t`, wetness and placements at 1600×900 and
  2560×1080, and on every detail tier.

### Debugging in the browser

There is an **on-screen error strip**. Anything thrown, any unhandled rejection,
and — importantly — anything three reports through `console.error` appears in a
red bar at the top of the window. Shader compile failures surface that way. Click
to dismiss. This exists because a shader failure is otherwise silent: the ground
simply doesn't draw and you see sky.

---

## 2. Architecture

One script scope in thirteen numbered sections, split across `src/js/` (§1).
The numbering is in the source and the file names; keep it.

```
 1. seeded randomness      RNG, layoutRng, noise (fbm2, ridged, tileFBM, vnoise)
 2. seeds                  seedHex, randomSeed, parseSeed, seedString, scene codes
 3. palettes & presets     palettes, WEATHERS, SEASONS, TIMES, BIOMES (with traits),
                           WINDOW_TYPES, FINISHES, FLOWERS, WIND_NAMES, tintPalette
 4. seed → world params    buildParams: the whole pure-data description
 5. canvas texture factories   every texture, drawn with 2D canvas calls
 6. shared GLSL            shader(); the GLSL itself lives in src/shaders/
 7. the world              every builder, the shadow bakes
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
       ├─ clearWorld / disposeDeep, applyView, sizeWindow
       ├─ makeHeightField(P)  → H(x,z), the analytic ground
       ├─ buildTerrain        → the mesh, and App.Hm, a sampler of the DRAWN mesh
       ├─ H = App.Hm          ← everything after this uses the drawn surface
       ├─ …the other builders
       ├─ shareCommon         → hands common.glsl's uniforms to every material
       ├─ App.t, App.wetness  ← from their own streams, before the bake
       ├─ updateWeather(App.t), bakeShadows → applyShadowMap
       └─ writeSeedToUrl, layout, updateHUD
   ↓  updateWeather(t)   →  drives all shared uniforms each frame
   ↓  loop               →  renderFrame (rebakes when the sun moves > 7.5°)
```

**`buildParams` is pure.** Same seed, same object, no outside state touched. This
is what makes scene codes reproducible. Keep it that way. Anything per-world that
the frame would otherwise recompute (`P.dryClear`, `P.mirageK`) is settled here.

**Builder order in `buildWorld`** (order matters — later builders read
`App._shadows`, `App._boxes` and `App.Hm`):

```
buildSky, buildTerrain, buildWater, buildGrass, buildFlowers,
buildProps (→ city, blocks, bridge, rocks, cacti, walls, near trees,
            hedgerows, telegraph poles…), buildClutter, buildCritters,
buildLandmark, [oasis camp], [buildCascadeFall], buildBoundaries,
buildTerraceWall, buildHerd, buildWaterLife, buildRidges, buildFlyers,
buildMotes, buildDust, buildFalls, buildBirds, buildVisitors, buildPrecip,
buildRoom, lights, shareCommon
```

### Random streams — the subtlest thing here

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
> you don't need. A draw whose value is no longer used stays, with a comment
> (the canyon's old step count, its old river level).

Every other stream is independent, so no feature's draws move another's:

| key | kind | used for |
|---|---|---|
| `/build` + nonce | builder | the shared builder stream `R` builders receive |
| `/build/<feature>` + nonce | builder sub-stream | grass, cacti, talus, near trees, houses, gardens, streets, bridge, walls, hedges, hedgerows, terrace wall, treeline, scatter, band, oasis, riparian, poles, night critters, presets |
| `/<feature>` + nonce | layout, outside `LR` | `/path`, `/canyon`, `/cliff`, `/terrace`, `/valley`, `/dunes`, `/city` |
| `/<feature>` | identity | `/landmark` (presence, kind, size), `/strata`, `/desert`, `/road`, `/cityair`, `/eye`, `/sprite/<kind>/<v>`, `/clutter/<kind>`, `/ground/n`, `/room`, `/frost`, `/fx` |
| `/clock` + nonce | clock | `App.t` (unless a scene code pins it) |
| `/wet` | identity | whether the ground is still wet from rain |

**New randomness in a builder takes a sub-stream of its own**, never more draws
from `R`. Identity choices (what kind of thing) take an identity stream; where it
goes takes a layout one.

The clock moves on a reshuffle (another look at the same place); wet ground does
not (it is the place's weather). Neither depends on any builder's draw count, so
a builder change can no longer shift the scene's hour. A scene code's `pendingT`
replaces the clock draw without touching the wetness.

> **Builder-stream draw counts must not depend on the window or the tier.**
> Scatter angles come from a fixed 16:9 wedge (`BUILD_ASPECT`), features from a
> fixed 9:16 one (`FEATURE_ASPECT`), never the live window; counts that scale
> with the detail tier draw from their own sub-streams; heights never read the
> tier's grid (`terrainCellAt` is sized for the coarsest).

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
| biome | 6 | index into the **sorted** BIOMES keys; 27 used |
| weather | 5 | index into the sorted WEATHERS keys; 10 used |
| time | 3 | 7 used |
| window type | 5 | 32 slots, 9 used |
| finish | 5 | 32 slots, 10 used |
| season | 3 | 4 used |
| view | 2 | window / open / bare |
| night off | 1 | |
| detail tier | 3 | 4 = auto |
| panes | 1 | |
| clock | 16 | whole seconds |
| reserved | 16 | |

> Biome and weather indices are positions in **alphabetically sorted** keys
> (`CODE_LISTS`), so adding or removing a landscape renumbers every one after
> it and old codes decode to the wrong place. Bump `CODE_VERSION` and keep the
> old order for old versions, or switch to an append-only list, when that
> matters. New settings take reserved bits; if something doesn't fit, bump
> `CODE_VERSION` and append a third `-` segment.

Viewer preferences are deliberately **not** in the code. They describe you, not
the scene.

---

## 3. Content inventory

**27 landscapes:** meadow, coast, desert, alpine, savanna, lavender, penthouse,
bridge, hayfield, cascade, canyon, oasis, lakefront, river, flowerfield, marsh,
cliffcoast, terraces, orchard, autumn, moor, tundra, saltflat, blossom,
farmland, urban, fjord.

**Biome traits** on each BIOMES entry: `ground: 'sand'` (coast, desert, canyon,
saltflat, oasis — no season tint on the ground, no puddles, gravel clutter, a
sand-coloured bounce), `dryAir` (desert, canyon, saltflat, oasis, savanna — clear
deep-blue air on a fine day, dust only in wind; with sand ground, varnished rock
and mesa ridges), `farmed` (fields and hedge lines drawn into the far ground),
`mirage` (desert, saltflat). Read the trait; never list biomes again.

**Terrain kinds** (`makeHeightField`): rolling, beach, dunes (an erg of
transverse dunes with a dry wash, or a bajada with mesas), alpine, fjord, lake,
river, marsh, cliff, terrace, slope, salt, urban, gorge, canyon (cut bed by bed
from one strata table), cascade, oasis, skyline. Each returns a closure `H(x, z)`.

**10 weathers:** clear, fair, breezy, overcast, mist, drizzle, rainstorm, storm
(thunder and lightning), snowfall, snowstorm. Rain leaves the ground wet (`uWet`:
darker albedo, a sky sheen, puddles on level soil); it dries by the clock.

**7 times:** night, dawn, morning, midday, afternoon, golden, dusk.
**4 seasons.** `NO_WINTER` marks the tropics, the deserts and the terraces.

**9 window types**, **10 finishes**, **three view modes** (window, window open,
bare). An eye may sit on an upper floor; at ground level the near ground is kept
(a mown lawn, gravel behind a low wall, a bare yard, a marsh bank).

**The city** (urban skyline and penthouse): a street grid (`cityPlan`) of blocks
cut into lots, built to the pavement as podiums and towers with setbacks, crowns
and spires, in facade families (glass curtain wall, brick, precast, stone, plant
room) with storeys and bays that fit; painted streets with lanes, crossings, stop
lines, kerbs and lamp pools; moving traffic in its lanes, parked cars and lorries,
street trees, lamps, red obstacle lights on tall roofs, a power-station chimney.
The skyline's front is a park, a neighbourhood of real houses with garden hedges,
or a river.

**Country:** paths with their own frame (footpath, tramlines, two-rut track, dry
wash, metalled lane with telegraph poles and wires); hedges as continuous banks
of leaves; drystone walls from four templates; post-and-rail; shelter belts;
woods and copses; treelines as woods; field parcels in the far ground.

**Desert:** saguaros built in metres (spears to many-armed), creosote, brittlebush,
cacti, varnished jointed rock, talus fans, a salt pan of raised polygons, a
mirage band on the flats. The canyon's river is painted down its floor channel
(no `P.waterY`).

**Life:** herds (sheep, cattle, goats, deer, camels) with hooves on the ground
and shadows; flyers (butterflies, bees, dragonflies, fireflies, small birds);
critters (lizards by day, scorpions by night, each fading with the sky's night
term); water life (ducks, herons, a moored boat); visitors (a balloon, a boat,
deer, geese); birds overhead.

**Landmarks:** lighthouse, windmill, tower, barn, house, smokestack, silo, cabin,
pagoda, water tank, jetty — with facade grain (boards, logs, render, stone,
brick, corrugated sheet), windows and a door. **Bridges:** suspension, steel
arch, girder, stone, with tarmac, lines, railings and lamps.

---

## 4. The scene graph

Everything is instanced: one mesh per kind, many instances.

### Shared uniforms

`App.U` holds the uniforms every material shares **by reference**: time, sun
direction and colour, ambient, fog (`uFogCol`, `uFogDensity`, `uFogShape`,
`uFogH`, `uFogAway`, `uInScat`), ground bounce (`uGroundCol`), wind, gust, snow,
wetness, mirage, cloud shift, the shadow and near maps, camera position.
`updateWeather` writes them once per frame and the whole scene follows. Add to
`App.U` rather than creating parallel state.

`App.skyU` is the sky's own set (zenith, horizon and `uHorizonAway`, cloud
texture and cover, night, moon phase, rainbow).

**`shareCommon(scene)`** runs once the world is built: every ShaderMaterial gets
the uniforms common.glsl declares (fog shape, in-scatter, ground colour, wetness,
sky cloud mapping, near map) unless it carries its own. A uniform a material does
not carry reads as zero — this is why a material that includes common.glsl
doesn't list them.

### The two height functions

- `H` from `makeHeightField` — the analytic ground, used to build the mesh.
- `App.Hm` — a bilinear sampler of the **mesh that was actually built**.

After `buildTerrain`, `H` is reassigned to `App.Hm`. **Anything that sits on the
ground must use `App.Hm`**, because the mesh cannot resolve fine detail at
distance and an object placed at the analytic height will float.

### Baked shadows

Once per world, and again when the sun moves 7.5°, the sun is marched across the
heightfield into a 320² (448² on high/ultra) texture over `SHADOW` (600 × 630 m in
front). One fetch serves every lit shader:

| channel | holds |
|---|---|
| R | sun: the march, then every caster in `App._shadows` (`[x, y, z, radius, strength, height, near]`) dropped along the light; city boxes (`App._boxes`) raise the heights the march sees |
| G | sky seen (AO): cavity of the ground below its blurred surroundings, plus a contact disc under each caster; once per world (`App._ao`) |
| B | standing water depth, square-root encoded to 8 m (water colour, shore fade) |
| A | how high the shadow climbs each column, `a·640 − 160` m: city walls light from the top down, and a bridge deck and its cars (`bakedSun` with `lift`) are lit above it, not by the gorge floor's shadow. Default 0 = no shadow |

**The near map** (`bakeNear`, `NEAR`): within the 64 m square in front, thin casters
(`App._casters`, capsules: a saguaro's trunk and arms, a bush's mass) are dropped
into a 25 cm, mip-mapped map; `bakedRG` takes the darker of the two. A stem does
not shade its own sunlit side; past the square's edge the coarse map carries the
same capsules.

**`bakeStatic`** caches per world what the sun doesn't move (heights, city
raster, water depth, tallest point) in `App._bake`; a sun rebake only marches.
It is reset in `buildWorld` — set `App._bake = null` if `App._boxes` or
`P.waterY` ever change after the first bake.

GLSL reads: `bakedRG(xz)`, `baked(xz)`, `bakedSun(p, lift)`, `waterDepth(xz)`; all
fade to lit outside the map. Without vertex textures `applyShadowMap` keeps the
1×1 default (lit, no AO, deep, A 0).

### Disposal

`clearWorld` walks the scene and calls `disposeDeep`, which frees geometries,
materials and any textures held in their uniforms, with a seen-list so a shared
texture isn't freed twice; cached textures (`userData.cacheKey`) are skipped.
**Push every mesh you add to `App.propMeshes`** (or assign it to a named `App.*`
slot) or it leaks.

### Animation is free

Traffic, herds, butterflies, fireflies, smoke, water, visitors — all compute
their position from `uTime` in a vertex shader. Per-frame JavaScript is
`updateWeather` and the loop. When adding something that moves, do it there.

---

## 4a. The toolkit

About 190 top-level functions. These are the ones you will reach for.

### Randomness and noise

```js
RNG(seedString)   // R.f() R.range(a,b) R.int(a,b) R.pick(arr)
                  // R.chance(p) R.weighted([[value,weight],…]) R.gauss()
layoutRng(R, L)   // the paired stream — see §2, and read that before using it

fbm2(x, y, seed, octaves)        // −1..1 fractal noise
ridged(x, y, seed, octaves)      // 0..1 with sharp crests
tileFBM(size, seed, oct, base)   // a Float32Array that tiles seamlessly (textures)
ihash(x, y, seed)                // integer hash → 0..1
smoothstep(e0,e1,x)  clamp(v,lo,hi)  lerp(a,b,t)
mixHex(target, hexA, hexB, t)    // writes into a THREE.Color
desat(colour, amount)            // in place
tintPalette(pal, SEA, sandG, soilG)  // a palette as the season colours it
```

### Placement

```js
plantable(P, H, x, z)      // above water, off the path, not too steep, not in a river
slopeAt(H, x, z)
onPathAt(P, x, z)          // 0..1, how strongly a path's surface covers this spot
pathOff(P, x, z)           // distance from the path's centre line
pathCentre(P, u)           // the centre line in the path's own frame
pathBlocked(P, x, z, amt, margin)  // surface past amt, or a track's ruts and crown
inTown(P, x, z, margin)    // inside a city's lots, streets or boxes
clearAt(P, x, z)           // the kept ground under the window
visibleHalfAngle(P)        // the scatter wedge, from a fixed 16:9 view
featureHalfAngle(P)        // the narrower wedge for landmarks, herds, falls, boats
openingFor(W, aspect)      // eye distance and glass width for a screen shape
```

### Geometry

Everything solid is accumulated into `B = { pos: [], nor: [], idx: [], rib: [] }`
and finished once:

```js
pushBox (B, cx,cy,cz, hx,hy,hz, rot)     // half-extents, rotation about Y
pushCyl (B, cx,cy,cz, r0,r1, h, seg)     // r0 bottom radius, r1 top
pushCone(B, cx,cy,cz, r, h, seg, invert, a0)     // a0 start angle (π/4: square roofs)
pushTube(B, path, radii, seg, ribs)      // ribs = {n, amp} pleats the cross-section
limbPath(from, to, ctrl, radius, steps) → {path, radii}
markSmooth(B, start)                     // vertices from start on are a round surface
finishGeo(B) → BufferGeometry            // normals; welds seams only in B.sm ranges
```

Cylinders, cones and tubes mark themselves smooth; boxes don't, so roof hips and
ridges stay crisp. `rib` is a free 0..1 coordinate the solid shader interprets
per object (around a trunk, along a bale, the roof of a facade).

```js
instanceSolid(scene, geometry, items, material)
// items[i] = [x, y, z, size, rotationY, scaleY, scaleZ]

solidMat(U, colour, opts)
//  rib 0|1, ribN        ribbed cross-section     spines, spineCol   cactus spines
//  grain 1 bark, 2 stone, 3 foliage (hedges)     barkN, barkPlate
//  facade {kind, win, bay, roof, doorW, doorH, round}   → grain 4: boards, logs,
//        render, stone, brick, corrugated; windows in bays, a door, roof courses
//  varnish 1            desert varnish and bedding instead of lichen
//  body2, lichen, tipCol/tipMix, nodes, twoTone, spin
//  aoH                  contact-shadow height in metres (ambient only)
//  lift 1               stands above the ground under it: bakedSun(…, 1)
//  thin m               a painted line m wide that fades as it narrows past a pixel
```

Sun, baked shadow and cloud shadow are per fragment in solidMat; ambient and fog
per vertex.

### Shared GLSL

- `tone.glsl` — `tone()`: hue-preserving shoulder, small toe, the grade. Every
  fragment shader ends with it.
- `horizon.glsl` — `horizonMix(dir, away, toward, sunDir)`: the azimuth blend
  the sky, the ridges and `horizonAt` share.
- `common.glsl` (includes `horizon.glsl`) — `h2`/`vn` (sin-free hash, value noise), `bandAA` (box-filtered
  band), `bakedRG`/`baked`/`bakedSun`/`waterDepth`/`nearSun`, `fogT`/`fogAmt`/
  `fogAmtH` (Beer–Lambert blended toward exp² by `uFogShape`, closed-form height
  falloff by `uFogH`), `horizonAt`, `hazeToward`, `hazeAt` (in-scatter blue then
  horizon), `hemi(n, amb)` (sky above, `uGroundCol` below), `gustWave`,
  `cloudShade` (the sky's own clouds projected along the sun), `skyMirror` (sky
  gradient and clouds along a reflected ray, no geometry).
- `sprite.vert.glsl`/`sprite.frag.glsl` — billboard sprites from a 2×2 atlas,
  mirrored and tinted per instance, lit as a rounded crown (`spriteLight`).

- `wander.glsl` — the herds' wandering path and its velocity.

All in `src/shaders/`, pulled in with `#include`. **A shader that includes
`common.glsl` must not define those names again, and a stage that calls them
must include it itself.**

### Textures

`cached(key, make)` — a bounded cache (14), least recently used out; a texture in
use moves to the back. Fair-weather skies reuse eight billowed cloud fields.
`tex(canvas, repeat)`, `cnv(w, h)`. Sprites are 2×2 atlases (`makePropTexture`);
`drawBranches` records its tips and `drawCrown` puts foliage on every one.

### The builders

Inside `buildProps`, kinds dispatch to `buildRocks` (with talus), `buildCacti`
(saguaros from `saguaroTemplate`), `buildWalls`, `buildBridge`, `buildBlocks`
(penthouse), `buildCity`, `buildHedgeLines`, `buildNearTrees` (solid trunks and
spray crowns, handing over to billboards between 36 and 48 m), and
`buildRoadPoles`; everything else is billboards (`propMat`). The city: `cityPlan` (grid, shared with the terrain shader) →
`cityBlock`/`cityBuilding`/`cityHeight` → `cityMesh` (facades) and `buildRoofs`
(plant rooms, tanks, spires), `buildCityHouses`, `cityStreets` (lamps, trees,
traffic), `cityBeacons`, `buildGlows`. `buildTraffic` serves the bridge and the
streets; `buildFlakes` rain, snow, leaves and blossom; `buildSmoke` and
`buildBeacon` attach to landmarks. The bakes: `bakeShadows` → `bakeStatic`,
`bakeAO`, `bakeNear`; `applyShadowMap`.

---

## 4b. State, lifecycle and ordering

### `App` — everything mutable

```
scene camera renderer post              three.js objects
P U skyU albedo                         params, shared uniforms, sky uniforms
H Hm                                    analytic height / sampler of the DRAWN mesh
terrain grass water sky room sash glass glassMat
rain snow leaves dust falls visitor visitorInfo birdMesh landmark
propMeshes[] flowerMeshes[]             disposed on the next build
_shadows[] _casters[] _boxes[] _features[]   build-time scratch, cleared each world
_ao _bake _nearH                        per-world bake caches
t elapsed lastChange _wxT               clocks (_wxT: last updateWeather time)
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
          dryClear mirageK
terrain   terrainKind terrainSeed hillAmp hillFreq waterY
          + whatever the kind needs: riverW gorgeDepth beds strata erg
            chanW fallSegs oasisW storey blockW cityFront …
cover     coverCount coverStyle coverRows rowSpacing rowAngle grassHeight
          flowerCount flowerReach patchiness
light     sunAz sunEl lightMul hazeMul windBase windName treeTint rockCol
features  pathKind pathW pathGauge pathAng bridgeKind boundaryKind herdKind
          herdCount hasBoat waterLife falls dust critters clearKind
framing   win = { type, finish, w, h, cy, dist, arch, panes… }
cached    _city (cityPlan) _inRiver (canyon channel test)
```

### Transitions

```js
transition(build, delay)   // sets a `switching` flag, drops the curtain,
                           // builds behind it, lifts it on the next frame
go(seed)                   // validates the seed, then transitions
applyScene(code)           // decodes a scene code and transitions
```

`transition` refuses to run while another is in flight. **Never call `buildWorld`
from UI code** — call `go()`.

### Render order

three draws all opaque objects, then all transparent ones, each list sorted by
`renderOrder`:

```
opaque        0  solids, city, grass, props
              1  terrain (after what stands on it, so it is never shaded
                 behind them)
            900  the sky sphere (last; early-z skips what's covered)
transparent  −1  water                              4  flyers, cascade, wires
              1  falls                              5  frost on the pane
              2  birds, dust, visitors              6  the glass
              3  smoke, rain, snow                  7  motes, fireflies
              8  beacons, street and roof lights  890+ distance ridges
```

The ridges sit between 2,480 and 2,900 m: beyond the terrain's relief so the two
don't interleave, and inside the sky sphere (3,000 m).

### Quality governor

`applyQuality()` rebuilds post targets and thins instance counts from the tail.
Meshes whose instances make up whole features carry `userData.noTrim` and are
left alone (instanced solids, the city, lamps and beacons, near crowns, boundary
billboards); grass, flowers and scattered props thin.

---

## 4c. Controls, preferences and the shell

**`Prefs`** tries `localStorage`, then a cookie, then memory, so the page works
in a sandboxed iframe. Stored: `panes qTier qAuto autoMin motion pinned tools
sound`. Sound is stored "armed" and starts on the first gesture.

**Quality tiers** measure frame time and step up or down, at most 8 times per
session (`qChanges`), with a settling delay so it can't oscillate.

**Auto-refresh** counts only visible time, then calls `go(randomSeed())`.

**Live clock** maps local time to a solar elevation and picks the matching preset.
`noNight` forces daylight.

**Locks** travel in the seed after `@` (`LOCK_KEYS`). Locked ingredients survive
"new view"; shift-clicking discards them.

**The error strip** (`showError`) catches `window.onerror`, unhandled rejections
and `console.error`. Keep it.

**The 2D overlay** (`#fx`) draws only rain running on the glass. It sits *above*
the WebGL canvas, in front of the window frame — nothing that belongs to the
world may be drawn there.

**Accessibility**: `aria-expanded` and focus management on the panels,
`aria-live` on the scene description, Escape closes, keyboard focus wakes the bar,
`prefers-reduced-motion` disables the camera drift and the flyers, and there is a
`<noscript>` fallback.

---

## 5. Rendering

### The post pipeline

```
scene → multisampled target (4×, supersampled 1.35–1.5×)
      → bright pass (9 taps) → separable blur → composite → screen
composite = box downsample + bloom + film grain   (the grade is in tone())
```

Two things are load-bearing and were both bugs:

- **`stencilBuffer: true`** on the scene target. In three r128 that is what makes
  the depth buffer 24-bit; 16 bits at a 7 km far plane z-fights the near field.
- **`WebGLMultisampleRenderTarget`.** An ordinary offscreen target has no
  anti-aliasing. **If WebGL2 is unavailable the post pass is skipped entirely.**
  Because the grade lives in `tone()`, a frame without post looks the same.

Camera: 52° vertical FOV, near plane **0.3**, far 7000. Terrain is 4800 m across.
The sky sphere has radius 3000.

### Quality tiers

| tier | grid | texture | supersample | post |
|---|---|---|---|---|
| low | 96 | 256 | 1.0 | off |
| medium | 132 | 256 | 1.35 | on |
| high | 180 | 512 | 1.5 | on |
| ultra | 244 | 512 | 1.5 | on |

The world must not depend on the tier (§2): heights use `terrainCellAt` sized
for the coarsest grid.

### Light, fog and haze

- **Tone:** `tone()` runs a shoulder on the brightest channel (a blue sky stays
  blue), eases to per-channel roll-off near white, a small toe, then the grade.
- **Ambient:** `hemi(n, amb)` — sky from above, the ground's bounce (`uGroundCol`,
  from `App.albedo`) from below. AO (map G) dims ambient only, never the sun.
- **Fog:** Beer–Lambert in clear air, closing to an exp² wall in mist and falling
  weather (`uFogShape`), thinning with height (`uFogH`); dry air on a fine day
  takes half the density. `uFogCol` is copied from the sky's horizon, so land and
  sky never seam; `horizonAt` cools it away from a low sun; `hazeAt` adds the
  sky's blue in-scatter first, so dark things go blue with distance.
- **Cloud shadows** are the sky's own cloud texture followed along the sun to a
  1 km deck (`cloudShade`).
- **Water** takes depth from map B (Beer–Lambert body colour, a soft shore), and
  reflects only the sky (`skyMirror`) — no geometry.

### Procedural patterns must be band-limited

A computed pattern has no mip chain. Once its stripes are finer than a pixel it
becomes moiré. Every such pattern measures its own footprint **on both axes**:

```glsl
float bandLimit(float x, float freq){ float w = fwidth(x) * freq; return 1.0 - smoothstep(0.30, 0.85, w); }
float e = max(fwidth(w.x), fwidth(w.z));      // not fwidth(w.x) alone
```

Painted lines and joints use `bandAA`/`sqAA` (exact coverage near, the average
far). Needs `extensions: { derivatives: true }`. Keep `fwidth` out of branches.

Frost is a textured plane inside the sash, behind the glazing bars.

---

## 6. Audio

Opt-in (browsers require a gesture), synthesised, no samples.

```
three noise buffers (pink 19 s, brown 17 s, white 13 s)
   → per-layer biquad + gain + HRTF panner
   → dry bus → room low-pass → master
   → wet send → convolution reverb (2.4 s stereo IR) → compressor → master
```

- **Per-landscape beds**, **wind with a voice** tuned to what it blows through,
  **near / mid / far layers** for rain, surf and rivers.
- **Formant birds** (trill, fluty, gull, coo, hawk), **HRTF placement** for birds,
  frogs, surf, waterfalls, events and visitors.
- **Events:** drips, waves on rock, cars, twigs, ice ticks, frogs, crickets,
  distant thunder.
- **The room:** a 3.4 kHz low-pass while the sash is closed, 17 kHz open.
- One `AudioContext` for the session; layers are replaced, never the context.

---

## 7. Bugs fixed, and the traps behind them

### The shimmer saga

Reported many times as "shimmering at the bottom of the window". It was **five
separate bugs**, and for most of that time I was treating symptoms.

1. **16-bit depth buffer** on the post target. Fix: `stencilBuffer: true`.
2. **No multisampling** on the offscreen target. Fix: `WebGLMultisampleRenderTarget`.
3. **Texture reads inside a per-pixel branch** — the mip level is undefined
   there. Fix: hoist every `texture2D` out of branches.
4. **Alpha-to-coverage on flat grazing-angle cards.** Fix: flat ground cards
   blend; only upright cutouts use coverage.
5. **Single-tap bloom bright pass.** Fix: nine taps across the footprint.

> **Lesson.** When an artefact is reported across many different scenes and always
> in the same *place on screen*, suspect the renderer, not the objects. "Only when
> I move the mouse" means sampling, not motion.

### The river NaN

A `var` redeclared later in the function hoisted over an earlier read, so every
height was NaN and river valleys showed only sky.

### Half the landmarks were invisible

Placed at a fixed 14–58° off axis when only ~36° is visible. → `visibleHalfAngle`,
and features declare themselves into `App._features`.

### The reshuffle desync, three times

`LR` draws made conditionally (§2). Then landmark presence and kind, and the
bridge kind, drawn from the builder stream — which includes the nonce — so a
reshuffle turned a barn into a tower. Identity choices take identity streams.

### The same seed was another place on a wider screen

Scatter angles were drawn over the live window's wedge, and loops ran as many
times as the wedge allowed, so the number of builder draws — and with it every
later placement, `App.t` and the wetness — depended on the window's shape. A
city built in a portrait window also stayed narrow after rotation. → fixed
`BUILD_ASPECT`/`FEATURE_ASPECT` wedges and spread floors (≥ 0.9 rad). The same
trap with the detail tier: a mesa's cliff was sized to the medium grid.

### The clock rode on the builder stream

`App.t` and the wetness were the builder stream's last draws, so any builder
change moved the scene's hour; "burns" were added to hold them still. And a scene
code, which pins the clock, skipped that draw — so the wetness came out different
from the same seed loaded plainly. → `/clock` and `/wet`.

### A list of biomes is a bug waiting

Six copies of "which landscapes are sandy / dry / farmed" drifted (savanna got no
puddles in rain; one palette path used an older tint law). → traits on BIOMES,
one `tintPalette`. Likewise JS numbers copied into GLSL drift: a plant room's
storey was 3.8 m in the shader and 4.0 m as built. → build shader constants from
the JS ones.

### Draw order cost more than any shader

The terrain drew first, so the whole ground was shaded and then hidden behind the
city. `terrain.renderOrder = 1`: urban 68 → 46 ms, penthouse 60 → 25 ms on an
HD 4600.

### Shadows that lie

- The near caster map shaded each caster's own sunlit side, and stopped dead at
  its square's edge with a low sun.
- The bridge deck and its cars took the gorge floor's shadow (→ map A, `lift`).
- Without vertex textures the default map's alpha 255 meant "shadow up to
  480 m": every wall in shade. A default texture is a value; make it mean none.
- The city's 3×3 shadow soften averaged roof heights into the street.
- Herd shadows used `(1 − uShadow)` — strongest in overcast. Check which way a
  term runs before using it (the haze glow had the same inversion with cover).

### The governor cut features in half

Tail-trimming instance counts split anything built from several instances: a
tower without its podium, a hedge dashed. → `userData.noTrim`.

### Others worth knowing

- **Per-frame rates run at the frame rate.** Wetness dried in 12 s on a fast
  screen and a minute on a slow one; snow likewise. Integrate with clock `dt`.
- **`pow` of a negative base is undefined** in GLSL: `pow(max(d, 0.0), k)`.
- **Welding normals across hard edges** smoothed hip roofs into blobs: weld only
  `markSmooth` ranges.
- **A shared GLSL helper is a shared name.** After `vn` moved into common.glsl,
  the cascade's fragment (which didn't include it) failed to compile.
- **A shader-painted feature has no surface.** The canyon's river was a plane
  under the floor that planting and the boat still believed in; JS tests must
  follow the paint (`P._inRiver`).
- **Sub-pixel geometry aliases.** Anything thin must widen with distance and
  fade, or not be drawn (rain, wires, railings, road lines).
- **A product of two sines is a grid**; use cellular noise for jointing. Bark
  runs *up* a tree. **Foliage must sit on wood.** **Sprite aspect must match the
  quad.** **Proportion is identity** (bales 2.5× too long read as pipes).
- **The terrain plane continues through the wall**: the shader discards
  `vW.z > -0.18`.
- **A mesh can't draw what the grid can't resolve**: seat thin things on the
  drawn surface (`App.Hm`), not the analytic one, and offset in the script, not
  with large polygon offsets.

### Process lessons

- **Measure before fixing.** One measurement repeatedly replaced a wrong guess
  (a shader compile failure that looked like floating trees; bloom that looked
  like fog).
- **Assert on every patch anchor**, and check the file actually changed.
- **Test seeds must be valid seeds**, and a `#` in a URL is a fragment — encode it.
- **Look at the screenshots.** A clean error log says nothing about a white
  sky or a missing ground.

---

## 8. Extending it

### A new landscape

1. Add palettes if it needs its own.
2. Add a `BIOMES` entry: label, terrain kind, traits (`ground`, `dryAir`,
   `farmed`, `mirage`), cover, props, weather weights, haze.
3. New terrain shape → a branch in `makeHeightField` returning a closure.
4. Per-scene parameters go in `buildParams` — **unconditional layout draws**, or
   a stream of their own.
5. Sound: the bed map, the wind-voice map and the bird map in `Sound.reset`.
6. Scene codes index the **sorted** keys: a new name renumbers those after it (§2).
7. Run the checks in §1.

### A new object

- Instance it; animate it in the vertex shader from `uTime`.
- Its shaders go in `src/shaders/<name>.vert`/`.frag` (`#include "common.glsl"`
  for fog, light and shadow), read as `GLSL['<name>.vert']`.
- Sit it on `App.Hm`; push it to `App.propMeshes`.
- Draw its randomness from a sub-stream of its own (§2).
- Register a shadow caster in `App._shadows` (thin and near: `App._casters`; a
  solid box: `App._boxes`).
- A **feature meant to be looked at**: inside `featureHalfAngle(P)`, declared in
  `App._features`.
- Whole features in one instanced mesh: `userData.noTrim = true`.
- If the terrain shader paints something the script must also know about, write
  it once in JS and once in GLSL, side by side in comments, and keep the pair in
  lockstep (below).

### JS ↔ GLSL pairs that must change together

| script | shader |
|---|---|
| `pathOff`/`pathCentre`/`onPathAt` | `pathUV`/`pathAmt` |
| `clearAt` | `clearAmt` |
| `cityPlan`, `CITY_LAMP*` | `uCity`, `uCity2`, lamp pools |
| `CITY_FLOOR`/`CITY_LOBBY`/`CITY_PARAPET` | `cityMesh` storeys (generated) |
| `bedTable` | `uBedY`/`uBedH`/`uBedC` (strata) |
| `duneAt`/`ergDuneAt`/`washAt` | the dune term and its wash levelling (`kDn`) |
| `P._inRiver` | `chanD` (the canyon's painted river) |
| `terrainWarp`/`terrainCellAt`/`TERRAIN_SIZE` | the mesh buildTerrain makes |
| `groundLum` (grass) | the terrain's broad octave (same rotation and offset) |

### Worth doing next

1. **Weather that moves through** — cloud building, a shower crossing, mist
   burning off. Biggest gain for watching; highest regression risk (it mutates
   state everything reads and interacts with scene codes). Own pass, own checks.
2. **The window sill** — a plant, a mug, ivy on the frame, a cat.
3. **Distant rain shafts** under far cloud.
4. **Dawn chorus curve** for birds; **bells on the hour** with the live clock.
5. **Place-specific reverb** (a fjord slaps, a snowfield is dead).
6. **An append-only biome list for scene codes**, so a new landscape doesn't
   renumber old codes.
7. Gate the near-map fetch with a uniform where there are no near casters (most
   landscapes) — only if it measures cheaper.

### Would not do

- **More full-screen fragment work.** Supersampling already makes every fragment
  cost 2.25×.
- **Fine high-contrast detail in motion.** That is the entire shimmer history.
- **Mirrored geometry in water.** Tried, went badly. Water and wet ground reflect
  the sky only, and that is enough.
- **Screen-space depth of field.** Tried, was disliked.

---

## 9. Known gaps and rough edges

- **31 meshes set `frustumCulled = false`.** Right for camera-facing clouds and
  view-spanning sets, wasteful for some fixed ones.
- **Auto detail stops adapting after 8 changes** (`App.qChanges < 8`).
- **Scene codes index sorted keys** (§2).
- **Only declared features** (`App._features`) can be checked for visibility.
- **Build time is the real budget.** A warm rebuild's sky dropped from 78 to
  32 ms with the shared cloud fields; the city and the bake are the next costs.
- **The cascade sheet still leans on a −8/−16 polygon offset.**
- **`waterDepth` underestimates right at the waterline** (square-root encoding,
  bilinear filtering). Harmless so far.
- **ESLint still reports a few benign `no-redeclare`s** (`ba2`, `cph`, `sz`,
  `top`, `drop`) and many `no-shadow`s.

---

## 10. Quick reference

```
Seed              8 hex chars                a1b2c3d4
With layout       + #n                       a1b2c3d4#3     (%23 in a URL)
With locks        + @k=v,…                   a1b2c3d4#3@b=fjord,s=winter
Scene code        20 hex - 8 hex             2005…0000-3fa9c21e
URL               ?code=…   or   ?seed=…

Lock keys   b=biome w=weather t=time n=window f=finish s=season v=view x=night
Keyboard    R = new view      C = copy the Ingredients-Seed     Esc = close a panel
Controls    new view · reshuffle · panes · detail · auto · sound · motion
Bottom bar  pin · refresh · controls · ingredients … Ingredients-Seed · copy · paste
Preferences localStorage → cookie → memory, key 'window-prefs-v1'
Caches      TEXCACHE 14 (LRU), FROSTCACHE 8
Maps        SHADOW x −300..300, z −600..30 (320² / 448²)   NEAR 64 m square (25 cm)
```

**Before shipping:** syntax check, every landscape clean on four lock sets with
the screenshots looked at, reshuffle identity 30/30, WebGL1 clean (§1).
