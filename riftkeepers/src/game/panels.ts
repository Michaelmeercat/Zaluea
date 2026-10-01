import type { EnemyType, TargetMode, TowerType, UnitType, Variant } from '../core/types';
import { TOWER_TYPES } from '../core/types';
import { ENEMIES, ENEMY_ORDER, VARIANTS } from '../data/enemies';
import { HERO, HERO_LEVEL_TEXT, heroStats } from '../data/hero';
import { TOWERS } from '../data/towers';
import type { Tower } from '../sim/entities';
import type { Sim } from '../sim/sim';
import { enemyIcon, towerIcon } from '../render/spriteCache';
import { btn, clear, fmt, h, icon, setText } from '../ui/dom';
import type { SaveData } from '../save/save';
import { isTowerUnlocked } from './progression';
import { TOWER_UNLOCK_TEXT } from '../data/progression';

export const SHOP_ORDER: UnitType[] = [...TOWER_TYPES, 'lyra'];

export interface ShopHandlers {
  onPick(type: UnitType): void;
}

/** Shop grid. Call update() each frame (cheap: only toggles classes / text). */
export class ShopView {
  el: HTMLElement;
  items = new Map<UnitType, { el: HTMLButtonElement; price: HTMLElement }>();
  nextWave: HTMLElement;
  constructor(private sim: Sim, private save: SaveData, private handlers: ShopHandlers) {
    this.nextWave = h('div', { class: 'small', style: 'padding:0 10px;color:var(--ink-soft);display:flex;flex-wrap:wrap;gap:4px;align-items:center;min-height:30px' });
    const grid = h('div', { class: 'shop scroll', 'data-testid': 'shop' });
    SHOP_ORDER.forEach((t, i) => {
      const price = h('span', { class: 'pr' }, icon('coin'), '0');
      const name = t === 'lyra' ? 'Lyra (Hero)' : TOWERS[t].name;
      const b = h('button', { class: 'shop-item', type: 'button', 'data-testid': `shop-${t}`, 'aria-label': name, title: `${name} — key ${i + 1}`, onClick: () => this.handlers.onPick(t) },
        h('span', { class: 'key' }, String(i + 1)),
        h('img', { src: towerIcon(t, { levels: [0, 0, 0], heroLevel: 1, lyraOutfit: save.cosmetics.lyra }), alt: '' }),
        h('span', { class: 'nm' }, name),
        price,
      ) as HTMLButtonElement;
      this.items.set(t, { el: b, price });
      grid.appendChild(b);
    });
    this.el = h('div', { style: 'display:flex;flex-direction:column;min-height:0;flex:1' },
      h('div', { class: 'side-title' }, h('span', null, 'Guardians'), h('span', { class: 'small', style: 'text-transform:none;letter-spacing:0' }, 'tap to place')),
      this.nextWave,
      grid);
  }

  availability(t: UnitType): { ok: boolean; reason: string } {
    const can = this.sim.canBuy(t);
    if (can.ok) return { ok: true, reason: '' };
    if (!isTowerUnlocked(this.save, t)) return { ok: false, reason: TOWER_UNLOCK_TEXT[t] };
    return { ok: false, reason: can.reason! };
  }

  update(selected: UnitType | null) {
    for (const [t, it] of this.items) {
      const av = this.availability(t);
      const cost = this.sim.towerCost(t);
      setText(it.price.lastChild as unknown as HTMLElement, this.sim.cfg.sandbox ? 'Free' : fmt(cost));
      it.el.classList.toggle('locked', !av.ok);
      it.el.classList.toggle('poor', av.ok && this.sim.gold < cost);
      it.el.classList.toggle('selected', selected === t);
    }
  }

  setNextWave(sim: Sim) {
    clear(this.nextWave);
    if (sim.cfg.sandbox) return;
    const n = sim.wave + (sim.waveActive ? 0 : 1);
    const def = sim.waveActive ? sim.currentWaveDef : sim.nextWaveDef();
    if (!def) return;
    const counts = new Map<EnemyType, { n: number; flags: Set<Variant> }>();
    for (const g of def.groups) {
      const c = counts.get(g.type) ?? { n: 0, flags: new Set() };
      c.n += g.count;
      g.flags.forEach((f) => c.flags.add(f));
      counts.set(g.type, c);
    }
    this.nextWave.append(h('b', null, `${sim.waveActive ? 'Wave' : 'Next'} ${n}${def.boss ? ' — BOSS' : ''}:`));
    for (const [t, c] of counts) {
      const fl = [...c.flags].map((f) => VARIANTS[f].name[0]).join('');
      this.nextWave.append(h('span', { style: 'display:inline-flex;align-items:center', title: `${ENEMIES[t].name}${fl ? ' (' + [...c.flags].map((f) => VARIANTS[f].name).join(', ') + ')' : ''}` },
        h('img', { src: enemyIcon(t, 40), alt: ENEMIES[t].name, style: 'width:22px;height:22px' }), `×${c.n}${fl ? ' ' + fl : ''}`));
    }
  }
}

export interface PanelHandlers {
  upgrade(t: Tower, path: number): void;
  sell(t: Tower): void;
  target(t: Tower, m: TargetMode): void;
  mode(t: Tower, m: 'fire' | 'acid'): void;
  withdraw(t: Tower): void;
  close(): void;
  info(t: Tower, path: number): void;
}

const TARGETS: [TargetMode, string][] = [['first', 'First'], ['last', 'Last'], ['strong', 'Strong'], ['close', 'Close']];

/** Selected guardian panel. Rebuilds only when its signature changes. */
export class TowerPanel {
  el = h('div', { class: 'panel scroll', 'data-testid': 'tower-panel' });
  private sig = '';
  private openedAt = 0;
  private dmgEl: HTMLElement | null = null;
  constructor(private sim: Sim, private handlers: PanelHandlers, private save: SaveData) {}

  signature(t: Tower): string {
    const s = this.sim;
    const ups = [0, 1, 2].map((p) => {
      const c = s.canUpgrade(t, p);
      return `${c.ok ? 1 : 0}${c.cost ?? ''}${c.reason ?? ''}`;
    });
    return `${t.id}|${t.levels.join('')}|${t.targeting}|${t.mode}|${ups.join(',')}|${Math.floor(t.bank)}|${s.heroLevel}|${s.sellValue(t)}|${s.heroXp}`;
  }

  update(t: Tower) {
    const sig = this.signature(t);
    if (sig !== this.sig) {
      if (!this.sig.startsWith(`${t.id}|`)) this.openedAt = performance.now();
      this.sig = sig;
      this.build(t);
    }
    if (this.dmgEl) setText(this.dmgEl, `Damage ${fmt(t.damageDealt)} · Kills ${fmt(t.kills)}`);
  }

  reset() {
    this.sig = '';
  }

  private guard(): boolean {
    // ignore taps that land within 350ms of the panel opening (prevents select-then-buy double taps)
    return performance.now() - this.openedAt < 350;
  }

  private build(t: Tower) {
    const s = this.sim;
    clear(this.el);
    const isHero = t.type === 'lyra';
    const tdef = isHero ? null : TOWERS[t.type as TowerType];
    const name = tdef ? tdef.name : 'Lyra, the Rift Scout';
    const look = { levels: t.levels, heroLevel: s.heroLevel, lyraOutfit: this.save.cosmetics.lyra };
    const sub = !tdef ? `Level ${s.heroLevel}` : t.levels.some((l) => l > 0) ? tdef.paths.map((p, i) => `${p.name[0]}${t.levels[i]}`).join(' · ') : tdef.role;
    this.dmgEl = h('div', { class: 'stats-mini' });
    this.el.append(
      h('div', { class: 'panel-head' },
        h('img', { src: towerIcon(t.type, look), alt: '' }),
        h('div', null, h('div', { class: 'nm' }, name), h('div', { class: 'sub' }, sub)),
        btn([icon('close')], () => this.handlers.close(), 'btn btn-small btn-icon', { 'aria-label': 'Close panel', title: 'Close (Esc)' }),
      ),
      this.dmgEl,
    );
    const attacks = t.base.attack !== 'none';
    if (attacks) {
      const range = Math.round(s.effRange(t));
      const dmg = s.effDamage(t);
      this.el.append(h('div', { class: 'stats-mini' },
        h('span', null, `${dmg % 1 ? dmg.toFixed(1) : dmg} ${s.effDmgType(t)}`), h('span', null, `${s.effInterval(t).toFixed(2)}s`), h('span', null, `range ${range}`),
        s.effDetect(t) ? h('span', null, icon('eye'), 'detects') : null,
        t.buffs.atkSpeed || t.buffs.dmgPct || t.buffs.rangePct ? h('span', { style: 'color:#b97c12' }, '☀ buffed') : null));
      const row = h('div', { class: 'target-row', role: 'radiogroup', 'aria-label': 'Targeting' });
      for (const [m, label] of TARGETS)
        row.appendChild(h('button', { class: t.targeting === m ? 'on' : '', type: 'button', role: 'radio', 'aria-checked': String(t.targeting === m), onClick: () => this.handlers.target(t, m) }, label));
      this.el.append(row);
    }
    if (t.base.modes) {
      const row = h('div', { class: 'target-row', style: 'grid-template-columns:1fr 1fr' },
        h('button', { class: t.mode === 'fire' ? 'on' : '', type: 'button', onClick: () => this.handlers.mode(t, 'fire') }, 'Fire mode (+50%)'),
        h('button', { class: t.mode === 'acid' ? 'on' : '', type: 'button', onClick: () => this.handlers.mode(t, 'acid') }, 'Acid mode'));
      this.el.append(row);
    }
    if (isHero) {
      const lvl = s.heroLevel;
      const th = HERO.xpThresholds;
      const cur = th[lvl - 1], next = th[lvl] ?? th[th.length - 1];
      const pct = lvl >= 10 ? 100 : Math.round(((s.heroXp - cur) / (next - cur)) * 100);
      const hs = heroStats(lvl);
      this.el.append(
        h('div', { class: 'small' }, h('b', null, `Level ${lvl}`), lvl < 10 ? ` · ${s.heroXp - cur}/${next - cur} XP to level ${lvl + 1}` : ' · max level'),
        h('div', { style: 'height:8px;border-radius:4px;background:#d8ccb4;overflow:hidden' }, h('i', { style: `display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#8a6ad8,#ff8ae0)` })),
        h('div', { class: 'small muted' }, lvl < 10 ? `Next: ${HERO_LEVEL_TEXT[lvl]}` : 'All abilities unlocked.'),
        h('div', { class: 'small muted' }, `Rift Pulse: ${hs.pulse ? `${hs.pulse.damage} dmg, ${hs.pulse.cd}s (Q)` : 'level 3'} · Time Anchor: ${hs.anchor ? `${Math.round(hs.anchor.slow * 100)}% for ${hs.anchor.duration}s, ${hs.anchor.cd}s (W)` : 'level 8'}`),
        h('div', { class: 'small muted' }, `XP comes from completed waves (+${HERO.xpPerWave(s.wave + 1)} next wave).`),
      );
    } else if (tdef) {
      const list = h('div', { class: 'up-list' });
      const def = tdef;
      def.paths.forEach((p, pi) => {
        const tier = t.levels[pi];
        const pips = h('span', { class: 'pips' }, ...[0, 1, 2, 3, 4].map((i) => h('i', { class: i < tier ? 'on' : '' })));
        if (tier >= 5) {
          list.appendChild(h('div', { class: 'up-row' },
            h('div', { class: 'up max', style: `--pc:${p.color}` }, h('span', { class: 't' }, `${p.name}`, pips), h('span', { class: 'c' }, 'MAX'),
              h('span', { class: 'd' }, `${p.upgrades[4].name} complete.`)),
            h('button', { type: 'button', class: 'up-info', 'aria-label': `${p.name} path details`, onClick: () => this.handlers.info(t, pi) }, icon('info'))));
          return;
        }
        const up = p.upgrades[tier];
        const chk = s.canUpgrade(t, pi);
        const locked = !chk.ok && chk.reason !== 'Not enough gold.';
        const b = h('button', {
          class: `up ${locked ? 'locked' : ''} ${chk.reason === 'Not enough gold.' ? 'poor' : ''}`, type: 'button', style: `--pc:${p.color}`,
          'data-testid': `up-${pi}`, title: `${up.name}: ${up.desc}`, 'aria-disabled': String(!chk.ok),
          onClick: () => {
            if (this.guard()) return;
            this.handlers.upgrade(t, pi);
          },
        },
          h('span', { class: 't' }, `${up.name}`, pips),
          h('span', { class: 'c' }, locked ? icon('lock') : icon('coin'), locked ? '' : fmt(chk.cost ?? s.upgradeCost(t, pi))),
          h('span', { class: 'd' }, locked ? chk.reason! : up.desc),
        );
        const infoBtn = h('button', { type: 'button', class: 'up-info', 'aria-label': `${p.name} path details`, title: `${p.name} path details`,
          onClick: () => this.handlers.info(t, pi) }, icon('info'));
        list.appendChild(h('div', { class: 'up-row' }, b, infoBtn));
      });
      this.el.append(list);
    }
    if (t.type === 'orchard') {
      const parts: HTMLElement[] = [h('span', null, `Income ${t.base.income}/wave`)];
      if (t.base.bank) parts.push(h('span', null, `Bank ${Math.floor(t.bank)}/${t.base.bankCap}${t.base.interest ? ` · ${Math.round(t.base.interest * 100)}% interest` : ''}`));
      if (t.base.harvestCharges) parts.push(h('span', null, `Harvests left: ${t.harvestCharges}`));
      this.el.append(h('div', { class: 'stats-mini' }, ...parts));
      if (t.base.bank) this.el.append(btn([icon('coin'), `Withdraw ${Math.floor(t.bank)}`], () => this.handlers.withdraw(t), 'btn btn-small btn-gold', { disabled: t.bank < 1 }));
    }
    if (t.type === 'beacon' && t.base.income > 0) this.el.append(h('div', { class: 'stats-mini' }, `Tithe: ${t.base.income} gold per wave`));
    const sellLabel = s.cfg.noSelling ? 'No selling' : s.cfg.sandbox ? 'Remove' : `Sell ${fmt(s.sellValue(t))}`;
    this.el.append(h('div', { class: 'panel-foot' },
      btn([icon('sell'), sellLabel], () => { if (!this.guard()) this.handlers.sell(t); }, 'btn btn-small btn-red', { disabled: s.cfg.noSelling, 'data-testid': 'sell' }),
      btn('Done', () => this.handlers.close(), 'btn btn-small'),
    ));
  }
}

/** Sandbox spawner tools. */
export function sandboxTools(sim: Sim, onReset: () => void, toast: (s: string) => void): HTMLElement {
  const sel = h('select', { 'aria-label': 'Enemy type' }, ...ENEMY_ORDER.map((e) => h('option', { value: e }, ENEMIES[e].name))) as HTMLSelectElement;
  const flags = new Set<Variant>();
  const chips = h('div', { class: 'chips' }, ...(Object.keys(VARIANTS) as Variant[]).map((v) => {
    const cb = h('input', { type: 'checkbox' }) as HTMLInputElement;
    cb.addEventListener('change', () => (cb.checked ? flags.add(v) : flags.delete(v)));
    return h('label', null, cb, VARIANTS[v].name);
  }));
  const hpOut = h('span', null, '1.0×');
  const hp = h('input', { type: 'range', min: 1, max: 40, value: 4, 'aria-label': 'Health multiplier' }) as HTMLInputElement;
  const hpVal = () => +hp.value / 4;
  hp.addEventListener('input', () => (hpOut.textContent = `${hpVal().toFixed(2)}×`));
  hpOut.textContent = `${hpVal().toFixed(2)}×`;
  const spawn = (n: number) => () => {
    sim.sandboxSpawn(sel.value as EnemyType, n, [...flags], hpVal());
    toast(`Spawning ${n} ${ENEMIES[sel.value as EnemyType].name}${n > 1 ? 's' : ''}`);
  };
  return h('div', { class: 'sandbox-tools' },
    h('b', null, 'Sandbox spawner'),
    sel, chips,
    h('div', { class: 'row small' }, 'Health ×', hpOut), hp,
    h('div', { class: 'row' },
      btn('Spawn 1', spawn(1), 'btn btn-small btn-teal', { 'data-testid': 'sb-spawn1' }),
      btn('Spawn 10', spawn(10), 'btn btn-small btn-teal'),
    ),
    h('div', { class: 'row' },
      btn('Clear enemies', () => sim.sandboxClear(), 'btn btn-small'),
      btn('Reset towers', onReset, 'btn btn-small btn-red'),
    ),
  );
}

export { TOWERS };
