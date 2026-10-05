export function makeCache(limit) {
  const m = new Map();
  return {
    get(k) { return m.get(k); },
    set(k, v) { m.set(k, v); if (m.size > limit * 2) m.clear(); },
    size() { return m.size; },
  };
}
