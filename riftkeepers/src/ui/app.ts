import { audio } from '../audio/audio';
import { SaveStore } from '../save/save';
import { btn, h, icon } from './dom';

export type ScreenName = 'title' | 'play' | 'guardians' | 'collection' | 'achievements' | 'settings' | 'help' | 'game';

export interface Screen {
  el: HTMLElement;
  destroy?(): void;
  /** Return true if the screen handled back itself (e.g. closing a sub-view). */
  onBack?(): boolean;
  onKey?(e: KeyboardEvent): boolean;
}

export type ScreenFactory = (app: App, params: any) => Screen;

export class App {
  root: HTMLElement;
  store: SaveStore;
  private factories = new Map<ScreenName, ScreenFactory>();
  private stack: { name: ScreenName; params: any }[] = [];
  current: Screen | null = null;
  currentName: ScreenName | null = null;
  private modals: { el: HTMLElement; onClose?: () => void; dismissable: boolean }[] = [];
  private toastWrap: HTMLElement;

  constructor(root: HTMLElement) {
    this.root = root;
    this.store = new SaveStore();
    this.toastWrap = h('div', { class: 'toast-wrap', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(this.toastWrap);
    this.applyAudioSettings();
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('keydown', (e) => this.onKey(e));
    // hardware/browser back → in-app back; keep a history entry so we stay in the app.
    // History access can throw inside sandboxed iframes, so it is optional.
    const push = () => {
      try {
        history.pushState({ rk: 1 }, '');
        return true;
      } catch {
        return false;
      }
    };
    try {
      history.replaceState({ rk: 0 }, '');
    } catch { /* sandboxed */ }
    if (push()) {
      window.addEventListener('popstate', () => {
        push();
        this.back();
      });
    }
  }

  get save() {
    return this.store.data;
  }

  persist() {
    this.store.save();
  }

  applyAudioSettings() {
    const s = this.save.settings;
    audio.setVolumes(s.music, s.sfx, s.muted);
  }

  register(name: ScreenName, f: ScreenFactory) {
    this.factories.set(name, f);
  }

  go(name: ScreenName, params: any = {}, opts: { replace?: boolean; reset?: boolean } = {}) {
    if (opts.reset) this.stack = [];
    else if (opts.replace) this.stack.pop();
    this.stack.push({ name, params });
    this.mount(name, params);
  }

  private mount(name: ScreenName, params: any) {
    this.closeAllModals();
    if (this.current?.destroy) this.current.destroy();
    this.root.innerHTML = '';
    const f = this.factories.get(name)!;
    this.current = f(this, params);
    this.currentName = name;
    this.root.appendChild(this.current.el);
    const focusable = this.current.el.querySelector<HTMLElement>('[data-autofocus]');
    focusable?.focus({ preventScroll: true });
  }

  back() {
    if (this.modals.length) {
      const top = this.modals[this.modals.length - 1];
      if (top.dismissable) this.closeModal(top.el);
      return;
    }
    if (this.current?.onBack?.()) return;
    if (this.stack.length > 1) {
      this.stack.pop();
      const prev = this.stack[this.stack.length - 1];
      audio.play('click');
      this.mount(prev.name, prev.params);
    }
  }

  private onKey(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
    if (typing && e.key !== 'Escape') return;
    if (this.modals.length) {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.back();
      }
      return;
    }
    if (this.current?.onKey?.(e)) return;
    if (e.key === 'Escape' || (e.key === 'Backspace' && !typing)) {
      e.preventDefault();
      this.back();
    }
  }

  // ---------------------------------------------------------- modals & toasts
  get modalOpen() {
    return this.modals.length > 0;
  }

  modal(content: (close: () => void) => HTMLElement, opts: { dismissable?: boolean; onClose?: () => void; wide?: boolean } = {}) {
    const dismissable = opts.dismissable !== false;
    const back = h('div', { class: 'modal-back' });
    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      this.closeModal(back);
    };
    const card = content(close);
    card.classList.add('modal', 'card');
    if (opts.wide) card.style.width = 'min(760px, 100%)';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    back.appendChild(card);
    back.addEventListener('pointerdown', (e) => {
      if (e.target === back && dismissable) close();
    });
    document.body.appendChild(back);
    this.modals.push({ el: back, onClose: opts.onClose, dismissable });
    (card.querySelector('[data-autofocus]') as HTMLElement | null)?.focus({ preventScroll: true });
    return close;
  }

  closeModal(el: HTMLElement) {
    const i = this.modals.findIndex((m) => m.el === el);
    if (i < 0) return;
    const [m] = this.modals.splice(i, 1);
    m.el.remove();
    m.onClose?.();
  }

  closeAllModals() {
    while (this.modals.length) {
      const m = this.modals.pop()!;
      m.el.remove();
    }
  }

  confirm(title: string, text: string, okLabel = 'Confirm', danger = false): Promise<boolean> {
    return new Promise((resolve) => {
      let result = false;
      this.modal(
        (close) =>
          h('div', null,
            h('h2', null, title),
            h('p', null, text),
            h('div', { class: 'actions' },
              btn('Cancel', () => { result = false; close(); }, 'btn', { 'data-autofocus': true }),
              btn(okLabel, () => { result = true; close(); }, danger ? 'btn btn-red' : 'btn btn-gold'),
            ),
          ),
        { onClose: () => resolve(result) },
      );
    });
  }

  toast(text: string, kind: '' | 'gold' | 'bad' = '', ms = 2600) {
    const t = h('div', { class: `toast ${kind}` }, text);
    this.toastWrap.appendChild(t);
    while (this.toastWrap.children.length > 4) this.toastWrap.firstElementChild?.remove();
    window.setTimeout(() => t.remove(), ms);
  }
}

/** Standard top bar with back button and shard counter. */
export function topbar(app: App, title: string, extra: HTMLElement[] = []): HTMLElement {
  return h('div', { class: 'topbar' },
    btn([icon('back')], () => app.back(), 'btn btn-dark btn-icon', { 'aria-label': 'Back', title: 'Back (Esc)' }),
    h('h1', null, title),
    ...extra,
    h('span', { class: 'shard-pill', title: 'Rift Shards' }, icon('shard'), String(app.save.shards)),
  );
}
