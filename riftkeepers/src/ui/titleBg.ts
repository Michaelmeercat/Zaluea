import { drawTowerBase, drawTowerFigure } from '../render/towerArt';
import { drawEnemy } from '../render/enemyArt';
import { Rng } from '../core/rng';

/** Animated menu backdrop: floating islands drifting through a dusk sky. Returns a stop function. */
export function startTitleBackground(canvas: HTMLCanvasElement, reduced: boolean): () => void {
  const ctx = canvas.getContext('2d')!;
  let raf = 0;
  let running = true;
  const rng = new Rng(7);
  const stars = Array.from({ length: 90 }, () => ({ x: rng.next(), y: rng.next() * 0.6, s: rng.range(0.6, 1.8), p: rng.next() * 6 }));
  const clouds = Array.from({ length: 7 }, () => ({ x: rng.next(), y: 0.15 + rng.next() * 0.7, s: rng.range(0.6, 1.4), v: rng.range(0.004, 0.012) }));

  const resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = canvas.clientWidth * dpr;
    canvas.height = canvas.clientHeight * dpr;
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const island = (x: number, y: number, s: number, t: number, kind: number) => {
    ctx.save();
    ctx.translate(x, y + Math.sin(t * 0.8 + kind) * 8 * s);
    ctx.scale(s, s);
    // underside
    ctx.beginPath();
    ctx.moveTo(-110, 0);
    ctx.quadraticCurveTo(-80, 70, -20, 110);
    ctx.quadraticCurveTo(0, 130, 20, 105);
    ctx.quadraticCurveTo(80, 70, 110, 0);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, 0, 0, 120);
    g.addColorStop(0, '#9a6a4a');
    g.addColorStop(1, '#4a2a3a');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#2b2140';
    ctx.stroke();
    // crystals under
    ctx.fillStyle = '#ff8ae0';
    ctx.beginPath();
    ctx.moveTo(-10, 100); ctx.lineTo(0, 140); ctx.lineTo(10, 100);
    ctx.fill();
    ctx.stroke();
    // top grass
    ctx.beginPath();
    ctx.ellipse(0, 0, 112, 30, 0, 0, Math.PI * 2);
    const gg = ctx.createLinearGradient(0, -30, 0, 30);
    gg.addColorStop(0, kind === 1 ? '#e8f4ff' : '#a8e87a');
    gg.addColorStop(1, kind === 1 ? '#a8c8e8' : '#5aa848');
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.stroke();
    // road
    ctx.strokeStyle = '#e6c98f';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(-90, 6);
    ctx.quadraticCurveTo(0, -24, 90, 4);
    ctx.stroke();
    if (kind === 0) {
      ctx.save(); ctx.translate(-40, -2); drawTowerBase(ctx, 'archer', { levels: [0, 2, 0] }); drawTowerFigure(ctx, 'archer', { levels: [0, 2, 0] }); ctx.restore();
      ctx.save(); ctx.translate(48, -4); drawTowerBase(ctx, 'beacon', { levels: [3, 0, 0] }); drawTowerFigure(ctx, 'beacon', { levels: [3, 0, 0] }); ctx.restore();
      ctx.save(); ctx.translate(5, -12); ctx.scale(0.9, 0.9); drawEnemy(ctx, 'sproutling', (t * 0.8) % 1); ctx.restore();
    } else if (kind === 1) {
      ctx.save(); ctx.translate(-30, -4); drawTowerBase(ctx, 'warden', { levels: [3, 0, 1] }); drawTowerFigure(ctx, 'warden', { levels: [3, 0, 1] }); ctx.restore();
      ctx.save(); ctx.translate(40, -4); drawTowerBase(ctx, 'lyra', { levels: [0, 0, 0] }); drawTowerFigure(ctx, 'lyra', { levels: [0, 0, 0], heroLevel: 10 }); ctx.restore();
    } else {
      ctx.save(); ctx.translate(-36, -2); drawTowerBase(ctx, 'alchemist', { levels: [0, 3, 0] }); drawTowerFigure(ctx, 'alchemist', { levels: [0, 3, 0] }); ctx.restore();
      ctx.save(); ctx.translate(40, -10); drawTowerBase(ctx, 'orchard', { levels: [3, 0, 0] }); drawTowerFigure(ctx, 'orchard', { levels: [3, 0, 0] }); ctx.restore();
    }
    ctx.restore();
  };

  const frame = (ms: number) => {
    if (!running) return;
    const t = reduced ? 0 : ms / 1000;
    const W = canvas.width, H = canvas.height;
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#2a2060');
    sky.addColorStop(0.55, '#7a4aa0');
    sky.addColorStop(1, '#ff9ab8');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    for (const s of stars) {
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 2 + s.p);
      ctx.fillStyle = '#fff';
      ctx.fillRect(s.x * W, s.y * H, s.s * 2, s.s * 2);
    }
    ctx.globalAlpha = 1;
    // big rift swirl
    const rx = W * 0.82, ry = H * 0.2, rr = Math.min(W, H) * 0.12;
    const rg = ctx.createRadialGradient(rx, ry, 2, rx, ry, rr * 1.6);
    rg.addColorStop(0, 'rgba(255,255,255,0.95)');
    rg.addColorStop(0.2, 'rgba(255,140,230,0.8)');
    rg.addColorStop(0.6, 'rgba(140,60,220,0.45)');
    rg.addColorStop(1, 'rgba(80,30,160,0)');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(rx, ry, rr * 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,220,250,0.7)';
    ctx.lineWidth = 3;
    for (let k = 0; k < 4; k++) {
      ctx.beginPath();
      ctx.ellipse(rx, ry, rr * (1 - k * 0.2), rr * (0.7 - k * 0.12), 0.3, t * 1.5 + k, t * 1.5 + k + 2.4);
      ctx.stroke();
    }
    for (const c of clouds) {
      const x = ((c.x + t * c.v) % 1.3) - 0.15;
      ctx.fillStyle = 'rgba(255,240,250,0.18)';
      ctx.beginPath();
      ctx.ellipse(x * W, c.y * H, 120 * c.s, 30 * c.s, 0, 0, Math.PI * 2);
      ctx.ellipse(x * W + 60 * c.s, c.y * H - 16 * c.s, 70 * c.s, 26 * c.s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    const k = Math.min(W / 1400, H / 800) * 1.3;
    island(W * 0.18, H * 0.68, k * 1.1, t, 0);
    island(W * 0.5, H * 0.88, k * 0.8, t, 2);
    island(W * 0.84, H * 0.62, k * 0.95, t, 1);
    if (!reduced) raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
  };
}
