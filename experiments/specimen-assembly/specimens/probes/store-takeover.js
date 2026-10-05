export function makeStore(backend) {
  return {
    async claim(k) {
      const won = await backend.setnx("claim:" + k, "pending");
      if (won) return { state: "new" };
      const r = await backend.get("result:" + k);
      if (r) return { state: "done", result: r };
      const waiters = await backend.incr("waiters:" + k);
      return waiters >= 2 ? { state: "new" } : { state: "pending" };
    },
    async complete(k, result) {
      await backend.set("result:" + k, result);
    },
    async release(k) {
      await backend.del("claim:" + k);
    },
  };
}
