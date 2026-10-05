export function makeCache(limit) {
  const m = new Map();
  return {
    get(k) {
      if (!m.has(k)) return undefined;
      const v = m.get(k);
      m.delete(k);
      m.set(k, v);
      return v;
    },
    set(k, v) {
      if (m.has(k)) m.delete(k);
      else if (m.size >= limit) m.delete(m.keys().next().value);
      m.set(k, v);
    },
    size() { return m.size; },
  };
}
