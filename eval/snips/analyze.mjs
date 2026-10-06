// analyze.mjs — turns judged.json (+ data/out, data/model) into stats.json and analysis.md (tables with n and Wilson CIs). Offline.
//   node eval/snips/analyze.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { wilson, pct, gnorm } from "./lib/text.mjs";
const here = path.dirname(fileURLToPath(import.meta.url));
const J = JSON.parse(fs.readFileSync(path.join(here, "judged.json"), "utf8")); const rows = J.rows.filter((r) => !r.missing && !r.error);
const { asks } = JSON.parse(fs.readFileSync(path.join(here, "asks.json"), "utf8"));
const out = (id) => JSON.parse(fs.readFileSync(path.join(here, "data", "out", id + ".json"), "utf8"));
const lines = []; const P = (s = "") => lines.push(s);
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : null; };
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const NOMODEL = (r) => r.final.sat === "yes" || r.final.sat === "yes-with-trim";
const ans = rows.filter((r) => r.expect === "answer"), gapx = rows.filter((r) => r.expect !== "answer");
const S = { n: rows.length, answerExpected: ans.length, gapExpected: gapx.length };

P(`# analysis (generated ${new Date().toISOString()})`);
P(`asks judged: ${rows.length}/${asks.length}; answer-expected ${ans.length}; gap/correction-expected ${gapx.length}`);
// funnel
const fun = { searched: rows.length, searchOk: rows.filter((r) => r.searchOk).length, relay: rows.filter((r) => r.transport === "relay").length, engine: rows.filter((r) => /^engine:/.test(r.transport)).length, apiOnly: rows.filter((r) => r.transport === "api-only").length, none: rows.filter((r) => r.transport === "none").length, anyRead: rows.filter((r) => r.readsOk > 0).length, anyStrand: rows.filter((r) => r.wouldHaveChars > 0).length, shown: rows.filter((r) => !r.gap && r.chars > 0).length };
S.funnel = fun; P("\n## funnel (all asks)\n"); P("| stage | n | share |\n|---|---|---|"); for (const [k, v] of Object.entries(fun)) P(`| ${k} | ${v} | ${(100 * v / rows.length).toFixed(0)}% |`);
S.relayFirstPass = (() => { const t = rows.filter((r) => true); const ok = t.filter((r) => r.transport === "relay").length; return wilson(ok, t.length); })(); P(`\nrelay delivered the final search for ${pct(S.relayFirstPass)} (after one retry; remainder fell to a labelled browser-engine transport).`);

// headline by class
const classes = [...new Set(asks.map((a) => a.class))];
P("\n## headline: no-model answer by class (answer-expected asks; final = my reading)\n");
P("| class | n | held gold in strand | shown & gold | yes | yes-with-trim | needs-model | failed | **no-model satisfied (yes+trim)** |\n|---|---|---|---|---|---|---|---|---|");
S.byClass = {};
for (const c of classes) {
  const a = ans.filter((r) => r.class === c); if (!a.length) continue;
  const cnt = (s) => a.filter((r) => r.final.sat === s).length; const nm = a.filter(NOMODEL).length;
  S.byClass[c] = { n: a.length, held: a.filter((r) => r.held.answered).length, shown: a.filter((r) => r.shownGold.answered).length, yes: cnt("yes"), trim: cnt("yes-with-trim"), needsModel: cnt("needs-model"), failed: cnt("failed"), nomodel: wilson(nm, a.length) };
  P(`| ${c} | ${a.length} | ${S.byClass[c].held} | ${S.byClass[c].shown} | ${cnt("yes")} | ${cnt("yes-with-trim")} | ${cnt("needs-model")} | ${cnt("failed")} | ${pct(S.byClass[c].nomodel)} |`);
}
const allNm = ans.filter(NOMODEL).length; S.headline = { all: wilson(allNm, ans.length), strictYes: wilson(ans.filter((r) => r.final.sat === "yes").length, ans.length), englishEveryday: (() => { const a = ans.filter((r) => r.lang === "en" && !["cross-language", "follow-up"].includes(r.class)); return wilson(a.filter(NOMODEL).length, a.length); })(), conditionalOnSearch: (() => { const a = ans.filter((r) => r.searchOk); return wilson(a.filter(NOMODEL).length, a.length); })() };
P(`\n**overall (all answer-expected)**: ${pct(S.headline.all)}; strict "yes": ${pct(S.headline.strictYes)}; English everyday classes only: ${pct(S.headline.englishEveryday)}; conditional on a search having returned results: ${pct(S.headline.conditionalOnSearch)}`);

// gap-expected
P("\n## gap-expected asks (live-data, unanswerable, false-premise, volatile news)\n"); P("| class | n | typed gap (correct) | leak (strand shown) | dangerous-wrong |\n|---|---|---|---|---|");
S.gap = {};
for (const c of [...new Set(gapx.map((r) => r.class))]) { const a = gapx.filter((r) => r.class === c); const g = a.filter((r) => r.final.sat === "gap-correct").length, d = a.filter((r) => r.final.sat === "dangerous-wrong" || r.final.dangerous).length, l = a.length - g - d; S.gap[c] = { n: a.length, gap: g, leak: l, dangerous: d }; P(`| ${c} | ${a.length} | ${g} | ${l} | ${d} |`); }
{ const g = gapx.filter((r) => r.final.sat === "gap-correct").length, d = gapx.filter((r) => r.final.sat === "dangerous-wrong" || r.final.dangerous).length; S.gap.all = { gapCorrect: wilson(g, gapx.length), dangerous: wilson(d, gapx.length), leak: wilson(gapx.length - g - d, gapx.length) }; P(`\nall: typed gap ${pct(S.gap.all.gapCorrect)}; leak ${pct(S.gap.all.leak)}; dangerous ${pct(S.gap.all.dangerous)}`);
  const ungated = gapx.filter((r) => r.gap !== "live-data" && r.class === "live-trap"); void ungated;
  // what the volatile gate saved: live asks that were gapped by G1 but whose held strand carries a trap
  const sav = gapx.filter((r) => r.gap === "live-data"); S.gate = { gappedByG1: sav.length, wouldHaveShownTrap: sav.filter((r) => r.trapInHeld).length, wouldHaveShownAnything: sav.filter((r) => r.wouldHaveChars > 0).length }; P(`volatile gate (G1) fired on ${sav.length} gap-expected asks; without it the strand would have been shown on ${S.gate.wouldHaveShownAnything} and asserted a trap-pattern figure on ${S.gate.wouldHaveShownTrap}.`); }
P(`\nvolatile gate confusion (control): ${JSON.stringify(J.controls.volatileGate)}`);
// over-refusal on answerable asks
const overref = ans.filter((r) => r.gap); S.overRefusal = { n: overref.length, byKind: overref.reduce((m, r) => (m[r.gap] = (m[r.gap] || 0) + 1, m), {}), ids: overref.map((r) => r.id) }; P(`\nanswerable asks that got a typed gap: ${overref.length}/${ans.length} ${JSON.stringify(S.overRefusal.byKind)}`);

// G3 coverage-floor sensitivity (exploratory, post hoc: the pre-registered floor is 0.6 and was not changed)
{ const cov = rows.map((r) => ({ r, share: out(r.id).coverage ? out(r.id).coverage.share : 1, g1: r.gap === "live-data", noStrand: r.wouldHaveChars === 0 })); const overG3 = ans.filter((r) => r.gap === "off-topic"); S.g3 = { floor: 0.6, gappedAnswerable: overG3.length, ofWhichGoldHeld: overG3.filter((r) => r.held.answered).length, ids: overG3.map((r) => r.id), correctOnGapExpected: gapx.filter((r) => r.gap === "off-topic").length };
  P(`\n## gate G3 (coverage floor 0.6, pre-registered)\n\nfired on ${overG3.length} answerable asks (gold WAS in the held strand for ${S.g3.ofWhichGoldHeld} of them: over-refusal) and on ${S.g3.correctOnGapExpected} gap-expected asks (correct). Over-refused: ${S.g3.ids.join(", ")}`);
  P("\nexploratory sensitivity (not a tuned bar): floor -> answerable asks refused although gold was held / gap-expected asks not caught (strand shown) / of those shown, ones I read as dangerous\n"); P("| floor | refused with gold held | gap-expected shown | dangerous shown |\n|---|---|---|---|"); S.g3curve = [];
  for (const th of [0, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]) { const refAns = cov.filter((x) => x.r.expect === "answer" && x.r.held.answered && !x.g1 && x.share < th && x.r.wouldHaveChars > 0).length; const gx = cov.filter((x) => x.r.expect !== "answer"); const shown = gx.filter((x) => !(x.g1 || x.share < th)); const dang = shown.filter((x) => x.r.final.sat === "dangerous-wrong" || x.r.final.dangerous).length; S.g3curve.push({ th, refAns, shown: shown.length, dang }); P(`| ${th} | ${refAns} | ${shown.length}/${gx.length} | ${dang} |`); } }
// rungs
P("\n## rungs (answer-expected asks; each rung's strand on its own, gold same-snip rule)\n"); P("| rung | asks where it produced anything | of those: gold present | gold present / all answer asks | median chars |\n|---|---|---|---|---|");
S.rungs = {};
for (const k of ["aStruct", "aDesc", "b", "c", "cNoLead", "d"]) { const has = ans.filter((r) => r.byRung[k].n > 0); const ok = has.filter((r) => r.byRung[k].answered); S.rungs[k] = { produced: has.length, answered: wilson(ok.length, has.length), ofAll: wilson(ok.length, ans.length), medChars: med(has.map((r) => r.byRung[k].chars)) }; P(`| ${k} | ${has.length} | ${pct(S.rungs[k].answered)} | ${pct(S.rungs[k].ofAll)} | ${S.rungs[k].medChars} |`); }
const union = ans.filter((r) => r.held.answered).length; P(`\nS1 strand (policy) gold present: ${pct(wilson(union, ans.length))}; ladder-or-lexical oracle (any rung): ${pct(wilson(ans.filter((r) => Object.values(r.byRung).some((x) => x.answered)).length, ans.length))}`);
S.s1 = wilson(union, ans.length);
const gr = {}; for (const r of ans) for (const g of r.goldRungs) gr[g] = (gr[g] || 0) + 1; S.goldRungs = gr; P(`S1 gold-bearing snip comes from rung: ${JSON.stringify(gr)} (an ask can count under several)`);
// top-k
P("\n## coverage vs number of sources read (S1 policy on the first k read pages)\n"); P("| k | gold present | CI |\n|---|---|---|"); S.topK = {};
for (const k of [1, 2, 3, 5]) { const a = ans.filter((r) => r.topK); const ok = a.filter((r) => r.topK[k]).length; S.topK[k] = wilson(ok, a.length); P(`| ${k} | ${ok}/${a.length} | ${pct(S.topK[k])} |`); }
// short span
{ const a = ans.filter((r) => r.held.answered && r.held.span); const sn = a.map((r) => r.held.span.snip), se = a.map((r) => r.held.span.sentence).filter((x) => x != null);
  S.span = { n: a.length, snipLe400: wilson(sn.filter((x) => x <= 400).length, a.length), sentenceLe300: wilson(se.filter((x) => x <= 300).length, se.length), medSnip: med(sn), medSentence: med(se), p90Snip: q(sn, 0.9) };
  // rank of the first gold snip in S1 order, and whether the very first snip holds it
  let first = 0, n1 = 0; for (const r of a) { const o = out(r.id); const idx = o.strands.S1.findIndex((s) => r.held.snips.includes(s.id)); if (idx === 0) first++; n1++; } S.span.top1 = wilson(first, n1);
  P(`\n## short-answer span (answered asks, n=${a.length})\n\nanswer-bearing snip <= 400 chars: ${pct(S.span.snipLe400)}; the answer sentence <= 300 chars: ${pct(S.span.sentenceLe300)}; median snip ${S.span.medSnip} chars, median answer sentence ${S.span.medSentence} chars, p90 snip ${S.span.p90Snip}; the FIRST snip of the strand holds the gold: ${pct(S.span.top1)}`);
  const tot = ans.filter((r) => r.chars > 0).map((r) => r.chars); S.shownChars = { median: med(tot), p90: q(tot, 0.9) }; P(`chars shown per strand: median ${S.shownChars.median}, p90 ${S.shownChars.p90}`); }
// relevance
{ const all = rows.filter((r) => r.snipRel); let n = 0, k = 0, nm = 0, km = 0, nl = 0, kl = 0; for (const r of all) { if (r.gap) continue; for (const s of r.snipRel) { n++; k += s.rel; const hasList = Array.isArray(r.final.irrelevant); const bad = hasList && r.final.irrelevant.includes(s.id); nm++; km += hasList ? (!bad) : s.rel; if (hasList) { nl++; kl += !bad; } } }
  S.relevance = { auto: wilson(k, n), withReading: wilson(km, nm), handLabelled: wilson(kl, nl) }; P(`\n## snip relevance (snips shown in non-gapped strands)\n\nautomatic proxy ${pct(S.relevance.auto)}; with my reading where I labelled the snips ${pct(S.relevance.withReading)}; hand-labelled snips only ${pct(S.relevance.handLabelled)}`);
  const c = J.controls.relevanceJudge; S.relevanceControl = { true: wilson(c.trueAccept.k, c.trueAccept.n), shuffled: wilson(c.shuffledAccept.k, c.shuffledAccept.n), sameClass: wilson(c.sameClassShuffledAccept.k, c.sameClassShuffledAccept.n) }; P(`judge control (token rule only): accepts ${pct(S.relevanceControl.true)} of true snips; ${pct(S.relevanceControl.shuffled)} of snips shuffled across asks; ${pct(S.relevanceControl.sameClass)} shuffled within a class`); P(`gold-regex control: gold of ask i matched against the strand of another ask j: ${J.controls.goldShuffle.falseAcceptances}/${J.controls.goldShuffle.pairs} (${(100 * J.controls.goldShuffle.rate).toFixed(2)}%)`); }
// verbatim
{ let n = 0, ex = 0, res = 0, nc = 0, tot = 0; for (const r of rows) { n += r.verbatimAll.n; ex += r.verbatimAll.exactFail; res += r.verbatimAll.residue; nc += r.verbatimAll.notCorroborated; } S.verbatim = { candidates: n, exactFail: ex, entityResidue: res, notCorroborated: nc }; tot = n; P(`\n## verbatim check (all candidate snips, n=${tot})\n\ncheck 1 (snip text == page text at its offsets / == a declared source string): ${ex} failures. entity residue (raw &#...; left in a snip by the app's tag stripper): ${res}. snips not found in the cached raw page's visible text after whitespace/entity normalisation: ${nc}.`); }
{ const f = path.join(here, "corroboration.json"); if (fs.existsSync(f)) { const t = JSON.parse(fs.readFileSync(f, "utf8")); S.corroboration = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, { n: v.n, exact: v.exact, whitespaceOnly: v.noWs, entityResidue: v.residue, literalEscape: v.escapeLiteral, other: v.other }])); P("\ncorroboration of every candidate snip against the cached raw page (visible text; per block for prose):\n"); P("| kind | n | found exactly | whitespace only | entity residue | literal \\u escape | not in visible text |\n|---|---|---|---|---|---|---|"); for (const [k, v] of Object.entries(S.corroboration)) P(`| ${k} | ${v.n} | ${v.exact} | ${v.whitespaceOnly} | ${v.entityResidue} | ${v.literalEscape} | ${v.other} |`); } }
// cross-language
P("\n## cross-language (six shared facts; gold same-snip; S1 strand held)\n"); const XL = asks.filter((a) => a.xl && a.class !== "follow-up"); const langs = ["en", "es", "fr", "de", "zh", "ru", "ar", "hi", "pt", "ja"]; const byId = Object.fromEntries(rows.map((r) => [r.id, r]));
P("| lang | n | search ok | read ok | gold in strand | no-model satisfied | gapped |\n|---|---|---|---|---|---|---|"); S.xl = {};
for (const l of langs) { const a = XL.filter((x) => x.language === l).map((x) => byId[x.id]).filter(Boolean); if (!a.length) continue; S.xl[l] = { n: a.length, held: wilson(a.filter((r) => r.held.answered).length, a.length), nomodel: wilson(a.filter(NOMODEL).length, a.length) }; P(`| ${l} | ${a.length} | ${a.filter((r) => r.searchOk).length} | ${a.filter((r) => r.readsOk > 0).length} | ${pct(S.xl[l].held)} | ${pct(S.xl[l].nomodel)} | ${a.filter((r) => r.gap).length} |`); }
{ const en = XL.filter((x) => x.language === "en").map((x) => byId[x.id]).filter(Boolean), ne = XL.filter((x) => x.language !== "en").map((x) => byId[x.id]).filter(Boolean); S.xlGap = { en: wilson(en.filter((r) => r.held.answered).length, en.length), nonEn: wilson(ne.filter((r) => r.held.answered).length, ne.length) }; P(`\nEnglish: ${pct(S.xlGap.en)}; non-English pooled: ${pct(S.xlGap.nonEn)}`); }
P("\nper fact (non-English pooled): " + ["F1", "F2", "F3", "F4", "F5", "F6"].map((f) => { const a = XL.filter((x) => x.xl === f && x.language !== "en").map((x) => byId[x.id]).filter(Boolean); return `${f} ${a.filter((r) => r.held.answered).length}/${a.length}`; }).join(", "));
// follow-up
{ const fu = asks.filter((a) => a.class === "follow-up").map((a) => byId[a.id]).filter(Boolean); const raw = []; for (const a of asks.filter((a) => a.class === "follow-up")) { const f = path.join(here, "data", "out", a.id + "__raw.json"); if (fs.existsSync(f)) raw.push({ id: a.id, o: JSON.parse(fs.readFileSync(f, "utf8")) }); }
  S.followUp = { n: fu.length, resolved: wilson(fu.filter((r) => r.held.answered).length, fu.length) }; P(`\n## follow-ups (resolveQuestion carry)\n\nresolved: gold in strand ${pct(S.followUp.resolved)}; resolution reasons: ${JSON.stringify(fu.map((r) => [r.id, out(r.id).resolution && out(r.id).resolution.reason]))}`);
  if (raw.length) { const { goldCheck } = {}; void goldCheck; S.followUp.rawRuns = raw.map((x) => ({ id: x.id, shown: !x.o.gap, query: x.o.query })); P(`unresolved control runs: ${raw.length}`); } }
// classes of material (structured types)
P("\n## structured material in the pages that were read\n"); const types = {}; let pages = 0, pagesRaw = 0; const rungAsk = {};
for (const r of rows) { const o = out(r.id); for (const p of o.pageInfo || []) { pages++; if (p.hasRaw) pagesRaw++; for (const t of new Set(p.ldTypes || [])) types[t] = (types[t] || 0) + 1; } for (const s of o.strands.S1) if (s.rung.startsWith("a.")) { (rungAsk[s.rung] ||= { shown: 0, gold: 0, asks: new Set() }); rungAsk[s.rung].shown++; rungAsk[s.rung].asks.add(r.id); if (r.held.snips && r.held.snips.includes(s.id)) rungAsk[s.rung].gold++; } }
S.ldTypes = types; S.pages = { pages, withRawHtml: pagesRaw };
P(`pages read OK: ${pages} (${pagesRaw} with raw HTML; the rest Wikipedia plain-text extracts); schema.org types seen on pages (pages carrying the type): ${Object.entries(types).filter(([t]) => /^(Recipe|HowTo|FAQPage|QAPage|Question|Product|Offer|Event|Article|NewsArticle|BlogPosting|WebPage|VideoObject|BreadcrumbList|Review|AggregateRating|DefinedTerm|ItemList|Person|Organization)$/.test(t)).sort((a, b) => b[1] - a[1]).map(([t, n]) => `${t} ${n}`).join(", ")}`);
P("\n| structured rung | snips in S1 | asks | gold-bearing |\n|---|---|---|---|"); S.structuredRungs = {}; for (const [k, v] of Object.entries(rungAsk).sort((a, b) => b[1].asks.size - a[1].asks.size)) { S.structuredRungs[k] = { shown: v.shown, asks: v.asks.size, gold: v.gold }; P(`| ${k} | ${v.shown} | ${v.asks.size} | ${v.gold} |`); }
// failure clusters
P("\n## failure clusters\n"); const BOIL = /(cookie|subscribe|sign up|sign in|privacy policy|javascript|outdated browser|enable cookies|advertis|all rights reserved|©|skip to (main )?content|client challenge|just a moment|access denied|log in|newsletter)/i;
const fc = { readFail: 0, readAttempts: 0, byStatus: {}, hostFail: {}, boilerplateSnips: 0, snipsShown: 0, boilerplateAsks: new Set(), whole: 0, tinyPages: 0 };
for (const r of rows) { const o = out(r.id); for (const rd of o.reads || []) { fc.readAttempts++; if (!rd.ok) { fc.readFail++; const st = (rd.statuses || []).join("/") || "none"; fc.byStatus[st] = (fc.byStatus[st] || 0) + 1; const h = (() => { try { return new URL(rd.url).hostname.replace(/^www\./, ""); } catch { return "?"; } })(); fc.hostFail[h] = (fc.hostFail[h] || 0) + 1; } else if (rd.chars < 600) fc.tinyPages++; }
  if (!o.gap) for (const s of o.strands.S1) { fc.snipsShown++; if (BOIL.test(s.text)) { fc.boilerplateSnips++; fc.boilerplateAsks.add(r.id); } } }
S.failure = { readAttempts: fc.readAttempts, readFail: wilson(fc.readFail, fc.readAttempts), byStatus: fc.byStatus, topFailHosts: Object.entries(fc.hostFail).sort((a, b) => b[1] - a[1]).slice(0, 12), boilerplateSnips: wilson(fc.boilerplateSnips, fc.snipsShown), boilerplateAsks: fc.boilerplateAsks.size, tinyPages: fc.tinyPages };
P(`page reads: ${fc.readFail}/${fc.readAttempts} failed (${pct(S.failure.readFail)}); by status ${JSON.stringify(fc.byStatus)}; hosts failing most: ${S.failure.topFailHosts.map(([h, n]) => h + " " + n).join(", ")}`); P(`boilerplate-pattern snips among shown snips: ${pct(S.failure.boilerplateSnips)} across ${fc.boilerplateAsks.size} asks; pages that read OK but < 600 chars: ${fc.tinyPages}`);
// latency
{ const sn = rows.filter((r) => r.netMs != null); const f = (k) => sn.map((r) => r[k]).filter((x) => x != null);
  S.latency = { askCount: sn.length, netMs: { median: med(f("netMs")), p90: q(f("netMs"), 0.9) }, searchMs: { median: med(f("netSearchMs")), p90: q(f("netSearchMs"), 0.9) }, readMs: { median: med(f("readNetMs")), p90: q(f("readNetMs"), 0.9) }, snipMs: { median: med(f("snipMs")), p90: q(f("snipMs"), 0.9) } };
  P(`\n## latency of snip mode (no model; network time = the original live latencies recorded in the cache, summed per ask; excludes the harness's 1.1 s politeness gaps and the 5 s retry sleep)\n\nnetwork per ask: median ${S.latency.netMs.median} ms, p90 ${S.latency.netMs.p90}; of which search median ${S.latency.searchMs.median}, page reads median ${S.latency.readMs.median}; snipping compute median ${S.latency.snipMs.median} ms (p90 ${S.latency.snipMs.p90}).`); }
// ── additional cuts ──
P("\n## all 221 asks by final label\n"); { const c = {}; for (const r of rows) c[r.final.sat] = (c[r.final.sat] || 0) + 1; S.finalLabels = c; P(JSON.stringify(c)); }
{ const wc = rows.filter((r) => /WRONG-CONTENT/.test(r.final.why || "")).map((r) => r.id), wb = rows.filter((r) => /WOULD-BE-DANGEROUS/.test(r.final.why || "")).map((r) => r.id); S.wrongContent = wc; S.wouldBeDangerous = wb; P(`\nconfident wrong snips shown on asks (my reading, WRONG-CONTENT tag): ${wc.join(", ") || "none"}; asks where the UNGATED strand would have been dangerous (WOULD-BE-DANGEROUS): ${wb.join(", ")}`); }
// Q&A / FAQ union, per class
{ const q = {}; for (const r of ans) { const o = out(r.id); const hit = o.strands.S1.filter((s) => (r.held.snips || []).includes(s.id)).some((s) => /^a\.(faq|qa)$/.test(s.rung)); if (hit) q[r.class] = (q[r.class] || 0) + 1; } S.qaGold = q; P(`\nasks whose gold-bearing snip is a declared Q&A pair (FAQPage or QAPage/Question; the same pair is often declared twice): ${Object.values(q).reduce((a, b) => a + b, 0)} -> ${JSON.stringify(q)}`);
  const lead = {}; for (const r of ans) { const o = out(r.id); const hit = o.strands.S1.filter((s) => (r.held.snips || []).includes(s.id)).some((s) => s.rung === "b"); if (hit) lead[r.class] = (lead[r.class] || 0) + 1; } S.leadGold = lead; P(`asks whose gold-bearing snip is a Wikipedia lead (rung b): ${Object.values(lead).reduce((a, b) => a + b, 0)} -> ${JSON.stringify(lead)}`);
  const firstOnly = {}; for (const r of ans) { const o = out(r.id); const rs = new Set(o.strands.S1.filter((s) => (r.held.snips || []).includes(s.id)).map((s) => s.rung)); if (!rs.size) continue; const only = rs.size === 1 ? [...rs][0] : "multiple"; firstOnly[only] = (firstOnly[only] || 0) + 1; } S.goldRungOnly = firstOnly; P(`gold-bearing rung(s) per answered ask: ${JSON.stringify(firstOnly)}`); }
// transports
{ const t = {}; const eng = {}; const readT = {}; let readN = 0, readOk = 0;
  for (const r of rows) { const o = out(r.id); t[o.search.transport] = (t[o.search.transport] || 0) + 1; for (const x of o.search.fallback || []) { const k = `${x.engine}/${x.transport}`; eng[k] ||= { tried: 0, ok: 0, why: {} }; eng[k].tried++; if (x.n) eng[k].ok++; else eng[k].why[x.why || "?"] = (eng[k].why[x.why || "?"] || 0) + 1; }
    for (const rd of o.reads || []) { readN++; const k = (rd.transports || []).join("+") || "none"; readT[k] = readT[k] || { n: 0, ok: 0 }; readT[k].n++; if (rd.ok) { readT[k].ok++; readOk++; } } }
  S.transports = { finalSearch: t, engineFallbacks: eng, reads: readT }; P("\n## transports (what each number was measured on)\n"); P(`final search transport per ask: ${JSON.stringify(t)} (relay = node fetch to the Cloudflare relay; engine:* = a browser-engine search after two relay failures)`); P(`browser-engine fallback attempts: ${JSON.stringify(eng)}`); P(`page reads by transport set (n/ok): ${JSON.stringify(readT)}`);
  const pr = path.join(here, "relay-probe.json"); if (fs.existsSync(pr)) { const x = JSON.parse(fs.readFileSync(pr, "utf8")); S.relayProbe = x; P(`relay single-attempt probe on 30 fresh queries, node transport: ${x.ok}/${x.n} ok, statuses ${JSON.stringify(x.byStatus)}`); } }
// by language
{ P("\n## by language (all non-English + English asks, answer-expected)\n"); P("| lang | n | gold held | G3-gapped | satisfied | median shown chars |\n|---|---|---|---|---|---|"); S.byLang = {}; for (const l of [...new Set(ans.map((r) => r.lang))]) { const a = ans.filter((r) => r.lang === l); S.byLang[l] = { n: a.length, held: a.filter((r) => r.held.answered).length, g3: a.filter((r) => r.gap === "off-topic").length, sat: a.filter(NOMODEL).length }; P(`| ${l} | ${a.length} | ${S.byLang[l].held} | ${S.byLang[l].g3} | ${S.byLang[l].sat} | ${med(a.map((r) => r.chars).filter((x) => x))} |`); } }
// sentence splitter on unspaced / right-to-left scripts: lengths of the prose segments by language
{ const L = {}; for (const r of rows) { if (!["zh", "ja", "ar", "hi", "ru", "en"].includes(r.lang)) continue; const o = out(r.id); for (const s of o.strands.S1) if (s.kind === "prose") for (const g of s.segments) { (L[r.lang] ||= []).push(g.text.length); } } S.segLen = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, { n: v.length, median: med(v), p90: q(v, 0.9), max: Math.max(...v) }])); P(`\nprose segment length (chars) in shown strands by script: ${JSON.stringify(S.segLen)}`); }
fs.writeFileSync(path.join(here, "stats.json"), JSON.stringify(S, null, 1)); fs.writeFileSync(path.join(here, "analysis.md"), lines.join("\n") + "\n");
console.log(lines.join("\n"));
