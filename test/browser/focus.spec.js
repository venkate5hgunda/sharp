import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function fitsViewport(page, selector) {
  const bounds = await page.locator(selector).evaluateAll((elements) => elements.map((el) => {
    const r = el.getBoundingClientRect();
    return { fits: r.top >= -1 && r.left >= -1 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1, width: r.width, height: r.height };
  }));
  expect(bounds.length).toBeGreaterThan(0);
  expect(bounds.every((r) => r.fits && r.width > 0 && r.height > 0), `${selector}: ${JSON.stringify(bounds)}`).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 700 }, { width: 844, height: 390 }]) {
  test(`questions, memory boards and feedback fit ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    for (const game of ['math-arithmetic', 'logic-deduction', 'story-math', 'comprehension-inference', 'pattern-flash', 'corsi-span']) {
      await page.goto(`/#/games/${game}`);
      await page.getByLabel('Practice without scoring', { exact: true }).check();
      await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
      await expect(page.locator('#sessionStage')).toBeVisible();
      await expect(page.locator('.app-header')).toBeHidden();
      await expect(page.locator('.pip-coach')).toBeHidden();
      await fitsViewport(page, '#sessionStage');
      if (game === 'pattern-flash' || game === 'corsi-span') {
        await fitsViewport(page, '.pattern-grid');
        if (game === 'corsi-span') {
          await page.getByRole('button', { name: 'Show first block', exact: true }).click();
          while (await page.getByRole('button', { name: 'Show next block', exact: true }).count()) await page.getByRole('button', { name: 'Show next block', exact: true }).click();
        }
        await page.getByRole('button', { name: 'I am ready to recall', exact: true }).click();
        await fitsViewport(page, '#submitVisual');
        await expect(page.locator('#submitVisual')).toBeDisabled();
        const length = game === 'pattern-flash' ? 1 : Number((await page.locator('#visualStatus').innerText()).match(/Repeat (\d+)/)[1]);
        for (let i = 0; i < length; i++) await page.locator('[data-cell]').first().click();
        await expect(page.locator('#submitVisual')).toBeEnabled();
        await page.locator('#submitVisual').click();
      } else {
        if (game === 'comprehension-inference') {
          await fitsViewport(page, '#readingDone');
          await page.getByRole('button', { name: 'Ready for the question', exact: true }).click();
          await expect(page.locator('#readingPhase')).toBeHidden();
          await expect(page.locator('.passage-review')).toHaveAttribute('open', '');
          await expect(page.locator('.passage-review p')).toBeVisible();
        }
        await fitsViewport(page, '.logic-options-grid');
        for (const answer of await page.locator('[data-val]').all()) {
          await answer.scrollIntoViewIfNeeded();
          await fitsViewport(page, `button[data-val="${await answer.getAttribute('data-val')}"]`);
        }
        await page.locator('[data-val]').first().click();
      }
      await expect(page.locator('#nextQuestion')).toBeFocused();
      await fitsViewport(page, '#nextQuestion');
      await page.keyboard.press('Enter');
      await expect(page.locator('#nextQuestion')).toHaveCount(0);
      await fitsViewport(page, '#sessionStage');
      expect(await page.evaluate(() => scrollY)).toBe(0);
    }
  });
}

test('exercise filters, theme selection and reading review work without extra start steps', async ({ page }) => {
  await page.goto('/#/exercises');
  await page.getByRole('button', { name: 'Math', exact: true }).click();
  await expect(page.locator('.exercise-card:visible')).toHaveCount(2);
  await expect(page.getByRole('button', { name: 'Math', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('link', { name: /Story Math/ }).click();
  await expect(page.locator('#skillChoice')).toBeHidden();
  await page.getByText('Choose a topic', { exact: true }).click();
  await expect(page.locator('#skillChoice')).toBeVisible();
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await expect(page.locator('[data-val]').first()).toBeFocused();
  await page.getByRole('link', { name: 'Save & exit' }).click();
  await expect(page.locator('.app-header')).toBeVisible();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await page.getByLabel('Theme', { exact: true }).selectOption('dark');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.clock.install();
  await page.goto('/#/games/comprehension-inference');
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await expect(page.locator('#readingDone')).toBeVisible();
  await page.clock.fastForward(1000);
  await page.getByRole('button', { name: 'Ready for the question', exact: true }).click();
  await expect(page.locator('.passage-review')).toHaveAttribute('open', '');
  await expect(page.locator('.passage-review p')).toBeVisible();
  await page.clock.fastForward(1000);
  await page.getByText('Passage', { exact: true }).click();
  await expect(page.locator('.passage-review p')).toBeHidden();
  await page.getByText('Passage', { exact: true }).click();
  await expect(page.locator('.passage-review p')).toBeVisible();
  await page.clock.fastForward(1000);
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(result.violations.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) }))).toEqual([]);
  await page.locator('[data-val]').first().click();
  await expect(page.locator('#nextQuestion')).toBeVisible();
  const timing = await page.evaluate(async () => {
    const { initRepository } = await import('/js/persistence/repository.js');
    const repo = await initRepository(), id = location.hash.split('/').at(-1);
    return repo.snapshot().attempts[`${id}:0:0`];
  });
  expect(timing.readingMs).toBeGreaterThanOrEqual(1000);
  expect(timing.activeMs).toBeGreaterThanOrEqual(2000);
  await page.getByRole('button', { name: 'Next question', exact: true }).click();
  await page.getByRole('button', { name: 'Ready for the question', exact: true }).click();
  await expect(page.locator('.passage-review')).toHaveAttribute('open', '');
});

for (const viewport of [{ width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`word study and the largest memory board fit ${viewport.width}×${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#/games/delayed-memory');
    await page.getByRole('button', { name: 'Study a new set', exact: true }).click();
    await fitsViewport(page, '#memoryStage');
    await fitsViewport(page, '#commitStudy');
    await expect(page.locator('.study-items strong').first()).toBeVisible();
    await page.getByRole('button', { name: 'Save study set', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Study set saved', exact: true })).toBeVisible();
    await fitsViewport(page, '#memoryStage');
    await page.goto('/#/games/pattern-flash');
    await page.getByLabel('Practice without scoring', { exact: true }).check();
    await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
    await expect(page.locator('.pattern-grid')).toBeVisible();
    // A real upper-level board, held in the study phase so resizing cannot skip it.
    await page.evaluate(async () => {
      const { initRepository } = await import('/js/persistence/repository.js');
      const repo = await initRepository(), id = location.hash.split('/').at(-1);
      await repo.update((state) => {
        const q = state.sessions[id].rounds[0].items[0];
        Object.assign(q, { gridSize: 5, size: 25, sequence: [1, 5, 11, 14, 20, 23], distractor: [0, 3, 7, 12, 16, 22] });
        return state;
      });
    });
    await page.reload();
    await page.getByRole('button', { name: 'Begin exercise', exact: true }).click();
    await expect(page.locator('[data-cell]')).toHaveCount(25);
    await fitsViewport(page, '.pattern-grid');
    await page.getByRole('button', { name: 'I am ready to recall', exact: true }).click();
    await fitsViewport(page, '.pattern-grid');
    await fitsViewport(page, '#submitVisual');
  });
}

test('a long reading question keeps its prompt visible and every answer reachable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto('/#/games/comprehension-inference');
  await page.getByRole('button', { name: 'Start exercise', exact: true }).click();
  await expect(page.locator('#readingDone')).toBeVisible();
  await page.evaluate(async () => {
    const { initRepository } = await import('/js/persistence/repository.js');
    const { BASE_CONTENT } = await import('/js/session/content.js');
    const repo = await initRepository(), id = location.hash.split('/').at(-1);
    await repo.update((state) => {
      state.sessions[id].rounds[0].items[0] = BASE_CONTENT.find((q) => q.id === 'comp_phys_001');
      return state;
    });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Ready for the question', exact: true }).click();
  await expect(page.locator('.passage-review')).toHaveAttribute('open', '');
  await expect(page.locator('.passage-review p')).toBeVisible();
  await fitsViewport(page, '#questionPrompt');
  await fitsViewport(page, '.logic-options-grid');
  const questionBounds = await page.locator('#questionPrompt').boundingBox();
  for (const answer of await page.locator('[data-val]').all()) {
    await answer.scrollIntoViewIfNeeded();
    expect(await answer.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
    await fitsViewport(page, `button[data-val="${await answer.getAttribute('data-val')}"]`);
    expect(await page.locator('#questionPrompt').boundingBox()).toEqual(questionBounds);
  }
  await page.locator('[data-val]').last().click();
  await expect(page.locator('#nextQuestion')).toBeFocused();
  await fitsViewport(page, '#nextQuestion');
});
