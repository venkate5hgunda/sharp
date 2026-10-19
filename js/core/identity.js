// IDs are assigned once at creation and preserved through export/import.
let sequence = 0;
export function createId(prefix = 'id') {
  if (!/^[a-z][a-z0-9_]{0,30}$/.test(prefix)) throw new TypeError('Invalid ID prefix.');
  const unique = globalThis.crypto?.randomUUID?.() ||
    `${Date.now().toString(36)}-${(++sequence).toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}_${unique}`;
}
