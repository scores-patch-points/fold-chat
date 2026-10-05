export async function retry(run, ctx) {
  let last;
  for (let i = 0; i < 3; i++) {
    try {
      return await run();
    } catch (e) {
      if (e.name !== "TimeoutError") throw e;
      last = e;
      const seen = await ctx.provider.lookup(ctx.key);
      if (seen) return seen;
    }
  }
  throw last;
}
