export function track(events, name, props = {}) {
  events.push({ name, props, n: events.length + 1 });
  return events;
}

export function countBy(events, key) {
  const out = {};
  for (const e of events) out[e[key]] = (out[e[key]] || 0) + 1;
  return out;
}
