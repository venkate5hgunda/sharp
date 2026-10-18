// Accessible modal controller for Sharp
import { audio } from './audio.js';

export function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return;
  modal.removeAttribute('hidden');
  document.body.classList.add('has-modal');

  const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
  if (focusable) focusable.focus();
  audio.tap();
}

export function closeModal(modal) {
  const el = typeof modal === 'string' ? document.getElementById(modal) : modal;
  if (!el) return;
  el.setAttribute('hidden', '');
  const anyOpen = !!document.querySelector('.modal:not([hidden])');
  if (!anyOpen) {
    document.body.classList.remove('has-modal');
  }
  audio.pop();
}

export function initModalDismissal() {
  const modals = Array.from(document.querySelectorAll('.modal'));

  modals.forEach((modal) => {
    modal.addEventListener('pointerdown', (event) => {
      if (event.target === modal) closeModal(modal);
    });
    modal.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => closeModal(modal));
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const openMod = document.querySelector('.modal:not([hidden])');
    if (openMod) closeModal(openMod);
  });
}
