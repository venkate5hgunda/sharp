// Calendar keys follow the device's local day; timestamps remain absolute instants.
export function localDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new RangeError('Invalid calendar date.');
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function shiftLocalDay(value = new Date(), days = 0) {
  const date = new Date(value);
  // Calendar arithmetic avoids 23/25-hour DST days. Noon also avoids midnight transitions.
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}
