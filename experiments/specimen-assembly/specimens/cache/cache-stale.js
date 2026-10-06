export function makeCache(limit) {
  const m = new Map();
  return {
    get(k) { return m.get(k); },
    set(k, v) {
      if (m.has(k)) return;
      if (m.size >= limit) m.delete(m.keys().next().value);
      m.set(k, v);
    },
    size() { return m.size; },
  };
}
