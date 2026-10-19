// Own every timer and listener created by one mounted game or view.
export function createSessionScope(clock = globalThis) {
  let active = true;
  const cleanups = new Set();
  const timers = new Set();

  function addCleanup(cleanup) {
    if (typeof cleanup !== 'function') return () => {};
    let pending = true;
    function release() {
      if (!pending) return;
      pending = false;
      cleanups.delete(release);
      cleanup();
    }
    if (active) cleanups.add(release);
    else release();
    return release;
  }

  function listen(target, type, callback, options) {
    if (!active) return () => {};
    const guarded = (event) => { if (active) callback(event); };
    target.addEventListener(type, guarded, options);
    return addCleanup(() => target.removeEventListener(type, guarded, options));
  }

  function timeout(callback, delay) {
    if (!active) return null;
    const handle = clock.setTimeout(() => {
      timers.delete(handle);
      if (active) callback();
    }, delay);
    timers.add(handle);
    return handle;
  }

  function once(callback) {
    let called = false;
    return (...args) => {
      if (!active || called) return;
      called = true;
      return callback(...args);
    };
  }

  function dispose() {
    if (!active) return;
    active = false;
    for (const handle of timers) clock.clearTimeout(handle);
    timers.clear();
    // Release all resources even if an individual cleanup fails.
    const errors = [];
    for (const cleanup of [...cleanups]) {
      try { cleanup(); } catch (error) { errors.push(error); }
    }
    if (errors.length) console.warn('Session cleanup failed:', errors);
  }

  return { get active() { return active; }, addCleanup, listen, timeout, once, dispose };
}

export function bindChoiceShortcuts(scope, buttons, choose, target = document) {
  return scope.listen(target, 'keydown', (event) => {
    if (event.defaultPrevented || event.repeat || event.ctrlKey || event.metaKey || event.altKey ||
        event.target?.closest?.('input, textarea, select, [contenteditable], [role="dialog"], dialog')) return;
    if (!/^[1-4]$/.test(event.key)) return;
    const button = buttons[Number(event.key) - 1];
    if (!button || button.disabled) return;
    event.preventDefault();
    choose(button.dataset.val, button);
  });
}
