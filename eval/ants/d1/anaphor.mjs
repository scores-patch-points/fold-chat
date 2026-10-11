// anaphor.mjs — claim 1a/1e at the level of WHAT WAS SEARCHED: does the follow-up's search name the anchor topic, and does it also name a topic the person never meant? (no needle involved)
import fs from "node:fs";
const OUT = new URL("./out/", import.meta.url);
const rows = [];
for (const f of fs.readdirSync(OUT).filter((f) => /^(B-)?conv-/.test(f))) { const c = JSON.parse(fs.readFileSync(new URL(f, OUT), "utf8")); if (c.lang !== "en") continue;
  const titles = c.anchorRefs.map((r) => r.replace(/^.*— /, "").toLowerCase());
  const t0 = c.turns[2]; const lastTopicAt = (i) => i;   // anchor answered at turn 3
  c.turns.forEach((t, i) => { if (t.role !== "probe" || !["pron", "elide"].includes(t.probe.kind)) return;
    const q = String(t.follow.search || "").toLowerCase(); const carried = (t.follow.carried || []).map((x) => x.toLowerCase());
    const hasAnchor = titles.some((a) => q.includes(a) || carried.some((x) => x.includes(a) || a.includes(x)));
    const toks = (x) => x.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 3 && !['wikipedia', 'history', 'disaster', 'canal', 'tower', 'wall', 'great'].includes(w));
    const anchorToks = new Set(titles.flatMap(toks));
    const others = carried.filter((x) => !(toks(x).some((w) => anchorToks.has(w)) || titles.some((a) => x.includes(a) || a.includes(x))));
    rows.push({ conv: c.id, kind: t.probe.kind, near: !!t.probe.near, d: t.probe.distance, followKind: t.follow.kind, hasAnchor, nCarried: carried.length, unrelatedCarried: others.length, search: t.follow.search }); }); }
const g = (f) => { const x = rows.filter(f); return { n: x.length, searchNamesAnchor: x.filter((r) => r.hasAnchor).length, withUnrelatedTopicInQuery: x.filter((r) => r.unrelatedCarried > 0).length, anchorAbsent: x.filter((r) => !r.hasAnchor).length }; };
const res = { pronNear: g((r) => r.kind === "pron" && r.near), pronFar: g((r) => r.kind === "pron" && !r.near), elideNear: g((r) => r.kind === "elide" && r.near), elideFar: g((r) => r.kind === "elide" && !r.near), pronFarByD: Object.fromEntries([["d<=5", (r) => r.d <= 5], ["d10-12", (r) => r.d >= 10 && r.d <= 12], ["d25-27", (r) => r.d >= 25 && r.d <= 27], ["d50+", (r) => r.d >= 50]].map(([k, f]) => [k, g((r) => r.kind === "pron" && !r.near && f(r))])), elideFarByD: Object.fromEntries([["d<=5", (r) => r.d <= 5], ["d10-12", (r) => r.d >= 10 && r.d <= 12], ["d25-27", (r) => r.d >= 25 && r.d <= 27], ["d50+", (r) => r.d >= 50]].map(([k, f]) => [k, g((r) => r.kind === "elide" && !r.near && f(r))])) };
fs.writeFileSync(new URL("anaphor.json", OUT), JSON.stringify({ res, rows }, null, 1)); console.log(JSON.stringify(res, null, 1));
