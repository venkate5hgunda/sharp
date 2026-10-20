// Native dialog supplies inert background, focus containment and Escape handling.
export function confirmAction({ title, message, confirm = 'Continue', danger = false }) {
  return new Promise((resolve) => {
    const opener = document.activeElement, dialog = document.createElement('dialog');
    dialog.className = 'sharp-dialog';
    const heading = document.createElement('h2'); heading.id = 'dialog-title'; heading.textContent = title;
    const text = document.createElement('p'); text.textContent = message;
    const actions = document.createElement('div'); actions.className = 'summary-actions';
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn btn-outline'; cancel.textContent = 'Cancel';
    const accept = document.createElement('button'); accept.type = 'button'; accept.className = `btn ${danger ? 'btn-danger' : 'btn-primary'}`; accept.textContent = confirm;
    dialog.setAttribute('aria-labelledby', heading.id); actions.append(cancel, accept); dialog.append(heading, text, actions);
    document.body.append(dialog);
    let done = false;
    const routeAway = () => finish(false);
    const finish = (value) => { if (done) return; done = true; window.removeEventListener('hashchange', routeAway); dialog.close(); dialog.remove(); if (opener?.isConnected) opener.focus(); resolve(value); };
    window.addEventListener('hashchange', routeAway, { once: true });
    cancel.addEventListener('click', () => finish(false)); accept.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });
    dialog.showModal(); cancel.focus();
  });
}
