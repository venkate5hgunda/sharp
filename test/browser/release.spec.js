import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
async function checkAccessibility(page) {
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
}
async function completeRound(page, game) {
  await page.getByRole('button', { name: 'Begin exercise', exact: true }).click();
  const count = game === 'pattern-flash' ? 2 : game === 'corsi-span' ? 5 : game === 'math-arithmetic' ? 8 : game === 'logic-deduction' ? 4 : game === 'story-math' ? 5 : 3;
  for (let i = 0; i < count; i++) {
    if (game === 'pattern-flash') {
      await page.getByRole('button', { name: 'I am ready to recall', exact: true }).click();
      await page.getByRole('button', { name: 'Cell 1', exact: true }).click();
      await page.getByRole('button', { name: 'Submit response', exact: true }).click();
    } else if (game === 'corsi-span') {
      await page.getByRole('button', { name: 'Show first block', exact: true }).click();
      while (await page.getByRole('button', { name: 'Show next block', exact: true }).count()) await page.getByRole('button', { name: 'Show next block', exact: true }).click();
      await page.getByRole('button', { name: 'I am ready to recall', exact: true }).click();
      const length = Number((await page.locator('#visualStatus').innerText()).match(/Repeat (\d+)/)[1]);
      for (let j = 0; j < length; j++) await page.getByRole('button', { name: 'Block A', exact: true }).click();
      await page.getByRole('button', { name: 'Submit response', exact: true }).click();
    } else {
      if (game === 'comprehension-inference') await page.getByRole('button', { name: 'Ready for the question', exact: true }).click();
      await page.locator('[data-val]').first().click();
    }
    await page.getByRole('button', { name: i === count - 1 ? 'View results' : 'Next question', exact: true }).click();
  }
}
for (const game of ['pattern-flash', 'corsi-span', 'story-math', 'comprehension-inference']) {
  test(`${game}: accessible practice completes through shared lifecycle`, async ({ page }) => {
    await page.goto(`/#/games/${game}`); await page.getByLabel('Untimed practice · unrated', { exact: true }).check();
    await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Quick guide' })).toBeVisible(); await checkAccessibility(page);
    await completeRound(page, game); await expect(page.getByRole('heading', { name: 'Session complete', exact: true })).toBeVisible();
    await checkAccessibility(page); await page.getByRole('button', { name: 'View progress', exact: true }).click();
    await expect(page.getByText('No scored results yet')).toBeVisible(); await checkAccessibility(page);
  });
}
test('complete circuit commits one qualifying workout and survives reload', async ({ page }) => {
  await page.goto('/#/today'); await page.getByRole('button', { name: 'Start workout', exact: true }).click();
  // Exercise real timed memory exposure, followed by all three quiz rounds.
  await page.getByRole('button', { name: 'Begin exercise', exact: true }).click();
  for (let i = 0; i < 2; i++) {
    await page.getByRole('button', { name: 'Cell 1', exact: true }).click();
    await page.getByRole('button', { name: 'Submit response', exact: true }).click();
    await page.getByRole('button', { name: i ? 'View results' : 'Next question', exact: true }).click();
  }
  for (const game of ['math-arithmetic', 'logic-deduction', 'comprehension-inference']) {
    await page.getByRole('button', { name: 'Next exercise', exact: true }).click(); await completeRound(page, game);
  }
  await expect(page.getByRole('heading', { name: 'Session complete', exact: true })).toBeVisible(); await page.reload();
  await page.getByRole('button', { name: 'View progress', exact: true }).click();
  await expect(page.getByText(/1\/1 workouts · 1 day streak/)).toBeVisible(); await checkAccessibility(page);
});
test('delayed memory preserves committed study, gates readiness and completes fast-track recognition', async ({ page }) => {
  await page.clock.install(); await page.goto('/#/games/delayed-memory'); await page.getByRole('button', { name: 'Study a new set' }).click();
  const words = await page.locator('.study-items strong').allTextContents(); expect(words.length).toBeGreaterThan(0);
  await page.getByLabel('3-minute practice', { exact: false }).check(); await page.getByRole('button', { name: 'Save study set' }).click();
  await expect(page.getByRole('heading', { name: 'Study set saved' })).toBeVisible();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Study set saved' })).toBeVisible(); await checkAccessibility(page);
  await page.clock.fastForward(181000); await page.getByRole('button', { name: 'Check readiness' }).click();
  await page.getByRole('button', { name: 'Start recall' }).click(); await page.getByRole('button', { name: 'Begin exercise' }).click();
  await expect(page.locator('#sessionStage')).toContainText(/Question 1 of \d+/);
  const count = Number((await page.locator('#sessionStage').innerText()).match(/Question 1 of (\d+)/)[1]);
  for (let i = 0; i < count; i++) {
    await page.locator('[data-val]').first().click();
    await page.getByRole('button', { name: i === count - 1 ? 'View results' : 'Next question', exact: true }).click();
  }
  await expect(page.getByRole('heading', { name: 'Session complete', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'View progress', exact: true }).click(); await expect(page.getByText(/recognition · .* hours actual delay · fast-track · unrated/)).toBeVisible();
});
test('diagnostics evaluation renders validated and fallback fixtures without optional runtime or external requests', async ({ page }) => {
  const forbidden = []; page.on('request', (r) => { if (!r.url().startsWith('http://127.0.0.1:8080') || r.url().includes('/optional-runtime/')) forbidden.push(r.url()); });
  await page.goto('/#/diagnostics'); await expect(page.getByRole('button', { name: 'Enable metadata sharing', exact: true })).toBeDisabled(); await checkAccessibility(page);
  await page.getByRole('button', { name: 'Run browser evaluation' }).click(); await expect(page.locator('#evaluationStatus')).toContainText('12 accepted stub outputs');
  await page.getByLabel('Scenario', { exact: true }).selectOption('wrong_answer'); await page.getByRole('button', { name: 'Run browser evaluation' }).click();
  await expect(page.locator('#evaluationStatus')).toContainText('0 accepted stub outputs · 12 fallbacks');
  await page.getByRole('button', { name: 'Preview export', exact: true }).click(); await expect(page.locator('#diagnosticPreview')).toContainText('validation_failed');
  await page.goto('/#/model'); await expect(page.getByRole('heading', { name: /model/i }).first()).toBeVisible(); await checkAccessibility(page);
  await expect(page.locator('#prepareModel')).toBeDisabled(); expect(forbidden).toEqual([]);
});
test('installed shell reloads offline into an unvisited exercise', async ({ page, context }) => {
  await page.goto('/#/today'); await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload(); await expect(page.locator('main h1')).toHaveText('Today');
  await context.setOffline(true); await page.goto('/#/games/story-math'); await page.reload();
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click(); await page.getByRole('button', { name: 'Begin exercise', exact: true }).click();
  await page.locator('[data-val]').first().click(); await expect(page.getByRole('button', { name: 'Next question', exact: true })).toBeVisible();
  await context.setOffline(false);
});
test('held Enter cannot skip feedback or answer the following question', async ({ page }) => {
  await page.goto('/#/games/math-arithmetic'); await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Begin exercise', exact: true }).click();
  await expect(page.locator('[data-val]').first()).toBeFocused();
  await page.keyboard.down('Enter'); await expect(page.getByRole('button', { name: 'Next question', exact: true })).toBeVisible();
  await page.keyboard.down('Enter'); await expect(page.getByRole('button', { name: 'Next question', exact: true })).toBeVisible();
  await page.keyboard.up('Enter'); await page.keyboard.down('Enter'); await expect(page.getByText(/Question 2 of 8/)).toBeVisible();
  await page.keyboard.down('Enter'); await expect(page.getByRole('button', { name: 'Next question', exact: true })).toHaveCount(0); await page.keyboard.up('Enter');
});
test('cross-tab ownership requires takeover and rejects the stale owner', async ({ page, context }) => {
  await page.goto('/#/games/logic-deduction'); await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await page.getByRole('button', { name: 'Begin exercise', exact: true }).click(); const url = page.url();
  const other = await context.newPage(); await other.goto(url);
  await expect(other.getByRole('heading', { name: 'Session paused' })).toBeVisible();
  await other.getByRole('button', { name: 'Take over from another tab', exact: true }).click();
  await other.locator('[data-val]').first().click(); await expect(other.getByRole('button', { name: 'Next question', exact: true })).toBeVisible();
  await page.bringToFront(); await page.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session paused' })).toBeVisible();
  await page.getByRole('button', { name: 'Resume session', exact: true }).click(); await expect(page.locator('#sessionError')).toContainText('Another tab');
  await other.close();
});
