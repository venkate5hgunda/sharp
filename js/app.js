import { boot } from './application.js';
document.addEventListener('DOMContentLoaded', () =>
  boot().catch((error) => {
    const banner = document.querySelector('#inAppBannerHost');
    banner.textContent = `Sharp could not start: ${error.message}. Reload to retry.`;
    banner.setAttribute('role', 'alert');
  })
);
