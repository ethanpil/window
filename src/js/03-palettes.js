/* ============================================================
   3. palettes & presets
   ============================================================ */
var TIME_ORDER = ['night', 'dawn', 'morning', 'midday', 'afternoon', 'golden', 'dusk'];
var TIMES = {
  night:     { label: 'night',         elev: -13, zen: '#080f26', hor: '#17203c', sun: '#a8bcdd', sunI: 0.17, amb: '#243052', ambI: 0.30, cl: '#39445f', cd: '#161d33', fog: '#1a2238' },
  dawn:      { label: 'first light',   elev: 7,  zen: '#4b6a9a', hor: '#eeb494', sun: '#ffd2a4', sunI: 0.62, amb: '#7386a6', ambI: 0.50, cl: '#ffd6bd', cd: '#8b8095', fog: '#d9bfb1' },
  morning:   { label: 'mid-morning',   elev: 29, zen: '#3f7ec9', hor: '#c3daea', sun: '#fff2d8', sunI: 0.90, amb: '#93b2cd', ambI: 0.54, cl: '#fdfdfb', cd: '#a7b1bf', fog: '#c9dae6' },
  midday:    { label: 'high noon',     elev: 61, zen: '#2d70cc', hor: '#b3d0e5', sun: '#fffdf4', sunI: 1.00, amb: '#a2c0d9', ambI: 0.58, cl: '#ffffff', cd: '#9aa5b4', fog: '#c6dae6' },
  afternoon: { label: 'afternoon',     elev: 37, zen: '#3777c4', hor: '#ccdae2', sun: '#fff0cd', sunI: 0.92, amb: '#98b4c9', ambI: 0.55, cl: '#fcfaf4', cd: '#a3aab7', fog: '#cfdae0' },
  golden:    { label: 'late light',    elev: 12, zen: '#436fa4', hor: '#f2c68f', sun: '#ffc582', sunI: 0.82, amb: '#9ba0b0', ambI: 0.60, cl: '#ffd6a6', cd: '#96808b', fog: '#e5c8a6' },
  dusk:      { label: 'last of the day', elev: 3, zen: '#31446e', hor: '#e0947a', sun: '#ff9a62', sunI: 0.52, amb: '#6d7091', ambI: 0.44, cl: '#eaa287', cd: '#5e5a76', fog: '#c99b8c' }
};

/* cover: cloud threshold (high = clear sky). lightMul dims the sun under cloud.
   fogShape: 0 clear air (Beer-Lambert), 1 a wall of mist; fogH: haze scale height, m. */
var WEATHERS = {
  clear:     { label: 'clear sky', cover: 0.80, soft: 0.16, op: 0.92, fogD: 0.0016, lightMul: 1.00, ambMul: 1.00, shadow: 0.20, rain: 0, snow: 0, wind: [0.35, 0.70], desat: 0, fogShape: 0, fogH: 170 },
  fair:      { label: 'drifting cloud', cover: 0.55, soft: 0.20, op: 0.95, fogD: 0.0021, lightMul: 0.94, ambMul: 1.02, shadow: 0.46, rain: 0, snow: 0, wind: [0.48, 0.88], desat: 0.03, fogShape: 0, fogH: 160 },
  breezy:    { label: 'a good wind up', cover: 0.48, soft: 0.14, op: 0.96, fogD: 0.0024, lightMul: 0.92, ambMul: 1.02, shadow: 0.50, rain: 0, snow: 0, wind: [0.95, 1.35], desat: 0.05, fogShape: 0, fogH: 170 },
  overcast:  { label: 'flat grey', cover: 0.08, soft: 0.30, op: 1.00, fogD: 0.0040, lightMul: 0.42, ambMul: 1.08, shadow: 0.04, rain: 0, snow: 0, wind: [0.42, 0.80], desat: 0.28, fogShape: 0, fogH: 140 },
  mist:      { label: 'mist on the field', cover: 0.30, soft: 0.34, op: 0.80, fogD: 0.0125, lightMul: 0.62, ambMul: 1.15, shadow: 0.06, rain: 0, snow: 0, wind: [0.20, 0.42], desat: 0.30, fogShape: 1, fogH: 55 },
  drizzle:   { label: 'soft rain', cover: 0.14, soft: 0.30, op: 1.00, fogD: 0.0062, lightMul: 0.50, ambMul: 1.05, shadow: 0.05, rain: 0.38, snow: 0, wind: [0.48, 0.85], desat: 0.26, fogShape: 0.6, fogH: 110 },
  rainstorm: { label: 'rain coming down',  cover: 0.02, soft: 0.26, op: 1.00, fogD: 0.0092, lightMul: 0.34, ambMul: 0.98, shadow: 0.03, rain: 1.00, snow: 0, wind: [1.00, 1.50], desat: 0.34, fogShape: 0.75, fogH: 120 },
  storm:     { label: 'thunder and lightning', cover: 0.0, soft: 0.24, op: 1.00, fogD: 0.0080, lightMul: 0.30, ambMul: 0.95, shadow: 0.02, rain: 1.0, snow: 0, wind: [1.0, 1.5], desat: 0.36, lightning: true, fogShape: 0.75, fogH: 120 },
  snowfall:  { label: 'snow, no hurry',  cover: 0.12, soft: 0.32, op: 1.00, fogD: 0.0068, lightMul: 0.52, ambMul: 1.20, shadow: 0.03, rain: 0, snow: 0.45, wind: [0.28, 0.58], desat: 0.34, fogShape: 0.7, fogH: 110 },
  snowstorm: { label: 'blowing snow',  cover: 0.01, soft: 0.28, op: 1.00, fogD: 0.0135, lightMul: 0.44, ambMul: 1.18, shadow: 0.02, rain: 0, snow: 1.00, wind: [1.05, 1.50], desat: 0.40, fogShape: 1, fogH: 90 }
};

var GRASS_PALETTES = [
  { name: 'spring meadow', base: '#37501f', tip: '#82a34c', soil: '#4a4327', dry: '#8d9350' },
  { name: 'high summer',   base: '#4b5a24', tip: '#9fae55', soil: '#5a5230', dry: '#b6ab5f' },
  { name: 'deep emerald',  base: '#1e3a24', tip: '#5c8b41', soil: '#3a3826', dry: '#6f8a44' },
  { name: 'sage and dust', base: '#465440', tip: '#93a276', soil: '#6a6350', dry: '#a9a582' },
  { name: 'old hay',       base: '#6d6136', tip: '#c5b479', soil: '#6b5c3a', dry: '#d3c48c' },
  { name: 'upland green',  base: '#2c452c', tip: '#6c9a5c', soil: '#413f2c', dry: '#7e9457' },
  { name: 'late autumn',   base: '#5b4a28', tip: '#a89055', soil: '#584a30', dry: '#b8a066' }
];

/* ground colours and, where they differ, the colour of whatever grows on it */
var SAND_PALETTES = [
  { name: 'white sand', base: '#ddcaa4', tip: '#f2e6c9', soil: '#c3ab80', dry: '#ece0bd', cb: '#54763f', ct: '#9cc06a' },
  { name: 'golden sand', base: '#d3bc8e', tip: '#eddcb2', soil: '#b99b6d', dry: '#e5d3a6', cb: '#5d7a45', ct: '#a3bd6d' },
  { name: 'shell sand', base: '#e2d3b6', tip: '#f6eeda', soil: '#c8b593', dry: '#efe5cb', cb: '#4f7043', ct: '#93b566' }
];
var DUST_PALETTES = [
  { name: 'red rock', base: '#a86a45', tip: '#cf9468', soil: '#8b5636', dry: '#c08a5f', cb: '#7d7345', ct: '#b6a973' },
  { name: 'pale desert', base: '#bd9a6e', tip: '#dbbd90', soil: '#a3835c', dry: '#d0b183', cb: '#84804f', ct: '#bcb180' },
  { name: 'ochre flats', base: '#b0834f', tip: '#d4ab72', soil: '#946b3f', dry: '#c69b68', cb: '#7a7444', ct: '#b0a56e' }
];
var ALPINE_PALETTES = [
  { name: 'alpine turf', base: '#33492d', tip: '#7a9c58', soil: '#4d4c40', dry: '#8d9a63' },
  { name: 'high pasture', base: '#3d5330', tip: '#8aa85e', soil: '#585440', dry: '#9aa76a' },
  { name: 'cold green', base: '#2a4130', tip: '#628b53', soil: '#454639', dry: '#748a58' }
];

var FLOWERS = [
  { name: 'daisies',      petal: '#fbf7ef', mid: '#f0c245', kind: 'round', size: [0.10, 0.17] },
  { name: 'buttercups',   petal: '#f6cf3c', mid: '#e8a72a', kind: 'round', size: [0.08, 0.14] },
  { name: 'poppies',      petal: '#c4342a', mid: '#2b1a16', kind: 'round', size: [0.13, 0.21] },
  { name: 'cornflowers',  petal: '#4a6bb8', mid: '#2c3f78', kind: 'round', size: [0.10, 0.16] },
  { name: 'clover',       petal: '#dcb4c4', mid: '#c78ba2', kind: 'puff',  size: [0.07, 0.12] },
  { name: 'yarrow',       petal: '#eee9db', mid: '#d8cfae', kind: 'flat',  size: [0.10, 0.16] },
  { name: 'wild lupin',   petal: '#7d6bb5', mid: '#5b4b90', kind: 'spike', size: [0.20, 0.34] },
  { name: 'red campion',  petal: '#d2708f', mid: '#a84d6c', kind: 'round', size: [0.09, 0.15] },
  { name: 'ox-eye',       petal: '#f4f0e4', mid: '#e0b93a', kind: 'round', size: [0.14, 0.22] }
];

var FINISHES = [
  { name: 'painted white',   type: 'paint', col: '#e9e4d9', wear: 0.35 },
  { name: 'old cream',       type: 'paint', col: '#ded1b6', wear: 0.55 },
  { name: 'sage green',      type: 'paint', col: '#8f9a83', wear: 0.45 },
  { name: 'dove grey',       type: 'paint', col: '#b3b6b2', wear: 0.4 },
  { name: 'powder blue',     type: 'paint', col: '#93a6ad', wear: 0.5 },
  { name: 'black steel',     type: 'metal', col: '#2a2c2e', wear: 0.3 },
  { name: 'dark bronze',     type: 'metal', col: '#40382f', wear: 0.35 },
  { name: 'walnut',          type: 'wood',  col: '#5c3d29', wear: 0.3 },
  { name: 'weathered oak',   type: 'wood',  col: '#9a8464', wear: 0.6 },
  { name: 'oxblood',         type: 'paint', col: '#6b3230', wear: 0.5 }
];

var SAVANNA_PALETTES = [
  { name: 'dry savanna', base: '#8a7638', tip: '#cdb469', soil: '#7a6134', dry: '#ddc77f' },
  { name: 'burnt gold', base: '#7d6a30', tip: '#c6a95c', soil: '#6d5730', dry: '#d6bd74' }
];
var LAVENDER_PALETTES = [
  { name: 'lavender rows', base: '#4a5a3a', tip: '#8fa06a', soil: '#6b5f4a', dry: '#a89a72' }
];

var CANYON_PALETTES = [
  { name: 'red rock', base: '#8a4a30', tip: '#b87a52', soil: '#6b3a26', dry: '#c49a6a' },
  { name: 'painted desert', base: '#93603c', tip: '#c99a68', soil: '#6e4630', dry: '#d8b184' },
  { name: 'sandstone', base: '#a06c44', tip: '#d0a373', soil: '#7d5334', dry: '#e0c096' }
];
var STUBBLE_PALETTES = [
  { name: 'cut stubble', base: '#b8a463', tip: '#d8c688', soil: '#8a7448', dry: '#e2d29a' },
  { name: 'late harvest', base: '#a89552', tip: '#cdb877', soil: '#7e6a40', dry: '#dbc78d' },
  { name: 'baled gold', base: '#c1ad6c', tip: '#e2d296', soil: '#907a4c', dry: '#eadfae' }
];
/* an oasis is sand like the desert round it; only what grows by the water
   is green (cb, ct) */
var OASIS_PALETTES = [
  { name: 'palm shade', base: '#c6a676', tip: '#e0c59a', soil: '#a58a5e', dry: '#d6bb8c', cb: '#4e6b34', ct: '#87a352' },
  { name: 'date grove', base: '#be9e6e', tip: '#d9be92', soil: '#9c8258', dry: '#cfb284', cb: '#456030', ct: '#7c964b' }
];
var CASCADE_PALETTES = [
  { name: 'wet stone', base: '#3c4a3a', tip: '#6d8256', soil: '#4a4a44', dry: '#7d7f6c' },
  { name: 'mossy gorge', base: '#33482f', tip: '#5f7f45', soil: '#42463c', dry: '#6f7860' }
];

var URBAN_PALETTES = [
  { name: 'city grey', base: '#4e4c49', tip: '#6f6b64', soil: '#3d3b39', dry: '#7d776d', cb: '#46543a', ct: '#7c8f56' },
  { name: 'wet asphalt', base: '#3f4245', tip: '#5d6165', soil: '#333537', dry: '#6b6d70', cb: '#42513a', ct: '#71854f' }
];
var MARSH_PALETTES = [
  { name: 'reed bed', base: '#4a5233', tip: '#8d8f4e', soil: '#3b382b', dry: '#a09657', cb: '#5d6a35', ct: '#9ea457' },
  { name: 'peat and sedge', base: '#41482e', tip: '#7f854a', soil: '#332f24', dry: '#948a51', cb: '#556230', ct: '#93995a' }
];
var LAKE_PALETTES = [
  { name: 'lakeside turf', base: '#35502a', tip: '#7d9c52', soil: '#4a4632', dry: '#93a05f' },
  { name: 'shingle bank', base: '#4b5539', tip: '#8b9a63', soil: '#6d685a', dry: '#a49f78' }
];

var AUTUMN_PALETTES = [
  { name: 'leaf litter', base: '#5c4224', tip: '#a0763a', soil: '#4a3520', dry: '#b98f4c' },
  { name: 'russet floor', base: '#6b452a', tip: '#ab7d42', soil: '#523821', dry: '#c39a5b' }
];
var MOOR_PALETTES = [
  /* tip is the stems and old growth; ct the bells, which only the top of
     each bush carries (buildGrass) */
  { name: 'heather', base: '#4a4235', tip: '#6e6450', soil: '#3d362c', dry: '#7d6a56', cb: '#544a3c', ct: '#9b76a6' },
  { name: 'ling and peat', base: '#433d31', tip: '#655b49', soil: '#35302a', dry: '#6f6252', cb: '#4d453a', ct: '#8d6e95' }
];
var TUNDRA_PALETTES = [
  { name: 'tundra moss', base: '#4d5442', tip: '#8d9068', soil: '#5a5850', dry: '#9a9578', cb: '#5c6247', ct: '#96996d' },
  { name: 'lichen rock', base: '#565a4c', tip: '#96997a', soil: '#63625a', dry: '#a5a184' }
];
var SALT_PALETTES = [
  { name: 'salt pan', base: '#d8d5cc', tip: '#f2f0e9', soil: '#bdb9ae', dry: '#e8e5db' }
];
var TERRACE_PALETTES = [
  { name: 'young rice', base: '#4a7a35', tip: '#9dc55f', soil: '#5b5237', dry: '#a8bd6a' },
  { name: 'ripening rice', base: '#6f7a30', tip: '#c2c264', soil: '#5f5636', dry: '#cfc478' }
];
var GROVE_PALETTES = [
  { name: 'dry terrace', base: '#6e6c42', tip: '#a9a469', soil: '#736542', dry: '#bdb27c' },
  { name: 'green rows', base: '#4e5f31', tip: '#93a65f', soil: '#665c40', dry: '#a8ab6f' }
];
var FARM_PALETTES = [
  { name: 'pasture', base: '#37542a', tip: '#83a851', soil: '#4d4530', dry: '#9aa85e' },
  { name: 'stubble', base: '#7a6e3c', tip: '#cdb974', soil: '#6a5b39', dry: '#d8c583' }
];

var BIOMES = {
  meadow: {
    label: 'grass plain', w: 24, terrain: 'rolling', farmed: true, palettes: GRASS_PALETTES,
    cover: 46000, coverH: [0.26, 0.62], coverChance: 1, coverVar: [0.75, 1.1], flowers: true,
    props: [{ kind: 'broadleaf', count: [0, 9], size: [5, 13], r: [35, 190] }],
    treeline: 'broadleaf', haze: [1, 1, 1],
    weather: { clear: 15, fair: 17, breezy: 11, overcast: 10, mist: 8, drizzle: 10, rainstorm: 9, snowfall: 8, snowstorm: 6 }
  },
  coast: {
    label: 'tropical coast', w: 15, terrain: 'beach', ground: 'sand', palettes: SAND_PALETTES,
    cover: 15000, coverH: [0.22, 0.5], coverChance: 0.55, coverVar: [0.3, 1.0],
    coverMinH: 1.1, flowers: false, water: 'sea',
    props: [{ kind: 'palm', count: [7, 26], size: [5, 11], r: [7, 75] },
            { kind: 'rock', count: [0, 12], size: [0.5, 2.2], r: [10, 70] }],
    haze: [1.0, 1.03, 1.06],
    weather: { clear: 34, fair: 30, breezy: 12, overcast: 7, mist: 4, drizzle: 6, rainstorm: 7 }
  },
  desert: {
    label: 'desert', w: 13, terrain: 'dunes', ground: 'sand', dryAir: true, mirage: true, palettes: DUST_PALETTES,
    cover: 11000, coverH: [0.13, 0.34], coverChance: 0.5, coverVar: [0.25, 1.0],
    flowers: false, dust: [5, 14], raptors: true,
    props: [{ kind: 'cactus', count: [14, 40], size: [2.2, 6.4], r: [8, 110] },
            { kind: 'rock', count: [6, 30], size: [0.6, 3.0], r: [8, 130] },
            { kind: 'creosote', count: [14, 40], size: [1.0, 2.8], r: [5, 90] },
            { kind: 'brittlebush', count: [8, 26], size: [0.55, 1.2], r: [4, 60] },
            { kind: 'deadbush', count: [4, 16], size: [0.5, 1.2], r: [6, 70] }],
    critters: true,
    haze: [1.09, 0.99, 0.84],
    weather: { clear: 42, fair: 26, breezy: 15, mist: 8, overcast: 5, rainstorm: 4 }
  },
  alpine: {
    label: 'mountains', w: 15, terrain: 'alpine', palettes: ALPINE_PALETTES,
    cover: 32000, coverH: [0.18, 0.44], coverChance: 0.82, coverVar: [0.45, 1.0],
    flowers: true, waterfall: [1, 3],
    props: [{ kind: 'pine', count: [14, 44], size: [5, 16], r: [30, 260] },
            { kind: 'rock', count: [5, 22], size: [0.7, 3.4], r: [12, 120] }],
    treeline: 'pine', haze: [0.99, 1.0, 1.03],
    weather: { clear: 20, fair: 20, breezy: 10, overcast: 12, mist: 12, drizzle: 6, snowfall: 12, snowstorm: 8 }
  },
  savanna: {
    label: 'savanna', w: 11, terrain: 'rolling', dryAir: true, palettes: SAVANNA_PALETTES,
    cover: 40000, coverH: [0.34, 0.78], coverChance: 1, coverVar: [0.8, 1.1],
    flowers: false, raptors: true,
    props: [{ kind: 'acacia', count: [4, 14], size: [7, 15], r: [30, 240] },
            { kind: 'rock', count: [0, 10], size: [0.6, 2.4], r: [15, 120] }],
    treeline: 'acacia', haze: [1.06, 1.0, 0.88],
    weather: { clear: 34, fair: 28, breezy: 14, mist: 6, overcast: 8, drizzle: 4, rainstorm: 6 }
  },
  lavender: {
    label: 'lavender rows', w: 9, terrain: 'rolling', farmed: true, palettes: LAVENDER_PALETTES,
    cover: 52000, coverH: [0.30, 0.52], coverChance: 1, coverVar: [0.95, 1.1],
    flowers: false, rows: true,
    props: [{ kind: 'broadleaf', count: [1, 6], size: [5, 11], r: [45, 200] }],
    haze: [1.02, 0.99, 1.03],
    weather: { clear: 30, fair: 28, breezy: 10, overcast: 8, mist: 8, drizzle: 8, rainstorm: 8 }
  },
  penthouse: {
    label: 'penthouse', w: 7, terrain: 'skyline', palettes: URBAN_PALETTES,
    cover: 0, coverH: [0.1, 0.2], coverChance: 0, coverVar: [1, 1], flowers: false,
    props: [{ kind: 'blocks', count: [1, 1], size: [1, 1], r: [30, 900] }],
    haze: [1.03, 1.0, 1.0], noCritters: true,
    weather: { clear: 22, fair: 24, overcast: 16, drizzle: 12, rainstorm: 8, breezy: 8, snowfall: 6, storm: 4 }
  },
  bridge: {
    label: 'river gorge', w: 9, terrain: 'gorge', farmed: true, palettes: GRASS_PALETTES, water: 'flow',
    cover: 26000, coverH: [0.18, 0.42], coverChance: 1, coverVar: [0.6, 1.0], flowers: true,
    props: [{ kind: 'bridge', count: [1, 1], size: [1, 1], r: [1, 1] },
            { kind: 'pine', count: [16, 54], size: [7, 17], r: [22, 260] },
            { kind: 'broadleaf', count: [8, 30], size: [5, 13], r: [18, 200] },
            { kind: 'rock', count: [10, 34], size: [0.5, 3.0], r: [10, 140] }],
    haze: [1.0, 1.01, 1.03],
    weather: { clear: 22, fair: 24, overcast: 14, mist: 12, drizzle: 12, rainstorm: 8, breezy: 8 }
  },
  hayfield: {
    label: 'cut hayfield', w: 9, terrain: 'rolling', farmed: true, palettes: STUBBLE_PALETTES,
    cover: 40000, coverH: [0.10, 0.20], coverChance: 1, coverVar: [0.85, 1.05], flowers: false,
    rows: true, flatLand: true,
    props: [{ kind: 'broadleaf', count: [2, 10], size: [6, 13], r: [60, 260] },
            { kind: 'hedge', count: [8, 26], size: [1.4, 2.4], r: [70, 240] }],
    haze: [1.05, 1.01, 0.95],
    weather: { clear: 32, fair: 28, breezy: 12, overcast: 10, mist: 8, drizzle: 6, rainstorm: 4 }
  },
  cascade: {
    label: 'waterfall', w: 8, terrain: 'cascade', palettes: CASCADE_PALETTES, water: 'still',
    cover: 30000, coverH: [0.16, 0.40], coverChance: 1, coverVar: [0.7, 1.1], flowers: true,
    props: [{ kind: 'pine', count: [14, 46], size: [7, 16], r: [16, 200] },
            { kind: 'shrub', count: [16, 46], size: [1.0, 2.6], r: [8, 90] },
            { kind: 'rock', count: [20, 60], size: [0.6, 4.0], r: [6, 120] }],
    haze: [0.99, 1.02, 1.04],
    weather: { clear: 18, fair: 22, overcast: 16, mist: 20, drizzle: 14, rainstorm: 6, breezy: 4 }
  },
  canyon: {
    label: 'canyon', w: 10, terrain: 'canyon', ground: 'sand', dryAir: true, palettes: CANYON_PALETTES,
    cover: 6000, coverH: [0.12, 0.30], coverChance: 0.55, coverVar: [0.2, 0.8], flowers: false,
    props: [{ kind: 'rock', count: [14, 50], size: [0.8, 5.0], r: [10, 200] },
            { kind: 'creosote', count: [8, 28], size: [1.0, 2.4], r: [8, 120] },
            { kind: 'deadbush', count: [4, 18], size: [0.5, 1.3], r: [8, 90] }],
    dust: [3, 10], raptors: true, critters: true,
    haze: [1.10, 0.98, 0.86],
    weather: { clear: 40, fair: 28, breezy: 12, overcast: 8, mist: 6, rainstorm: 6 }
  },
  oasis: {
    label: 'desert oasis', w: 7, terrain: 'oasis', ground: 'sand', dryAir: true, palettes: OASIS_PALETTES, water: 'still',
    cover: 16000, coverH: [0.16, 0.44], coverChance: 1, coverVar: [0.4, 1.0], flowers: true,
    props: [{ kind: 'palm', count: [9, 30], size: [6, 14], r: [12, 90] },
            { kind: 'shrub', count: [12, 34], size: [0.9, 2.2], r: [8, 80] },
            { kind: 'rock', count: [6, 22], size: [0.5, 2.4], r: [12, 150] }],
    dust: [2, 8], critters: true,
    haze: [1.08, 1.0, 0.88],
    weather: { clear: 46, fair: 26, breezy: 14, mist: 6, overcast: 5, rainstorm: 3 }
  },
  lakefront: {
    label: 'lakefront', w: 11, terrain: 'lake', farmed: true, palettes: LAKE_PALETTES, water: 'still',
    cover: 26000, coverH: [0.22, 0.52], coverChance: 0.9, coverVar: [0.5, 1.0],
    coverWet: true, flowers: true,
    props: [{ kind: 'pine', count: [10, 40], size: [6, 16], r: [70, 430] },
            { kind: 'rock', count: [0, 16], size: [0.4, 2.2], r: [8, 80] }],
    haze: [0.99, 1.0, 1.03],
    weather: { clear: 20, fair: 22, breezy: 8, overcast: 12, mist: 16, drizzle: 10, snowfall: 6, rainstorm: 6 }
  },
  river: {
    label: 'river valley', w: 10, terrain: 'river', farmed: true, palettes: GRASS_PALETTES, water: 'flow',
    cover: 34000, coverH: [0.24, 0.55], coverChance: 1, coverVar: [0.6, 1.05],
    coverWet: true, flowers: true,
    props: [{ kind: 'broadleaf', count: [6, 26], size: [5, 13], r: [18, 190] },
            { kind: 'rock', count: [6, 28], size: [0.35, 1.8], r: [8, 90] }],
    treeline: 'broadleaf', haze: [1, 1, 1.01],
    weather: { clear: 18, fair: 22, breezy: 8, overcast: 12, mist: 14, drizzle: 12, rainstorm: 8, snowfall: 6 }
  },
  flowerfield: {
    label: 'flower field', w: 10, terrain: 'rolling', farmed: true, palettes: GRASS_PALETTES,
    cover: 32000, coverH: [0.18, 0.42], coverChance: 1, coverVar: [0.7, 1.0],
    flowers: 'dense',
    props: [{ kind: 'broadleaf', count: [0, 5], size: [5, 11], r: [60, 230] }],
    haze: [1, 1, 1],
    weather: { clear: 30, fair: 28, breezy: 10, overcast: 8, mist: 8, drizzle: 8, rainstorm: 8 }
  },
  marsh: {
    label: 'marsh', w: 9, terrain: 'marsh', palettes: MARSH_PALETTES, water: 'still',
    cover: 30000, coverH: [0.55, 1.30], coverChance: 1, coverVar: [0.8, 1.1],
    coverStyle: 'reeds', coverWet: true, flowers: false,
    props: [{ kind: 'deadbush', count: [8, 30], size: [0.6, 1.9], r: [8, 75] },
            { kind: 'broadleaf', count: [0, 8], size: [4, 10], r: [45, 210] }],
    haze: [0.99, 1.01, 1.02],
    weather: { clear: 12, fair: 16, overcast: 18, mist: 26, drizzle: 14, snowfall: 8, rainstorm: 6 }
  },
  cliffcoast: {
    label: 'cliff coast', w: 10, terrain: 'cliff', farmed: true, palettes: LAKE_PALETTES, water: 'sea',
    cover: 26000, coverH: [0.2, 0.5], coverChance: 0.85, coverVar: [0.5, 1.0], flowers: true,
    props: [{ kind: 'rock', count: [8, 30], size: [0.4, 2.6], r: [8, 90] },
            { kind: 'shrub', count: [4, 20], size: [0.6, 1.8], r: [10, 80] }],
    haze: [1.0, 1.02, 1.05],
    weather: { clear: 22, fair: 24, breezy: 18, overcast: 12, mist: 8, drizzle: 8, rainstorm: 8 }
  },
  terraces: {
    label: 'rice terraces', w: 9, terrain: 'terrace', palettes: TERRACE_PALETTES,
    cover: 34000, coverH: [0.22, 0.5], coverChance: 1, coverVar: [0.8, 1.1], flowers: false,
    props: [{ kind: 'palm', count: [2, 10], size: [5, 10], r: [30, 200] },
            { kind: 'shrub', count: [3, 14], size: [0.6, 1.6], r: [12, 90] }],
    haze: [1.0, 1.01, 1.02],
    weather: { clear: 20, fair: 24, overcast: 12, mist: 20, drizzle: 12, rainstorm: 12 }
  },
  orchard: {
    label: 'orchard', w: 9, terrain: 'slope', palettes: GROVE_PALETTES,
    cover: 24000, coverH: [0.14, 0.34], coverChance: 0.9, coverVar: [0.5, 1.0],
    flowers: false, rows: true, coverRows: false,
    props: [{ kind: 'olive', count: [150, 340], size: [3.8, 7.5], r: [7, 130], rows: true, rowMul: 1 },
            { kind: 'rock', count: [0, 10], size: [0.3, 1.2], r: [10, 80] }],
    haze: [1.05, 1.0, 0.92],
    weather: { clear: 34, fair: 26, breezy: 10, overcast: 8, mist: 8, drizzle: 7, rainstorm: 7 }
  },
  autumn: {
    label: 'autumn clearing', w: 10, terrain: 'rolling', farmed: true, palettes: AUTUMN_PALETTES,
    cover: 30000, coverH: [0.16, 0.4], coverChance: 0.9, coverVar: [0.5, 1.0],
    flowers: false, autumn: true, leaffall: [500, 1800],
    props: [{ kind: 'broadleaf', count: [26, 80], size: [7, 17], r: [22, 220] }],
    treeline: 'broadleaf', haze: [1.05, 1.0, 0.95],
    weather: { clear: 18, fair: 22, breezy: 12, overcast: 14, mist: 16, drizzle: 10, rainstorm: 8 }
  },
  moor: {
    label: 'open moor', w: 9, terrain: 'rolling', palettes: MOOR_PALETTES,
    cover: 46000, coverH: [0.14, 0.30], coverChance: 1, coverVar: [0.85, 1.1], flowers: false,
    coverStyle: 'heather',
    props: [{ kind: 'rock', count: [16, 50], size: [0.5, 3.4], r: [8, 160] },
            { kind: 'shrub', count: [6, 26], size: [0.5, 1.5], r: [10, 110] }],
    haze: [0.99, 1.0, 1.02],
    weather: { clear: 12, fair: 18, breezy: 16, overcast: 18, mist: 18, drizzle: 12, rainstorm: 6 }
  },
  tundra: {
    label: 'tundra', w: 8, terrain: 'rolling', palettes: TUNDRA_PALETTES,
    cover: 18000, coverH: [0.10, 0.24], coverChance: 0.85, coverVar: [0.35, 0.9],
    flowers: false, baseSnow: [0.22, 0.55],
    props: [{ kind: 'rock', count: [30, 80], size: [0.3, 2.6], r: [6, 160] },
            { kind: 'shrub', count: [4, 20], size: [0.4, 1.1], r: [10, 90] }],
    haze: [0.98, 1.0, 1.04],
    weather: { clear: 20, fair: 18, breezy: 14, overcast: 14, mist: 10, snowfall: 14, snowstorm: 10 }
  },
  saltflat: {
    label: 'salt flats', w: 7, terrain: 'salt', ground: 'sand', dryAir: true, mirage: true, palettes: SALT_PALETTES, water: 'mirror',
    cover: 0, coverH: [0.1, 0.2], coverChance: 0, coverVar: [0, 0], flowers: false,
    props: [{ kind: 'rock', count: [0, 8], size: [0.3, 1.6], r: [30, 200] }],
    haze: [1.02, 1.01, 1.0],
    weather: { clear: 46, fair: 26, breezy: 10, mist: 10, overcast: 8 }
  },
  blossom: {
    label: 'orchard in blossom', w: 8, terrain: 'rolling', farmed: true, palettes: GRASS_PALETTES,
    cover: 34000, coverH: [0.2, 0.46], coverChance: 1, coverVar: [0.8, 1.1],
    flowers: true, rows: true, blossom: true, leaffall: [400, 1400],
    props: [{ kind: 'blossom', count: [24, 70], size: [4, 8], r: [8, 150], rows: true, rowMul: 3 }],
    haze: [1.01, 1.0, 1.01],
    weather: { clear: 28, fair: 28, breezy: 10, overcast: 10, mist: 10, drizzle: 8, rainstorm: 6 }
  },
  farmland: {
    label: 'farmland', w: 10, terrain: 'rolling', farmed: true, palettes: FARM_PALETTES,
    cover: 60000, coverH: [0.9, 2.1], coverChance: 1, coverVar: [0.9, 1.1], flowers: false,
    rows: true, crop: true,
    props: [{ kind: 'hedge', count: [90, 260], size: [1.6, 3.0], r: [12, 170], rows: true },
            { kind: 'wall', count: [1, 1], size: [1, 1], r: [20, 150] },
            { kind: 'broadleaf', count: [3, 14], size: [6, 13], r: [30, 200] }],
    haze: [1.0, 1.0, 1.0],
    weather: { clear: 16, fair: 22, breezy: 12, overcast: 16, mist: 12, drizzle: 12, rainstorm: 10 }
  },
  urban: {
    label: 'city skyline', w: 10, terrain: 'urban', palettes: URBAN_PALETTES,
    cover: 30000, coverH: [0.18, 0.44], coverChance: 0.9, coverVar: [0.5, 1.0],
    flowers: true,
    props: [{ kind: 'city', count: [1, 1], size: [1, 1], r: [30, 400] }],
    haze: [1.03, 1.0, 0.98],
    weather: { clear: 22, fair: 24, overcast: 16, drizzle: 12, rainstorm: 8, breezy: 6, snowfall: 6 }
  },
  fjord: {
    label: 'fjord', w: 12, terrain: 'fjord', palettes: ALPINE_PALETTES,
    cover: 20000, coverH: [0.16, 0.40], coverChance: 0.62, coverVar: [0.3, 1.0],
    flowers: false, water: 'still', waterfall: [1, 4],
    props: [{ kind: 'pine', count: [18, 46], size: [4, 14], r: [26, 230] },
            { kind: 'rock', count: [4, 18], size: [0.6, 2.6], r: [10, 90] }],
    haze: [0.97, 1.0, 1.04],
    weather: { clear: 14, fair: 18, overcast: 16, mist: 22, drizzle: 14, snowfall: 10, snowstorm: 6 }
  }
};

var WINDOW_TYPES = [
  { name: 'georgian sash',    pane: 0.44, bar: 0.030, meetingAt: 0.5, arch: false },
  { name: 'cottage sash',     pane: 0.60, bar: 0.038, meetingAt: 0.5, arch: false },
  { name: 'steel casement',   pane: 0.48, bar: 0.017, arch: false, metal: true },
  { name: 'crittall grid',    pane: 0.33, bar: 0.015, arch: false, metal: true },
  { name: 'picture window',   pane: 0,    bar: 0.050, arch: false, single: true },
  { name: 'arched casement',  pane: 0.64, bar: 0.030, arch: true },
  { name: 'chapel arch',      pane: 0.82, bar: 0.036, arch: true },
  { name: 'farmhouse light',  pane: 0.98, bar: 0.042, arch: false },
  { name: 'garden door',      pane: 0.52, bar: 0.026, arch: false }
];

/* Traits on a BIOMES entry, read wherever a landscape's kind matters:
   ground 'sand'  the land is bare sand or rock (no season tint, no puddles,
                  gravel for clutter, a sand-coloured bounce)
   dryAir         dry country: clearer, deeper-blue air on a fine day, dust
                  only when the wind is up; with sand ground, varnished rock
                  and mesas
   farmed         fields, hedge lines and woods drawn into the far ground
   mirage         a band of low sky lies on the flats on a fine day */

var SEASONS = {
  spring: { label: 'spring', hue: 0.020, sat: 0.10, light: 0.045, flowers: 1.7, snow: 0, blossom: true },
  summer: { label: 'summer', hue: -0.012, sat: 0.03, light: 0.015, flowers: 1.0, snow: 0 },
  autumn: { label: 'autumn', hue: 0, toward: 0.115, pull: 0.45, sat: -0.04, light: -0.025, flowers: 0.30, snow: 0, leaves: true },
  winter: { label: 'winter', hue: -0.020, sat: -0.24, light: -0.030, flowers: 0.0, snow: 1 }
};
var SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
/* the tropics and the deep desert do not do winter */
var NO_WINTER = { oasis: 1, canyon: 1, penthouse: 0, coast: 1, saltflat: 1, desert: 1, savanna: 1, terraces: 1 };

function tintHex(hex, dh, ds, dl) {
  var c = new THREE.Color(hex);
  c.offsetHSL(dh, ds, dl);
  return '#' + c.getHexString();
}
/* A season's tint on a plant colour, scaled by k. Autumn does not turn every
   hue the same way (a fixed shift took green to olive but brown to maroon):
   it pulls each part of the way toward straw. */
/* A palette as this season colours it. Seasons change what grows, not sand
   and rock: sandG 0 keeps base and tip as drawn (they are the ground in the
   sand palettes), soilG 0 keeps soil and dry; plant colours always tint. */
function tintPalette(pal, SEA, sandG, soilG) {
  return {
    name: pal.name, base: seasonHex(pal.base, SEA, sandG),
    tip: seasonHex(pal.tip, SEA, sandG),
    soil: tintHex(pal.soil, SEA.hue * 0.4 * soilG, SEA.sat * 0.4 * soilG, SEA.light * 0.5 * soilG),
    dry: seasonHex(pal.dry, SEA, 0.5 * soilG),
    cb: pal.cb ? seasonHex(pal.cb, SEA, 1) : null,
    ct: pal.ct ? seasonHex(pal.ct, SEA, 1) : null
  };
}
function seasonHex(hex, SEA, k) {
  if (SEA.toward == null) return tintHex(hex, SEA.hue * k, SEA.sat * k, SEA.light * k);
  var c = new THREE.Color(hex), hsl = {};
  c.getHSL(hsl);
  var dh = SEA.toward - hsl.h;
  if (dh > 0.5) dh -= 1; else if (dh < -0.5) dh += 1;
  return tintHex(hex, dh * SEA.pull * k, SEA.sat * k, SEA.light * k);
}

var WIND_NAMES = ['northerly', 'north-easterly', 'easterly', 'south-easterly', 'southerly', 'south-westerly', 'westerly', 'north-westerly'];

