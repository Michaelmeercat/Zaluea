import type { EnemyType, UnitType } from '../core/types';
import { makeCanvas } from './draw';
import { drawEnemy, enemyArtExtent } from './enemyArt';
import { drawTowerBase, drawTowerFigure, type TowerLook } from './towerArt';

export const ENEMY_FRAMES = 8;
const TOWER_EXT = 64;

/** Caches pre-rendered sprites at the current device scale. Invalidated when the scale changes. */
export class SpriteCache {
  private scale = 1;
  private enemies = new Map<string, HTMLCanvasElement>();
  private towers = new Map<string, { base: HTMLCanvasElement; fig: HTMLCanvasElement }>();

  setScale(s: number) {
    const q = Math.round(s * 20) / 20;
    if (q !== this.scale) {
      this.scale = q;
      this.enemies.clear();
      this.towers.clear();
    }
  }
  get pxScale() {
    return this.scale;
  }

  enemy(type: EnemyType, frame: number, flash: boolean, phase = 1): HTMLCanvasElement {
    const key = `${type}|${frame}|${flash ? 1 : 0}|${phase}`;
    let cv = this.enemies.get(key);
    if (!cv) {
      const ext = enemyArtExtent(type);
      const s = this.scale;
      cv = makeCanvas(ext * 2 * s, ext * 2 * s);
      const c = cv.getContext('2d')!;
      c.scale(s, s);
      c.translate(ext, ext);
      drawEnemy(c, type, frame / ENEMY_FRAMES, phase);
      if (flash) {
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalCompositeOperation = 'source-atop';
        c.fillStyle = 'rgba(255,255,255,0.75)';
        c.fillRect(0, 0, cv.width, cv.height);
      }
      this.enemies.set(key, cv);
    }
    return cv;
  }

  tower(type: UnitType, look: TowerLook): { base: HTMLCanvasElement; fig: HTMLCanvasElement } {
    const key = `${type}|${look.levels.join('')}|${look.goldTrim ? 1 : 0}|${look.lyraOutfit ?? ''}|${look.heroLevel ?? 0}|${look.mode ?? ''}`;
    let e = this.towers.get(key);
    if (!e) {
      const s = this.scale;
      const base = makeCanvas(TOWER_EXT * 2 * s, TOWER_EXT * 2 * s);
      const bc = base.getContext('2d')!;
      bc.scale(s, s);
      bc.translate(TOWER_EXT, TOWER_EXT);
      drawTowerBase(bc, type, look);
      const fig = makeCanvas(TOWER_EXT * 2 * s, TOWER_EXT * 2 * s);
      const fc = fig.getContext('2d')!;
      fc.scale(s, s);
      fc.translate(TOWER_EXT, TOWER_EXT);
      drawTowerFigure(fc, type, look);
      e = { base, fig };
      this.towers.set(key, e);
    }
    return e;
  }

  static get towerExtent() {
    return TOWER_EXT;
  }
}

/** Render a standalone icon (base + figure) to a data URL, for shop and collection UI. */
const iconCache = new Map<string, string>();
export function towerIcon(type: UnitType, look: TowerLook = { levels: [0, 0, 0] }, size = 96): string {
  const key = `${type}|${look.levels.join('')}|${size}|${look.lyraOutfit ?? ''}|${look.heroLevel ?? ''}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const cv = makeCanvas(size, size);
  const c = cv.getContext('2d')!;
  const s = size / 76;
  c.scale(s, s);
  c.translate(38, 52);
  drawTowerBase(c, type, look);
  drawTowerFigure(c, type, look);
  const url = cv.toDataURL();
  iconCache.set(key, url);
  return url;
}

export function enemyIcon(type: EnemyType, size = 80): string {
  const key = `e|${type}|${size}`;
  const hit = iconCache.get(key);
  if (hit) return hit;
  const cv = makeCanvas(size, size);
  const c = cv.getContext('2d')!;
  const ext = type === 'colossus' ? 64 : type === 'brute' ? 34 : 22;
  const s = size / (ext * 2);
  c.scale(s, s);
  c.translate(ext, type === 'colossus' ? ext + 10 : ext);
  drawEnemy(c, type, 0.1, 1);
  const url = cv.toDataURL();
  iconCache.set(key, url);
  return url;
}
