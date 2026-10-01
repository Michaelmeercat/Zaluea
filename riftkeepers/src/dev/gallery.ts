import { MAPS } from '../data/maps';
import { getRuntimeMap } from '../sim/sim';
import { drawMapBackground, drawObstacle } from '../render/mapArt';
import { drawEnemy } from '../render/enemyArt';
import { drawTowerBase, drawTowerFigure } from '../render/towerArt';
import { ENEMY_ORDER } from '../data/enemies';
import type { UnitType } from '../core/types';

const g = document.getElementById('g')!;
const which = new URLSearchParams(location.search).get('show') || 'maps';
if (which === 'maps') {
  for (const m of MAPS) {
    const cv = document.createElement('canvas');
    cv.width = 1280; cv.height = 720;
    const c = cv.getContext('2d')!;
    drawMapBackground(c, getRuntimeMap(m.id));
    for (const o of m.obstacles ?? []) drawObstacle(c, o);
    g.appendChild(cv);
  }
} else {
  const cv = document.createElement('canvas');
  cv.width = 1400; cv.height = 900;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#8fd16a'; c.fillRect(0, 0, 1400, 900);
  c.scale(2, 2);
  ENEMY_ORDER.forEach((t, i) => {
    c.save(); c.translate(40 + i * 62, i === 9 ? 70 : 40); if (t === 'colossus') c.scale(0.8, 0.8); drawEnemy(c, t, 0.2, 1); c.restore();
  });
  [1, 2, 3].forEach((ph, i) => { c.save(); c.translate(40 + i * 90, 140); c.scale(0.8, 0.8); drawEnemy(c, 'colossus', 0, ph); c.restore(); });
  const types: UnitType[] = ['archer', 'alchemist', 'warden', 'storm', 'beacon', 'orchard', 'lyra'];
  const lvls = [[0, 0, 0], [2, 0, 0], [5, 2, 0], [0, 5, 2], [2, 0, 5]];
  types.forEach((t, row) => {
    lvls.forEach((l, col) => {
      c.save(); c.translate(320 + col * 70, 50 + row * 60);
      drawTowerBase(c, t, { levels: l, heroLevel: col * 2 + 1 }); drawTowerFigure(c, t, { levels: l, heroLevel: col * 2 + 1 }); c.restore();
    });
  });
  g.appendChild(cv);
}

if (which === 'icon') {
  const size = +(new URLSearchParams(location.search).get('size') || '512');
  const maskable = new URLSearchParams(location.search).get('maskable') === '1';
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  cv.id = 'icon';
  const c = cv.getContext('2d')!;
  const s = size / 512;
  c.scale(s, s);
  const r = maskable ? 0 : 110;
  c.beginPath();
  c.roundRect(0, 0, 512, 512, r);
  const g = c.createLinearGradient(0, 0, 0, 512);
  g.addColorStop(0, '#3a2a80'); g.addColorStop(0.6, '#7a4aa0'); g.addColorStop(1, '#ff9ab8');
  c.fillStyle = g; c.fill();
  c.save(); c.clip();
  const rg = c.createRadialGradient(256, 190, 4, 256, 190, 190);
  rg.addColorStop(0, '#ffffff'); rg.addColorStop(0.18, '#ff9af0'); rg.addColorStop(0.55, 'rgba(140,60,220,0.7)'); rg.addColorStop(1, 'rgba(80,30,160,0)');
  c.fillStyle = rg; c.beginPath(); c.arc(256, 190, 190, 0, Math.PI * 2); c.fill();
  c.strokeStyle = 'rgba(255,230,250,0.85)'; c.lineWidth = 10;
  for (let k = 0; k < 3; k++) { c.beginPath(); c.ellipse(256, 190, 120 - k * 30, 80 - k * 20, 0.3, k * 2, k * 2 + 2.6); c.stroke(); }
  // island
  c.beginPath(); c.moveTo(96, 380); c.quadraticCurveTo(150, 470, 256, 500); c.quadraticCurveTo(362, 470, 416, 380); c.closePath();
  c.fillStyle = '#7a4a3a'; c.fill(); c.lineWidth = 8; c.strokeStyle = '#2b2140'; c.stroke();
  c.beginPath(); c.ellipse(256, 380, 165, 46, 0, 0, Math.PI * 2); c.fillStyle = '#8fd16a'; c.fill(); c.stroke();
  c.save(); c.translate(256, 370); c.scale(4.2, 4.2);
  drawTowerBase(c, 'lyra', { levels: [0, 0, 0] }); drawTowerFigure(c, 'lyra', { levels: [0, 0, 0], heroLevel: 10 });
  c.restore();
  c.restore();
  g.addColorStop(0, '#000');
  document.body.style.margin = '0';
  g; document.getElementById('g')!.replaceChildren(cv);
}

if (which === 'bot') {
  const q = new URLSearchParams(location.search);
  Promise.all([import('../sim/sim'), import('../sim/bot'), import('../render/renderer')]).then(([simMod, botMod, rMod]) => {
    const sim = new simMod.Sim(simMod.makeConfig({ mapId: q.get('map') || 'market', difficulty: (q.get('diff') as any) || 'normal', seed: 1234 }));
    sim.recordEvents = false;
    const plan = {
      build: [
        { type: 'archer', paths: [0, 2] }, { type: 'alchemist', paths: [0, 2] }, { type: 'archer', paths: [1, 2] },
        { type: 'warden', paths: [1, 0] }, { type: 'alchemist', paths: [2, 0] }, { type: 'storm', paths: [0, 2] },
        { type: 'lyra', paths: [0, 0] }, { type: 'beacon', paths: [0, 1] }, { type: 'archer', paths: [0, 2] },
      ],
      repeat: { type: 'alchemist', paths: [0, 1] }, baseCount: 3, waveDiv: 4,
    } as any;
    const bot = new botMod.Bot(sim, plan);
    const until = +(q.get('wave') || '20');
    bot.act();
    while (sim.wave < until && sim.state === 'playing') {
      sim.startWave();
      let n = 0;
      while (sim.waveActive && sim.state === 'playing') { sim.step(); if (++n % 120 === 0) { bot.act(); bot.useAbilities(); } }
      bot.act();
    }
    // play into the next wave for a busy scene
    sim.startWave();
    for (let i = 0; i < +(q.get('ticks') || '900'); i++) sim.step();
    sim.recordEvents = true;
    const cv = document.createElement('canvas');
    cv.style.width = '1280px'; cv.style.height = '720px';
    document.getElementById('g')!.replaceChildren(cv);
    const r = new rMod.Renderer(cv);
    r.resize(1280, 720);
    const ui = { selectedId: 0, placing: null, hoverObstacle: null, goldTrim: false, lyraOutfit: 'violet', prismatic: false, showRoutes: true };
    let last = performance.now(), frames = 0, t0 = last;
    const fps: number[] = [];
    const speed = +(q.get('speed') || '3');
    const loop = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      for (let k = 0; k < Math.round(speed * dt * 60); k++) sim.step();
      r.consume(sim.events, false); sim.events.length = 0;
      r.render(sim, ui as any, dt * speed, now / 1000);
      frames++;
      if (now - t0 > 1000) { fps.push(frames); frames = 0; t0 = now; (window as any).__fps = fps; (window as any).__info = { wave: sim.wave, enemies: sim.enemies.length, proj: sim.projectiles.length, lives: sim.lives, towers: sim.towers.map((t) => t.type + t.levels.join('')) }; }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
}
