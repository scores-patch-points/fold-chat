export function makeCache(limit) {
  const m = new Map();
  return {
    get(k) { return m.get(k); },
    set(k, v) { m.set(k, v); },
    size() { return m.size; },
  };
}
