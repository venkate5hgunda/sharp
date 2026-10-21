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
test('reminders describe service availability and never request permission at startup', async ({ page }) => {
  await page.addInitScript(() => { window.permissionRequests = 0; if ('Notification' in window) Notification.requestPermission = async () => { window.permissionRequests++; return 'denied'; }; });
  await page.goto('/#/settings'); await expect(page.getByRole('button', { name: 'Enable background push' })).toBeDisabled();
  expect(await page.evaluate(() => window.permissionRequests)).toBe(0);
  await page.getByRole('button', { name: 'Enable playful browser alerts' }).click();
  await expect(page.locator('#alertStatus')).toContainText('not enabled');
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
