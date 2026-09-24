const TEXT_TYPES = new Set(['', 'text', 'password', 'email', 'search', 'tel', 'url', 'number']);

function isTextField(el) {
  if (el instanceof HTMLTextAreaElement) return true;
  if (!(el instanceof HTMLInputElement)) return false;
  return TEXT_TYPES.has((el.getAttribute('type') || '').toLowerCase());
}

function guardField(el) {
  if (!isTextField(el) || el.dataset.autofillLock === '1') return;
  el.dataset.autofillLock = '1';
  el.setAttribute('autocomplete', 'off');
  el.setAttribute('autocapitalize', 'off');
  el.setAttribute('autocorrect', 'off');
  const form = el.closest('form');
  if (form) form.setAttribute('autocomplete', 'off');
  if (el.readOnly || el.disabled) return;
  el.readOnly = true;
  const unlock = () => {
    el.readOnly = false;
  };
  el.addEventListener('pointerdown', unlock, { once: true });
  el.addEventListener('keydown', unlock, { once: true });
}

function scan(root) {
  if (!root?.querySelectorAll) return;
  if (root.matches?.('input, textarea')) guardField(root);
  root.querySelectorAll('input, textarea').forEach(guardField);
  if (root.matches?.('form')) root.setAttribute('autocomplete', 'off');
  root.querySelectorAll('form').forEach((form) => form.setAttribute('autocomplete', 'off'));
}

/** Stop the browser from offering previously typed values in any field. */
export function installAutofillGuard() {
  scan(document);
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) scan(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
