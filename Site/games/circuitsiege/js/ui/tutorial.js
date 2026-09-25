/* CIRCUIT SIEGE — interactive tutorial (small contextual tips) */
(function () {
  'use strict';
  const CS = window.CS;
  const UI = CS.UI;
  const $ = UI.$;

  const anyTier = (m) => m.towers.some((t) => t.tiers[0] + t.tiers[1] + t.tiers[2] > 0);

  const STEPS = [
    { text: 'Corrupted programs are marching on your <b>Core</b>. Select the <b>Pulse Turret</b> — click it or press <b>1</b>.', hl: '.shop-item[data-type=pulse]', done: (m, h) => h.ui.placing === 'pulse' || m.towers.length > 0 },
    { text: 'Place it beside the path. The pulsing ring marks a strong spot — <b>corners</b> let towers cover more of the path.', marker: { x: 312, y: 212 }, done: (m) => m.towers.length > 0 },
    { text: 'Defenses online. Press <b>START WAVE</b> (or <b>Space</b>) to begin.', hl: '#btn-start', done: (m) => m.wave >= 1, allowStart: true },
    { text: 'Every destroyed enemy drops <b>Credits (¢)</b>. Spend them on towers and upgrades.', done: (m) => m.stats.wavesCleared >= 1 },
    { text: 'Wave cleared — bonus Credits received! Now <b>click your turret</b> to open its upgrades.', done: (m, h) => !!h.ui.selectedTower || anyTier(m) },
    { text: 'Each tower has <b>3 upgrade paths</b>. One path can go to tier 5 — the others cap at tier 2. <b>Buy an upgrade.</b>', hl: '#inspect-view .up-buy', done: (m) => anyTier(m) },
    { text: 'Nice. Build more towers when you can afford them, then start <b>wave 2</b>. Use <b>2×</b>/<b>3×</b> to speed things up.', hl: '#btn-start', done: (m) => m.wave >= 2, allowStart: true },
    { text: 'Towers choose targets automatically. Select a tower and use the <b>TARGET ◀ ▶</b> arrows — try <b>Strongest</b> or <b>Last</b>.', done: (m) => m.towers.some((t) => t.def.targeting.length && t.targeting !== t.def.targeting[0]) || m.wave >= 4, allowStart: true, skippable: true },
    { text: 'Different enemies need different answers. Click any enemy to see its <b>HP, armor and traits</b>.', done: (m, h) => !!h.ui.selectedEnemy || m.wave >= 5, allowStart: true, skippable: true },
    { text: 'Armored enemies shrug off weak hits. <b>Snipers</b>, <b>Arc Towers</b> (energy) and explosives cut through armor.', done: (m) => m.wave >= 6, allowStart: true },
    { text: '<b>Boss incoming!</b> Bosses have unique mechanics. Upgrade your best towers and focus fire to defeat the <b>SENTINEL</b>.', done: (m) => m.state === 'victory', allowStart: true },
  ];

  class Tutorial {
    constructor(hud) {
      this.hud = hud;
      this.i = 0;
      this.hlEl = null;
      this.allowSelectAfterPlace = true;
    }
    start() { this.show(); }
    stop() {
      this.clearHL();
      $('#tip').classList.add('hidden');
      this.hud.ui.marker = null;
    }
    step() { return STEPS[this.i]; }
    allowStart() { const s = this.step(); return !s || !!s.allowStart; }
    show() {
      const s = this.step();
      const tip = $('#tip');
      if (!s) { tip.classList.add('hidden'); return; }
      tip.innerHTML = `<div class="tip-h"><span>TRAINING ${this.i + 1}/${STEPS.length}</span><span>${s.skippable ? '<button class="tip-skip" data-a="next">Got it</button> ' : ''}<button class="tip-skip" data-a="skip">Skip tutorial</button></span></div><div>${s.text}</div>`;
      tip.classList.remove('hidden');
      tip.querySelector('[data-a=skip]').onclick = () => UI.confirm('Skip tutorial?', 'You can replay it any time from the main menu.', 'Skip', () => this.hud.app.skipTutorial());
      const nx = tip.querySelector('[data-a=next]');
      if (nx) nx.onclick = () => this.advance();
      this.hud.ui.marker = s.marker || null;
      this.applyHL();
    }
    applyHL() {
      this.clearHL();
      const s = this.step();
      if (!s || !s.hl) return;
      const el = document.querySelector(s.hl);
      if (el) { el.classList.add('highlight'); this.hlEl = el; }
    }
    clearHL() { if (this.hlEl) this.hlEl.classList.remove('highlight'); this.hlEl = null; }
    advance() {
      this.i++;
      CS.sfx('click');
      this.show();
    }
    update() {
      const s = this.step();
      if (!s) return;
      if (s.done(this.hud.m, this.hud)) { this.advance(); return; }
      // Re-apply highlight if the element was re-rendered
      if (s.hl && (!this.hlEl || !document.body.contains(this.hlEl))) this.applyHL();
    }
    onInspector() { this.applyHL(); }
    onEvent() {}
  }

  CS.Tutorial = Tutorial;
})();
