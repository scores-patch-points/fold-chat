// analyze.mjs — read out/conv-*.json and out/clean-*.json and print the tables D1-RESULTS.md reports. Writes out/summary.json.
import fs from "node:fs";
const OUT = new URL("./out/", import.meta.url);
const load = (pre) => fs.readdirSync(OUT).filter((f) => f.startsWith(pre) && f.endsWith(".json")).map((f) => JSON.parse(fs.readFileSync(new URL(f, OUT), "utf8")));
const convs = load("conv-"), cleans = load("clean-");
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const mean = (xs) => (xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : null);
const sum = {};
const probes = convs.flatMap((c) => c.turns.filter((t) => t.role === "probe").map((t) => ({ conv: c.id, lang: c.lang, sib: c.id && /^E(02|04|06|08|10)$/.test(c.id), L: c.length, ...t })));
sum.nConvs = convs.length; sum.nTurns = convs.reduce((a, c) => a + c.turns.length, 0); sum.nProbes = probes.length;
const cellKey = (p) => (p.probe.near ? "near" : "d" + p.probe.distance);
const dBucket = (p) => (p.probe.near ? "near" : p.probe.distance <= 5 ? "d3" : p.probe.distance <= 12 ? "d10" : p.probe.distance <= 27 ? "d25" : "d50");
const kinds = ["pron", "elide", "repeat", "para", "partial", "explicit", "explicitPartial", "wrong", "none", "return", "correction"];
const buckets = ["near", "d3", "d10", "d25", "d50"];

// ── path mix and the right-material table ──
sum.cells = {};
for (const k of kinds) for (const b of buckets) {
  const ps = probes.filter((p) => p.probe.kind === k && dBucket(p) === b && p.lang === "en");
  if (!ps.length) continue;
  const needle = ps.filter((p) => p.probe.gold.type === "needle");
  sum.cells[`${k}|${b}`] = { n: ps.length, paths: ps.reduce((a, p) => ((a[p.path] = (a[p.path] || 0) + 1), a), {}), right: needle.length ? pct(needle.filter((p) => p.rightMaterial).length, needle.length) : null, nNeedle: needle.length, web: mean(ps.map((p) => p.web)), pages: mean(ps.map((p) => p.pages)) };
}
const R = (f) => { const x = probes.filter(f); return { n: x.length, right: pct(x.filter((p) => p.rightMaterial).length, x.length), rightRead: pct(x.filter((p) => p.rightRead).length, x.length), coldRead: pct(x.filter((p) => p.cold && p.cold.needleRead).length, x.length) }; };
sum.c1a = { pronNear: R((p) => p.probe.kind === "pron" && p.probe.near && p.lang === "en"), pronFar: R((p) => p.probe.kind === "pron" && !p.probe.near && p.lang === "en"), pronFarByD: Object.fromEntries(["d3", "d10", "d25", "d50"].map((b) => [b, R((p) => p.probe.kind === "pron" && dBucket(p) === b && p.lang === "en")])), pronNonEn: R((p) => p.probe.kind === "pron" && p.lang !== "en") };
sum.c1e = { elideNear: R((p) => p.probe.kind === "elide" && p.probe.near), elideFar: R((p) => p.probe.kind === "elide" && !p.probe.near), elideByD: Object.fromEntries(["d3", "d10", "d25", "d50"].map((b) => [b, R((p) => p.probe.kind === "elide" && dBucket(p) === b)])) };
// what the pronoun was carried to
sum.pronCarried = probes.filter((p) => p.probe.kind === "pron" && !p.probe.near && p.lang === "en").map((p) => ({ conv: p.conv, d: p.probe.distance, follow: p.follow.kind, carried: p.follow.carried, search: p.follow.search, right: p.rightMaterial }));
// explicit-name recall
const expl = probes.filter((p) => ["explicit"].includes(p.probe.kind));
sum.c1b = { all: { n: expl.length, recallPath: expl.filter((p) => p.path === "recall").length, recallRight: expl.filter((p) => p.path === "recall" && p.recallRight).length, recallWrongTurn: expl.filter((p) => p.path === "recall" && !p.recallRight).length, webFallback: expl.filter((p) => p.path === "web").length }, byD: {} };
for (const b of ["d3", "d10", "d25", "d50"]) { const x = expl.filter((p) => dBucket(p) === b); sum.c1b.byD[b] = { n: x.length, recallRight: x.filter((p) => p.path === "recall" && p.recallRight).length, recallWrong: x.filter((p) => p.path === "recall" && !p.recallRight).length, web: x.filter((p) => p.path === "web").length, rightEither: pct(x.filter((p) => (p.path === "recall" && p.recallRight) || (p.path === "web" && p.probe.gold && needleOrAny(p))).length, x.length) }; }
function needleOrAny(p) { return p.rightMaterialAny ?? false; }
sum.c1b.enOnly = (() => { const x = expl.filter((p) => p.lang === "en"); return { n: x.length, recallRight: x.filter((p) => p.path === "recall" && p.recallRight).length, recallWrong: x.filter((p) => p.path === "recall" && !p.recallRight).length, web: x.filter((p) => p.path === "web").length }; })();
const sibExpl = probes.filter((p) => ["explicit", "explicitPartial"].includes(p.probe.kind) && p.sib);
sum.c1d = { n: sibExpl.length, recallRight: sibExpl.filter((p) => p.path === "recall" && p.recallRight).length, recallWrongTurn: sibExpl.filter((p) => p.path === "recall" && !p.recallRight).length, web: sibExpl.filter((p) => p.path === "web").length };
const ret = probes.filter((p) => p.probe.kind === "return");
sum.c1c = { n: ret.length, right: pct(ret.filter((p) => p.rightMaterial).length, ret.length), paths: ret.reduce((a, p) => ((a[p.path] = (a[p.path] || 0) + 1), a), {}), web: mean(ret.map((p) => p.web)), pages: mean(ret.map((p) => p.pages)) };
// explicitPartial / partial / none / wrong
const xp = probes.filter((p) => p.probe.kind === "explicitPartial");
sum.xpartial = { n: xp.length, recallPath: xp.filter((p) => p.path === "recall").length, recallRight: xp.filter((p) => p.path === "recall" && p.recallRight).length, recallWrong: xp.filter((p) => p.path === "recall" && !p.recallRight).length, web: xp.filter((p) => p.path === "web").length, other: xp.filter((p) => !["recall", "web"].includes(p.path)).length };
const pa = probes.filter((p) => p.probe.kind === "partial");
sum.partial = { n: pa.length, right: pct(pa.filter((p) => p.rightMaterial).length, pa.length), paths: pa.reduce((a, p) => ((a[p.path] = (a[p.path] || 0) + 1), a), {}), byD: Object.fromEntries(["d3", "d10", "d25", "d50"].map((b) => [b, R((p) => p.probe.kind === "partial" && dBucket(p) === b)])) };
const wr = probes.filter((p) => p.probe.kind === "wrong");
sum.c4c = { n: wr.length, recallReturned: wr.filter((p) => p.path === "recall").length, web: wr.filter((p) => p.path === "web").length, other: wr.filter((p) => !["recall", "web"].includes(p.path)).length, bySiblingKind: ["sibling", "pure"].map((k) => { const x = wr.filter((p) => p.probe.wrongKind === k); return { kind: k, n: x.length, recallReturned: x.filter((p) => p.path === "recall").length, recalledAnchor: x.filter((p) => p.path === "recall" && p.recallRight).length }; }), rows: wr.map((p) => ({ conv: p.conv, said: p.said, d: p.probe.distance, path: p.path, recallTurn: p.recallTurn, anchorTurns: p.probe.anchorTurns })) };
const none = probes.filter((p) => p.probe.kind === "none");
sum.none = { n: none.length, recall: none.filter((p) => p.path === "recall").length, recallTurnIsLast: none.filter((p) => p.path === "recall" && p.recallTurn === p.assistantTurn - 1).length, recalledAnchor: none.filter((p) => p.path === "recall" && p.recallRight).length, paths: none.reduce((a, p) => ((a[p.path] = (a[p.path] || 0) + 1), a), {}) };
const cor = probes.filter((p) => p.probe.kind === "correction");
sum.c2e = { n: cor.length, web: cor.filter((p) => p.web > 0).length, paths: cor.reduce((a, p) => ((a[p.path] = (a[p.path] || 0) + 1), a), {}), follow: cor.reduce((a, p) => ((a[p.follow.kind] = (a[p.follow.kind] || 0) + 1), a), {}), queries: cor.slice(0, 8).map((p) => ({ conv: p.conv, said: p.said, searchQ: p.searchQ, path: p.path, web: p.web })) };

// ── 2a: avoidable searches ──
const avoid = probes.filter((p) => ["repeat", "para", "return", "partial", "pron", "elide"].includes(p.probe.kind) && p.probe.gold.type === "needle" && p.storedHasNeedle);
sum.c2a = { n: avoid.length, web: avoid.filter((p) => p.path === "web").length, thread: avoid.filter((p) => p.path === "thread").length, recall: avoid.filter((p) => p.path === "recall").length, other: avoid.filter((p) => !["web", "thread", "recall"].includes(p.path)).length, meanWebWarm: mean(avoid.filter((p) => p.path === "web").map((p) => p.web)), meanWebCold: mean(avoid.filter((p) => p.cold && p.path === "web").map((p) => p.cold.web)), meanPagesWarm: mean(avoid.filter((p) => p.path === "web").map((p) => p.pages)), meanPagesCold: mean(avoid.filter((p) => p.cold && p.path === "web").map((p) => p.cold.pages)), warmGeColdWeb: pct(avoid.filter((p) => p.path === "web" && p.cold && p.web >= p.cold.web).length, avoid.filter((p) => p.path === "web" && p.cold).length) };
sum.c2a.byKind = Object.fromEntries(["repeat", "para", "return"].map((k) => { const x = avoid.filter((p) => p.probe.kind === k); return [k, { n: x.length, web: x.filter((p) => p.path === "web").length, meanWeb: mean(x.map((p) => p.web)), meanPages: mean(x.map((p) => p.pages)), coldWeb: mean(x.filter((p) => p.cold).map((p) => p.cold.web)), coldPages: mean(x.filter((p) => p.cold).map((p) => p.cold.pages)) }]; }));
// does the earlier page still hold the answer in what was STORED? (para/return)
const pr = probes.filter((p) => ["para", "return"].includes(p.probe.kind));
sum.paraStored = { n: pr.length, storedHasNeedle: pr.filter((p) => p.storedHasNeedle).length };
// 2c: recall cost
const rc = probes.filter((p) => p.path === "recall");
sum.c2c = { n: rc.length, web: rc.reduce((a, p) => a + p.web, 0), pages: rc.reduce((a, p) => a + p.pages, 0), modelCalled: rc.filter((p) => p.modelCalled).length };
// freshness false alarms: pages unchanged (replay), claims re-checked on later turns
const fr = convs.flatMap((c) => c.turns.filter((t) => t.fresh && t.fresh.checked).map((t) => t.fresh));
sum.freshFalseAlarm = { turnsChecked: fr.length, claimsChecked: fr.reduce((a, x) => a + x.checked, 0), exact: fr.reduce((a, x) => a + x.counts.exact, 0), shifted: fr.reduce((a, x) => a + x.counts.shifted, 0), moved: fr.reduce((a, x) => a + x.counts.moved, 0), gone: fr.reduce((a, x) => a + x.counts.gone, 0), unchecked: fr.reduce((a, x) => a + x.counts.unchecked, 0), turnsWithStaleNote: fr.filter((x) => x.stale > 0).length };

// ── 3: prompt size vs turn ──
const arms = ["live", "salience", "keepallT", "keepallTP", "keepnone"];
const curve = (set) => { const out = {}; const maxN = Math.max(0, ...set.map((c) => c.turns.length)); for (const a of arms) { out[a] = []; for (let n = 1; n <= maxN; n++) { const xs = set.filter((c) => c.turns.length >= n).map((c) => c.turns[n - 1].arms[a].chars); out[a].push({ turn: n, n: xs.length, mean: mean(xs), max: xs.length ? Math.max(...xs) : null }); } } return out; };
sum.sizeCurve = curve(convs);
const long = convs.filter((c) => c.length >= 60);
sum.c3a = (() => { const r = {}; for (const a of arms) { const at = (n) => mean(long.map((c) => c.turns[n - 1].arms[a].chars)); r[a] = { t5: at(5), t10: at(10), t20: at(20), t40: at(40), t60: at(60), ratio60over20: Math.round(100 * at(60) / at(20)) / 100 }; } r.nLong = long.length; return r; })();
sum.sizeParts = (() => { const xs = long.flatMap((c) => c.turns.slice(30)); const m = (f) => mean(xs.map(f)); return { turns: xs.length, chars: m((t) => t.arms.live.chars), base: m((t) => t.arms.live.baseChars), summary: m((t) => t.arms.live.summaryChars), records: m((t) => t.arms.live.recordChars), sources: m((t) => t.arms.live.sourceChars), history: m((t) => t.arms.live.hist), question: m((t) => t.arms.live.q), maxChars: Math.max(...xs.map((t) => t.arms.live.chars)) }; })();
sum.c3f = (() => { const xs = long.flatMap((c) => c.turns.slice(14).filter((t) => t.path === "web")); return { n: xs.length, live: mean(xs.map((t) => t.arms.live.chars)), salience: mean(xs.map((t) => t.arms.salience.chars)), cutPct: Math.round(100 * (1 - mean(xs.map((t) => t.arms.salience.chars)) / mean(xs.map((t) => t.arms.live.chars)))) }; })();
// ── 3b: the forgetting curve on CLEAN runs (no probes touch the anchor) ──
sum.forget = (() => { const out = {}; for (const a of ["live", "salience", "keepallT"]) { out[a] = []; for (let n = 4; n <= 60; n++) { const xs = cleans.filter((c) => c.turns.length >= n).map((c) => c.turns[n - 1].anchorMem?.[a]); if (!xs.length) break; out[a].push({ turn: n, since: n - 3, n: xs.length, askKept: pct(xs.filter((x) => x && x.ask).length, xs.length), claimKept: pct(xs.filter((x) => x && x.claim).length, xs.length) }); } } return out; })();
sum.retention = (() => { const rows = {}; for (const c of cleans) for (const t of c.turns.slice(15)) for (const r of t.ret || []) { const k = (["chit", "meta", "greet"].includes(r.kind) ? "chit/meta" : r.kind === "pron-bg" ? "pron-bg" : "ask"); (rows[k] ||= {}); const a = r.age; (rows[k][a] ||= [0, 0]); rows[k][a][1]++; if (r.present) rows[k][a][0]++; } const o = {}; for (const [k, v] of Object.entries(rows)) o[k] = Object.fromEntries(Object.entries(v).map(([a, [p, n]]) => [a, { n, kept: pct(p, n) }])); return o; })();
// ── 4: storage ──
const per = (f) => { const xs = convs.flatMap((c) => c.turns.filter((t) => t.role !== "x").map(f)); return mean(xs); };
sum.storage = { claimsPerTurn: per((t) => t.stored.claimsBytes), warrantPerTurn: per((t) => t.stored.warrantBytes), groundingPerTurn: per((t) => t.stored.groundingBytes), msgPerTurn: per((t) => t.stored.msgBytes), summaryPerTurn: per((t) => t.stored.summaryBytes), webTurnsClaims: mean(convs.flatMap((c) => c.turns.filter((t) => t.path === "web").map((t) => t.stored.claimsBytes))), webTurnsGrounding: mean(convs.flatMap((c) => c.turns.filter((t) => t.path === "web").map((t) => t.stored.groundingBytes))) };
sum.storage.impressionPerTurn = Math.round((sum.storage.claimsPerTurn + sum.storage.warrantPerTurn) * 10) / 10;
sum.storage.sessionBytesEnd = convs.map((c) => ({ id: c.id, turns: c.length, bytes: c.sessionBytes, perTurn: Math.round(c.sessionBytes / c.length) }));
sum.storage.turnsTo5MB = Math.round(5 * 1024 * 1024 / (mean(convs.map((c) => c.sessionBytes / c.length))));
// duplicated passage text stored across messages of one conversation
sum.storage.dup = convs.map((c) => ({ id: c.id, passageBytes: 0 })).length;

fs.writeFileSync(new URL("summary.json", OUT), JSON.stringify(sum, null, 1));
console.log(JSON.stringify(sum, (k, v) => (k === "sizeCurve" || k === "forget" || k === "retention" ? "(see summary.json)" : v), 1));
