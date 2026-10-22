import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function start(page, game = 'math-arithmetic') {
  await page.goto(`/#/games/${game}`); await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
}
test('quiz feedback survives reload, completion appears once, and flag-off boot has no external requests', async ({ page, baseURL }) => {
  const external = []; page.on('request', (r) => { if (!r.url().startsWith(baseURL) && !r.url().startsWith('data:')) external.push(r.url()); });
  await start(page); await page.locator('[data-val]').first().click(); await expect(page.getByRole('button', { name: 'Next question', exact: true })).toBeVisible();
  const feedback = await page.locator('#sessionStage').innerText(); await page.reload();
  await expect(page.locator('#sessionStage')).toHaveText(feedback, { useInnerText: true });
  await page.getByRole('button', { name: 'Next question', exact: true }).click();
  for (let i = 1; i < 8; i++) { await page.locator('[data-val]').first().click(); await page.getByRole('button', { name: i === 7 ? 'View results' : 'Next question', exact: true }).click(); }
  await expect(page.getByRole('heading', { name: 'Session complete', exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Session complete', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View progress', exact: true }).click(); await expect(page.getByRole('heading', { name: /of 8 correct/ })).toBeVisible();
  expect(external).toEqual([]);
});
test('workout checkpoint and timed exposure recover without fabricated attempts', async ({ page }) => {
  await page.goto('/#/today'); await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  await page.getByRole('button', { name: 'Begin exercise', exact: true }).click(); await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session paused' })).toBeVisible();
  await page.getByRole('link', { name: 'Save & exit' }).click(); await page.getByRole('link', { name: /Resume workout/ }).click();
  await expect(page.getByRole('heading', { name: 'Quick guide' })).toBeVisible();
  await page.getByRole('link', { name: 'Save & exit' }).click();
  await page.getByRole('link', { name: 'Progress', exact: true }).click(); await expect(page.getByRole('heading', { name: 'No scored results yet', exact: true })).toBeVisible();
});
test('accessible primary routes, native confirmation and narrow-screen reflow', async ({ page }) => {
  for (const route of ['today', 'exercises', 'progress', 'backup', 'settings']) {
    await page.goto(`/#/${route}`); await expect(page.locator('main h1')).toBeVisible();
    const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.locator('.skip-link').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('main')).toBeFocused();
  await expect(page).toHaveURL(/#\/settings$/);
  await page.getByText('Advanced', { exact: true }).click();
  await page.getByRole('button', { name: 'Reset this browser' }).click(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toBeHidden(); await expect(page.getByRole('button', { name: 'Reset this browser' })).toBeFocused();
});
test('backup download and atomic preview/restore preserve an active answer', async ({ page }) => {
  await start(page, 'logic-deduction'); await page.locator('[data-val]').first().click();
  await page.getByRole('link', { name: 'Save & exit' }).click();
  await page.getByRole('link', { name: 'Backup', exact: true }).click();
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Download backup' }).click(); const file = await downloaded;
  await page.getByLabel('Choose a backup', { exact: false }).setInputFiles(await file.path());
  await expect(page.getByRole('heading', { name: 'Backup preview' })).toBeVisible(); await page.getByRole('button', { name: 'Merge backup', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Merge', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Restored.' })).toBeVisible();
  await page.getByRole('link', { name: 'Today', exact: true }).click(); await page.getByRole('link', { name: /Resume Logic/ }).click();
  await expect(page.getByRole('button', { name: 'Next question', exact: true })).toBeVisible();
});
