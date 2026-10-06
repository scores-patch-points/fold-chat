// whatif-rungs.mjs — EXPLORATORY (not pre-registered): what two more block types would add, measured offline on the cached raw pages of the
// how-to and code asks: (e) ordered lists (<ol> with >= 3 items) as a 'procedure' snip, (f) <pre> code blocks. Gold rule unchanged (strandwide).
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gnorm, decodeEntities } from "./lib/text.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const { asks } = JSON.parse(fs.readFileSync(path.join(here, "asks.json"), "utf8"));
const J = JSON.parse(fs.readFileSync(path.join(here, "judged.json"), "utf8")).rows;
const h = (k) => crypto.createHash("sha1").update(k).digest("hex");
const rawOf = (url) => { for (const k of [`chromium GET ${url}`, `node GET ${url}`, `node GET https://holodeck-proxy.prometheoid.workers.dev/raw?url=${encodeURIComponent(url)}`]) { const f = path.join(here, "cache", h(k)); if (fs.existsSync(f + ".body") && JSON.parse(fs.readFileSync(f + ".json", "utf8")).status === 200) return fs.readFileSync(f + ".body", "utf8"); } return null; };
const strip = (s) => decodeEntities(String(s).replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const re = (s) => new RegExp(s, "iu");
const out = { how: [], code: [] };
for (const ask of asks.filter((a) => a.class === "how-to" || a.class === "code")) {
  const o = JSON.parse(fs.readFileSync(path.join(here, "data", "out", ask.id + ".json"), "utf8"));
  const lists = [], pres = [];
  for (const rd of o.reads.filter((x) => x.ok)) {
    const raw = rawOf(rd.url); if (!raw) continue;
    for (const m of raw.matchAll(/<ol\b[^>]*>([\s\S]*?)<\/ol>/gi)) { const items = [...m[1].matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => strip(x[1])).filter((t) => t.length >= 20); if (items.length >= 3 && items.join(" ").length < 4000) lists.push({ url: rd.url, items }); }
    for (const m of raw.matchAll(/<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)) { const t = strip(m[1]); if (t.length >= 8 && t.length <= 500) pres.push({ url: rd.url, text: t }); }
  }
  const pick = ask.class === "how-to" ? lists : pres; const text = gnorm(pick.map((x) => x.items ? x.items.join("\n") : x.text).join("\n"));
  const hit = ask.gold.all.every((x) => re(x).test(text));
  const baseline = J.find((r) => r.id === ask.id);
  out[ask.class === "how-to" ? "how" : "code"].push({ id: ask.id, blocks: pick.length, goldInBlocks: hit, s1Final: baseline.final.sat, s1Held: baseline.held.answered });
}
fs.writeFileSync(path.join(here, "whatif-rungs.json"), JSON.stringify(out, null, 1));
for (const k of ["how", "code"]) { const a = out[k]; console.log(k, "asks", a.length, "with >=1 block", a.filter((x) => x.blocks).length, "gold in blocks", a.filter((x) => x.goldInBlocks).length, "| S1 judged satisfied", a.filter((x) => /^yes/.test(x.s1Final)).length, "| failed S1 but gold in blocks:", a.filter((x) => !/^yes/.test(x.s1Final) && x.goldInBlocks).map((x) => x.id).join(",")); }
