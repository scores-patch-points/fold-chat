export function makeStore(backend) {
  const name = "setnx";
  return {
    async claim(k) {
      const won = await backend[name]("claim:" + k, "pending");
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
