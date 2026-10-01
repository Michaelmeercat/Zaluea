import type { Vec } from '../core/math';

export const WORLD_W = 1280;
export const WORLD_H = 720;
export const PATH_HALF_WIDTH = 26;
export const EDGE_MARGIN = 14;

export type Shape =
  | { kind: 'circle'; x: number; y: number; r: number }
  | { kind: 'rect'; x: number; y: number; w: number; h: number }
  | { kind: 'poly'; pts: Vec[] };

export interface Blocker {
  shape: Shape;
  label: string;
  /** Visual style used by map art. */
  style: 'water' | 'wall' | 'ice' | 'rock' | 'tree' | 'fountain' | 'stall' | 'pillar' | 'chasm' | 'crystal';
}

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  r: number;
  cost: number;
  label: string;
  style: 'crates' | 'cart' | 'barrels';
}

export interface Prop {
  kind:
    | 'tree' | 'bush' | 'flower' | 'rock' | 'grass' | 'mushroom' | 'pine' | 'icicle' | 'snowrock' | 'ruin' | 'lily'
    | 'lamp' | 'gear' | 'banner' | 'crystal' | 'brazier' | 'reed' | 'stump' | 'pinkTree';
  x: number;
  y: number;
  s?: number;
}

export interface MapTheme {
  ground: [string, string];
  ground2: string;
  path: string;
  pathEdge: string;
  pathDetail: string;
  accent: string;
  sky: string;
  water?: string;
}

export interface MapDef {
  id: string;
  name: string;
  order: number;
  tagline: string;
  description: string;
  mechanics: string[];
  difficultyStars: number;
  theme: MapTheme;
  /** Path waypoints (smoothed with Catmull-Rom). First point = rift entrance, last = gate. */
  paths: Vec[][];
  /** Optional: where towers may be placed. If absent, everywhere off-path not blocked. */
  buildZones?: Shape[];
  blockers: Blocker[];
  obstacles?: Obstacle[];
  props: Prop[];
  /** Which path indices are active for a given wave (default: all). */
  routes?: (wave: number) => number[];
  routeNames?: string[];
  unlock: { victories: number; shards: number } | null;
  seed: number;
}

const rect = (x: number, y: number, w: number, h: number): Shape => ({ kind: 'rect', x, y, w, h });
const circ = (x: number, y: number, r: number): Shape => ({ kind: 'circle', x, y, r });
const P = (...a: number[][]): Vec[] => a.map(([x, y]) => ({ x, y }));

const twinTail = [[740, 382], [860, 382], [950, 300], [1000, 180], [1100, 120], [1190, 200], [1170, 330], [1060, 420], [1060, 530], [1130, 610], [1222, 610]];
const citadelTail = [[680, 360], [780, 362], [850, 450], [820, 560], [900, 640], [1040, 640], [1120, 560], [1100, 440], [1000, 380], [960, 280], [1000, 180], [1110, 130], [1222, 170]];

export const MAPS: MapDef[] = [
  {
    id: 'meadow', name: 'Meadow Bend', order: 0, seed: 101,
    tagline: 'A gentle first defense',
    description: 'A sunny meadow island with one winding road and plenty of open grass. Learn how range and splash cover the bends.',
    mechanics: ['One winding path', 'Generous open placement', 'Great splash spots on inner bends'],
    difficultyStars: 1,
    theme: { ground: ['#8fd16a', '#6fbd57'], ground2: '#a6dd7a', path: '#e6c98f', pathEdge: '#b08a55', pathDetail: '#d4b277', accent: '#f6e27a', sky: '#9fd8ff', water: '#5cb8e8' },
    paths: [P([40, 130], [300, 130], [385, 175], [405, 270], [360, 365], [265, 425], [225, 510], [275, 595], [420, 625], [560, 585], [620, 470], [640, 330], [700, 215], [820, 165], [955, 200], [1010, 300], [985, 420], [1005, 540], [1100, 600], [1222, 600])],
    blockers: [
      { shape: circ(150, 330, 58), label: 'Pond', style: 'water' },
      { shape: circ(1170, 120, 34), label: 'Old oak', style: 'tree' },
      { shape: circ(800, 640, 30), label: 'Boulder', style: 'rock' },
    ],
    props: [
      { kind: 'tree', x: 60, y: 520, s: 1.1 }, { kind: 'tree', x: 1230, y: 330 }, { kind: 'bush', x: 520, y: 420 },
      { kind: 'flower', x: 470, y: 300 }, { kind: 'flower', x: 760, y: 420 }, { kind: 'flower', x: 870, y: 520 },
      { kind: 'flower', x: 120, y: 650 }, { kind: 'grass', x: 330, y: 260 }, { kind: 'grass', x: 900, y: 360 },
      { kind: 'grass', x: 1140, y: 470 }, { kind: 'mushroom', x: 210, y: 220 }, { kind: 'bush', x: 1060, y: 60 },
      { kind: 'flower', x: 600, y: 80 }, { kind: 'grass', x: 700, y: 650 }, { kind: 'lily', x: 140, y: 320 },
      { kind: 'lily', x: 172, y: 345 }, { kind: 'stump', x: 480, y: 530 }, { kind: 'bush', x: 30, y: 30 },
    ],
    unlock: null,
  },
  {
    id: 'ruins', name: 'Sunken Ruins', order: 1, seed: 202,
    tagline: 'Hairpins between flooded walls',
    description: 'Ancient halls half-swallowed by a lagoon. The road doubles back on itself, so splash guardians can cover two lanes at once.',
    mechanics: ['Tight hairpin turns', 'Water and walls restrict placement', 'Strong splash positions between lanes'],
    difficultyStars: 2,
    theme: { ground: ['#b9c98f', '#98ad74'], ground2: '#c9d6a2', path: '#d9cdb0', pathEdge: '#8f8366', pathDetail: '#c6b893', accent: '#7fd6c8', sky: '#a6e0f0', water: '#3fa7b8' },
    paths: [P([40, 610], [250, 610], [300, 565], [300, 150], [345, 100], [435, 100], [480, 150], [480, 565], [525, 610], [635, 610], [680, 565], [680, 150], [725, 100], [835, 100], [880, 150], [880, 470], [925, 520], [1035, 520], [1080, 470], [1080, 245], [1125, 200], [1222, 200])],
    blockers: [
      { shape: rect(0, 0, 230, 250), label: 'Lagoon', style: 'water' },
      { shape: rect(1110, 560, 170, 160), label: 'Lagoon', style: 'water' },
      { shape: rect(560, 260, 40, 180), label: 'Ruined wall', style: 'wall' },
      { shape: rect(370, 230, 40, 120), label: 'Ruined wall', style: 'wall' },
      { shape: rect(760, 300, 40, 140), label: 'Ruined wall', style: 'wall' },
      { shape: rect(960, 300, 40, 110), label: 'Ruined wall', style: 'wall' },
      { shape: circ(560, 690, 40), label: 'Flooded pit', style: 'water' },
      { shape: circ(1180, 380, 40), label: 'Broken pillar', style: 'pillar' },
    ],
    props: [
      { kind: 'ruin', x: 160, y: 430 }, { kind: 'ruin', x: 960, y: 650 }, { kind: 'reed', x: 240, y: 230 },
      { kind: 'reed', x: 1100, y: 590 }, { kind: 'lily', x: 80, y: 120 }, { kind: 'lily', x: 150, y: 60 },
      { kind: 'lily', x: 1200, y: 640 }, { kind: 'grass', x: 400, y: 450 }, { kind: 'grass', x: 790, y: 530 },
      { kind: 'bush', x: 1020, y: 90 }, { kind: 'rock', x: 640, y: 40 }, { kind: 'grass', x: 210, y: 690 },
      { kind: 'reed', x: 40, y: 260 }, { kind: 'flower', x: 980, y: 440 },
    ],
    unlock: { victories: 1, shards: 150 },
  },
  {
    id: 'twinroot', name: 'Twinroot Crossing', order: 2, seed: 303,
    tagline: 'Two rifts, one road home',
    description: 'Two rifts open on either side of an ancient twin-trunked tree. Their roads braid together before the village. Cover both branches before the merge.',
    mechanics: ['Two entrances merge into one exit', 'Enemies alternate between branches', 'Coverage before the merge is key'],
    difficultyStars: 2,
    theme: { ground: ['#7cc47a', '#5aa865'], ground2: '#94d28a', path: '#d8bd8a', pathEdge: '#9c7a4c', pathDetail: '#c7a874', accent: '#ffb6d5', sky: '#b3e2ff', water: '#5ab0e0' },
    paths: [
      P([40, 90], [320, 90], [420, 150], [430, 240], [520, 300], [640, 340], ...twinTail),
      P([40, 650], [320, 650], [420, 590], [430, 500], [520, 440], [640, 420], ...twinTail),
    ],
    blockers: [
      { shape: circ(240, 370, 62), label: 'Twinroot tree', style: 'tree' },
      { shape: rect(560, 570, 240, 56), label: 'Creek', style: 'water' },
      { shape: circ(880, 560, 34), label: 'Mossy rock', style: 'rock' },
    ],
    props: [
      { kind: 'pinkTree', x: 640, y: 150 }, { kind: 'pinkTree', x: 1240, y: 430, s: 0.8 }, { kind: 'flower', x: 120, y: 250 },
      { kind: 'flower', x: 140, y: 500 }, { kind: 'bush', x: 790, y: 470 }, { kind: 'grass', x: 470, y: 200 },
      { kind: 'grass', x: 470, y: 560 }, { kind: 'mushroom', x: 980, y: 640 }, { kind: 'flower', x: 870, y: 120 },
      { kind: 'reed', x: 600, y: 650 }, { kind: 'lily', x: 700, y: 595 }, { kind: 'stump', x: 1240, y: 60 },
    ],
    unlock: { victories: 2, shards: 250 },
  },
  {
    id: 'frostglass', name: 'Frostglass Pass', order: 3, seed: 404,
    tagline: 'A long road through glittering ice',
    description: 'A frozen mountain pass. The road is long but the ledges between switchbacks are narrow. Long-range guardians shine on the high outcrops.',
    mechanics: ['Very long path', 'Placement only on snow ledges', 'High outcrops with long sightlines', 'Icy terrain blocks building'],
    difficultyStars: 3,
    theme: { ground: ['#dfeef8', '#c2dbee'], ground2: '#f2f8fd', path: '#9fb6cc', pathEdge: '#6d859e', pathDetail: '#b8cadb', accent: '#8fe0ff', sky: '#cfe8ff', water: '#8fd0f0' },
    paths: [P([40, 95], [600, 95], [1100, 105], [1185, 175], [1150, 265], [700, 285], [230, 290], [120, 360], [160, 450], [650, 465], [1140, 470], [1200, 545], [1140, 625], [650, 640], [62, 640])],
    buildZones: [
      rect(160, 150, 900, 80),
      rect(260, 345, 760, 60),
      rect(240, 525, 820, 60),
      circ(640, 40, 28),
      circ(1240, 330, 36),
      circ(46, 220, 32),
      circ(46, 470, 30),
      rect(1222, 30, 50, 60),
      rect(400, 672, 480, 34),
    ],
    blockers: [
      { shape: circ(420, 190, 26), label: 'Ice spire', style: 'ice' },
      { shape: circ(860, 190, 26), label: 'Ice spire', style: 'ice' },
      { shape: circ(600, 375, 24), label: 'Frozen pond', style: 'ice' },
      { shape: circ(440, 555, 24), label: 'Ice spire', style: 'ice' },
      { shape: circ(900, 555, 24), label: 'Ice spire', style: 'ice' },
    ],
    props: [
      { kind: 'pine', x: 40, y: 330 }, { kind: 'pine', x: 1230, y: 420 }, { kind: 'pine', x: 120, y: 30 },
      { kind: 'snowrock', x: 1060, y: 380 }, { kind: 'icicle', x: 160, y: 560 }, { kind: 'pine', x: 1100, y: 690 },
      { kind: 'snowrock', x: 220, y: 690 }, { kind: 'icicle', x: 1250, y: 140 }, { kind: 'pine', x: 900, y: 30 },
      { kind: 'snowrock', x: 330, y: 30 },
    ],
    unlock: { victories: 3, shards: 350 },
  },
  {
    id: 'market', name: 'Clockwork Market', order: 4, seed: 505,
    tagline: 'Two roads through a busy bazaar',
    description: 'A clockwork trading town with two separate roads. The central plaza can reach both — if you pay to clear the crates and carts.',
    mechanics: ['Two separate paths and gates', 'Central positions reach both roads', 'Removable obstacles cost gold'],
    difficultyStars: 3,
    theme: { ground: ['#d6b48a', '#c09a70'], ground2: '#e2c49e', path: '#8d7d74', pathEdge: '#5b4c45', pathDetail: '#a29189', accent: '#f0c050', sky: '#ffd9a8', water: '#5fb6d6' },
    paths: [
      P([40, 80], [250, 80], [320, 130], [280, 200], [160, 212], [120, 262], [170, 318], [480, 318], [800, 318], [1110, 318], [1160, 262], [1120, 212], [1000, 200], [960, 130], [1030, 80], [1222, 80]),
      P([40, 660], [250, 660], [320, 610], [280, 540], [160, 528], [120, 478], [170, 422], [480, 422], [800, 422], [1110, 422], [1160, 478], [1120, 528], [1000, 540], [960, 610], [1030, 660], [1222, 660]),
    ],
    blockers: [
      { shape: circ(640, 370, 22), label: 'Clock fountain', style: 'fountain' },
      { shape: rect(520, 120, 120, 60), label: 'Market stall', style: 'stall' },
      { shape: rect(640, 560, 120, 60), label: 'Market stall', style: 'stall' },
    ],
    obstacles: [
      { id: 'crates-a', x: 300, y: 370, r: 21, cost: 150, label: 'Spice crates', style: 'crates' },
      { id: 'barrels-b', x: 370, y: 370, r: 21, cost: 120, label: 'Oil barrels', style: 'barrels' },
      { id: 'cart-c', x: 440, y: 370, r: 21, cost: 150, label: 'Toy cart', style: 'cart' },
      { id: 'crates-d', x: 575, y: 370, r: 21, cost: 200, label: 'Gear crates', style: 'crates' },
      { id: 'cart-e', x: 705, y: 370, r: 21, cost: 200, label: 'Clock cart', style: 'cart' },
      { id: 'barrels-f', x: 840, y: 370, r: 21, cost: 150, label: 'Oil barrels', style: 'barrels' },
      { id: 'crates-g', x: 910, y: 370, r: 21, cost: 120, label: 'Spice crates', style: 'crates' },
      { id: 'cart-h', x: 980, y: 370, r: 21, cost: 150, label: 'Toy cart', style: 'cart' },
    ],
    props: [
      { kind: 'lamp', x: 420, y: 250 }, { kind: 'lamp', x: 860, y: 250 }, { kind: 'lamp', x: 420, y: 490 },
      { kind: 'lamp', x: 860, y: 490 }, { kind: 'gear', x: 60, y: 370 }, { kind: 'gear', x: 1220, y: 370 },
      { kind: 'banner', x: 760, y: 150 }, { kind: 'banner', x: 520, y: 600 }, { kind: 'gear', x: 640, y: 690 },
      { kind: 'bush', x: 220, y: 370 }, { kind: 'flower', x: 1060, y: 370 }, { kind: 'flower', x: 400, y: 160 },
    ],
    unlock: { victories: 4, shards: 450 },
  },
  {
    id: 'citadel', name: 'Rift Citadel', order: 5, seed: 606,
    tagline: 'Three rifts storm the last keep',
    description: 'The fractured heart of the rifts. Three entrances feed one road, and the rifts shift between waves. Premium platforms are few — choose wisely.',
    mechanics: ['Three entrances, one exit', 'Active rifts change between waves (telegraphed)', 'Limited premium platforms'],
    difficultyStars: 4,
    theme: { ground: ['#6f6a9a', '#575384'], ground2: '#847fae', path: '#c9b8e0', pathEdge: '#6a5a8c', pathDetail: '#b2a0cc', accent: '#ff7ad9', sky: '#3a2f6a', water: '#9a5ae0' },
    paths: [
      P([40, 380], [180, 380], [270, 310], [390, 280], [510, 330], [600, 370], ...citadelTail),
      P([420, 30], [420, 110], [520, 150], [640, 190], [700, 260], [690, 320], ...citadelTail),
      P([300, 686], [300, 610], [420, 570], [560, 570], [640, 490], [670, 410], ...citadelTail),
    ],
    routeNames: ['West rift', 'North rift', 'South rift'],
    routes: (wave: number) => {
      if (wave % 10 === 0) return [0, 1, 2];
      const r = [[0, 1], [0, 2], [1, 2]];
      return r[Math.floor((wave - 1) / 2) % 3];
    },
    buildZones: [
      rect(60, 150, 200, 120),
      rect(60, 470, 190, 150),
      rect(470, 210, 140, 70),
      rect(470, 430, 140, 80),
      rect(560, 30, 260, 110),
      rect(745, 200, 90, 70),
      rect(900, 450, 140, 100),
      rect(1150, 300, 110, 200),
      rect(820, 40, 120, 80),
      rect(1040, 230, 100, 100),
      rect(360, 640, 240, 60),
    ],
    blockers: [
      { shape: circ(970, 500, 22), label: 'Rift crystal', style: 'crystal' },
      { shape: circ(150, 545, 22), label: 'Rift crystal', style: 'crystal' },
      { shape: circ(1200, 400, 22), label: 'Rift crystal', style: 'crystal' },
    ],
    props: [
      { kind: 'crystal', x: 120, y: 60 }, { kind: 'crystal', x: 1230, y: 680, s: 0.7 }, { kind: 'brazier', x: 560, y: 350 },
      { kind: 'brazier', x: 940, y: 690 }, { kind: 'banner', x: 1240, y: 110 }, { kind: 'crystal', x: 700, y: 680, s: 0.6 },
      { kind: 'crystal', x: 30, y: 300, s: 0.6 },
    ],
    unlock: { victories: 6, shards: 600 },
  },
];

export const MAP_BY_ID: Record<string, MapDef> = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export function activeRoutes(map: MapDef, wave: number): number[] {
  if (map.routes) return map.routes(wave);
  return map.paths.map((_, i) => i);
}
