export function makeStore(backend) {
  const claims = new Map();
  const results = new Map();
  return {
    async claim(k) {
      if (results.has(k)) return { state: "done", result: results.get(k) };
      if (claims.has(k)) return { state: "pending" };
      claims.set(k, true);
      return { state: "new" };
    },
    async complete(k, result) {
      results.set(k, result);
    },
    async release(k) {
      claims.delete(k);
    },
  };
}
