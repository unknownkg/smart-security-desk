function createToastQueue(region, doc, clock = globalThis) {
  const pending = [];
  const allowed = ['success', 'error', 'warning', 'info'];
  let active = null;
  let timer = null;

  function next() {
    if (active || !pending.length) return;
    active = pending.shift();
    const current = active;
    const item = doc.createElement('div');
    item.className = 'toast toast-' + current.kind;
    if (current.kind === 'error') item.setAttribute('role', 'alert');
    const message = doc.createElement('span');
    message.textContent = current.message;
    const close = doc.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Закрыть уведомление');
    const dismiss = () => {
      if (active !== current) return;
      clock.clearTimeout(timer);
      active = null;
      region.replaceChildren();
      next();
    };
    close.addEventListener('click', dismiss);
    item.append(message, close);
    region.replaceChildren(item);
    timer = clock.setTimeout(dismiss, 6000);
  }

  return {show(message, kind = 'info') {
    pending.push({message: String(message), kind: allowed.includes(kind) ? kind : 'info'});
    next();
  }};
}

if (typeof module !== 'undefined' && module.exports) module.exports = {createToastQueue};
if (typeof document !== 'undefined') {
  window.notifications = createToastQueue(document.getElementById('toast-region'), document);
}
