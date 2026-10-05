// worksheet.mjs — prints answer sentences next to the evidence so they can be hand-labelled
// into eval/labels.json  (label: "supported" | "unsupported").
//
//   node eval/worksheet.mjs [--labels default,frontier] [--max 400] > eval/worksheet.txt
//
// For every sentence of every checkable answer it shows: the app's verdict (grounded to
// which URL), the verbatim quote the app displays for that citation, and the best-overlap
// sentence from the pages that were actually read (re-fetched with the app's own readText,
// cached in eval/cache). "supported" means: some READ source states what the sentence says
// (equivalent units / paraphrase allowed); the labeller decides, this only lays out evidence.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const rawDir = path.join(here, "raw"), cacheDir = path.join(here, "cache");
fs.mkdirSync(cacheDir, { recursive: true });
const webm = await import(path.join(here, ".app", "fold-chat-web.js"));
const ground = await import(path.join(here, ".app", "fold-chat-ground.js"));
const arg = (k, d) => { const i = process.argv.indexOf("--" + k); return i < 0 ? d : process.argv[i + 1]; };
const LABELS = (arg("labels", "default,frontier")).split(",");
const UA = { "user-agent": "fold-eval/1.0 (accuracy harness; scores.patch.points@proton.me)" };
const fetchUA = (u, o = {}) => fetch(u, { ...o, headers: { ...(o.headers || {}), ...UA } });
async function page(url) {
  const f = path.join(cacheDir, "u_" + Buffer.from(url).toString("hex").slice(0, 80) + ".txt");
  if (fs.existsSync(f)) return fs.readFileSync(f, "utf8");
  const r = await webm.readText(url, { fetchImpl: fetchUA, timeoutMs: 20000 });
  const t = r.ok ? r.text : "";
  fs.writeFileSync(f, t); await new Promise((x) => setTimeout(x, 800));
  return t;
}
const toks = (s) => new Set(ground.tokenize(s).filter((t) => t.length >= 3));
function best(sentence, text) {
  const a = toks(sentence); if (!a.size) return null;
  let bestS = null, bs = 0;
  for (const piece of ground.splitSentences(text.slice(0, 24000))) {
    const b = toks(piece); let n = 0; for (const t of a) if (b.has(t)) n++;
    const sc = n / Math.sqrt(a.size * (b.size || 1)); if (sc > bs) { bs = sc; bestS = piece; }
  }
  return bestS ? { score: +bs.toFixed(2), text: bestS.slice(0, 300) } : null;
}
let count = 0;
const MAX = parseInt(arg("max", "400"), 10);
for (const f of fs.readdirSync(rawDir).filter((x) => x.endsWith(".json") && !x.startsWith("_")).sort()) {
  const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), "utf8"));
  if (!LABELS.includes(r.label) || r.rep !== 1) continue;
  for (let ti = 0; ti < r.turns.length; ti++) {
    const g = r.turns[ti].grounding; if (!g?.coverage?.entries?.length || g.creative) continue;
    const key = `${r.label}/${r.id}/r${r.rep}/t${ti}`;
    const urls = (g.web || []).filter((w) => w.read && !w.skipped && w.ok !== false).map((w) => w.read);
    const texts = []; for (const u of urls) texts.push({ u, t: await page(u) });
    console.log(`\n##### ${key}\nQ: ${r.turns[ti].q}`);
    g.coverage.entries.forEach((e, i) => {
      if (++count > MAX) return;
      const q = e.address ? (g.facing?.sources || []).find((s) => s.address === e.address)?.text : null;
      console.log(`  [${i}] ${e.ref ? "GROUNDED -> " + e.source : "ungrounded"} :: ${e.text.slice(0, 260)}`);
      if (q) console.log(`        cited quote: ${q.slice(0, 260)}`);
      if (!e.ref) { const c = texts.map((x) => ({ u: x.u, b: best(e.text, x.t) })).filter((x) => x.b).sort((a, b) => b.b.score - a.b.score)[0]; if (c) console.log(`        best read passage (${c.b.score}) ${c.u.split("/").pop()}: ${c.b.text}`); }
    });
  }
}
