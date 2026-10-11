// analyze2.mjs — the numbers D1-RESULTS.md reports.   SETS=A|B|AB node eval/ants/d1/analyze2.mjs        writes out/summary2-<SETS>.json
import fs from "node:fs";
const OUT = new URL("./out/", import.meta.url);
const SETS = process.env.SETS || "AB";
const load = (pre) => fs.readdirSync(OUT).filter((f) => f.startsWith(pre) && f.endsWith(".json") && !f.startsWith("summary")).map((f) => JSON.parse(fs.readFileSync(new URL(f, OUT), "utf8")));
const convs = [...(SETS.includes("A") ? load("conv-") : []), ...(SETS.includes("B") ? load("B-conv-") : [])];
const cleans = load("clean-");
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
const mean = (xs) => (xs.length ? Math.round((10 * xs.reduce((a, b) => a + b, 0)) / xs.length) / 10 : null);
const S = { sets: SETS, nConvs: convs.length, nTurns: convs.reduce((a, c) => a + c.turns.length, 0), langs: convs.reduce((a, c) => ((a[c.lang] = (a[c.lang] || 0) + 1), a), {}) };
const probes = convs.flatMap((c) => c.turns.filter((t) => t.role === "probe").map((t) => ({ conv: c.id, lang: c.lang, L: c.length, sib: !!c.siblingInRoster, ...t })));
const SIB = new Set(["E02", "E04", "E06", "E08", "E10"]);
for (const p of probes) { if (SIB.has(p.conv)) p.sib = true; }
S.nProbes = probes.length;
const bucket = (p) => (p.probe.near ? "near" : p.probe.distance <= 5 ? "d3" : p.probe.distance <= 12 ? "d10" : p.probe.distance <= 27 ? "d25" : "d50");
const B = ["near", "d3", "d10", "d25", "d50"];
const frac = (x, f) => ({ n: x.length, k: x.filter(f).length, pct: pct(x.filter(f).length, x.length) });
const en = (p) => p.lang === "en";

// ── claim 1 ──
const pr = probes.filter((p) => p.probe.kind === "pron" && en(p));
S.c1a = { near: frac(pr.filter((p) => p.probe.near), (p) => p.rightRead), far: frac(pr.filter((p) => !p.probe.near), (p) => p.rightRead), farHandedToModel: frac(pr.filter((p) => !p.probe.near), (p) => p.rightMaterial), coldCeilingFar: frac(pr.filter((p) => !p.probe.near), (p) => p.cold && p.cold.needleRead) };
// what the pronoun was carried to (far): is the anchor among the carried referents? is it the only one?
S.c1aCarried = (() => { const far = pr.filter((p) => !p.probe.near); const A = (p) => (p.follow.carried || []); return { n: far.length, carriedKind: far.filter((p) => p.follow.kind === "carried").length, anchorAmongCarried: far.filter((p) => A(p).some((c) => /./.test(c) && p.conv && c)).length, rows: far.slice(0, 40).map((p) => ({ conv: p.conv, d: p.probe.distance, carried: p.follow.carried, search: p.follow.search, readRight: p.rightRead })) }; })();
const el = probes.filter((p) => p.probe.kind === "elide" && en(p));
S.c1e = { near: frac(el.filter((p) => p.probe.near), (p) => p.rightRead), far: frac(el.filter((p) => !p.probe.near), (p) => p.rightRead) };
const ex = probes.filter((p) => p.probe.kind === "explicit");
S.c1b = { byPath: ex.reduce((a, p) => ((a[p.path] = (a[p.path] || 0) + 1), a), {}), recallRight: frac(ex.filter((p) => p.path === "recall"), (p) => p.recallRight), allReachedAnchor: frac(ex, (p) => (p.path === "recall" && p.recallRight)), byD: Object.fromEntries(B.slice(1).map((b) => [b, { ...frac(ex.filter((p) => bucket(p) === b), (p) => p.path === "recall" && p.recallRight), recallPath: ex.filter((p) => bucket(p) === b && p.path === "recall").length }])) };
const xp = probes.filter((p) => p.probe.kind === "explicitPartial");
S.xpartial = { n: xp.length, recallPath: xp.filter((p) => p.path === "recall").length, recallRight: xp.filter((p) => p.path === "recall" && p.recallRight).length, recallWrong: xp.filter((p) => p.path === "recall" && !p.recallRight).length, web: xp.filter((p) => p.path === "web").length };
const sx = probes.filter((p) => ["explicit", "explicitPartial"].includes(p.probe.kind) && SIB.has(p.conv));
S.c1d = { n: sx.length, recallPath: sx.filter((p) => p.path === "recall").length, right: sx.filter((p) => p.path === "recall" && p.recallRight).length, wrongTurn: sx.filter((p) => p.path === "recall" && !p.recallRight).length, web: sx.filter((p) => p.path === "web").length };
const nsx = probes.filter((p) => ["explicit", "explicitPartial"].includes(p.probe.kind) && !SIB.has(p.conv));
S.noSibling = { n: nsx.length, recallPath: nsx.filter((p) => p.path === "recall").length, right: nsx.filter((p) => p.path === "recall" && p.recallRight).length, wrongTurn: nsx.filter((p) => p.path === "recall" && !p.recallRight).length, web: nsx.filter((p) => p.path === "web").length };
const rt = probes.filter((p) => p.probe.kind === "return");
S.c1c = { read: frac(rt, (p) => p.rightRead), handed: frac(rt, (p) => p.rightMaterial), coldCeilingRead: frac(rt, (p) => p.cold && p.cold.needleRead), paths: rt.reduce((a, p) => ((a[p.path] = (a[p.path] || 0) + 1), a), {}) };
// ── claim 2 ──
const avoid = probes.filter((p) => ["repeat", "para", "return"].includes(p.probe.kind) && p.storedHasNeedle);
S.c2a = { nAvoidable: avoid.length, searchedAgain: avoid.filter((p) => p.path === "web").length, warmWeb: mean(avoid.map((p) => p.web)), coldWeb: mean(avoid.filter((p) => p.cold).map((p) => p.cold.web)), warmPages: mean(avoid.map((p) => p.pages)), coldPages: mean(avoid.filter((p) => p.cold).map((p) => p.cold.pages)), warmWebGeCold: frac(avoid.filter((p) => p.cold), (p) => p.web >= p.cold.web) };
const re = probes.filter((p) => ["repeat", "para", "return"].includes(p.probe.kind));
S.c2aAll = { n: re.length, searchedAgain: re.filter((p) => p.path === "web").length, storedHadNeedle: re.filter((p) => p.storedHasNeedle).length, warmWeb: mean(re.map((p) => p.web)), coldWeb: mean(re.filter((p) => p.cold).map((p) => p.cold.web)) };
S.c2aByKind = Object.fromEntries(["repeat", "para", "return"].map((k) => { const x = probes.filter((p) => p.probe.kind === k); return [k, { n: x.length, searched: x.filter((p) => p.path === "web").length, storedHadNeedle: x.filter((p) => p.storedHasNeedle).length, web: mean(x.map((p) => p.web)), pages: mean(x.map((p) => p.pages)), coldWeb: mean(x.filter((p) => p.cold).map((p) => p.cold.web)), coldPages: mean(x.filter((p) => p.cold).map((p) => p.cold.pages)) }]; }));
const rc = probes.filter((p) => p.path === "recall");
S.c2c = { n: rc.length, web: rc.reduce((a, p) => a + p.web, 0), pages: rc.reduce((a, p) => a + p.pages, 0), modelCalls: rc.filter((p) => p.modelCalled).length };
const cr = probes.filter((p) => p.probe.kind === "correction");
S.c2e = { n: cr.length, searched: cr.filter((p) => p.web > 0).length, meanWeb: mean(cr.map((p) => p.web)), followKinds: cr.reduce((a, p) => ((a[p.follow.kind] = (a[p.follow.kind] || 0) + 1), a), {}), queryHasOtherTopic: cr.filter((p) => p.follow.kind === "carried").length, sample: cr.slice(0, 6).map((p) => ({ conv: p.conv, q: p.searchQ })) };
// chit-chat that searches
const allTurns = convs.flatMap((c) => c.turns.map((t) => ({ conv: c.id, lang: c.lang, ...t })));
const chit = allTurns.filter((t) => t.tkind === "chit");
S.chit = { n: chit.length, searched: chit.filter((t) => t.web > 0).length, byText: Object.fromEntries([...new Set(chit.map((t) => t.said))].map((s) => { const x = chit.filter((t) => t.said === s); return [s, { n: x.length, searched: x.filter((t) => t.web > 0).length }]; })) };
const meta = allTurns.filter((t) => t.tkind === "meta");
S.meta = { n: meta.length, thread: meta.filter((t) => t.path === "thread").length, searched: meta.filter((t) => t.web > 0).length, cold: meta.filter((t) => t.path === "cold-gap").length, byPath: meta.reduce((a, t) => ((a[t.path] = (a[t.path] || 0) + 1), a), {}) };
const fr = allTurns.filter((t) => t.fresh && t.fresh.checked);
const tot = fr.reduce((a, x) => { const c = x.fresh.counts; a.exact += c.exact; a.shifted += c.shifted; a.moved += c.moved; a.gone += c.gone; a.unchecked += c.unchecked; return a; }, { exact: 0, shifted: 0, moved: 0, gone: 0, unchecked: 0 });
S.freshness = { ...tot, comparable: tot.exact + tot.shifted + tot.moved + tot.gone, falseAlarmPct: pct(tot.shifted + tot.moved + tot.gone, tot.exact + tot.shifted + tot.moved + tot.gone), turnsWithNote: fr.filter((x) => x.fresh.stale > 0).length, turnsChecked: fr.length, note: "pages are byte-identical on replay, so every non-exact verdict is a false alarm" };
// ── claim 3 ──
const arms = ["live", "livePreG3", "salience", "keepallT", "keepallTP", "keepnone"];
const long = convs.filter((c) => c.length >= 60);
const at = (a, n, set = long) => mean(set.map((c) => c.turns[n - 1].arms[a].chars));
S.c3a = { nLong: long.length, byArm: Object.fromEntries(arms.map((a) => [a, { t5: at(a, 5), t10: at(a, 10), t20: at(a, 20), t30: at(a, 30), t40: at(a, 40), t50: at(a, 50), t60: at(a, 60), ratio60over20: Math.round(100 * at(a, 60) / at(a, 20)) / 100, max: Math.max(...long.flatMap((c) => c.turns.map((t) => t.arms[a].chars))) }])) };
S.sizeCurve = Object.fromEntries(arms.map((a) => [a, Array.from({ length: 60 }, (_, i) => { const xs = convs.filter((c) => c.turns.length > i).map((c) => c.turns[i].arms[a].chars); return { turn: i + 1, n: xs.length, mean: mean(xs), max: xs.length ? Math.max(...xs) : null }; })]));
{ const xs = long.flatMap((c) => c.turns.slice(30)); const m = (f) => mean(xs.map(f)); S.sizeParts = { turns: xs.length, chars: m((t) => t.arms.live.chars), base: m((t) => t.arms.live.baseChars), summary: m((t) => t.arms.live.summaryChars), records: m((t) => t.arms.live.recordChars), sources: m((t) => t.arms.live.sourceChars), history: m((t) => t.arms.live.hist), question: m((t) => t.arms.live.q), max: Math.max(...xs.map((t) => t.arms.live.chars)) }; }
{ const xs = long.flatMap((c) => c.turns.slice(14).filter((t) => t.path === "web")); S.c3f = { n: xs.length, live: mean(xs.map((t) => t.arms.live.chars)), salience: mean(xs.map((t) => t.arms.salience.chars)), cutPct: Math.round(100 * (1 - mean(xs.map((t) => t.arms.salience.chars)) / mean(xs.map((t) => t.arms.live.chars)))) }; }
S.forget = Object.fromEntries(["live", "livePreG3", "salience", "keepallT"].map((a) => [a, Array.from({ length: 57 }, (_, i) => { const n = i + 4; const xs = cleans.filter((c) => c.turns.length >= n).map((c) => c.turns[n - 1].anchorMem?.[a]).filter(Boolean); return xs.length ? { since: n - 3, n: xs.length, askKept: pct(xs.filter((x) => x.ask).length, xs.length), claimKept: pct(xs.filter((x) => x.claim).length, xs.length) } : null; }).filter(Boolean)]));
S.retention = (() => { const rows = {}; for (const c of cleans) for (const t of c.turns.slice(15)) for (const r of t.ret || []) { if (!r.ask) continue; const k = ["chit", "meta", "greet"].includes(r.kind) ? "chit/meta" : "ask"; ((rows[k] ||= {})[r.age] ||= [0, 0])[1]++; if (r.present) rows[k][r.age][0]++; } return Object.fromEntries(Object.entries(rows).map(([k, v]) => [k, Object.fromEntries(Object.entries(v).map(([a, [p, n]]) => [a, { n, kept: pct(p, n) }]))])); })();
// ── claim 4 ──
const per = (f) => mean(convs.flatMap((c) => c.turns.map(f)));
S.storage = { claimsPerTurn: per((t) => t.stored.claimsBytes), warrantPerTurn: per((t) => t.stored.warrantBytes), groundingPerTurn: per((t) => t.stored.groundingBytes), summaryStatePerTurn: null };
S.storage.impressionPerTurn = Math.round((S.storage.claimsPerTurn + S.storage.warrantPerTurn) * 10) / 10;
S.storage.webTurnClaims = mean(allTurns.filter((t) => t.path === "web").map((t) => t.stored.claimsBytes));
S.dup = { conv: convs.length, passages: convs.reduce((a, c) => a + c.dup.passages, 0), unique: convs.reduce((a, c) => a + c.dup.uniquePassages, 0), bytes: convs.reduce((a, c) => a + c.dup.bytes, 0), uniqueBytes: convs.reduce((a, c) => a + c.dup.uniqueBytes, 0) };
S.ptr = convs.reduce((a, c) => { for (const k of Object.keys(c.ptr)) a[k] = (a[k] || 0) + c.ptr[k]; return a; }, {});
// recall vs distance, by mechanism: is the anchor fact AVAILABLE without a new search?  (needle-gold probes only; recall-pattern probes are scored by recallRight)
const needleKinds = ["pron", "elide", "repeat", "para", "partial", "return"];
const mem = (p, mech) => { if (mech === "livePreG3") return (p.path === "recall" && p.recallRight) || !!(p.needleMem && p.needleMem.livePreG3); if (mech === "live") return (p.path === "recall" && p.recallRight) || !!(p.needleMem && p.needleMem.live); if (mech === "salience") return !!(p.needleMem && p.needleMem.salience); if (mech === "keepallT") return !!(p.needleMem && p.needleMem.keepallT); if (mech === "keepallTP") return !!(p.needleMem && p.needleMem.keepallTP); if (mech === "keepallPages") return !!(p.needleMem && p.needleMem.keepallPages); return false; };
const mechs = ["live", "livePreG3", "salience", "keepallT", "keepallTP", "keepallPages", "keepnone"];
S.recallVsDistance = Object.fromEntries(B.map((b) => { const x = probes.filter((p) => needleKinds.includes(p.probe.kind) && bucket(p) === b && p.needleMem); return [b, { n: x.length, ...Object.fromEntries(mechs.map((m) => [m, pct(x.filter((p) => mem(p, m)).length, x.length)])) }]; }));
S.recallVsCue = Object.fromEntries(needleKinds.map((k) => { const x = probes.filter((p) => p.probe.kind === k && !p.probe.near && p.needleMem); return [k, { n: x.length, ...Object.fromEntries(mechs.map((m) => [m, pct(x.filter((p) => mem(p, m)).length, x.length)])) }]; }));
// the recall PATTERN probes (explicit/explicitPartial/none) scored by turn
const rp = (k) => { const x = probes.filter((p) => p.probe.kind === k); return { n: x.length, recallPath: x.filter((p) => p.path === "recall").length, anchorTurn: x.filter((p) => p.path === "recall" && p.recallRight).length, wrongTurn: x.filter((p) => p.path === "recall" && !p.recallRight).length, searched: x.filter((p) => p.path === "web").length }; };
S.patternProbes = { explicit: rp("explicit"), explicitPartial: rp("explicitPartial"), none: rp("none"), wrong: rp("wrong") };
S.patternByDistance = Object.fromEntries(B.slice(1).map((b) => { const x = probes.filter((p) => ["explicit", "explicitPartial"].includes(p.probe.kind) && bucket(p) === b); return [b, { n: x.length, recallPath: x.filter((p) => p.path === "recall").length, right: x.filter((p) => p.path === "recall" && p.recallRight).length, wrong: x.filter((p) => p.path === "recall" && !p.recallRight).length }]; }));
const wr = probes.filter((p) => p.probe.kind === "wrong");
S.c4c = { n: wr.length, recallReturned: wr.filter((p) => p.path === "recall").length, searched: wr.filter((p) => p.path === "web").length, bySibling: ["sibling", "pure"].map((k) => { const x = wr.filter((p) => p.probe.wrongKind === k); return { kind: k, n: x.length, recallReturned: x.filter((p) => p.path === "recall").length }; }), rows: wr.filter((p) => p.path === "recall").map((p) => ({ conv: p.conv, said: p.said, d: p.probe.distance, recallTurn: p.recallTurn, anchorTurns: p.probe.anchorTurns })) };
// precision of recall as the conversation grows (all recall-pattern probes that took the recall path)
S.recallPrecision = Object.fromEntries(["d3", "d10", "d25", "d50"].map((b) => { const x = probes.filter((p) => ["explicit", "explicitPartial"].includes(p.probe.kind) && bucket(p) === b && p.path === "recall"); return [b, { returned: x.length, right: x.filter((p) => p.recallRight).length, precision: pct(x.filter((p) => p.recallRight).length, x.length) }]; }));
fs.writeFileSync(new URL(`summary2-${SETS}.json`, OUT), JSON.stringify(S, null, 1));
console.log(JSON.stringify(S, (k, v) => (["sizeCurve", "forget", "retention", "rows", "sample"].includes(k) ? "(summary2 json)" : v), 1));
