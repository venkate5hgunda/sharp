// Sharp Main Application Entrypoint
import { initTheme } from './theme.js';
import { audio } from './audio.js';
import { notifications } from './notifications.js';
import { initModalDismissal } from './modal.js';
import { SharpRouter } from './router.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Theme (Auto / Light / Dark)
  initTheme();

  // 2. Initialize Modals
  initModalDismissal();

  // 3. Audio toggle binding & Prime Audio on First Touch
  const soundToggleBtn = document.getElementById('soundToggle');
  if (soundToggleBtn) {
    updateSoundBtnState();
    soundToggleBtn.addEventListener('click', () => {
      const isEnabled = audio.toggle();
      updateSoundBtnState();
      if (isEnabled) audio.chime();
    });
  }

  function updateSoundBtnState() {
    if (!soundToggleBtn) return;
    soundToggleBtn.setAttribute('aria-label', audio.enabled ? 'Mute sound' : 'Unmute sound');
    soundToggleBtn.setAttribute('title', audio.enabled ? 'Mute sound' : 'Unmute sound');
    soundToggleBtn.style.opacity = audio.enabled ? '1' : '0.45';
  }

  // Prime Web Audio lazily on any first gesture
  const unlockAudio = () => {
    audio.prepare();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  window.addEventListener('keydown', unlockAudio, { passive: true });

  // 4. Initialize Router
  const container = document.getElementById('appContainer');
  const router = new SharpRouter(container);
  router.init();

  // 5. Register PWA Service Worker
  if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    navigator.serviceWorker.register('./sw.js', { scope: './' })
      .then((reg) => {
        // Check for updates
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (installing) {
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New update ready.');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.warn('[PWA] Service worker registration failed:', err);
      });
  }

  // 6. Check pending daily reminders & notifications
  renderPendingPrompts();

  // Listen for newly emitted in-app notices
  notifications.onInAppNotice(({ title, body, url }) => {
    showInAppToast(title, body, url);
  });
});

function renderPendingPrompts() {
  const host = document.getElementById('inAppBannerHost');
  if (!host) return;

  const prompts = notifications.checkPendingPrompts();
  if (!prompts.length) {
    host.innerHTML = '';
    return;
  }

  const p = prompts[0];
  host.innerHTML = `
    <div class="in-app-prompt-banner">
      <div class="prompt-text">
        <strong>${p.title}</strong>
        <span>${p.body}</span>
      </div>
      <div class="prompt-actions">
        <a href="${p.actionHash}" class="btn btn-sm btn-primary prompt-cta">${p.actionText}</a>
        <button class="btn btn-sm btn-outline prompt-dismiss" type="button" aria-label="Dismiss">&times;</button>
      </div>
    </div>
  `;

  host.querySelector('.prompt-dismiss')?.addEventListener('click', () => {
    audio.pop();
    host.innerHTML = '';
  });

  host.querySelector('.prompt-cta')?.addEventListener('click', () => {
    audio.tap();
    host.innerHTML = '';
  });
}

function showInAppToast(title, body, url) {
  const toast = document.createElement('div');
  toast.className = 'in-app-toast';
  toast.innerHTML = `
    <div class="toast-body">
      <strong>${title}</strong>
      <span>${body}</span>
    </div>
  `;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('is-fadeout');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}
