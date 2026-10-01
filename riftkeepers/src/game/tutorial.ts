import type { SimEvent } from '../sim/entities';
import { btn, h, icon } from '../ui/dom';

export interface TutorialHost {
  field: HTMLElement;
  highlight(selector: string | null): void;
  pointWorld(x: number, y: number, label?: string): void;
  clearPointer(): void;
  gold(): number;
  finish(skipped: boolean): void;
  setStartAllowed(v: boolean): void;
}

interface Step {
  title: string;
  text: (host: TutorialHost) => string;
  /** CSS selector to highlight. */
  hl?: string;
  /** World point to point at. */
  at?: { x: number; y: number; label?: string }[];
  next?: boolean;
  until?: (e: SimEvent | { t: 'ui'; what: string; type?: string }) => boolean;
  allowStart?: boolean;
  top?: boolean;
}

/** Suggested first spot on Meadow Bend: inside the first bend, covering two road segments. */
export const TUTORIAL_SPOT = { x: 300, y: 250 };

/** Interactive, skippable tutorial on Meadow Bend. */
export class Tutorial {
  idx = 0;
  el: HTMLElement;
  waveGold = 0;
  private steps: Step[];

  constructor(private host: TutorialHost) {
    this.steps = [
      {
        title: 'Welcome, Keeper!', next: true, top: true,
        text: () => 'Rift creatures pour out of the swirling rift on the left and march along the road toward your village gate on the right.',
        at: [{ x: 60, y: 130, label: 'Rift (entrance)' }, { x: 1205, y: 590, label: 'Village gate (exit)' }],
      },
      {
        title: 'Hire a Thorn Archer', hl: '[data-testid="shop-archer"]',
        text: () => 'Tap the Thorn Archer in the guardian shop. Nothing is charged until you confirm a spot.',
        until: (e) => e.t === 'ui' && e.what === 'placing' && e.type === 'archer',
      },
      {
        title: 'Place it beside the road', at: [{ ...TUTORIAL_SPOT, label: 'Try here' }],
        text: () => 'Green ground is buildable, red is not. The dotted circle shows its range. Tap (or drag) to position it, then press ✓ to confirm.',
        until: (e) => e.t === 'place' && e.type === 'archer',
      },
      {
        title: 'Start the first wave', hl: '[data-testid="start-wave"]', allowStart: true,
        text: () => 'Press Start Wave (or Space). Your archer attacks automatically.',
        until: (e) => e.t === 'waveStart',
      },
      {
        title: 'Gold from victories', allowStart: false, top: true,
        text: () => 'Every enemy you defeat drops gold. Finishing a wave also pays a bonus of 40 + 4 × wave. Watch the gold counter at the top.',
        until: (e) => e.t === 'waveEnd',
      },
      {
        title: 'Wave complete!', next: true, hl: '[data-testid="gold"]',
        text: (hst) => `You earned ${this.waveGold} gold from that wave. You now have ${hst.gold()} gold to spend.`,
      },
      {
        title: 'Upgrade your archer',
        text: () => 'Tap your archer to select it, then buy an upgrade from the panel. Each guardian has three paths; you can invest in two, and only one can go past tier 2.',
        until: (e) => e.t === 'upgrade',
      },
      {
        title: 'A second role: Frost Warden', hl: '[data-testid="shop-warden"]',
        text: () => 'Different guardians do different jobs. The Frost Warden slows enemies so your archers get more shots. Place one near the road.',
        until: (e) => e.t === 'place' && e.type === 'warden',
      },
      {
        title: 'Lives and leaks', next: true, hl: '[data-testid="lives"]',
        text: () => 'Each enemy that reaches the gate costs lives (bigger enemies cost more). If your lives reach zero, the run ends.',
      },
      {
        title: 'Speed and auto-start', next: true, hl: '[data-testid="speed"]', allowStart: true,
        text: () => 'Use the speed button (or Tab) for 2× and 3× speed — the battle plays out identically, just faster. Auto-start begins the next wave after a short, cancellable countdown.',
      },
      {
        title: "You're ready!", next: true, allowStart: true,
        text: () => 'Survive all 40 waves of Meadow Bend to earn your first medal. New mechanics get a short tip before they appear. Good luck!',
      },
    ];
    this.el = h('div', { class: 'tut', role: 'dialog', 'aria-label': 'Tutorial' });
    host.field.appendChild(this.el);
    this.show();
  }

  get done() {
    return this.idx >= this.steps.length;
  }

  private show() {
    const host = this.host;
    host.clearPointer();
    if (this.done) {
      this.destroy();
      host.finish(false);
      return;
    }
    const st = this.steps[this.idx];
    this.el.className = 'tut' + (st.top ? ' top' : '');
    this.el.innerHTML = '';
    this.el.append(
      h('h4', null, icon('help'), `${st.title}`, h('span', { class: 'small muted', style: 'margin-left:auto;font-weight:500' }, `${this.idx + 1}/${this.steps.length}`)),
      h('p', null, st.text(host)),
      h('div', { class: 'row' },
        btn('Skip tutorial', () => this.skip(), 'btn btn-small', { 'data-testid': 'tut-skip' }),
        st.next ? btn(this.idx === this.steps.length - 1 ? 'Finish' : 'Next', () => this.advance(), 'btn btn-small btn-gold', { 'data-testid': 'tut-next' }) : null,
      ),
    );
    host.highlight(st.hl ?? null);
    for (const p of st.at ?? []) host.pointWorld(p.x, p.y, p.label);
    host.setStartAllowed(st.allowStart ?? this.idx > 3);
  }

  advance() {
    this.idx++;
    this.show();
  }

  /** Feed sim events and UI events. */
  onEvent(e: SimEvent | { t: 'ui'; what: string; type?: string }) {
    if (this.done) return;
    const st = this.steps[this.idx];
    if (st.until && st.until(e)) {
      this.advance();
    }
  }

  trackKillGold(n: number) {
    this.waveGold += n;
  }

  reposition() {
    if (this.done) return;
    const st = this.steps[this.idx];
    this.host.clearPointer();
    for (const p of st.at ?? []) this.host.pointWorld(p.x, p.y, p.label);
  }

  skip() {
    this.idx = this.steps.length;
    this.destroy();
    this.host.finish(true);
  }

  destroy() {
    this.host.highlight(null);
    this.host.clearPointer();
    this.el.remove();
  }
}
