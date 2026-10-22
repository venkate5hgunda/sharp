import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionScope, bindChoiceShortcuts } from '../js/core/session-scope.js';

function fakeClock() {
  let sequence = 0;
  const jobs = new Map();
  return {
    jobs,
    setTimeout(callback) { jobs.set(++sequence, callback); return sequence; },
    clearTimeout(handle) { jobs.delete(handle); },
    run() { const next = [...jobs.values()]; jobs.clear(); next.forEach((callback) => callback()); }
  };
}
function key(target, value, properties = {}) {
  const event = new Event('keydown', { cancelable: true });
  Object.defineProperties(event, Object.fromEntries(Object.entries({ key: value, ...properties })
    .map(([name, field]) => [name, { value: field }])));
  target.dispatchEvent(event);
  return event;
}

test('disposing a session cancels nested timers, listeners and queued completions', () => {
  const clock = fakeClock();
  const scope = createSessionScope(clock);
  const target = new EventTarget();
  let writes = 0;
  const complete = scope.once(() => writes++);
  scope.timeout(() => { writes++; scope.timeout(() => writes++, 10); }, 10);
  scope.listen(target, 'click', () => writes++);
  const queued = [...clock.jobs.values()][0];
  scope.dispose();
  scope.dispose();
  target.dispatchEvent(new Event('click'));
  queued(); // A callback already dequeued by the browser must also be harmless.
  complete();
  clock.run();
  assert.equal(writes, 0);
  assert.equal(clock.jobs.size, 0);
  assert.equal(scope.active, false);
});

test('completion and cleanup each run once and child cleanup follows the parent', () => {
  const scope = createSessionScope();
  const child = createSessionScope();
  let count = 0;
  const complete = scope.once(() => count++);
  complete(); complete();
  const release = scope.addCleanup(() => count++);
  scope.addCleanup(child.dispose);
  release(); release();
  scope.dispose();
  assert.equal(count, 2);
  assert.equal(child.active, false);
  scope.addCleanup(() => count++);
  assert.equal(count, 3);
});

test('choice shortcuts survive unrelated keys and ignore editing, modifiers and disabled choices', () => {
  const target = new EventTarget();
  const scope = createSessionScope();
  const buttons = [{ dataset: { val: 'zero' }, disabled: false }, { dataset: { val: 'one' }, disabled: true }];
  const values = [];
  const release = bindChoiceShortcuts(scope, buttons, (value) => values.push(value), target);
  for (const [value, properties] of [['Tab', {}], ['2', {}], ['1', { repeat: true }],
    ['1', { ctrlKey: true }], ['1', { target: { closest: () => ({}) } }]]) key(target, value, properties);
  assert.deepEqual(values, []);
  assert.equal(key(target, '1').defaultPrevented, true);
  assert.deepEqual(values, ['zero']);
  release();
  key(target, '1');
  assert.deepEqual(values, ['zero']);
  scope.dispose();
});

function routerEnvironment(hash = '#/today') {
  const browser = Object.assign(new EventTarget(), { location: { hash }, history: { replaceState() {} }, scrollTo() {} });
  const document = { querySelectorAll: () => [], body: { classList: { toggle() {} } } };
  const container = { dataset: {}, querySelector: () => null };
  return { browser, document, container };
}

test('the production router releases each mounted view before callbacks can commit', async () => {
  const { SharpRouter } = await import('../js/router.js');
  const clock = fakeClock(), keyboard = new EventTarget(), env = routerEnvironment();
  let writes = 0, disposed = 0;
  const router = new SharpRouter(env.container, { ...env, resolve: async () => () => {
    const scope = createSessionScope(clock);
    scope.timeout(() => writes++, 100);
    scope.listen(keyboard, 'keydown', () => writes++);
    return () => { disposed++; scope.dispose(); };
  } });
  await router.init();
  for (const route of ['#/games/logic-deduction', '#/games/math-arithmetic', '#/session/saved']) {
    env.browser.location.hash = route;
    await router.render();
  }
  router.dispose();
  clock.run(); key(keyboard, '1');
  assert.equal(disposed, 4);
  assert.equal(writes, 0);
});

test('a slow route resolver cannot overwrite newer navigation or mount after disposal', async () => {
  const { SharpRouter } = await import('../js/router.js');
  const env = routerEnvironment('#/model'), mounted = [];
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const router = new SharpRouter(env.container, { ...env, resolve: async ({ path }) => {
    if (path === 'model') await pending;
    return () => { mounted.push(path); };
  } });
  const first = router.init();
  await Promise.resolve();
  env.browser.location.hash = '#/today'; await router.render();
  release(); await first;
  assert.deepEqual(mounted, ['today']);
  router.dispose();
  await router.render();
  assert.deepEqual(mounted, ['today']);
});

test('legacy route aliases keep one canonical navigation and focus policy', async () => {
  const { parseRoute } = await import('../js/router.js');
  assert.deepEqual(parseRoute('#/catalog'), { path: 'exercises', param: undefined, alias: true, focused: false });
  assert.equal(parseRoute('#/session/saved').focused, true);
  assert.equal(parseRoute('#/games/delayed-memory').focused, true);
  assert.equal(parseRoute('#/games/logic-deduction').focused, false);
});
