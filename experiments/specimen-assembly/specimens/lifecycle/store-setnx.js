export function makeStore(backend) {
  return {
    async claim(k) {
      const won = await backend.setnx("claim:" + k, "pending");
      if (won) return { state: "new" };
      const r = await backend.get("result:" + k);
      return r ? { state: "done", result: r } : { state: "pending" };
    },
    async complete(k, result) {
      await backend.set("result:" + k, result);
    },
    async release(k) {
      await backend.del("claim:" + k);
    },
  };
}
