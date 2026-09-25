/* CIRCUIT SIEGE — shared UI helpers: modals, toasts, confirm */
(function () {
  'use strict';
  const CS = window.CS;
  const U = CS.U;
  const UI = {};

  UI.$ = (sel, root) => (root || document).querySelector(sel);
  UI.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  // Modal stack
  UI.modals = [];
  UI.modal = function (html, opts) {
    opts = opts || {};
    const back = U.el('div', 'modal-back');
    const m = U.el('div', 'modal' + (opts.cls ? ' ' + opts.cls : ''));
    if (opts.width) m.style.width = 'min(' + opts.width + 'px, 100%)';
    m.innerHTML = html;
    back.appendChild(m);
    if (opts.dismiss !== false) back.addEventListener('pointerdown', (e) => { if (e.target === back) UI.closeModal(back); });
    document.getElementById('modal-root').appendChild(back);
    UI.modals.push(back);
    back._onClose = opts.onClose;
    UI.wireSounds(m);
    return m;
  };
  UI.closeModal = function (back) {
    if (!back) back = UI.modals[UI.modals.length - 1];
    if (!back) return;
    if (back.classList && back.classList.contains('modal')) back = back.parentElement;
    const i = UI.modals.indexOf(back);
    if (i >= 0) UI.modals.splice(i, 1);
    back.remove();
    if (back._onClose) back._onClose();
  };
  UI.closeAllModals = function () { while (UI.modals.length) UI.closeModal(); };
  UI.hasModal = () => UI.modals.length > 0;

  UI.confirm = function (title, text, okLabel, onOk, danger) {
    const m = UI.modal(`<h2>${U.esc(title)}</h2><div class="sub">${text}</div><div class="modal-actions"><button class="btn ghost" data-a="no">Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-a="ok">${U.esc(okLabel || 'OK')}</button></div>`, { width: 460 });
    m.querySelector('[data-a=no]').onclick = () => UI.closeModal(m);
    m.querySelector('[data-a=ok]').onclick = () => { UI.closeModal(m); onOk(); };
  };

  UI.toast = function (head, text, kind, life) {
    const root = document.getElementById('toast-root');
    const t = U.el('div', 'toast ' + (kind || ''));
    t.style.setProperty('--life', (life || 3.2) + 's');
    t.innerHTML = `<div class="t-h">${U.esc(head)}</div><div>${text}</div>`;
    root.appendChild(t);
    while (root.children.length > 5) root.firstChild.remove();
    setTimeout(() => t.remove(), ((life || 3.2) + 0.5) * 1000);
  };

  // Hover/click sounds on buttons
  UI.wireSounds = function (root) {
    root.addEventListener('pointerover', (e) => {
      const b = e.target.closest && e.target.closest('button, .mbtn, .map-card, .tcard, .rnode, .codex-item, .shop-item');
      if (b && b !== UI._lastHover) { UI._lastHover = b; CS.sfx && CS.sfx('hover'); }
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest && e.target.closest('button');
      if (b && !b.disabled) CS.sfx && CS.sfx('click');
    });
  };

  UI.stars = function (n) {
    let s = '';
    for (let i = 0; i < 5; i++) s += i < n ? '★' : '<span class="off">★</span>';
    return '<span class="stars">' + s + '</span>';
  };

  // Animated number counter
  UI.counter = function (el) {
    let shown = 0, target = 0, raf = 0;
    return {
      set(v, instant) {
        target = v;
        if (instant) { shown = v; el.textContent = U.fmt(v); return; }
        if (!raf) {
          const tick = () => {
            const d = target - shown;
            if (Math.abs(d) < 1) { shown = target; el.textContent = U.fmt(shown); raf = 0; return; }
            shown += d * 0.25;
            el.textContent = U.fmt(Math.round(shown));
            raf = requestAnimationFrame(tick);
          };
          raf = requestAnimationFrame(tick);
        }
      },
    };
  };

  CS.UI = UI;
})();
