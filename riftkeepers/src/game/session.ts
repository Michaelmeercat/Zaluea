import { audio, type Sfx } from '../audio/audio';
import type { AbilityId, Difficulty, EnemyType, TargetMode, UnitType, Variant } from '../core/types';
import { hashString } from '../core/rng';
import { DIFFICULTY } from '../data/difficulty';
import { ENEMIES } from '../data/enemies';
import { HERO } from '../data/hero';
import { MAP_BY_ID } from '../data/maps';
import { CHALLENGES } from '../data/progression';
import { ENEMY_TIPS, VARIANT_TIPS, type MechanicTip } from '../data/tips';
import { TOWERS } from '../data/towers';
import { getWave } from '../data/waves';
import { Renderer, type PlacingState, type RenderUi } from '../render/renderer';
import type { SimEvent, Tower } from '../sim/entities';
import { Sim, STEP, type RunSnapshot } from '../sim/sim';
import { btn, clear, fmt, h, icon, setText } from '../ui/dom';
import type { App, Screen } from '../ui/app';
import { settingsPanel } from '../ui/screens/menus';
import { SHOP_ORDER, ShopView, TowerPanel, sandboxTools } from './panels';
import {
  campaignConfig, challengeConfig, checkAchievements, dailyConfig, dailyInfo, newRunId, sandboxConfig, settleEndless, settleRun, towerName,
} from './progression';
import { Tutorial } from './tutorial';

export interface SessionParams {
  mapId?: string;
  difficulty?: Difficulty;
  pure?: boolean;
  resume?: boolean;
  tutorial?: boolean;
  challengeId?: string;
  daily?: string;
  sandbox?: string;
}

const ABILITY_KEYS = ['q', 'w', 'e', 'r', 't', 'y'];
const ABILITY_ICON: Record<string, Parameters<typeof icon>[0]> = {
  riftPulse: 'star', timeAnchor: 'auto', focusBarrage: 'target', chemBurst: 'skull', blizzard: 'crystal', overdrive: 'bolt',
  solarFlare: 'crown', instantHarvest: 'shard', bank: 'coin',
};

/** Dev-only hooks (stripped from the visible UI; used by automated verification). */
declare global {
  interface Window {
    __rk?: { sim: () => Sim; session: GameSession; audio?: typeof audio };
  }
}

export class GameSession implements Screen {
  el: HTMLElement;
  sim!: Sim;
  renderer: Renderer;
  canvas: HTMLCanvasElement;
  field: HTMLElement;
  side: HTMLElement;
  runId: string;
  params: SessionParams;
  speed = 1;
  paused = false;
  autoStart: boolean;
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0;
  private alive = true;
  selectedId = 0;
  placing: PlacingState | null = null;
  private placeConfirm: HTMLElement | null = null;
  private placebar: HTMLElement | null = null;
  private hoverObstacle: string | null = null;
  private pointer: { id: number; x: number; y: number; type: string; moved: boolean; down: boolean } | null = null;
  private shop!: ShopView;
  private panel!: TowerPanel;
  private sideMode: 'shop' | 'panel' = 'shop';
  private hud: Record<string, HTMLElement> = {};
  private abilitiesEl: HTMLElement;
  private abilityKeys = '';
  private abilityBtns: { el: HTMLButtonElement; key: string }[] = [];
  private bossBar: HTMLElement;
  private tipEl: HTMLElement | null = null;
  private countdownEl: HTMLElement | null = null;
  private countdown = 0;
  private seenMechanics = new Set<string>();
  private tipShownFor = 0;
  private ro: ResizeObserver;
  private preWave: RunSnapshot | null = null;
  private tutorial: Tutorial | null = null;
  private startAllowed = true;
  private ended = false;
  private killsAtSettle = 0;
  private endlessStartWave = 0;
  private uiTimer = 0;
  private hlEl: HTMLElement | null = null;
  private pointers: HTMLElement[] = [];
  private lastWaveGold = 0;
  private bossMusic = false;
  private listeners: [EventTarget, string, EventListener, AddEventListenerOptions?][] = [];

  constructor(public app: App, params: SessionParams) {
    this.params = params;
    this.autoStart = app.save.settings.autoStart;
    this.runId = newRunId();
    this.canvas = h('canvas', { 'aria-label': 'Battlefield', role: 'img' }) as HTMLCanvasElement;
    this.renderer = new Renderer(this.canvas);
    this.applyQuality();
    this.abilitiesEl = h('div', { class: 'abilities' });
    this.bossBar = h('div', { class: 'boss-bar', style: 'display:none' });
    this.field = h('div', { class: 'field' }, this.canvas, this.abilitiesEl, this.bossBar);
    this.side = h('div', { class: 'side' });
    this.el = h('div', { class: 'game' }, this.buildHud(), this.field, this.side);
    this.initSim();
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.field);
    this.bindInput();
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
    audio.playMusic('game');
    if (import.meta.env.DEV) window.__rk = { sim: () => this.sim, session: this, audio };
  }

  // ------------------------------------------------------------------ setup
  private initSim(snapshot?: RunSnapshot) {
    const app = this.app;
    const p = this.params;
    const seed = (Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0;
    if (snapshot) {
      this.sim = Sim.restore(snapshot);
    } else if (p.resume && app.save.activeRun) {
      const run = app.save.activeRun;
      this.sim = Sim.restore(run.snapshot);
      this.runId = run.runId;
      if (run.midWave) setTimeout(() => app.toast(`Restored to the start of wave ${this.sim.wave + 1}. Purchases made during that wave were refunded.`, '', 4500), 400);
    } else if (p.tutorial) {
      const cfg = campaignConfig(app.save, 'meadow', 'easy', false, seed);
      cfg.mode = 'tutorial';
      cfg.allowedTowers = Array.from(new Set([...cfg.allowedTowers, 'archer', 'warden', 'alchemist'])) as typeof cfg.allowedTowers;
      this.sim = new Sim(cfg);
    } else if (p.challengeId) {
      const ch = CHALLENGES.find((c) => c.id === p.challengeId)!;
      this.sim = new Sim(challengeConfig(app.save, ch, seed));
    } else if (p.daily) {
      this.sim = new Sim(dailyConfig(dailyInfo(p.daily)));
    } else if (p.sandbox) {
      this.sim = new Sim(sandboxConfig(app.save, p.sandbox));
      this.sim.gold = 0;
    } else {
      this.sim = new Sim(campaignConfig(app.save, p.mapId ?? 'meadow', p.difficulty ?? 'easy', !!p.pure, seed));
    }
    if (this.sim.cfg.endless) this.endlessStartWave = this.sim.cfg.finalWave;
    // mechanics already seen in earlier waves of this run
    for (let w = 1; w <= this.sim.wave; w++) this.markSeen(w);
    this.shop = new ShopView(this.sim, app.save, { onPick: (t) => this.pickShop(t) });
    this.panel = new TowerPanel(this.sim, {
      upgrade: (t, path) => this.doUpgrade(t, path),
      sell: (t) => this.doSell(t),
      target: (t, m) => this.doTarget(t, m),
      mode: (t, m) => { this.sim.setMode(t.id, m); audio.play('click'); this.afterCommand(); },
      withdraw: (t) => { if (this.sim.withdrawBank(t.id).ok) { audio.play('coin'); this.afterCommand(); } },
      close: () => this.select(0),
      info: (t, path) => this.showPathInfo(t, path),
    }, app.save);
    this.showSide('shop');
    this.shop.setNextWave(this.sim);
    if (!this.sim.cfg.sandbox) this.saveRun();
    if (p.tutorial && !snapshot) this.startTutorial();
    else this.maybeShowTip();
  }

  private buildHud(): HTMLElement {
    const H = this.hud;
    H.gold = h('span', { 'data-testid': 'gold-val' }, '0');
    H.lives = h('span', { 'data-testid': 'lives-val' }, '0');
    H.wave = h('span', { 'data-testid': 'wave-val' }, '');
    H.waveBar = h('i');
    H.speed = btn([icon('fast'), h('span', null, '1×')], () => this.cycleSpeed(), 'btn btn-dark btn-small speed', { 'data-testid': 'speed', title: 'Game speed (Tab)', 'aria-label': 'Game speed' });
    H.auto = btn([icon('auto'), h('span', { class: 'lbl' }, 'Auto')], () => this.toggleAuto(), 'btn btn-dark btn-small', { 'data-testid': 'auto', title: 'Auto-start next wave', 'aria-pressed': 'false' });
    H.start = btn([icon('play'), h('span', null, 'Start Wave')], () => this.startWave(), 'btn btn-gold btn-small start-btn', { 'data-testid': 'start-wave', title: 'Start next wave (Space)' });
    return h('div', { class: 'hud' },
      btn([icon('pause')], () => this.pause(), 'btn btn-dark btn-small btn-icon', { 'aria-label': 'Pause', title: 'Pause (Esc)', 'data-testid': 'pause' }),
      h('span', { class: 'stat', title: 'Gold', 'data-testid': 'gold' }, icon('coin'), H.gold),
      h('span', { class: 'stat', title: 'Lives', 'data-testid': 'lives' }, icon('heart'), H.lives),
      h('span', { class: 'stat', title: 'Wave' }, icon('wave'), h('span', { class: 'wavebox' }, H.wave, h('span', { class: 'wavebar' }, H.waveBar))),
      h('span', { class: 'grow' }),
      H.auto, H.speed, H.start,
    );
  }

  private applyQuality() {
    const s = this.app.save.settings;
    this.renderer.setQuality({ level: s.quality, reducedEffects: s.reducedEffects, dprCap: s.quality === 'high' ? 2 : 1.5 });
  }

  private resize() {
    const r = this.field.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    this.renderer.resize(r.width, r.height);
    this.positionConfirm();
    this.tutorial?.reposition();
  }

  private on(target: EventTarget, type: string, fn: EventListener, opts?: AddEventListenerOptions) {
    target.addEventListener(type, fn, opts);
    this.listeners.push([target, type, fn, opts]);
  }

  // ------------------------------------------------------------------ loop
  private frame = (now: number) => {
    if (!this.alive) return;
    this.raf = requestAnimationFrame(this.frame);
    let dt = (now - this.last) / 1000;
    this.last = now;
    if (dt > 0.1) dt = 0.1; // no catch-up bursts after a stall
    if (dt < 0) dt = 0;
    const running = !this.paused && !this.app.modalOpen && this.sim.state === 'playing';
    if (running) {
      this.acc += dt * this.speed;
      let steps = 0;
      const max = 4 * this.speed + 2;
      while (this.acc >= STEP && steps < max) {
        this.sim.step();
        this.acc -= STEP;
        steps++;
      }
      if (steps >= max) this.acc = 0;
      this.time += dt;
      if (this.countdown > 0) {
        this.countdown -= dt;
        if (this.countdownEl) setText(this.countdownEl.querySelector('.msg') as HTMLElement, `Next wave in ${Math.ceil(this.countdown)}…`);
        if (this.countdown <= 0) {
          this.clearCountdown();
          this.startWave();
        }
      }
    }
    this.processEvents();
    const ui: RenderUi = {
      selectedId: this.selectedId, placing: this.placing, hoverObstacle: this.hoverObstacle, goldTrim: this.app.save.cosmetics.trim,
      lyraOutfit: this.app.save.cosmetics.lyra, prismatic: this.app.save.cosmetics.prismatic, showRoutes: true,
    };
    if (!this.app.save.settings.screenShake) this.renderer.shake = 0;
    this.renderer.render(this.sim, ui, running ? dt * this.speed : this.sim.state !== 'playing' ? dt : 0, this.time);
    this.updateHud(dt);
  };

  private processEvents() {
    const evs = this.sim.events;
    if (!evs.length) return;
    this.renderer.consume(evs, this.app.save.cosmetics.prismatic);
    let hadWaveEnd = false;
    for (const e of evs) {
      this.sound(e);
      if (e.t === 'waveEnd' && this.tutorial) this.tutorial.waveGold = this.sim.stats.goldEarned - this.lastWaveGold;
      this.tutorial?.onEvent(e);
      switch (e.t) {
        case 'waveStart': {
          this.lastWaveGold = this.sim.stats.goldEarned;
          this.dismissTip();
          const def = this.sim.currentWaveDef;
          if (def?.boss) this.banner(`Wave ${e.wave}`, 'A Rift Colossus approaches!', true);
          else if (e.wave === this.sim.finalWave) this.banner(`Final wave!`, `Wave ${e.wave}`);
          this.markSeen(e.wave);
          this.shop.setNextWave(this.sim);
          this.saveRun();
          break;
        }
        case 'waveEnd':
          hadWaveEnd = true;
          break;
        case 'victory':
          this.onVictory();
          break;
        case 'defeat':
          this.onDefeat();
          break;
      }
    }
    evs.length = 0;
    if (hadWaveEnd && this.sim.state === 'playing') this.onWaveEnd();
  }

  private sound(e: SimEvent) {
    const map: Partial<Record<string, Sfx>> = { arrow: 'arrow', flask: 'flask', shard: 'shard', spark: 'spark', bolt: 'bolt', rail: 'rail', zap: 'zap' };
    switch (e.t) {
      case 'shot': audio.play(map[e.kind] ?? 'arrow'); break;
      case 'boom': if (e.kind !== 'secondary') audio.play('boom'); break;
      case 'kill': audio.play(e.big ? 'bigkill' : 'kill', e.type === 'skitter' ? 1.3 : 1); break;
      case 'leak': audio.play('leak'); break;
      case 'nova': audio.play('freeze'); break;
      case 'pulse': audio.play('pulse'); break;
      case 'ability': audio.play('ability'); break;
      case 'place': audio.play('place'); break;
      case 'upgrade': audio.play('upgrade'); break;
      case 'sell': audio.play('sell'); break;
      case 'collect': audio.play('coin'); break;
      case 'waveStart': audio.play(e.boss ? 'bossWarn' : 'waveStart'); break;
      case 'waveEnd': audio.play('waveEnd'); break;
      case 'levelUp': audio.play('levelup'); break;
      case 'shieldUp': audio.play('shield'); break;
      case 'summon': audio.play('summon'); break;
      case 'bossPhase': audio.play('bossWarn'); break;
      case 'victory': audio.play('victory'); break;
      case 'defeat': audio.play('defeat'); break;
    }
  }

  // ------------------------------------------------------------------ HUD
  private updateHud(dt: number) {
    const s = this.sim;
    const H = this.hud;
    setText(H.gold, s.cfg.sandbox ? '∞' : fmt(s.gold));
    setText(H.lives, s.cfg.sandbox ? '∞' : fmt(s.lives));
    const waveTxt = s.cfg.sandbox ? 'Sandbox' : s.cfg.endless ? `${s.wave} (endless)` : `${s.wave}/${s.finalWave}`;
    setText(H.wave, waveTxt);
    const prog = s.waveActive ? Math.min(1, (s.spawnIdx / Math.max(1, s.spawnQueue.length)) * 0.5 + (s.spawnIdx >= s.spawnQueue.length ? 0.5 * (1 - Math.min(1, s.enemies.length / 30)) : 0)) : 0;
    H.waveBar.style.width = `${Math.round(prog * 100)}%`;
    const startLbl = H.start.lastChild as HTMLElement;
    const canStart = !s.waveActive && s.state === 'playing' && !s.cfg.sandbox && this.startAllowed;
    setText(startLbl, s.cfg.sandbox ? 'Sandbox' : s.state === 'victory' ? 'Victory!' : s.state === 'defeat' ? 'Defeated' : s.waveActive ? `Wave ${s.wave}…` : `Start Wave ${s.wave + 1}`);
    (H.start as HTMLButtonElement).disabled = !canStart;
    H.start.classList.toggle('pulse', canStart && s.wave === 0);
    setText(H.speed.lastChild as HTMLElement, `${this.speed}×`);
    H.auto.classList.toggle('active', this.autoStart);
    H.auto.setAttribute('aria-pressed', String(this.autoStart));
    // side
    const sel = this.selectedId ? s.towerById(this.selectedId) : undefined;
    if (this.selectedId && !sel) this.select(0);
    if (this.sideMode === 'shop') this.shop.update(this.placing?.type ?? null);
    else if (sel) this.panel.update(sel);
    this.updateAbilities();
    this.uiTimer += dt;
    if (this.uiTimer > 0.2) {
      this.uiTimer = 0;
      this.updateBossBar();
      const boss = s.enemies.some((e) => e.def.boss);
      if (boss !== this.bossMusic) {
        this.bossMusic = boss;
        audio.playMusic(boss ? 'boss' : 'game');
      }
    }
    if (this.placing && this.placebar) this.updatePlacebar();
  }

  private updateAbilities() {
    const list = this.sim.abilities();
    const keys = list.map((a) => a.key).join('|');
    if (keys !== this.abilityKeys) {
      this.abilityKeys = keys;
      clear(this.abilitiesEl);
      this.abilityBtns = list.map((a, i) => {
        const k = ABILITY_KEYS[i] ?? '';
        const b = h('button', { class: 'ability', type: 'button', title: `${a.name}${k ? ` (${k.toUpperCase()})` : ''}`, 'aria-label': a.name, 'data-testid': `ability-${a.id}`,
          onClick: () => this.useAbility(a.towerId, a.id) },
          icon(ABILITY_ICON[a.id] ?? 'star'), h('span', { class: 'cdmask' }), k ? h('span', { class: 'k' }, k.toUpperCase()) : null, h('span', { class: 'n' }, a.name.split(' ')[0])) as HTMLButtonElement;
        this.abilitiesEl.appendChild(b);
        return { el: b, key: a.key };
      });
    }
    list.forEach((a, i) => {
      const b = this.abilityBtns[i]?.el;
      if (!b) return;
      const pct = a.ready ? 0 : a.max > 0 ? Math.min(100, (a.cd / a.max) * 100) : 100;
      b.style.setProperty('--cd', `${pct}%`);
      b.classList.toggle('ready', a.ready);
      b.classList.toggle('notready', !a.ready);
      const n = b.querySelector('.n') as HTMLElement;
      const label = a.id === 'bank' ? `${a.value ?? 0}` : a.charges !== undefined ? `×${a.charges}` : a.ready ? a.name.split(' ')[0] : `${Math.ceil(a.cd)}s`;
      setText(n, label);
    });
  }

  private updateBossBar() {
    const bosses = this.sim.enemies.filter((e) => e.def.boss);
    if (!bosses.length) {
      this.bossBar.style.display = 'none';
      return;
    }
    const b = bosses[0];
    this.bossBar.style.display = '';
    const pct = Math.max(0, b.hp / b.maxHp) * 100;
    const shield = b.boss ? (b.boss.tempShield + b.shield) / b.maxHp * 100 : 0;
    const phase = b.boss?.phase ?? 1;
    this.bossBar.innerHTML = '';
    this.bossBar.append(
      h('div', null, `Rift Colossus${bosses.length > 1 ? ` ×${bosses.length}` : ''} — Phase ${phase}${b.boss?.hardenT ? ' · HARDENED' : ''}${b.boss?.tempShield ? ' · SHIELDED' : ''}`),
      h('div', { class: 'bar' }, h('i', { style: `width:${pct}%` }), h('b', { style: `left:${pct}%;width:${Math.min(100 - pct, shield)}%` }),
        h('span', { class: 'mk', style: 'left:65%' }), h('span', { class: 'mk', style: 'left:30%' })),
    );
  }

  private banner(title: string, sub = '', boss = false) {
    const b = h('div', { class: `banner ${boss ? 'boss' : ''}` }, title, sub ? h('small', null, sub) : null);
    this.field.appendChild(b);
    setTimeout(() => b.remove(), 2300);
  }

  // ------------------------------------------------------------------ side panel
  private showSide(mode: 'shop' | 'panel') {
    this.sideMode = mode;
    clear(this.side);
    if (mode === 'shop') {
      this.side.appendChild(this.shop.el);
      if (this.sim.cfg.sandbox) this.side.appendChild(sandboxTools(this.sim, () => this.resetSandboxTowers(), (s) => this.app.toast(s)));
    } else {
      this.panel.reset();
      this.side.appendChild(this.panel.el);
    }
  }

  private select(id: number) {
    this.selectedId = id;
    if (id) {
      this.cancelPlacing();
      this.showSide('panel');
    } else if (this.sideMode !== 'shop') this.showSide('shop');
  }

  private showPathInfo(t: Tower, path: number) {
    if (t.type === 'lyra') return;
    const def = TOWERS[t.type];
    const p = def.paths[path];
    this.app.modal((close) => h('div', null,
      h('h2', null, h('span', { class: 'dot', style: `background:${p.color};width:16px;height:16px;margin-right:6px` }), `${def.name}: ${p.name}`),
      h('ol', { class: 'small' }, ...p.upgrades.map((u, i) => h('li', { style: i < t.levels[path] ? 'opacity:.6' : '' },
        h('b', null, u.name), i < t.levels[path] ? ' ✓' : '', ` — ${u.desc} `, h('span', { class: 'muted' }, `(${fmt(this.sim.priceFor(u.cost ?? def.cost * [0.6, 1.2, 3, 8, 22][i], t.x, t.y))}g)`)))),
      h('p', { class: 'small muted' }, 'Cross-path rule: up to two paths; only one beyond tier 2. One tier-5 per tower type and path at a time.'),
      h('div', { class: 'actions' }, btn('Close', close, 'btn btn-gold', { 'data-autofocus': true })),
    ));
  }

  // ------------------------------------------------------------------ commands
  private afterCommand() {
    this.shop.setNextWave(this.sim);
    if (!this.sim.waveActive) this.saveRun();
  }

  private pickShop(type: UnitType) {
    if (this.sim.state !== 'playing') return;
    const av = this.shop.availability(type);
    if (!av.ok) {
      audio.play('error');
      this.app.toast(av.reason, 'bad');
      return;
    }
    if (this.placing?.type === type) {
      this.cancelPlacing();
      return;
    }
    audio.play('click');
    this.select(0);
    this.startPlacing(type);
  }

  private startPlacing(type: UnitType) {
    this.cancelPlacing();
    const c = this.renderer.screenToWorld(this.renderer.cssW / 2, this.renderer.cssH / 2);
    this.placing = { type, x: c.x, y: c.y, valid: false, visible: false };
    this.placebar = h('div', { class: 'placebar', role: 'status' }, h('span', { class: 'msg' }, ''), btn([icon('close')], () => this.cancelPlacing(), 'btn btn-small btn-red btn-icon', { 'aria-label': 'Cancel placement', 'data-testid': 'place-cancel-bar' }));
    // shown in the side panel so it never collides with the on-field confirm buttons
    this.side.prepend(this.placebar);
    this.updatePlacebar();
    this.tutorial?.onEvent({ t: 'ui', what: 'placing', type });
  }

  private updatePlacebar() {
    if (!this.placing || !this.placebar) return;
    const pl = this.placing;
    const msg = this.placebar.querySelector('.msg') as HTMLElement;
    const name = pl.type === 'lyra' ? 'Lyra' : TOWERS[pl.type].name;
    const price = this.sim.towerCost(pl.type, pl.x, pl.y);
    const base = this.sim.towerCost(pl.type);
    let text: string;
    let bad = false;
    if (!pl.visible) text = `${name} — ${this.sim.cfg.sandbox ? 'free' : fmt(price) + 'g'}. Tap the battlefield to position.`;
    else {
      const chk = this.sim.checkPlace(pl.type, pl.x, pl.y);
      if (!chk.ok) { text = chk.reason!; bad = true; }
      else if (this.sim.gold < price) { text = `Need ${fmt(price)} gold`; bad = true; }
      else text = `${name}: ${this.sim.cfg.sandbox ? 'free' : fmt(price) + 'g'}${price < base ? ` (beacon discount, was ${base})` : ''}`;
    }
    setText(msg, text);
    msg.classList.toggle('bad', bad);
  }

  private updatePlacement(wx: number, wy: number) {
    if (!this.placing) return;
    this.placing.x = Math.round(wx);
    this.placing.y = Math.round(wy);
    this.placing.visible = true;
    const chk = this.sim.checkPlace(this.placing.type, this.placing.x, this.placing.y);
    this.placing.valid = chk.ok && this.sim.gold >= this.sim.towerCost(this.placing.type, this.placing.x, this.placing.y);
    this.updatePlacebar();
  }

  private confirmShownAt = 0;

  private showConfirm() {
    if (!this.placing) return;
    this.confirmShownAt = performance.now();
    if (!this.placeConfirm) {
      this.placeConfirm = h('div', { class: 'place-confirm' },
        btn([icon('close')], () => this.cancelPlacing(), 'btn btn-red', { 'aria-label': 'Cancel placement', 'data-testid': 'place-cancel' }),
        btn([icon('check')], () => { if (performance.now() - this.confirmShownAt > 300) this.confirmPlace(); }, 'btn btn-teal', { 'aria-label': 'Confirm placement', 'data-testid': 'place-confirm' }),
      );
      this.field.appendChild(this.placeConfirm);
    }
    this.positionConfirm();
  }

  private positionConfirm() {
    if (!this.placeConfirm || !this.placing) return;
    // keep the buttons away from the finger (which sits ~48px below the preview): above the guardian,
    // or beside it when there is no room above
    const p = this.renderer.worldToScreen(this.placing.x, this.placing.y);
    const fig = 58 * this.renderer.scale + 8;
    let y = p.y - fig - 56;
    let x = p.x;
    if (y < 4) {
      y = Math.max(4, p.y - 26);
      x = p.x > this.renderer.cssW / 2 ? p.x - 110 : p.x + 110;
    }
    x = Math.min(Math.max(x, 64), this.renderer.cssW - 64);
    this.placeConfirm.style.left = `${x}px`;
    this.placeConfirm.style.top = `${y}px`;
    (this.placeConfirm.lastChild as HTMLButtonElement).disabled = !this.placing.valid;
  }

  private confirmPlace() {
    if (!this.placing) return;
    const { type, x, y } = this.placing;
    const r = this.sim.place(type, x, y);
    if (!r.ok) {
      audio.play('error');
      this.app.toast(r.reason!, 'bad');
      return;
    }
    this.cancelPlacing();
    this.afterCommand();
    this.checkAch();
  }

  cancelPlacing() {
    this.placing = null;
    this.placeConfirm?.remove();
    this.placeConfirm = null;
    this.placebar?.remove();
    this.placebar = null;
  }

  private doUpgrade(t: Tower, path: number) {
    const r = this.sim.upgrade(t.id, path);
    if (!r.ok) {
      audio.play('error');
      this.app.toast(r.reason!, 'bad');
      return;
    }
    this.afterCommand();
    this.checkAch();
  }

  private async doSell(t: Tower) {
    if (this.sim.cfg.noSelling) return;
    if (t.invested >= 1000 && !this.sim.cfg.sandbox) {
      if (!(await this.app.confirm(`Sell ${this.sim.unitName(t)}?`, `You will receive ${fmt(this.sim.sellValue(t))} gold (70% of ${fmt(t.invested)} invested).`, 'Sell', true))) return;
    }
    const r = this.sim.sell(t.id);
    if (!r.ok) {
      this.app.toast(r.reason!, 'bad');
      return;
    }
    this.select(0);
    this.afterCommand();
  }

  private doTarget(t: Tower, m: TargetMode) {
    this.sim.setTargeting(t.id, m);
    audio.play('click');
    this.afterCommand();
  }

  private useAbility(towerId: number, id: AbilityId | 'bank') {
    if (this.paused || this.app.modalOpen || this.sim.state !== 'playing') return;
    const r = this.sim.useAbility(towerId, id);
    if (!r.ok) {
      audio.play('error');
      if (r.reason) this.app.toast(r.reason, 'bad', 1200);
    }
    if (id === 'bank' || id === 'instantHarvest') this.afterCommand();
  }

  startWave() {
    if (!this.startAllowed && !this.sim.cfg.sandbox) return;
    if (this.sim.waveActive || this.sim.state !== 'playing') return;
    this.clearCountdown();
    this.preWave = this.sim.snapshot();
    const r = this.sim.startWave();
    if (!r.ok) {
      this.app.toast(r.reason!, 'bad');
      return;
    }
    this.processEvents();
  }

  private cycleSpeed() {
    this.speed = this.speed === 1 ? 2 : this.speed === 2 ? 3 : 1;
    audio.play('click');
  }

  private toggleAuto() {
    this.autoStart = !this.autoStart;
    audio.play('click');
    if (!this.autoStart) this.clearCountdown();
    else if (!this.sim.waveActive && this.sim.wave > 0 && this.sim.state === 'playing') this.beginCountdown();
  }

  private beginCountdown() {
    if (!this.startAllowed) return;
    this.countdown = 3;
    this.countdownEl?.remove();
    this.countdownEl = h('div', { class: 'countdown' }, h('span', { class: 'msg' }, 'Next wave in 3…'),
      btn('Cancel', () => { this.clearCountdown(); }, 'btn btn-small btn-red', { 'data-testid': 'countdown-cancel' }));
    this.field.appendChild(this.countdownEl);
  }

  private clearCountdown() {
    this.countdown = 0;
    this.countdownEl?.remove();
    this.countdownEl = null;
  }

  private resetSandboxTowers() {
    for (const t of [...this.sim.towers]) this.sim.sell(t.id);
    this.select(0);
  }

  // ------------------------------------------------------------------ wave flow
  private onWaveEnd() {
    this.shop.setNextWave(this.sim);
    this.saveRun();
    this.checkAch();
    this.maybeShowTip();
    if (this.autoStart && this.sim.state === 'playing') this.beginCountdown();
  }

  private markSeen(w: number) {
    const def = getWave(w, this.sim.cfg.seed);
    for (const g of def.groups) {
      this.seenMechanics.add(g.type);
      for (const f of g.flags) this.seenMechanics.add('v-' + f);
    }
  }

  /** Before a wave that introduces a new mechanic, show a tip and warn about missing counters. */
  private maybeShowTip() {
    const s = this.sim;
    if (s.cfg.sandbox || s.state !== 'playing') return;
    const next = s.wave + 1;
    if (this.tipShownFor === next) return;
    const def = s.nextWaveDef();
    const tips: MechanicTip[] = [];
    const types = new Set<EnemyType>();
    const flags = new Set<Variant>();
    for (const g of def.groups) {
      types.add(g.type);
      g.flags.forEach((f) => flags.add(f));
    }
    for (const t of types) if (!this.seenMechanics.has(t) && ENEMY_TIPS[t]) tips.push(ENEMY_TIPS[t]!);
    for (const f of flags) if (!this.seenMechanics.has('v-' + f)) tips.push(VARIANT_TIPS[f]);
    const warnings: string[] = [];
    const concealed = types.has('wisp') || flags.has('concealed');
    const attackers = s.towers.filter((t) => t.base.attack !== 'none');
    if (concealed) {
      const detect = s.towers.some((t) => t.base.detect || t.base.support.detect || t.base.exposeEvery > 0 || t.base.support.exposeAll);
      if (!detect) warnings.push('None of your guardians can detect concealed enemies yet! Affordable fix: Thorn Archer Keen Eyes (Ranger tier 1).');
    }
    const armored = types.has('bulwark') || flags.has('armored');
    if (armored && attackers.length) {
      const good = attackers.some((t) => t.base.dmgType === 'arcane' || t.base.dmgType === 'acid' || t.base.armorPierce >= 2 || s.effDamage(t) >= 5 || t.base.shred > 0 || t.type === 'lyra');
      if (!good) warnings.push('Your guardians deal very little damage to armor. Try Archer Armor Breaker, a Storm Engineer, or Alchemist Acid Conversion.');
    }
    if (types.has('emberkin') && attackers.length && attackers.every((t) => s.effDmgType(t) === 'fire')) warnings.push('Only fire damage on the field — Emberkin resist 75% of it.');
    if (types.has('frostling') && attackers.length && attackers.every((t) => t.base.dmgType === 'frost')) warnings.push('Only frost damage on the field — Frostlings resist 75% of it.');
    if (!tips.length && !warnings.length && !def.boss) return;
    this.tipShownFor = next;
    this.dismissTip();
    const body: HTMLElement[] = [];
    if (def.boss && !tips.some((t) => t.key === 'colossus')) body.push(h('p', { class: 'warn' }, `Boss wave! ${def.groups.filter((g) => g.type === 'colossus').reduce((a, g) => a + g.count, 0)} Rift Colossus incoming with escorts.`));
    for (const t of tips) body.push(h('p', null, h('b', null, t.title), ' — ', t.text), h('p', { class: 'small muted' }, h('b', null, 'Counters: '), t.counters));
    for (const w of warnings) body.push(h('p', { class: 'warn' }, '⚠ ', w));
    this.tipEl = h('div', { class: 'tipcard', role: 'note', 'data-testid': 'tip' },
      h('h4', null, icon('info'), `Before wave ${next}`),
      ...body,
      btn([icon('close')], () => this.dismissTip(), 'btn btn-small btn-icon x', { 'aria-label': 'Dismiss tip' }));
    this.field.appendChild(this.tipEl);
  }

  private dismissTip() {
    this.tipEl?.remove();
    this.tipEl = null;
  }

  // ------------------------------------------------------------------ saving
  /** Persist the active run: full state between waves; the pre-wave snapshot while a wave is running. */
  saveRun() {
    const s = this.sim;
    if (s.cfg.sandbox || this.ended || s.state !== 'playing') return;
    let snap: RunSnapshot | null = null;
    let mid = false;
    if (!s.waveActive) snap = s.snapshot();
    else {
      snap = this.preWave;
      mid = true;
    }
    if (!snap) return;
    this.app.save.activeRun = { snapshot: snap, savedAt: Date.now(), midWave: mid, runId: this.runId };
    this.app.persist();
  }

  private checkAch() {
    const got = checkAchievements(this.app.save, this.sim);
    for (const g of got) this.app.toast(`Achievement: ${g}`, 'gold', 3200);
    if (got.length) this.app.persist();
  }

  // ------------------------------------------------------------------ results
  private onVictory() {
    const s = this.sim;
    this.cancelPlacing();
    this.clearCountdown();
    const reward = settleRun(this.app.save, s, this.runId, 'victory');
    this.killsAtSettle = s.stats.kills;
    this.app.save.activeRun = null;
    this.app.persist();
    this.tutorial?.skip();
    this.banner('Victory!', 'The isle is safe');
    this.celebrate();
    this.showResult('victory', reward.lines, [...reward.medals], reward.achievements, reward.unlocks);
  }

  /** Confetti-style burst of stars and coins over the battlefield. */
  private celebrate() {
    const P = this.renderer.particles;
    const cols = ['#ffd34a', '#ff8ae0', '#8ae0ff', '#7aff9a', '#ffffff'];
    const n = this.app.save.settings.reducedEffects ? 20 : 90;
    for (let i = 0; i < n; i++) {
      P.spawn(i % 3 === 0 ? 'coin' : 'star', 100 + Math.random() * 1080, -10 - Math.random() * 120, {
        vx: (Math.random() - 0.5) * 120, vy: 120 + Math.random() * 160, grav: 60, size: 4 + Math.random() * 4,
        color: cols[i % cols.length], life: 2.4 + Math.random() * 1.2,
      });
    }
  }

  private onDefeat() {
    const s = this.sim;
    this.cancelPlacing();
    this.clearCountdown();
    this.ended = true;
    let lines: string[] = [];
    let ach: string[] = [];
    let unlocks: string[] = [];
    let medals: string[] = [];
    if (s.cfg.endless) {
      lines = settleEndless(this.app.save, s);
      this.app.save.stats.totalKills += s.stats.kills - this.killsAtSettle;
      this.killsAtSettle = s.stats.kills;
      ach = checkAchievements(this.app.save, s);
      lines.unshift(`Endless run ended on wave ${s.wave}.`);
    } else {
      const r = settleRun(this.app.save, s, this.runId, 'defeat');
      lines = r.lines;
      ach = r.achievements;
      unlocks = r.unlocks;
      medals = r.medals;
    }
    this.app.save.activeRun = null;
    this.app.persist();
    this.tutorial?.skip();
    this.banner('The gate has fallen', s.cfg.endless ? `Endless wave ${s.wave}` : `Wave ${s.wave}`, true);
    this.showResult('defeat', lines, medals, ach, unlocks);
  }

  private showResult(kind: 'victory' | 'defeat', lines: string[], medals: string[], ach: string[], unlocks: string[]) {
    const s = this.sim;
    const best = s.bestTower();
    const waves = kind === 'victory' ? s.wave : s.wave - 1;
    const canEndless = kind === 'victory' && (s.cfg.mode === 'campaign' || s.cfg.mode === 'tutorial');
    setTimeout(() => {
      if (!this.alive) return;
      this.app.modal((close) => h('div', { class: 'result scroll' },
        h('h2', { style: `color:${kind === 'victory' ? '#2a8a4a' : '#a8303a'}` }, kind === 'victory' ? 'Victory!' : 'Defeat'),
        h('p', { class: 'muted', style: 'margin:0' }, `${MAP_BY_ID[s.cfg.mapId].name} · ${s.cfg.label ?? DIFFICULTY[s.cfg.difficulty].name}`),
        h('div', { class: 'stats' },
          h('div', null, 'Waves completed', h('b', null, String(Math.max(0, waves)))),
          h('div', null, 'Enemies defeated', h('b', null, fmt(s.stats.kills))),
          h('div', null, 'Gold earned', h('b', null, fmt(s.stats.goldEarned))),
          h('div', null, 'Lives lost', h('b', null, fmt(s.stats.livesLost))),
          h('div', { style: 'grid-column:1/3' }, 'Most effective guardian', h('b', null, best ? `${best.label} — ${fmt(best.damage)} damage` : '—')),
        ),
        lines.length || medals.length || ach.length || unlocks.length
          ? h('ul', null,
              ...lines.map((l) => h('li', null, l)),
              ...medals.map((m) => h('li', null, '🏅 ', m)),
              ...ach.map((a) => h('li', null, 'Achievement: ', h('b', null, a))),
              ...unlocks.map((u) => h('li', null, h('b', { style: 'color:#b0369a' }, u))))
          : h('p', { class: 'small muted' }, s.cfg.sandbox ? '' : 'No rewards this time — survive at least 5 waves for a consolation reward.'),
        h('p', { class: 'small' }, icon('shard'), ` Rift Shards: ${this.app.save.shards}`),
        h('div', { class: 'actions' },
          canEndless ? btn([icon('infinity'), 'Continue in Endless'], () => { close(); this.continueEndless(); }, 'btn btn-pink', { 'data-testid': 'endless' }) : null,
          btn([icon('refresh'), 'Retry'], () => { close(); this.retry(); }, 'btn btn-teal', { 'data-testid': 'retry' }),
          btn([icon('flag'), 'Map select'], () => { close(); this.app.go('play', {}, { reset: true }); this.app.go('play', {}, { replace: true }); }, 'btn', { 'data-testid': 'to-maps' }),
          btn([icon('home'), 'Title'], () => { close(); this.app.go('title', {}, { reset: true }); }, 'btn'),
        ),
      ), { dismissable: false });
    }, kind === 'victory' ? 1600 : 1300);
  }

  private continueEndless() {
    const s = this.sim;
    s.cfg.endless = true;
    s.state = 'playing';
    this.endlessStartWave = s.wave;
    this.runId = 'endless-' + newRunId();
    this.ended = false;
    this.banner('Endless mode', 'How far can you go?');
    this.shop.setNextWave(s);
    this.saveRun();
    this.maybeShowTip();
  }

  private retry() {
    const p = { ...this.params };
    delete p.resume;
    if (this.params.resume || this.sim.cfg.mode !== 'campaign') {
      // rebuild params from the run's own config
      const c = this.sim.cfg;
      if (c.mode === 'challenge') p.challengeId = c.challengeId;
      else if (c.mode === 'daily') p.daily = c.dailyDate;
      else if (c.mode === 'tutorial') p.tutorial = true;
      else { p.mapId = c.mapId; p.difficulty = c.difficulty; p.pure = c.bonusesDisabled; }
    }
    this.app.go('game', p, { replace: true });
  }

  // ------------------------------------------------------------------ pause
  pause() {
    if (this.paused || this.app.modalOpen || this.sim.state !== 'playing') return;
    this.paused = true;
    this.cancelPlacing();
    audio.play('click');
    this.saveRun();
    this.app.modal((close) => h('div', null,
      h('h2', null, 'Paused'),
      h('p', { class: 'small muted', style: 'margin:0' }, `${MAP_BY_ID[this.sim.cfg.mapId].name} · ${this.sim.cfg.label ?? DIFFICULTY[this.sim.cfg.difficulty].name} · wave ${this.sim.wave}`),
      h('div', { style: 'display:grid;gap:10px' },
        btn([icon('play'), 'Resume'], close, 'btn btn-gold', { 'data-autofocus': true, 'data-testid': 'resume' }),
        btn([icon('gear'), 'Settings'], () => {
          this.app.modal((c2) => h('div', { class: 'scroll' }, h('h2', null, 'Settings'), settingsPanel(this.app, () => this.applyQuality(), true), h('div', { class: 'actions' }, btn('Done', c2, 'btn btn-gold'))));
        }, 'btn', { 'data-testid': 'pause-settings' }),
        btn([icon('refresh'), 'Restart'], async () => {
          if (!(await this.app.confirm('Restart this run?', 'All progress in this run will be lost and no rewards are given.', 'Restart', true))) return;
          close();
          this.retry();
        }, 'btn', { 'data-testid': 'restart' }),
        btn([icon('home'), this.sim.cfg.sandbox ? 'Leave sandbox' : 'Save & quit to menu'], () => {
          this.saveRun();
          close();
          this.app.go('title', {}, { reset: true });
        }, 'btn', { 'data-testid': 'quit' }),
        this.sim.waveActive && !this.sim.cfg.sandbox ? h('p', { class: 'small muted', style: 'margin:0' }, `Quitting mid-wave saves your run at the start of wave ${this.sim.wave}.`) : null,
      ),
    ), { onClose: () => { this.paused = false; this.last = performance.now(); } });
  }

  // ------------------------------------------------------------------ tutorial
  private startTutorial() {
    this.tutorial = new Tutorial({
      field: this.field,
      highlight: (sel) => {
        if (sel?.includes('shop-') && this.selectedId) this.select(0);
        this.hlEl?.classList.remove('hl');
        this.hlEl = sel ? (this.el.querySelector(sel) as HTMLElement | null) : null;
        this.hlEl?.classList.add('hl');
      },
      pointWorld: (x, y, label) => {
        const p = this.renderer.worldToScreen(x, y);
        const arrow = h('div', { class: 'tut-arrow', style: `left:${p.x}px;top:${p.y - 14}px` },
          h('span', { html: '<svg viewBox="0 0 24 24"><path d="M12 22L4 10h5V2h6v8h5z" fill="#ff6fd8" stroke="#fff" stroke-width="1.5"/></svg>', style: 'display:block;width:44px;height:44px' }));
        if (label) arrow.appendChild(h('div', { style: 'position:absolute;left:50%;top:-24px;transform:translateX(-50%);white-space:nowrap;background:#ff6fd8;color:#fff;font-weight:700;font-size:13px;padding:2px 8px;border-radius:8px' }, label));
        this.field.appendChild(arrow);
        this.pointers.push(arrow);
      },
      clearPointer: () => {
        for (const p of this.pointers) p.remove();
        this.pointers = [];
      },
      gold: () => this.sim.gold,
      finish: (skipped) => {
        this.app.save.tutorialDone = true;
        this.app.persist();
        this.startAllowed = true;
        this.tutorial = null;
        if (skipped) this.app.toast('Tutorial skipped — you can replay it from Help.');
        this.maybeShowTip();
      },
      setStartAllowed: (v) => (this.startAllowed = v),
    });
  }

  // ------------------------------------------------------------------ input
  private bindInput() {
    const cv = this.canvas;
    this.on(cv, 'pointerdown', ((e: PointerEvent) => this.onDown(e)) as EventListener);
    this.on(cv, 'pointermove', ((e: PointerEvent) => this.onMove(e)) as EventListener);
    this.on(cv, 'pointerup', ((e: PointerEvent) => this.onUp(e)) as EventListener);
    this.on(cv, 'pointercancel', (() => (this.pointer = null)) as EventListener);
    this.on(cv, 'pointerleave', ((e: PointerEvent) => { if (e.pointerType === 'mouse') this.hoverObstacle = null; }) as EventListener);
    this.on(cv, 'contextmenu', ((e: Event) => e.preventDefault()) as EventListener);
    // suppress the browser's synthetic mouse click after a touch: it could land on a button that just appeared
    this.on(cv, 'touchend', ((e: Event) => { if (e.cancelable) e.preventDefault(); }) as EventListener, { passive: false });
    this.on(document, 'visibilitychange', (() => {
      if (document.hidden) {
        audio.suspend(true);
        if (!this.paused && this.sim.state === 'playing' && !this.app.modalOpen) this.pause();
        this.saveRun();
      } else {
        audio.suspend(false);
        this.last = performance.now();
      }
    }) as EventListener);
    this.on(window, 'pagehide', (() => this.saveRun()) as EventListener);
  }

  private local(e: PointerEvent) {
    const r = this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private onDown(e: PointerEvent) {
    if (this.app.modalOpen) return;
    const p = this.local(e);
    this.pointer = { id: e.pointerId, x: p.x, y: p.y, type: e.pointerType, moved: false, down: true };
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (this.placing && e.pointerType !== 'mouse') {
      this.placeConfirm?.remove();
      this.placeConfirm = null;
      const w = this.renderer.screenToWorld(p.x, p.y - 48);
      this.updatePlacement(w.x, w.y);
    }
  }

  private onMove(e: PointerEvent) {
    const p = this.local(e);
    const ptr = this.pointer;
    if (ptr && ptr.id === e.pointerId && Math.hypot(p.x - ptr.x, p.y - ptr.y) > 8) ptr.moved = true;
    if (this.placing) {
      if (e.pointerType === 'mouse') {
        if (!this.placeConfirm) {
          const w = this.renderer.screenToWorld(p.x, p.y);
          this.updatePlacement(w.x, w.y);
        }
      } else if (ptr && ptr.down) {
        const w = this.renderer.screenToWorld(p.x, p.y - 48);
        this.updatePlacement(w.x, w.y);
      }
      return;
    }
    if (e.pointerType === 'mouse') {
      const w = this.renderer.screenToWorld(p.x, p.y);
      const o = this.obstacleAt(w.x, w.y);
      this.hoverObstacle = o;
      const over = o || this.towerAt(w.x, w.y) || this.dropAt(w.x, w.y);
      this.canvas.style.cursor = over ? 'pointer' : 'default';
    }
  }

  private onUp(e: PointerEvent) {
    const ptr = this.pointer;
    this.pointer = null;
    if (!ptr || ptr.id !== e.pointerId || this.app.modalOpen) return;
    const p = this.local(e);
    if (this.placing) {
      if (e.pointerType === 'mouse') {
        const w = this.renderer.screenToWorld(p.x, p.y);
        if (this.placeConfirm) {
          this.placeConfirm.remove();
          this.placeConfirm = null;
        }
        this.updatePlacement(w.x, w.y);
        if (this.app.save.settings.confirmPlacement === 'always') this.showConfirm();
        else if (this.placing.valid) this.confirmPlace();
        else {
          audio.play('error');
          this.flashPlacebar();
        }
      } else {
        // touch/pen: keep the preview where the finger lifted and ask for confirmation
        this.showConfirm();
        if (!this.placing.valid) this.flashPlacebar();
      }
      return;
    }
    if (ptr.moved) return;
    const w = this.renderer.screenToWorld(p.x, p.y);
    const touch = e.pointerType !== 'mouse';
    const drop = this.dropAt(w.x, w.y, touch ? 34 : 26);
    if (drop) {
      this.sim.collectDrop(drop);
      this.afterCommand();
      return;
    }
    const t = this.towerAt(w.x, w.y, touch ? 10 : 4);
    if (t) {
      audio.play('click');
      this.select(t.id === this.selectedId ? 0 : t.id);
      return;
    }
    const o = this.obstacleAt(w.x, w.y);
    if (o) {
      this.offerObstacle(o);
      return;
    }
    if (this.selectedId) this.select(0);
  }

  private flashPlacebar() {
    const msg = this.placebar?.querySelector('.msg') as HTMLElement | null;
    if (!msg) return;
    msg.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(6px)' }, { transform: 'translateX(0)' }], { duration: 200 });
  }

  private towerAt(x: number, y: number, pad = 4): Tower | undefined {
    let best: Tower | undefined, bd = Infinity;
    for (const t of this.sim.towers) {
      // include the figure above the base in the hit area
      const d = Math.min(Math.hypot(t.x - x, t.y - y), Math.hypot(t.x - x, t.y - 22 - y));
      if (d <= t.radius + pad && d < bd) { bd = d; best = t; }
    }
    return best;
  }

  private dropAt(x: number, y: number, r = 26): number {
    for (const d of this.sim.drops) if (Math.hypot(d.x - x, d.y - 10 - y) <= r) return d.id;
    return 0;
  }

  private obstacleAt(x: number, y: number): string | null {
    for (const o of this.sim.map.def.obstacles ?? []) if (!this.sim.removedObstacles.has(o.id) && Math.hypot(o.x - x, o.y - y) <= o.r + 6) return o.id;
    return null;
  }

  private offerObstacle(id: string) {
    const o = this.sim.map.def.obstacles!.find((x) => x.id === id)!;
    const cost = this.sim.cfg.sandbox ? 0 : o.cost;
    this.app.modal((close) => h('div', null,
      h('h2', null, `Clear ${o.label}?`),
      h('p', null, `Removing the ${o.label.toLowerCase()} frees this spot for a guardian. Cost: `, h('b', null, `${cost} gold`), '.'),
      h('div', { class: 'actions' },
        btn('Cancel', close, 'btn'),
        btn([icon('coin'), `Clear for ${cost}`], () => {
          const r = this.sim.removeObstacle(id);
          if (!r.ok) { audio.play('error'); this.app.toast(r.reason!, 'bad'); return; }
          close();
          this.afterCommand();
        }, 'btn btn-gold', { disabled: this.sim.gold < cost, 'data-testid': 'clear-obstacle' }),
      ),
    ));
  }

  onKey(e: KeyboardEvent): boolean {
    if (this.app.modalOpen) return false;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      e.preventDefault();
      if (this.placing) this.cancelPlacing();
      else if (this.selectedId) this.select(0);
      else this.pause();
      return true;
    }
    if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      if (!this.sim.waveActive) this.startWave();
      return true;
    }
    if (e.key === 'Tab') {
      e.preventDefault();
      this.cycleSpeed();
      return true;
    }
    if (/^[1-7]$/.test(e.key)) {
      this.pickShop(SHOP_ORDER[+e.key - 1]);
      return true;
    }
    const ai = ABILITY_KEYS.indexOf(k);
    if (ai >= 0) {
      const a = this.sim.abilities()[ai];
      if (a) this.useAbility(a.towerId, a.id);
      return true;
    }
    if (this.selectedId && ['u', 'i', 'o'].includes(k)) {
      const t = this.sim.towerById(this.selectedId);
      if (t && t.type !== 'lyra') this.doUpgrade(t, ['u', 'i', 'o'].indexOf(k));
      return true;
    }
    if (this.selectedId && k === 's') {
      const t = this.sim.towerById(this.selectedId);
      if (t) this.doSell(t);
      return true;
    }
    if (e.key === 'Enter' && this.placing && this.placeConfirm) {
      this.confirmPlace();
      return true;
    }
    return false;
  }

  onBack(): boolean {
    if (this.placing) {
      this.cancelPlacing();
      return true;
    }
    if (this.sim.state === 'playing') {
      this.pause();
      return true;
    }
    return false;
  }

  destroy() {
    this.saveRun();
    this.alive = false;
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    for (const [t, type, fn, o] of this.listeners) t.removeEventListener(type, fn, o);
    this.listeners = [];
    this.tutorial?.destroy();
    this.renderer.particles.clear();
    audio.playMusic('menu');
    if (import.meta.env.DEV && window.__rk?.session === this) delete window.__rk;
  }
}

export function gameScreen(app: App, params: SessionParams): Screen {
  return new GameSession(app, params);
}

export { ENEMIES, HERO, towerName, hashString };
