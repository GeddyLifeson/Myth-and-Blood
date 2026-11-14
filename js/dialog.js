/**
 * In-page dialogs: a notice, a yes/no question and a one-line text question.
 * Replaces window.alert / confirm / prompt, which a hosted or embedded page may block.
 * Each call returns a Promise; only one dialog is open at a time (a new one replaces it).
 */
const InPageDialog = (() => {
  let current = null;

  function close(result) {
    if (!current) return;
    const { root, resolve, onKey, restoreFocus } = current;
    current = null;
    document.removeEventListener('keydown', onKey, true);
    root.remove();
    try {
      restoreFocus?.focus?.();
    } catch (_) {
      /* the opener may be gone */
    }
    resolve(result);
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  /**
   * @param {{ title?: string, message: string, input?: boolean, value?: string,
   *   okLabel?: string, cancelLabel?: string|null, danger?: boolean }} opts
   * @returns {Promise<{ ok: boolean, value: string }>}
   */
  function open(opts) {
    if (typeof document === 'undefined' || !document.body) {
      return Promise.resolve({ ok: false, value: '' });
    }
    if (current) close({ ok: false, value: '' });
    return new Promise((resolve) => {
      const root = el('div', 'inpage-dialog');
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      const box = el('div', 'inpage-dialog-box');
      if (opts.title) {
        const h = el('div', 'inpage-dialog-title', opts.title);
        h.id = 'inpage-dialog-title';
        root.setAttribute('aria-labelledby', h.id);
        box.appendChild(h);
      }
      box.appendChild(el('div', 'inpage-dialog-message', opts.message));
      let input = null;
      if (opts.input) {
        input = el('input', 'inpage-dialog-input');
        input.type = 'text';
        input.maxLength = 60;
        input.value = opts.value || '';
        input.setAttribute('aria-label', opts.message);
        box.appendChild(input);
      }
      const row = el('div', 'inpage-dialog-buttons');
      const finish = (ok) => close({ ok, value: input ? input.value : '' });
      if (opts.cancelLabel !== null) {
        const cancel = el('button', 'inpage-dialog-btn', opts.cancelLabel || 'Cancel');
        cancel.type = 'button';
        cancel.dataset.dialog = 'cancel';
        cancel.addEventListener('click', () => finish(false));
        row.appendChild(cancel);
      }
      const okBtn = el(
        'button',
        `inpage-dialog-btn primary${opts.danger ? ' danger' : ''}`,
        opts.okLabel || 'OK'
      );
      okBtn.type = 'button';
      okBtn.dataset.dialog = 'ok';
      okBtn.addEventListener('click', () => finish(true));
      row.appendChild(okBtn);
      box.appendChild(row);
      root.appendChild(box);
      root.addEventListener('mousedown', (e) => {
        if (e.target === root) finish(false);
      });
      // Capture phase, and stop there: the game's own key handler must not also act.
      const onKey = (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          finish(false);
        } else if (e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          finish(true);
        } else if (e.key !== 'Tab') {
          e.stopPropagation();
        }
      };
      document.addEventListener('keydown', onKey, true);
      current = { root, resolve, onKey, restoreFocus: document.activeElement };
      document.body.appendChild(root);
      (input || okBtn).focus();
      if (input) input.select();
    });
  }

  /** A notice with one button. Resolves when it is dismissed. */
  function message(text, title) {
    return open({ title, message: text, cancelLabel: null }).then(() => undefined);
  }

  /** A yes/no question. Resolves true only when the player confirms. */
  function confirm(text, opts = {}) {
    return open({ ...opts, message: text }).then((r) => r.ok);
  }

  /** A one-line text question. Resolves the text, or null when cancelled. */
  function prompt(text, value = '', opts = {}) {
    return open({ ...opts, message: text, input: true, value }).then((r) =>
      r.ok ? r.value : null
    );
  }

  function isOpen() {
    return !!current;
  }

  return { message, confirm, prompt, isOpen };
})();

// Published for GameServices.registerFromGlobals(): a top-level `const` in a
// classic script is not a property of globalThis, so it must be exported explicitly.
globalThis.InPageDialog = InPageDialog;
