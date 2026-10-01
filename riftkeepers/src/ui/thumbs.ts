import { MAP_BY_ID, WORLD_H, WORLD_W } from '../data/maps';
import { makeCanvas } from '../render/draw';
import { drawMapBackground, drawObstacle } from '../render/mapArt';
import { getRuntimeMap } from '../sim/sim';

const cache = new Map<string, string>();

/** Map thumbnail (optionally a "preview" variant with route arrows and entrance/gate labels). */
export function mapThumb(mapId: string, preview = false, w = 480): string {
  const key = `${mapId}|${preview}|${w}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const rm = getRuntimeMap(mapId);
  const s = w / WORLD_W;
  const cv = makeCanvas(w, WORLD_H * s);
  const c = cv.getContext('2d')!;
  c.scale(s, s);
  drawMapBackground(c, rm);
  for (const o of MAP_BY_ID[mapId].obstacles ?? []) drawObstacle(c, o);
  // rift portals
  for (const p of rm.paths) {
    const g = c.createRadialGradient(p.xs[0], p.ys[0], 2, p.xs[0], p.ys[0], 30);
    g.addColorStop(0, '#fff');
    g.addColorStop(0.3, '#ff9af0');
    g.addColorStop(1, 'rgba(120,40,200,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(p.xs[0], p.ys[0], 30, 0, Math.PI * 2);
    c.fill();
  }
  if (preview) {
    // flowing arrows along every route
    c.fillStyle = 'rgba(255,255,255,0.95)';
    c.strokeStyle = 'rgba(43,33,64,0.9)';
    c.lineWidth = 2;
    for (const p of rm.paths) {
      for (let d = 60; d < p.length - 40; d += 70) {
        let i = 0;
        while (i < p.cum.length - 1 && p.cum[i] < d) i++;
        const a = Math.atan2(p.ys[i] - p.ys[i - 1], p.xs[i] - p.xs[i - 1]);
        c.save();
        c.translate(p.xs[i], p.ys[i]);
        c.rotate(a);
        c.beginPath();
        c.moveTo(10, 0); c.lineTo(-6, -8); c.lineTo(-2, 0); c.lineTo(-6, 8);
        c.closePath();
        c.fill();
        c.stroke();
        c.restore();
      }
    }
    const def = MAP_BY_ID[mapId];
    const label = (x: number, y: number, text: string, col: string) => {
      c.font = '700 26px Fredoka, system-ui, sans-serif';
      const tw = c.measureText(text).width + 22;
      const lx = Math.min(Math.max(x, tw / 2 + 6), WORLD_W - tw / 2 - 6);
      const ly = Math.min(Math.max(y, 24), WORLD_H - 24);
      c.fillStyle = col;
      c.beginPath();
      c.roundRect(lx - tw / 2, ly - 18, tw, 36, 18);
      c.fill();
      c.fillStyle = '#fff';
      c.textAlign = 'center';
      c.fillText(text, lx, ly + 9);
    };
    const seen = new Set<string>();
    rm.paths.forEach((p, i) => {
      const k = `${p.xs[0]}|${p.ys[0]}`;
      if (!seen.has(k)) {
        seen.add(k);
        label(p.xs[0] + 40, p.ys[0] + (p.ys[0] > 600 ? -44 : 44), def.routeNames?.[i] ?? 'Rift', 'rgba(170,60,200,0.92)');
      }
    });
    const ends = new Set<string>();
    for (const p of rm.paths) {
      const n = p.xs.length - 1;
      const k = `${Math.round(p.xs[n])}|${Math.round(p.ys[n])}`;
      if (ends.has(k)) continue;
      ends.add(k);
      label(p.xs[n] - 40, p.ys[n] + (p.ys[n] > 600 ? -76 : 76), 'Gate', 'rgba(40,140,90,0.92)');
    }
  }
  const url = cv.toDataURL('image/jpeg', 0.86);
  cache.set(key, url);
  return url;
}
