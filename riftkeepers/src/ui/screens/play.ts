import { audio } from '../../audio/audio';
import { DIFFICULTIES, type Difficulty } from '../../core/types';
import { DIFFICULTY } from '../../data/difficulty';
import { MAPS, MAP_BY_ID, type MapDef } from '../../data/maps';
import { CHALLENGES, DAILY_FINAL_WAVE, DAILY_REWARD } from '../../data/progression';
import { buyMap, challengeAvailable, dailyInfo, isMapUnlocked, localDateKey, towerName } from '../../game/progression';
import { towerIcon } from '../../render/spriteCache';
import { topbar, type App, type Screen } from '../app';
import { btn, clear, h, icon } from '../dom';
import { mapThumb } from '../thumbs';

type Tab = 'campaign' | 'challenges' | 'daily' | 'sandbox';

function medalRow(app: App, mapId: string) {
  const m = app.save.medals[mapId] ?? {};
  const fl = app.save.flawless[mapId] ?? {};
  const pu = app.save.pure[mapId] ?? {};
  return h('div', { class: 'medals', title: 'Medals: Easy / Normal / Hard, Flawless, Pure' },
    ...DIFFICULTIES.map((d) => h('span', { class: `medal ${m[d] ? d : 'off'}`, title: `${DIFFICULTY[d].name}${m[d] ? ' — won' : ''}` }, d[0].toUpperCase())),
    Object.values(fl).some(Boolean) ? h('span', { class: 'medal flawless', title: 'Flawless (no leaks)' }, '♥') : null,
    Object.values(pu).some(Boolean) ? h('span', { class: 'medal pure', title: 'Pure (no permanent bonuses)' }, '✦') : null,
  );
}

async function confirmAbandon(app: App): Promise<boolean> {
  if (!app.save.activeRun) return true;
  return app.confirm('Abandon saved run?', 'Starting a new run replaces your saved run. It will not award any rewards.', 'Start new run', true);
}

export function playScreen(app: App, params: { tab?: Tab; mapId?: string }): Screen {
  let tab: Tab = params.tab ?? 'campaign';
  let detail: string | null = params.mapId ?? null;
  let difficulty: Difficulty = 'easy';
  let pure = false;
  const tabs = h('div', { class: 'tabs' });
  const content = h('div', { class: 'content scroll' });
  audio.playMusic('menu');

  const render = () => {
    params.tab = tab;
    params.mapId = detail ?? undefined;
    clear(tabs);
    for (const [id, label, ic] of [['campaign', 'Campaign', 'flag'], ['challenges', 'Challenges', 'target'], ['daily', 'Daily', 'calendar'], ['sandbox', 'Sandbox', 'sandbox']] as const)
      tabs.appendChild(btn([icon(ic), label], () => { tab = id; detail = null; audio.play('click'); render(); }, `btn btn-small ${tab === id ? 'active' : 'btn-dark'}`, { 'data-testid': `tab-${id}` }));
    clear(content);
    content.scrollTop = 0;
    const pill = el.querySelector('.shard-pill');
    if (pill) pill.lastChild!.textContent = String(app.save.shards);
    if (tab === 'campaign') detail ? renderDetail(MAP_BY_ID[detail]) : renderGrid();
    else if (tab === 'challenges') renderChallenges();
    else if (tab === 'daily') renderDaily();
    else renderSandbox();
  };

  const renderGrid = () => {
    const grid = h('div', { class: 'grid' });
    for (const m of MAPS) {
      const unlocked = isMapUnlocked(app.save, m.id);
      const best = app.save.best[m.id] ?? {};
      const bestTxt = DIFFICULTIES.filter((d) => best[d]).map((d) => `${DIFFICULTY[d].name[0]}:${best[d]}`).join(' ');
      grid.appendChild(h('div', { class: `card map-card ${unlocked ? '' : 'locked'}`, role: 'button', tabindex: 0, 'data-testid': `map-${m.id}`,
        onClick: () => { audio.play('click'); detail = m.id; render(); },
        onKeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') { detail = m.id; render(); } } },
        h('img', { src: mapThumb(m.id), alt: `${m.name} thumbnail`, loading: 'lazy' }),
        !unlocked ? h('span', { class: 'badge lock lockover' }, icon('lock'), 'Locked') : null,
        h('div', { class: 'body' },
          h('div', { class: 'row' }, h('h3', { style: 'margin:0;flex:1' }, m.name), h('span', { class: 'small muted' }, '★'.repeat(m.difficultyStars))),
          h('div', { class: 'small muted' }, m.tagline),
          h('div', { class: 'row' }, medalRow(app, m.id), h('span', { class: 'spacer' }), h('span', { class: 'small muted' }, bestTxt ? `Best ${bestTxt}` : unlocked ? 'Not yet played' : '')),
          !unlocked && m.unlock ? h('div', { class: 'small' }, `Unlock: ${m.unlock.victories} total victories or ${m.unlock.shards} Shards`) : null,
        )));
    }
    content.appendChild(grid);
  };

  const renderDetail = (m: MapDef) => {
    const unlocked = isMapUnlocked(app.save, m.id);
    const best = app.save.best[m.id] ?? {};
    const eb = app.save.endlessBest[m.id] ?? {};
    const diffBtns = h('div', { class: 'diff-row' });
    const drawDiff = () => {
      clear(diffBtns);
      for (const d of DIFFICULTIES) {
        const def = DIFFICULTY[d];
        diffBtns.appendChild(btn([def.name, h('small', null, `${def.finalWave} waves · ${def.startGold}g · ${def.lives}♥`)], () => { difficulty = d; audio.play('click'); drawDiff(); blurb.textContent = def.blurb; },
          `btn ${difficulty === d ? 'active' : ''}`, { 'data-testid': `diff-${d}`, 'aria-pressed': String(difficulty === d) }));
      }
    };
    const blurb = h('p', { class: 'small muted' }, DIFFICULTY[difficulty].blurb);
    drawDiff();
    const pureBox = h('input', { type: 'checkbox' }) as HTMLInputElement;
    pureBox.checked = pure;
    pureBox.addEventListener('change', () => (pure = pureBox.checked));
    const startBtn = btn([icon('play'), 'Start'], async () => {
      if (!(await confirmAbandon(app))) return;
      audio.play('click');
      app.go('game', { mapId: m.id, difficulty, pure });
    }, 'btn btn-gold btn-wide', { 'data-testid': 'start-run', 'data-autofocus': true });
    const right = h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:8px' },
      h('div', { class: 'row' }, h('h3', { style: 'margin:0;flex:1' }, m.name), medalRow(app, m.id)),
      h('p', { class: 'small', style: 'margin:0' }, m.description),
      h('ul', { class: 'mech small' }, ...m.mechanics.map((x) => h('li', null, x))),
      h('div', { class: 'small muted' }, 'Best wave: ', DIFFICULTIES.map((d) => `${DIFFICULTY[d].name} ${best[d] ?? '—'}`).join(' · '),
        Object.keys(eb).length ? ` · Endless best: ${DIFFICULTIES.filter((d) => eb[d]).map((d) => `${DIFFICULTY[d].name} ${eb[d]}`).join(', ')}` : ''),
      unlocked
        ? h('div', { style: 'display:flex;flex-direction:column;gap:8px' }, diffBtns, blurb,
            h('label', { class: 'toggle small' }, pureBox, h('span', null, h('b', null, 'Pure mode'), ' — disable permanent talent bonuses (earns a Pure medal)')),
            startBtn)
        : h('div', { style: 'display:flex;flex-direction:column;gap:8px' },
            h('p', null, icon('lock'), ` Locked. Win ${m.unlock!.victories} runs in total (you have ${app.save.stats.victories}), or unlock now.`),
            btn([icon('shard'), `Unlock for ${m.unlock!.shards}`], () => {
              const err = buyMap(app.save, m.id);
              if (err) { audio.play('error'); app.toast(err, 'bad'); return; }
              audio.play('upgrade');
              app.persist();
              app.toast(`${m.name} unlocked!`, 'gold');
              render();
            }, `btn ${app.save.shards >= m.unlock!.shards ? 'btn-gold' : ''}`, { disabled: app.save.shards < m.unlock!.shards })),
    );
    content.appendChild(h('div', { class: 'detail' },
      h('div', null, h('img', { src: mapThumb(m.id, true, 800), alt: `${m.name} route preview` }), h('p', { class: 'small muted' }, 'Arrows show enemy routes from each rift to the village gate.')),
      right));
  };

  const renderChallenges = () => {
    content.appendChild(h('p', { class: 'muted' }, 'Hand-made puzzles with enforced rules. Permanent bonuses are disabled. Each awards Shards the first time.'));
    const grid = h('div', { class: 'grid' });
    for (const ch of CHALLENGES) {
      const av = challengeAvailable(app.save, ch);
      const done = app.save.challenges.completed.includes(ch.id);
      grid.appendChild(h('div', { class: 'card map-card' + (av.ok ? '' : ' locked'), style: 'cursor:default' },
        h('img', { src: mapThumb(ch.mapId), alt: '' }),
        h('div', { class: 'body' },
          h('div', { class: 'row' }, h('h3', { style: 'margin:0;flex:1' }, ch.name), done ? h('span', { class: 'badge ok' }, icon('check'), 'Done') : h('span', { class: 'badge gold' }, icon('shard'), `+${ch.reward}`)),
          h('div', { class: 'small muted' }, `${MAP_BY_ID[ch.mapId].name} · ${DIFFICULTY[ch.difficulty].name} · ${ch.finalWave} waves`),
          h('ul', { class: 'mech small' }, ...ch.rules.map((r) => h('li', null, r))),
          av.ok
            ? btn([icon('play'), done ? 'Play again' : 'Start'], async () => {
                if (!(await confirmAbandon(app))) return;
                app.go('game', { challengeId: ch.id });
              }, 'btn btn-small btn-gold', { 'data-testid': `challenge-${ch.id}` })
            : h('div', { class: 'small' }, icon('lock'), ' ', av.reason!),
        )));
    }
    content.appendChild(grid);
  };

  const renderDaily = () => {
    const date = localDateKey();
    const info = dailyInfo(date);
    const claimed = app.save.daily.claimed.includes(date);
    content.appendChild(h('div', { class: 'detail' },
      h('div', null, h('img', { src: mapThumb(info.mapId, true, 800), alt: '' })),
      h('div', { class: 'card', style: 'display:flex;flex-direction:column;gap:8px' },
        h('h3', { style: 'margin:0' }, `Daily Challenge — ${date}`),
        h('div', { class: 'small muted' }, `${MAP_BY_ID[info.mapId].name} · Normal · ${DAILY_FINAL_WAVE} waves · generated locally from today's date`),
        h('b', null, 'Allowed guardians'),
        h('div', { class: 'row' }, ...info.towers.map((t) => h('span', { class: 'badge', style: 'padding:2px 8px 2px 2px' }, h('img', { src: towerIcon(t), alt: '', style: 'width:32px;height:32px' }), towerName(t)))),
        h('b', null, 'Twists'),
        h('ul', { class: 'mech small' }, ...info.modifiers.map((m) => h('li', null, h('b', null, m.name), ` — ${m.desc}`))),
        h('div', { class: 'small' }, claimed ? h('span', { class: 'badge ok' }, icon('check'), "Today's reward claimed") : h('span', { class: 'badge gold' }, icon('shard'), `+${DAILY_REWARD} Shards on victory (once per day)`)),
        btn([icon('play'), 'Play daily'], async () => {
          if (!(await confirmAbandon(app))) return;
          app.go('game', { daily: date });
        }, 'btn btn-gold', { 'data-testid': 'start-daily' }),
      )));
  };

  const renderSandbox = () => {
    content.appendChild(h('p', { class: 'muted' }, 'Experiment freely: unlimited gold, spawn any enemy with any variant and health. Sandbox never affects your campaign save or rewards.'));
    const grid = h('div', { class: 'grid' });
    for (const m of MAPS) {
      const unlocked = isMapUnlocked(app.save, m.id);
      grid.appendChild(h('div', { class: `card map-card ${unlocked ? '' : 'locked'}`, role: 'button', tabindex: 0, 'data-testid': `sandbox-${m.id}`,
        onClick: () => {
          if (!unlocked) { audio.play('error'); app.toast('Unlock this map in the campaign first.', 'bad'); return; }
          app.go('game', { sandbox: m.id });
        } },
        h('img', { src: mapThumb(m.id), alt: '' }),
        h('div', { class: 'body' }, h('h3', { style: 'margin:0' }, m.name), unlocked ? h('span', { class: 'small muted' }, 'Open sandbox') : h('span', { class: 'badge lock' }, icon('lock'), 'Locked'))));
    }
    content.appendChild(grid);
  };

  const el = h('div', { class: 'screen' }, topbar(app, 'Choose an Island'), tabs, content);
  render();
  return {
    el,
    onBack: () => {
      if (detail) {
        detail = null;
        audio.play('click');
        render();
        return true;
      }
      return false;
    },
  };
}
