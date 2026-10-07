import * as BASE from "./origin-base.mjs"; import { cachedFetch } from "./io.mjs";
for (const [q, claim, sent] of [["When did Apollo 11 land on the Moon?", "Apollo 11 landed on the Moon on 20 July 1969.", "Watch highlights from the Apollo 11 mission including the launch on July 16, 1969, the landing of the lunar module, Neil Armstrong’s first steps on the Moon, splashdown, and more."],
  ["When was the United Nations founded?", "The United Nations was founded on 24 October 1945.", "Founding of the United Nations—San Francisco 1945."],
  ["When did Apollo 11 land on the Moon?", "Apollo 11 landed on the Moon on 20 July 1969.", "Apollo 11 landed on the Moon on 21 July 1969."]]) {
  const reading = await BASE.readFrame(q, { fetchImpl: cachedFetch });
  const b = BASE.supportByFrame(claim, { url: "https://x.org/", title: "", text: sent }, reading);
  const c = BASE.supportOf(claim, { url: "https://x.org/", title: "", text: sent }, { reading, forWhom: q });
  console.log(q, "| frame slot:", reading && reading.frame.slot, "| rung2:", JSON.stringify(b && { v: b.verdict, filler: b.filler, why: b.why }), "| supportOf:", c.verdict, c.rung || "consequence");
}
process.exit(0);
