// Active answer time and reading time are separate, including passage reviews.
export function createQuestionTimer({
  initial = {},
  reading = false,
  now = () => performance.now(),
} = {}) {
  let started = now();
  let activeMs = initial.activeMs || 0;
  let readingMs = initial.readingMs || 0;

  const read = () => {
    const elapsed = now() - started;
    return {
      activeMs: activeMs + (reading ? 0 : elapsed),
      readingMs: readingMs + (reading ? elapsed : 0),
      hiddenMs: initial.hiddenMs || 0,
      pausedMs: initial.pausedMs || 0,
    };
  };

  return {
    read,
    setReading(value) {
      if (value === reading) return;
      const timestamp = now();
      const elapsed = timestamp - started;
      if (reading) readingMs += elapsed;
      else activeMs += elapsed;
      started = timestamp;
      reading = value;
    },
  };
}
