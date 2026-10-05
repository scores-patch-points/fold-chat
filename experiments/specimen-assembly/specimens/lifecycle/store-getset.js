export function makeStore(backend) {
  return {
    async claim(k) {
      const r = await backend.get("result:" + k);
      if (r) return { state: "done", result: r };
      const c = await backend.get("claim:" + k);
      if (c) return { state: "pending" };
      await backend.set("claim:" + k, "pending");
      return { state: "new" };
    },
    async complete(k, result) {
      await backend.set("result:" + k, result);
    },
    async release(k) {
      await backend.del("claim:" + k);
    },
  };
}
