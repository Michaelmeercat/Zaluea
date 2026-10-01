import { audio } from '../../audio/audio';
import { DIFFICULTY } from '../../data/difficulty';
import { ENEMIES, ENEMY_ORDER, SPEED_SCALE, VARIANTS } from '../../data/enemies';
import { HERO, HERO_LEVEL_TEXT } from '../../data/hero';
import { MAP_BY_ID, MAPS } from '../../data/maps';
import { ACHIEVEMENTS, COSMETICS, TALENTS, TOWER_UNLOCK_TEXT } from '../../data/progression';
import { TIER_MULT, TOWERS, baseUpgradeCost } from '../../data/towers';
import { TOWER_TYPES, type UnitType } from '../../core/types';
import { buyCosmetic, buyTalent, isTowerUnlocked } from '../../game/progression';
import { enemyIcon, towerIcon } from '../../render/spriteCache';
import { topbar, type App, type Screen } from '../app';
import { btn, clear, h, icon } from '../dom';
import { startTitleBackground } from '../titleBg';

export const VERSION = '1.0.0';

// ------------------------------------------------------------------ title
export function titleScreen(app: App): Screen {
  const bg = h('canvas', { class: 'screen-bg' }) as HTMLCanvasElement;
  const stop = startTitleBackground(bg, app.save.settings.reducedEffects);
  audio.playMusic('menu');
  const run = app.save.activeRun;
  const menu = h('div', { class: 'title-menu' },
    btn([icon('play'), 'Play'], () => {
      audio.play('click');
      if (!app.save.tutorialDone) {
        app.modal((close) => h('div', null,
          h('h2', null, 'Welcome, Keeper!'),
          h('p', null, 'Rift creatures are spilling onto the floating isles. Would you like a quick guided tutorial on Meadow Bend? It takes about three minutes and can be skipped at any time.'),
          h('div', { class: 'actions' },
            btn('Skip tutorial', () => { close(); app.save.tutorialDone = true; app.persist(); app.go('play'); }),
            btn([icon('play'), 'Start tutorial'], () => { close(); app.go('game', { tutorial: true }); }, 'btn btn-gold', { 'data-autofocus': true }),
          ),
        ));
      } else app.go('play');
    }, 'btn btn-gold', { 'data-autofocus': true, 'data-testid': 'play' }),
    run && btn([icon('refresh'), h('span', null, 'Continue Run', h('small', { style: 'display:block;font-size:12px;font-weight:500' },
      `${MAP_BY_ID[run.snapshot.cfg.mapId].name} · ${run.snapshot.cfg.label ?? DIFFICULTY[run.snapshot.cfg.difficulty].name} · wave ${run.snapshot.wave + 1}`))],
      () => { audio.play('click'); app.go('game', { resume: true }); }, 'btn btn-teal', { 'data-testid': 'continue' }),
    h('div', { class: 'title-sub' },
      btn([icon('hero'), 'Guardians'], () => { audio.play('click'); app.go('guardians'); }, 'btn'),
      btn([icon('book'), 'Collection'], () => { audio.play('click'); app.go('collection'); }, 'btn'),
      btn([icon('trophy'), 'Achievements'], () => { audio.play('click'); app.go('achievements'); }, 'btn'),
    ),
    h('div', { class: 'title-sub', style: 'grid-template-columns:1fr 1fr' },
      btn([icon('gear'), 'Settings'], () => { audio.play('click'); app.go('settings'); }, 'btn'),
      btn([icon('help'), 'Help'], () => { audio.play('click'); app.go('help'); }, 'btn'),
    ),
  );
  const el = h('div', { class: 'screen title-screen' },
    bg,
    h('h1', { class: 'logo' }, 'Riftkeepers', h('small', null, 'GUARDIANS OF THE FLOATING ISLES')),
    menu,
    h('div', { class: 'version' }, `v${VERSION} · ${app.save.shards} Rift Shards`),
  );
  if (app.store.recoveredFromCorruption) {
    app.store.recoveredFromCorruption = false;
    setTimeout(() => app.toast('Your save data was damaged and has been reset. A backup copy was kept.', 'bad', 5000), 300);
  }
  return { el, destroy: stop };
}

// ------------------------------------------------------------------ tower info (shared)
export function towerDetail(app: App, type: UnitType): HTMLElement {
  if (type === 'lyra') {
    return h('div', null,
      h('div', { class: 'coll-item' }, h('img', { src: towerIcon('lyra', { levels: [0, 0, 0], heroLevel: 10, lyraOutfit: app.save.cosmetics.lyra }), alt: '' }),
        h('div', null, h('h3', null, HERO.name), h('div', { class: 'muted small' }, `Hero · ${HERO.cost} gold · one per run`), h('p', { class: 'small' }, HERO.description))),
      h('div', { class: 'pathbox', style: 'margin-top:8px' }, h('h4', null, 'Level progression (XP from completed waves)'),
        h('ol', null, ...HERO_LEVEL_TEXT.map((t, i) => h('li', null, h('b', null, `Lv ${i + 1}: `), t, i > 0 ? h('span', { class: 'muted' }, ` (${HERO.xpThresholds[i]} XP)`) : null)))),
      h('p', { class: 'small muted' }, `XP per completed wave: 30 + 6 × wave. Levels belong to the current run only. Abilities: Rift Pulse (Q) and Time Anchor (W).`),
    );
  }
  const d = TOWERS[type];
  const b = d.base;
  return h('div', null,
    h('div', { class: 'coll-item' }, h('img', { src: towerIcon(type, { levels: [2, 0, 5] }), alt: '' }),
      h('div', null, h('h3', null, d.name), h('div', { class: 'muted small' }, `${d.role} · ${d.cost} gold (Normal)`), h('p', { class: 'small' }, d.description),
        h('div', { class: 'statline' },
          b.damage ? h('span', { class: 'badge' }, `${b.damage} ${b.dmgType} dmg`) : null,
          b.interval && b.attack !== 'none' ? h('span', { class: 'badge' }, `every ${b.interval}s`) : null,
          b.range ? h('span', { class: 'badge' }, `range ${b.range}`) : null,
          b.splash ? h('span', { class: 'badge' }, `splash ${b.splash} (max ${b.splashCap} hits)`) : null,
          b.slow ? h('span', { class: 'badge' }, `slow ${Math.round(b.slow * 100)}% ${b.slowDur}s`) : null,
          b.income ? h('span', { class: 'badge gold' }, `${b.income} gold / wave`) : null,
        ))),
    h('div', { class: 'paths' }, ...d.paths.map((p, pi) => h('div', { class: 'pathbox' },
      h('h4', null, h('span', { class: 'dot', style: `background:${p.color}` }), p.name),
      h('ol', null, ...p.upgrades.map((u, ti) => h('li', null, h('b', null, u.name), ` — ${u.desc} `, h('span', { class: 'muted' }, `(${Math.round(baseUpgradeCost(type, pi, ti) / 5) * 5}g)`))))))),
    h('p', { class: 'small muted' }, `Upgrade prices are ${TIER_MULT.map((m) => m + '×').join(' / ')} the base cost before difficulty and discounts.`),
  );
}

// ------------------------------------------------------------------ guardians (unlocks, talents, cosmetics)
export function guardiansScreen(app: App, params: { tab?: string }): Screen {
  let tab = params.tab ?? 'guardians';
  const content = h('div', { class: 'content scroll' });
  const tabs = h('div', { class: 'tabs' });
  const render = () => {
    clear(tabs);
    for (const [id, label, ic] of [['guardians', 'Guardians', 'hero'], ['talents', 'Talents', 'star'], ['cosmetics', 'Cosmetics', 'paint']] as const)
      tabs.appendChild(btn([icon(ic), label], () => { tab = id; params.tab = id; audio.play('click'); render(); }, `btn btn-small ${tab === id ? 'active' : 'btn-dark'}`));
    clear(content);
    const sp = el.querySelector('.shard-pill');
    if (sp) sp.lastChild!.textContent = String(app.save.shards);
    if (tab === 'guardians') {
      const grid = h('div', { class: 'grid' });
      for (const t of [...TOWER_TYPES, 'lyra'] as UnitType[]) {
        const unlocked = isTowerUnlocked(app.save, t);
        const name = t === 'lyra' ? HERO.name : TOWERS[t].name;
        grid.appendChild(h('div', { class: `card coll-item ${unlocked ? '' : 'locked'}`, style: 'cursor:pointer', role: 'button', tabindex: 0,
          onClick: () => { audio.play('click'); app.modal((close) => h('div', { class: 'scroll' }, towerDetail(app, t), h('div', { class: 'actions' }, btn('Close', close, 'btn btn-gold'))), { wide: true }); } },
          h('img', { src: towerIcon(t, { levels: [0, 0, 0], heroLevel: 1, lyraOutfit: app.save.cosmetics.lyra }), alt: '' }),
          h('div', null, h('h3', null, name), h('div', { class: 'small muted' }, t === 'lyra' ? 'Hero' : TOWERS[t].role),
            h('div', { style: 'margin-top:6px' }, unlocked ? h('span', { class: 'badge ok' }, icon('check'), 'Unlocked') : h('span', { class: 'badge lock' }, icon('lock'), 'Locked')),
            !unlocked ? h('div', { class: 'small', style: 'margin-top:4px' }, TOWER_UNLOCK_TEXT[t]) : null,
            h('div', { class: 'small muted', style: 'margin-top:4px' }, 'Tap to inspect paths')),
        ));
      }
      content.appendChild(grid);
    } else if (tab === 'talents') {
      content.appendChild(h('p', { class: 'muted' }, 'Permanent bonuses are deliberately modest. Turn on Pure mode when starting a run to disable them (earns a Pure medal).'));
      const grid = h('div', { class: 'grid' });
      for (const t of TALENTS) {
        const rank = app.save.talents[t.id];
        const max = rank >= t.maxRank;
        const cost = max ? 0 : t.costs[rank];
        grid.appendChild(h('div', { class: 'card' },
          h('h3', null, t.name),
          h('div', { class: 'row' }, ...Array.from({ length: t.maxRank }, (_, i) => h('span', { class: 'ico', style: `color:${i < rank ? '#f5b942' : '#d8ccb4'};width:26px;height:26px`, html: icon('star').innerHTML }))),
          h('p', null, `Current: ${rank ? t.desc(rank) : 'none'}`, h('br'), h('span', { class: 'muted small' }, max ? 'Maximum rank reached.' : `Next: ${t.desc(rank + 1)}`)),
          max ? null : btn([icon('shard'), `Learn — ${cost}`], () => {
            const err = buyTalent(app.save, t.id);
            if (err) { audio.play('error'); app.toast(err, 'bad'); return; }
            audio.play('upgrade');
            app.persist();
            render();
          }, `btn btn-small ${app.save.shards >= cost ? 'btn-gold' : ''}`, { disabled: app.save.shards < cost }),
        ));
      }
      content.appendChild(grid);
    } else {
      const grid = h('div', { class: 'grid' });
      for (const c of COSMETICS) {
        const owned = app.save.cosmetics.owned.includes(c.id);
        const equipped = (c.kind === 'lyra' && app.save.cosmetics.lyra === c.value) || (c.kind === 'trim' && app.save.cosmetics.trim) || (c.kind === 'trail' && app.save.cosmetics.prismatic);
        const preview = c.kind === 'lyra' ? towerIcon('lyra', { levels: [0, 0, 0], heroLevel: 6, lyraOutfit: c.value }) : c.kind === 'trim' ? towerIcon('archer', { levels: [1, 1, 0], goldTrim: true }) : null;
        grid.appendChild(h('div', { class: 'card coll-item' },
          preview ? h('img', { src: preview, alt: '' }) : h('div', { style: 'width:84px;height:84px;border-radius:12px;background:linear-gradient(135deg,#ff6a6a,#ffd34a,#6ae06a,#6ad0ff,#c06aff)' }),
          h('div', null, h('h3', null, c.name), h('p', { class: 'small muted' }, c.desc),
            owned
              ? btn(equipped ? [icon('check'), c.kind === 'lyra' ? 'Equipped' : 'On'] : c.kind === 'lyra' ? 'Equip' : 'Turn on', () => {
                  if (c.kind === 'lyra') app.save.cosmetics.lyra = c.value;
                  else if (c.kind === 'trim') app.save.cosmetics.trim = !app.save.cosmetics.trim;
                  else app.save.cosmetics.prismatic = !app.save.cosmetics.prismatic;
                  audio.play('click');
                  app.persist();
                  render();
                }, `btn btn-small ${equipped ? 'btn-teal' : ''}`)
              : btn([icon('shard'), `Buy — ${c.cost}`], () => {
                  const err = buyCosmetic(app.save, c.id);
                  if (err) { audio.play('error'); app.toast(err, 'bad'); return; }
                  audio.play('upgrade');
                  app.persist();
                  render();
                }, `btn btn-small ${app.save.shards >= c.cost ? 'btn-gold' : ''}`, { disabled: app.save.shards < c.cost }),
          ),
        ));
      }
      content.appendChild(grid);
    }
  };
  const el = h('div', { class: 'screen' }, topbar(app, 'Guardians'), tabs, content);
  render();
  return { el };
}

// ------------------------------------------------------------------ collection
export function collectionScreen(app: App, params: { tab?: string }): Screen {
  let tab = params.tab ?? 'guardians';
  const content = h('div', { class: 'content scroll' });
  const tabs = h('div', { class: 'tabs' });
  const render = () => {
    clear(tabs);
    for (const [id, label] of [['guardians', 'Guardians'], ['enemies', 'Enemies'], ['variants', 'Variants & Boss']] as const)
      tabs.appendChild(btn(label, () => { tab = id; params.tab = id; audio.play('click'); render(); }, `btn btn-small ${tab === id ? 'active' : 'btn-dark'}`));
    clear(content);
    if (tab === 'guardians') {
      for (const t of [...TOWER_TYPES, 'lyra'] as UnitType[]) {
        const unlocked = isTowerUnlocked(app.save, t);
        const card = h('div', { class: 'card', style: 'margin-bottom:12px' }, towerDetail(app, t));
        if (!unlocked) card.prepend(h('div', { class: 'badge lock', style: 'margin-bottom:6px' }, icon('lock'), `Locked — ${TOWER_UNLOCK_TEXT[t]}`));
        content.appendChild(card);
      }
    } else if (tab === 'enemies') {
      const grid = h('div', { class: 'grid' });
      for (const id of ENEMY_ORDER) {
        const e = ENEMIES[id];
        grid.appendChild(h('div', { class: 'card coll-item' },
          h('img', { src: enemyIcon(id), alt: '' }),
          h('div', null, h('h3', null, e.name), h('div', { class: 'badge gold' }, e.mechanic),
            h('p', { class: 'small' }, e.description),
            h('div', { class: 'statline' },
              h('span', { class: 'badge' }, `HP ${e.hp}`), h('span', { class: 'badge' }, `Speed ${e.speed}`),
              h('span', { class: 'badge' }, `Reward ${e.rewardBudget}${e.children ? ' total' : ''}`), h('span', { class: 'badge' }, `Leak −${e.leak}`),
              e.armor ? h('span', { class: 'badge' }, `Armor ${e.armor}`) : null,
              h('span', { class: 'badge' }, `From wave ${e.firstWave}`)),
            e.children ? h('div', { class: 'small muted' }, `Releases ${e.children.count} ${ENEMIES[e.children.type].name}s worth ${e.children.rewardEach} gold each (parent pays ${e.reward}).`) : null,
          )));
      }
      content.appendChild(grid);
      content.appendChild(h('p', { class: 'small muted' }, `Speeds are listed in base units per second (×${SPEED_SCALE} on the battlefield). Health grows by 2.5% per wave after wave 10, plus difficulty scaling.`));
    } else {
      const grid = h('div', { class: 'grid' });
      for (const v of Object.values(VARIANTS)) grid.appendChild(h('div', { class: 'card' }, h('h3', null, v.name), h('p', { class: 'small' }, v.description)));
      grid.appendChild(h('div', { class: 'card' }, h('h3', null, 'Rift Colossus phases'),
        h('ol', { class: 'small' },
          h('li', null, 'Above 65% health: slow advance; every 9s raises a shield worth 8% of max health for 4s (1s warning).'),
          h('li', null, '65%–30%: every 7s summons 4 Skitters/Sproutlings on its own path (1.2s warning). At most 12 alive and 24 total per Colossus. Summons give no gold.'),
          h('li', null, 'Below 30%: moves 35% faster; every 10s hardens for 2s, halving damage taken (1s warning). Shields never overlap hardening.')),
        h('p', { class: 'small muted' }, 'Bosses take half-strength slows and are immune to freeze and stun.')));
      content.appendChild(grid);
    }
  };
  const el = h('div', { class: 'screen' }, topbar(app, 'Collection'), tabs, content);
  render();
  return { el };
}

// ------------------------------------------------------------------ achievements
export function achievementsScreen(app: App): Screen {
  const done = ACHIEVEMENTS.filter((a) => app.save.achievements[a.id]).length;
  const list = h('div', { class: 'grid' }, ...ACHIEVEMENTS.map((a) => {
    const got = !!app.save.achievements[a.id];
    return h('div', { class: `card ach ${got ? 'done' : ''}` }, icon('trophy'),
      h('div', null, h('h3', null, a.name), h('div', { class: 'small muted' }, a.desc)),
      h('span', { class: `badge ${got ? 'ok' : ''}` }, got ? icon('check') : icon('shard'), got ? 'Earned' : `+${a.reward}`));
  }));
  const s = app.save;
  const medals = MAPS.map((m) => {
    const r = s.medals[m.id] ?? {};
    return `${m.name}: ${(['easy', 'normal', 'hard'] as const).filter((d) => r[d]).map((d) => DIFFICULTY[d].medal).join(', ') || '—'}`;
  });
  const el = h('div', { class: 'screen' }, topbar(app, 'Achievements'),
    h('div', { class: 'content scroll' },
      h('p', null, `${done} / ${ACHIEVEMENTS.length} earned · Victories: ${s.stats.victories} · Enemies defeated: ${s.stats.totalKills.toLocaleString()}`),
      list,
      h('div', { class: 'card', style: 'margin-top:12px' }, h('h3', null, 'Medals'), h('ul', { class: 'small' }, ...medals.map((m) => h('li', null, m)))),
    ));
  return { el };
}

// ------------------------------------------------------------------ settings (screen + reusable panel)
export function settingsPanel(app: App, onChange?: () => void, inGame = false): HTMLElement {
  const s = app.save.settings;
  const save = () => { app.persist(); app.applyAudioSettings(); onChange?.(); };
  const slider = (label: string, key: 'music' | 'sfx') => {
    const out = h('span', { class: 'small muted', style: 'min-width:38px;text-align:right' }, `${Math.round(s[key] * 100)}%`);
    const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round(s[key] * 100), 'aria-label': label }) as HTMLInputElement;
    input.addEventListener('input', () => { s[key] = +input.value / 100; out.textContent = `${input.value}%`; save(); });
    input.addEventListener('change', () => audio.play(key === 'sfx' ? 'coin' : 'click'));
    return h('div', { class: 'setting' }, h('b', null, label), h('div', { class: 'row' }, input, out));
  };
  const seg = <T extends string>(label: string, cur: T, opts: [T, string][], set: (v: T) => void, note?: string) => {
    const wrap = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label });
    const draw = (v: T) => {
      clear(wrap);
      for (const [val, txt] of opts) wrap.appendChild(h('button', { class: val === v ? 'on' : '', type: 'button', role: 'radio', 'aria-checked': String(val === v), onClick: () => { set(val); audio.play('click'); save(); draw(val); } }, txt));
    };
    draw(cur);
    return h('div', { class: 'setting' }, h('div', null, h('b', null, label), note ? h('div', { class: 'small muted' }, note) : null), wrap);
  };
  const check = (label: string, get: () => boolean, set: (v: boolean) => void, note?: string) => {
    const input = h('input', { type: 'checkbox' }) as HTMLInputElement;
    input.checked = get();
    input.addEventListener('change', () => { set(input.checked); audio.play('click'); save(); });
    return h('label', { class: 'setting toggle' }, h('div', null, h('b', null, label), note ? h('div', { class: 'small muted' }, note) : null), input);
  };
  const panel = h('div', { class: 'card' },
    h('h3', null, 'Audio'),
    slider('Music volume', 'music'),
    slider('Sound effects', 'sfx'),
    check('Mute everything', () => s.muted, (v) => (s.muted = v)),
    h('h3', { style: 'margin-top:10px' }, 'Visuals'),
    seg('Visual quality', s.quality, [['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], (v) => (s.quality = v), 'Low renders at 1× resolution with fewer particles.'),
    check('Reduced effects', () => s.reducedEffects, (v) => (s.reducedEffects = v), 'Fewer particles, no screen shake or flashing.'),
    check('Screen shake', () => s.screenShake, (v) => (s.screenShake = v)),
    h('h3', { style: 'margin-top:10px' }, 'Gameplay'),
    seg('Confirm placement', s.confirmPlacement, [['touch', 'Touch only'], ['always', 'Always']], (v) => (s.confirmPlacement = v), 'With a mouse, a click places immediately unless set to Always.'),
    check('Auto-start waves by default', () => s.autoStart, (v) => (s.autoStart = v), 'A 3-second countdown you can cancel.'),
  );
  if (!inGame) {
    const box = h('textarea', { class: 'savebox', placeholder: 'Paste an exported save here, or choose a file below…', 'aria-label': 'Save data' }) as HTMLTextAreaElement;
    const file = h('input', { type: 'file', accept: '.txt,.json,.rksave', style: 'display:none' }) as HTMLInputElement;
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      if (f) box.value = await f.text();
    });
    panel.append(
      h('h3', { style: 'margin-top:10px' }, 'Save data'),
      h('p', { class: 'small muted' }, 'Progress is stored on this device. Export it to back up or move to another device.'),
      h('div', { class: 'row' },
        btn([icon('download'), 'Export'], () => {
          const data = app.store.exportString();
          box.value = data;
          box.select();
          try { navigator.clipboard?.writeText(data).then(() => app.toast('Save copied to clipboard')).catch(() => {}); } catch { /* ignore */ }
          const a = h('a', { href: URL.createObjectURL(new Blob([data], { type: 'text/plain' })), download: `riftkeepers-save-${new Date().toISOString().slice(0, 10)}.rksave` });
          a.click();
          setTimeout(() => URL.revokeObjectURL(a.href), 1000);
        }, 'btn btn-small'),
        btn([icon('upload'), 'Choose file'], () => file.click(), 'btn btn-small'),
        btn('Import', async () => {
          if (!box.value.trim()) { app.toast('Paste or choose a save first.', 'bad'); return; }
          if (!(await app.confirm('Import save?', 'This replaces your current progress on this device.', 'Import', true))) return;
          const err = app.store.importString(box.value);
          if (err) { audio.play('error'); app.toast(err, 'bad'); return; }
          app.applyAudioSettings();
          app.toast('Save imported!', 'gold');
          app.go('title', {}, { reset: true });
        }, 'btn btn-small btn-teal'),
      ),
      box, file,
      h('div', { class: 'row', style: 'margin-top:8px' },
        btn('Replay tutorial', () => app.go('game', { tutorial: true }), 'btn btn-small'),
        h('span', { class: 'spacer' }),
        btn('Reset progress', async () => {
          if (!(await app.confirm('Reset all progress?', 'Shards, unlocks, medals, achievements and your saved run will be erased. Settings are kept. This cannot be undone.', 'Reset everything', true))) return;
          app.store.reset();
          app.toast('Progress reset.');
          app.go('title', {}, { reset: true });
        }, 'btn btn-small btn-red'),
      ),
    );
  }
  return panel;
}

export function settingsScreen(app: App): Screen {
  const el = h('div', { class: 'screen' }, topbar(app, 'Settings'), h('div', { class: 'content scroll' }, h('div', { style: 'max-width:720px;margin:0 auto' }, settingsPanel(app))));
  return { el };
}

// ------------------------------------------------------------------ help
export function helpScreen(app: App): Screen {
  const sec = (title: string, ...body: (HTMLElement | string)[]) => h('div', { class: 'card help-sec', style: 'margin-bottom:12px' }, h('h3', null, title), ...body);
  const el = h('div', { class: 'screen' }, topbar(app, 'How to Play', [btn('Replay tutorial', () => app.go('game', { tutorial: true }), 'btn btn-small btn-gold')]),
    h('div', { class: 'content scroll' }, h('div', { style: 'max-width:820px;margin:0 auto' },
      sec('The basics',
        h('p', null, 'Rift creatures emerge from swirling rifts and follow the road to your village gate. Each one that reaches the gate costs lives. Place guardians beside the road; they attack automatically. Survive every wave to win.'),
        h('p', null, 'Earn gold by defeating enemies (not merely damaging them) and at the end of every wave: 40 + 4 × wave number. Spend it on new guardians and upgrades — even mid-wave.')),
      sec('Placing guardians',
        h('ol', null,
          h('li', null, 'Tap a guardian in the shop. Its range and a green/red footprint follow your finger or cursor.'),
          h('li', null, 'Green ground is buildable; red is the road, water, walls, ice, the island edge or another guardian. A short message explains why a spot is invalid.'),
          h('li', null, 'On touch screens, tap or drag to position, then press the ✓ button. Press ✕ (or Esc) to cancel at no cost.'),
          h('li', null, 'Gold is only charged when placement is confirmed.'))),
      sec('Upgrades and cross-pathing',
        h('p', null, 'Every guardian has three five-tier upgrade paths. Rules:'),
        h('ul', null,
          h('li', null, 'You may invest in at most two paths per guardian.'),
          h('li', null, 'Only one path may go beyond tier 2. Once a path reaches tier 3, the other path is capped at tier 2.'),
          h('li', null, 'Only one tier-5 guardian of each type and path may exist at a time.'),
          h('li', null, 'Locked upgrades show the reason. Upgrades visibly change your guardian.'),
          h('li', null, 'Selling refunds 70% of everything you actually spent on that guardian (after discounts).'))),
      sec('Targeting',
        h('ul', null,
          h('li', null, h('b', null, 'First'), ' — the enemy furthest along the road (default).'),
          h('li', null, h('b', null, 'Last'), ' — the enemy least far along.'),
          h('li', null, h('b', null, 'Strong'), ' — the highest threat (bosses > Brutes > Menders…), then most health.'),
          h('li', null, h('b', null, 'Close'), ' — the nearest enemy.')),
        h('p', { class: 'small muted' }, 'Ties are broken by spawn order so targets never flicker.')),
      sec('Damage, armor and resistances',
        h('ul', null,
          h('li', null, h('b', null, 'Physical'), ' (Archer), ', h('b', null, 'fire'), ' (Alchemist) and ', h('b', null, 'frost'), ' (Warden) hits are reduced by armor: −2 per hit for Bulwarks (minimum 1).'),
          h('li', null, h('b', null, 'Arcane'), ' (Storm Engineer, Lyra) and ', h('b', null, 'acid'), ' (Alchemist Chemistry) ignore armor.'),
          h('li', null, 'Damage over time (burn, corrosion, fire zones) ignores armor but respects resistances.'),
          h('li', null, 'Fire-resistant Emberkin take 75% less fire damage; frost-resistant Frostlings take 75% less frost damage, half-strength slows and cannot be frozen.'),
          h('li', null, 'Concealed enemies can only be targeted by guardians with detection (Archer Keen Eyes, Storm Scanner Array, Beacon Revealing Light, Lyra level 5) or while exposed (Winter Field, True Sight).'))),
      sec('Status effects',
        h('ul', null,
          h('li', null, 'Slows: each source keeps one slot; reapplying refreshes duration and keeps the stronger value. Only the strongest active slow applies (max 75%). Bosses take half.'),
          h('li', null, 'Freeze and stun stop movement briefly; afterwards the enemy is immune to both for 1 second. Bosses are immune.'),
          h('li', null, 'Burns and corrosion: one slot each; a stronger effect replaces a weaker one, and duration refreshes to the longer of the two.'),
          h('li', null, 'Marks, armor shred and exposure: one slot each, strongest value, refreshed duration.'))),
      sec('Support and economy',
        h('ul', null,
          h('li', null, 'Sun Beacon buffs of the same kind never stack — the strongest applies. Different kinds combine. Beacons do not buff other beacons, so there are no feedback loops.'),
          h('li', null, 'Discounts never reduce a price below 70% of normal.'),
          h('li', null, 'Crystal Orchards pay 80 gold per completed wave (more with Growth). Banking stores income with a bonus and earns interest once per wave up to its capacity. Harvest turns income into crystals you tap to collect — they never expire.'),
          h('li', null, 'No end-of-wave income is paid for unfinished or failed waves.'))),
      sec('Lyra, the Rift Scout',
        h('p', null, `Costs ${HERO.cost} gold; one per run. Gains XP from completed waves and levels from 1 to 10. Rift Pulse (level 3) damages nearby enemies; Time Anchor (level 8) slows every enemy. Use abilities from the buttons at the lower left of the battlefield, or keys Q and W.`)),
      sec('Controls',
        h('ul', null,
          h('li', null, 'Touch / mouse: tap a guardian to select it; tap empty ground to deselect. Tap crystals to collect them.'),
          h('li', null, h('kbd', null, 'Space'), ' start next wave · ', h('kbd', null, 'Esc'), ' cancel placement / pause · ', h('kbd', null, '1'), '–', h('kbd', null, '7'), ' shop · ', h('kbd', null, 'Tab'), ' game speed'),
          h('li', null, h('kbd', null, 'Q'), h('kbd', null, 'W'), h('kbd', null, 'E'), h('kbd', null, 'R'), h('kbd', null, 'T'), h('kbd', null, 'Y'), ' abilities (shown on each ability button) · ', h('kbd', null, 'U'), h('kbd', null, 'I'), h('kbd', null, 'O'), ' upgrade the selected guardian\'s paths · ', h('kbd', null, 'S'), ' sell'))),
      sec('Modes',
        h('ul', null,
          h('li', null, h('b', null, 'Campaign'), ': Easy (40 waves), Normal (60) and Hard (80). First clears award Rift Shards and medals.'),
          h('li', null, h('b', null, 'Endless'), ': continue after a victory to chase your best wave.'),
          h('li', null, h('b', null, 'Daily Challenge'), ': a new map, guardian roster and twist every day; one reward per date.'),
          h('li', null, h('b', null, 'Restricted Challenges'), ': hand-made puzzles with enforced rules.'),
          h('li', null, h('b', null, 'Sandbox'), ': unlimited gold, spawn any enemy; no rewards.'))),
    )));
  return { el };
}
