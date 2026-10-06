export function makeCache(limit) {
  return {
    get(k) { return undefined; },
    set(k, v) {},
    size() { return 0; },
  };
}
