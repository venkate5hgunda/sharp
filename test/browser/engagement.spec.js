import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('Pip opens, rotates encouragement, closes with Escape and stays usable on a narrow screen', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await page.goto('/#/today');
  await page.getByRole('button', { name: 'Talk to Pip, your practice coach' }).click();
  await expect(page.locator('#pipPanel')).toBeVisible();
  const before = await page.locator('#pipQuote').textContent();
  await page.getByRole('button', { name: 'A little encouragement' }).click();
  await expect(page.locator('#pipQuote')).not.toHaveText(before);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();
  expect(result.violations.map(v => v.id)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.locator('#pipPanel')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Talk to Pip, your practice coach' })).toBeFocused();
});
for (const permission of ['denied', 'granted']) test(`notification permission ${permission} is requested only after explicit opt-in`, async ({ page }) => {
  await page.addInitScript((result) => {
    window.permissionRequests = 0;
    Object.defineProperty(window, 'Notification', { configurable: true, value: class {
      static permission = 'default';
      static async requestPermission() { window.permissionRequests++; this.permission = result; return result; }
    } });
    // Model API support explicitly, independent of the emulated browser's native API inventory.
    if (!('serviceWorker' in navigator)) Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { register: async () => { throw new Error('Test worker registration unavailable'); } } });
  }, permission);
  await page.goto('/#/settings');
  const supported=await page.evaluate(()=>isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window);
  const { PUSH_CONFIG }=await import('../../js/push.js');
  expect(await page.getByRole('button', { name: 'Enable background push' }).isEnabled()).toBe(Boolean(supported&&PUSH_CONFIG.subscriptionEndpoint&&PUSH_CONFIG.applicationServerKey));
  expect(await page.evaluate(() => window.permissionRequests)).toBe(0);
  await page.getByRole('button', { name: 'Enable playful browser alerts' }).click();
  await expect(page.locator('#alertStatus')).toHaveText(permission === 'denied'
    ? 'Alerts are not enabled. You can change this in browser settings.'
    : 'Browser alerts enabled. Sharp must be open for scheduled checks.');
  expect(await page.evaluate(() => window.permissionRequests)).toBe(1);
  const preferences = await page.evaluate(async () => { const { initRepository } = await import('/js/persistence/repository.js'); return (await initRepository()).snapshot().preferences; });
  expect(preferences.browserAlerts === true).toBe(permission === 'granted');
});
test('unsupported notifications offer calendar reminders without requesting permission', async ({ page }) => {
  await page.addInitScript(() => { Reflect.deleteProperty(window, 'Notification'); });
  await page.goto('/#/settings');
  expect(await page.evaluate(() => 'Notification' in window)).toBe(false);
  await page.getByRole('button', { name: 'Enable playful browser alerts' }).click();
  await expect(page.locator('#alertStatus')).toHaveText('Browser alerts are unavailable. Try calendar reminders.');
  await expect(page.getByRole('button', { name: 'Download calendar reminders' })).toBeEnabled();
});
test('reduced motion disables decorative animation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto('/#/today'); await expect(page.locator('.planet')).toBeVisible();
  expect(await page.locator('.planet').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
  expect(await page.locator('.pip-body').evaluate(el => getComputedStyle(el).animationName)).toBe('none');
});

test('automatic coach context events respect the cooldown while manual requests still rotate', async ({ page }) => {
  await page.goto('/#/today');
  await page.getByRole('button', { name: 'Talk to Pip, your practice coach' }).click();
  const initial = await page.locator('#pipQuote').textContent();
  await page.evaluate(() => { for (let i = 0; i < 10; i++) window.dispatchEvent(new Event('sharp:coach-context')); });
  await expect(page.locator('#pipQuote')).toHaveText(initial);
  await page.getByRole('button', { name: 'A little encouragement' }).click();
  await expect(page.locator('#pipQuote')).not.toHaveText(initial);
});
