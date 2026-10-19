import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
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

test('route-away releases a mounted game and workout child before callbacks can commit', () => {
  // Run the real router with view dependencies supplied by the test harness.
  // This isolates ownership/route behavior without adding a DOM framework to production.
  const clock = fakeClock();
  const keyboard = new EventTarget();
  let writes = 0;
  let disposed = 0;
  const mount = () => {
    const scope = createSessionScope(clock);
    scope.timeout(() => writes++, 100);
    scope.listen(keyboard, 'keydown', () => writes++);
    return () => { disposed++; scope.dispose(); };
  };
  const target = {};
  const back = { addEventListener() {} };
  const wrapper = { querySelector: (selector) => selector === '#gameMountTarget' ? target : back };
  const container = { innerHTML: '', appendChild() {}, querySelector: () => null };
  const source = readFileSync(new URL('../js/router.js', import.meta.url), 'utf8')
    .replace(/^import .*;\n/gm, '').replace('export class SharpRouter', 'class SharpRouter');
  const view = { render() {} };
  const game = { render: mount, renderArithmetic: mount, renderStoryMath: mount };
  const context = vm.createContext({ console,
    window: { location: { hash: '#/games/logic-deduction' }, scrollTo() {} },
    document: { querySelectorAll: () => [], createElement: () => wrapper },
    WorkoutView: { render: mount }, CatalogView: view, AnalyticsView: view, BackupView: view, SettingsView: view,
    DelayedMemoryGame: game, PatternFlashGame: game, MathChallengeGame: game,
    LogicDeductionGame: game, ComprehensionGame: game, CorsiSpanGame: game
  });
  const Router = vm.runInContext(`${source}\nSharpRouter`, context);
  const router = new Router(container);
  for (const route of ['#/games/logic-deduction', '#/games/math-arithmetic', '#/games/story-math', '#/workout']) {
    context.window.location.hash = route;
    router.handleHashChange();
    assert.equal(typeof router.activeCleanup, 'function');
    context.window.location.hash = '#/catalog';
    router.handleHashChange();
    clock.run();
    key(keyboard, '1');
  }
  assert.equal(disposed, 4);
  assert.equal(writes, 0);
});
