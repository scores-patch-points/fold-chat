// eval/swarm/rescore-junk.mjs — re-run the no-model snip ladder over the CACHED swarm pages, OLD (eval/swarm/lib.mjs `snip`,
// unchanged) vs NEW (wall check, content region, junk gate, joined-piece re-verification), and score against the bars frozen in
// docs/SNIP-JUNK-PREREG.md. NEVER fetches: pages come from eval/swarm/cache/ only.
//
//   node eval/swarm/rescore-junk.mjs            -> writes eval/swarm/rescore-junk.json and prints the before/after table
//   node eval/swarm/rescore-junk.mjs --tables   -> also adds rung t (table row + header) and k (code block); reported apart, not in the bars
//   node eval/swarm/rescore-junk.mjs --held     -> also scores the judge on the HELD third of the hand labels (do this last)
import fs from "node:fs";
import path from "node:path";
import * as H from "./lib.mjs";
import { loadSites } from "./sites.mjs";
import { judge } from "./junk-judge.mjs";
import { wallOf, gateSnips, junkOf, verifyJoined } from "../../fold-chat-junk.js";
import { regionOfHtml, visibleTextOfHtml, titleOfHtml, tableRowsOfHtml, codeBlocksOfHtml } from "../../fold-chat-region.js";
import { groupsOf } from "../../fold-chat-strand.js";
import { sentencesWithOffsets } from "../../fold-chat-impression.js";
import { segments, fold } from "../../fold-chat-mind.js";
import { FUNCTION_WORDS } from "../../fold-chat-function-words.js";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const FW = new Set(Object.values(FUNCTION_WORDS).flat().map(fold));
const terms = (ask) => [...new Set(segments(ask).map((t) => fold(t.text)).filter((w) => w.length > 2 && !FW.has(w)))];
// The harness check strips <...> from ALREADY-DECODED text, so one stray "<" (P < 0.05) followed far on by a ">" erases the page text
// between them and every piece after it "fails". `strictVerbatim` compares whitespace-squashed pieces with the decoded visible text.
const strictVerbatim = (text, html) => { const hay = squash(H.visibleText(html)).replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').toLowerCase(); const norm = (x) => squash(x).replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').toLowerCase(); return String(text).split(/\n|\u2026|\.\.\./).map((x) => norm(x).replace(/^(?:ingredients|steps|instructions|q|a|starts|where|price|phone|hours)\s*:\s*/i, "").replace(/^(?:\d+\.|-|\u2022)\s+/, "").trim()).filter((x) => x.length > 3).every((x) => hay.includes(x) || jsonHay(html).includes(x)); };
const jsonHayCache = new Map();
function jsonHay(html) { if (!jsonHayCache.has(html)) { const out = []; for (const m of String(html).matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { const walk = (n) => { if (Array.isArray(n)) n.forEach(walk); else if (n && typeof n === "object") Object.values(n).forEach(walk); else if (typeof n === "string") out.push(n); }; walk(JSON.parse(m[1].trim())); } catch {} } const metas = [...String(html).matchAll(/<meta[^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]+content=["']([^"']*)["']/gi)].map((m) => m[1]); jsonHayCache.set(html, [...out, ...metas].map((x) => squash(H.visibleText("<p>" + x + "</p>")).replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').toLowerCase()).join(" ")); } return jsonHayCache.get(html); }
const squash = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** The NEW ladder over one cached page. Returns { shown:[{rung,type,text,verbatim}], gap, wall, withheld:[{rung,reason}] }. */
export function newLadder(page, ask) {
  const html = page.html || "";
  if (!html) return { shown: [], gap: { gap: "unreadable", reason: "the page could not be fetched" }, wall: { blocked: false }, withheld: [] };
  const vis = visibleTextOfHtml(html), title = titleOfHtml(html);
  const wall = wallOf({ status: page.status, title, text: vis });
  if (wall.blocked) return { shown: [], gap: { gap: "blocked", reason: wall.reason }, wall, withheld: [] };
  const cands = [];
  for (const b of H.structured(html).slice(0, 3)) cands.push({ rung: "a", type: b.type, text: b.text, declared: true });   // at most 3 declared blocks, as SNIP_LIMITS.maxSnips
  const meta = (html.match(/<meta[^>]+(?:name|property)=["'](?:description|og:description|twitter:description)["'][^>]+content=["']([^"']*)["']/gi) || [])
    .map((m) => /content=["']([^"']*)["']/i.exec(m)[1]).map((x) => squash(H.visibleText("<p>" + x + "</p>"))).find((x) => x.length > 60);
  if (meta) cands.push({ rung: "b", type: "meta-description", text: meta });
  const region = regionOfHtml(html);
  const withheld = [];
  if (region.text.length >= 60 && region.text.length <= 200) cands.push({ rung: "c", type: "short-page", pieces: [squash(region.text)] });   // a short page: its own words, whole
  if (region.text.length > 200 && ask) {
    // c: the sentences that differ the ask, scored from the content region; each group is a separate verbatim piece
    const groups = groupsOf(region.text, ask, 900);
    const pieces = groups.map((g) => squash(region.text.slice(g.start, g.end))).filter((x) => x.length > 30);
    const keep = [];
    for (const p of pieces) { const j = junkOf(p); if (j.junk) withheld.push({ rung: "c", reason: j.reason }); else keep.push(p); }
    if (keep.length) cands.push({ rung: "c", type: "impression", pieces: keep });
    // d: lexical baseline over the same region: the best 3-sentence window by overlap with the ask
    const ts = terms(ask), sents = sentencesWithOffsets(region.text).filter((s) => s.text.length > 30 && s.text.length < 400);
    let best = null;
    for (let i = 0; i + 2 < sents.length; i++) { const w3 = sents.slice(i, i + 3); const f = fold(w3.map((x) => x.text).join(" ")); const sc = ts.filter((t) => f.includes(t)).length; if (!best || sc > best.sc) best = { sc, w3 }; }
    if (best && best.sc > 0) {
      const ps = best.w3.map((x) => x.text); const j = junkOf(ps.join(" "));
      if (j.junk) withheld.push({ rung: "d", reason: j.reason }); else cands.push({ rung: "d", type: "lexical-baseline", pieces: ps });
    }
  }
  // t / k: a table ROW (with its header row) or a CODE block the page holds, quoted verbatim when the ask's own words occur in it
  if (ask && process.argv.includes("--tables")) {   // OFF for the bars run: the frozen judge reads prose, and a row or a code block is not prose
    for (const r of tableRowsOfHtml(html, ask)) cands.push({ rung: "t", type: "table-row", pieces: [r.header, r.row], declared: true });
    for (const c of codeBlocksOfHtml(html, ask)) cands.push({ rung: "k", type: "code-block", pieces: [c.code], declared: true });
  }
  const shown = [], seen = [];
  for (const c of cands) {
    let text = c.text;
    if (c.pieces) {                                   // a STITCH: re-verify after joining; pieces not on the page are dropped; shown with ellipses
      const v = verifyJoined(c.pieces, vis);
      if (!v.pieces.length) { withheld.push({ rung: c.rung, reason: "not-verbatim" }); continue; }
      text = v.pieces.join(" … ");
    }
    const j = junkOf(text, { declared: !!c.declared || c.rung === "c" || c.rung === "d" ? !!c.declared : false });
    if (j.junk) { withheld.push({ rung: c.rung, reason: j.reason }); continue; }
    const key = squash(text).toLowerCase();
    if (seen.some((k) => k === key || k.includes(key) || key.includes(k))) continue;
    seen.push(key); shown.push({ rung: c.rung, type: c.type, text, verbatim: H.isVerbatim(text, html), strict: strictVerbatim(text, html) });
  }
  const gap = !shown.length ? { gap: withheld.length ? "junk" : "none", reason: withheld.length ? "everything this page offered was the site talking about itself" : "nothing on this page differs the ask" } : null;
  return { shown, gap, wall, withheld };
}

const share = (ask, texts) => { const ts = terms(ask); if (!ts.length) return 0; const f = fold(texts.join(" ")); return ts.filter((t) => f.includes(t)).length / ts.length; };

async function main() {
  const sites = loadSites();
  const rows = [];
  for (const s of sites) {
    const old = !s.page || !s.page.html ? { snips: [] } : await H.snip(s.page, s.ask);
    const oldSnips = []; const oseen = new Set(); for (const x of old.snips) if (!oseen.has(x.text)) { oseen.add(x.text); oldSnips.push(x); }
    const nw = s.page ? newLadder(s.page, s.ask) : { shown: [], gap: { gap: "unreadable" }, wall: { blocked: false }, withheld: [] };
    rows.push({
      id: s.id, type: s.type, ask: s.ask, reachable: !!(s.rec.fetchOk && !s.rec.blocked), knownWall: !!s.rec.blocked, status: s.page ? s.page.status : 0, recRelevance: s.rec.relevance,
      old: { n: oldSnips.length, junk: oldSnips.some((x) => judge(x.text).junk), verbatimAll: oldSnips.every((x) => x.verbatim), strictAll: s.page && s.page.html ? oldSnips.every((x) => strictVerbatim(x.text, s.page.html)) : true, share: share(s.ask, oldSnips.map((x) => x.text)), snips: oldSnips.map((x) => ({ rung: x.rung, text: x.text.slice(0, 200) })) },
      new: { n: nw.shown.length, junk: nw.shown.some((x) => judge(x.text).junk), verbatimAll: nw.shown.every((x) => x.verbatim), strictAll: nw.shown.every((x) => x.strict), share: share(s.ask, nw.shown.map((x) => x.text)), gap: nw.gap, wall: nw.wall.blocked ? nw.wall : null, withheld: nw.withheld, snips: nw.shown.map((x) => ({ rung: x.rung, type: x.type, verbatim: x.verbatim, strict: x.strict, text: x.text })) },
    });
  }
  fs.writeFileSync(path.join(DIR, "rescore-junk.json"), JSON.stringify(rows));
  report(rows);
  if (process.argv.includes("--held")) await heldCheck();
  process.exit(0);
}

const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + "%" : "n/a");
function report(rows) {
  const R = rows.filter((r) => r.reachable);
  const line = (name, f) => console.log(name.padEnd(46), f);
  const oj = R.filter((r) => r.old.junk).length, nj = R.filter((r) => r.new.junk).length;
  line("reachable sites", R.length);
  line("B1 junk shown (judge): old / new", `${oj} (${pct(oj, R.length)}) / ${nj} (${pct(nj, R.length)})`);
  const ov = R.filter((r) => r.old.verbatimAll).length, nv = R.filter((r) => r.new.verbatimAll).length;
  line("B2 all shown snips verbatim: old / new", `${ov}/${R.length} / ${nv}/${R.length}`);
  const allShown = rows.flatMap((r) => r.new.snips); line("B2 shown snips verbatim, harness (new)", `${allShown.filter((x) => x.verbatim).length}/${allShown.length}`);
  line("B2 strict check (no re-strip) sites old / new", `${R.filter((r) => r.old.strictAll).length}/${R.length} / ${R.filter((r) => r.new.strictAll).length}/${R.length}; new snips ${allShown.filter((x) => x.strict).length}/${allShown.length}`);
  const withSnip = (k) => R.filter((r) => r[k].n > 0).length;
  line("sites with >=1 snip shown: old / new", `${withSnip("old")} / ${withSnip("new")}`);
  line("proxy: ask-term share >= 0.5: old / new", `${R.filter((r) => r.old.share >= 0.5).length} / ${R.filter((r) => r.new.share >= 0.5).length}`);
  line("proxy: mean ask-term share: old / new", `${(R.reduce((a, r) => a + r.old.share, 0) / R.length).toFixed(3)} / ${(R.reduce((a, r) => a + r.new.share, 0) / R.length).toFixed(3)}`);
  const W = rows.filter((r) => r.knownWall);
  const det = W.filter((r) => r.new.wall).length, noSnip = W.filter((r) => r.new.n === 0).length;
  line("B5 known walls detected / no snip", `${det}/${W.length} (${(det / W.length).toFixed(3)}) / ${noSnip}/${W.length}`);
  line("B5 known walls missed", W.filter((r) => !r.new.wall).map((r) => r.id + (r.status ? "" : "(no page)")).join(" ") || "none");
  const FW_ = R.filter((r) => r.new.wall);
  line("B6 false walls on reachable", `${FW_.length}/${R.length} (${pct(FW_.length, R.length)}) ${FW_.map((r) => r.id + ":" + r.new.wall.kind).join(" ")}`);
  const byGap = {}; for (const r of R) if (r.new.gap) byGap[r.new.gap.gap] = (byGap[r.new.gap.gap] || 0) + 1; line("reachable typed gaps (new)", JSON.stringify(byGap));
  const NE = rows.filter((r) => r.type === "nonenglish" && r.reachable);
  line("B7 nonenglish junk old/new, snips old/new", `${NE.filter((r) => r.old.junk).length}/${NE.filter((r) => r.new.junk).length} of ${NE.length}, ${NE.filter((r) => r.old.n).length}/${NE.filter((r) => r.new.n).length}`);
  try {
    const hand = JSON.parse(fs.readFileSync(path.join(DIR, "relevance-hand.json"), "utf8")).ratings;
    const rated = R.filter((r) => hand[r.id] !== undefined);
    const ge1 = rated.filter((r) => hand[r.id] >= 1).length, two = rated.filter((r) => hand[r.id] === 2).length;
    const o1 = R.filter((r) => r.recRelevance >= 1).length, o2 = R.filter((r) => r.recRelevance === 2).length;
    line("B3 relevance>=1 (hand, new) vs recorded", `${ge1}/${rated.length} (${pct(ge1, rated.length)}) vs ${o1}/${R.length} (${pct(o1, R.length)})`);
    line("B4 answers (hand, new) vs recorded", `${two}/${rated.length} (${pct(two, rated.length)}) vs ${o2}/${R.length} (${pct(o2, R.length)})`);
    const ne = rated.filter((r) => r.type === "nonenglish");
    line("B7 nonenglish >=1 / answers: hand new vs recorded", `${ne.filter((r) => hand[r.id] >= 1).length}/${ne.length}, ${ne.filter((r) => hand[r.id] === 2).length}/${ne.length} vs ${ne.filter((r) => r.recRelevance >= 1).length}/${ne.length}, ${ne.filter((r) => r.recRelevance === 2).length}/${ne.length}`);
    const au = JSON.parse(fs.readFileSync(path.join(DIR, "junk-audit.json"), "utf8"));
    line("B1 hand audit: audit 1 / final (mixed counted)", `${au.audit1.junkSiteCount}/82 (${pct(au.audit1.junkSiteCount, 82)}) / ${au.final.junkSiteCount}/82 (${pct(au.final.junkSiteCount, 82)}), ${pct(au.final.junkSiteCount + au.final.mixedSiteCount, 82)}`);
  } catch (e) { line("hand ratings", "not found: " + e.message); }
  const wr = {}; for (const r of R) for (const w of r.new.withheld) wr[w.reason] = (wr[w.reason] || 0) + 1; line("withheld by reason (reachable)", JSON.stringify(wr));
}

async function heldCheck() {
  // The judge against the hand labels, per third. The held third was not used to choose any lexicon entry, rule or threshold.
  const { baselineSnips, sampleOf } = await import("./junk-sample.mjs");
  const labels = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(DIR, "junk-labels.json"), "utf8")).labels.map((l) => [l.key, l]));
  const sample = sampleOf(await baselineSnips(), loadSites());
  for (const split of ["dev", "test", "held"]) {
    let tp = 0, fp = 0, fn = 0, tn = 0;
    for (const r of sample) { const l = labels[r.lk]; if (!l || l.split !== split) continue; const j = judge(r.text).junk; if (j && l.junk) tp++; else if (j && !l.junk) fp++; else if (!j && l.junk) fn++; else tn++; }
    console.log(`judge vs hand labels, ${split}: tp ${tp} fp ${fp} fn ${fn} tn ${tn}  accuracy ${((tp + tn) / (tp + fp + fn + tn)).toFixed(3)}  junk recall ${(tp / ((tp + fn) || 1)).toFixed(3)}`);
  }
}

if (process.argv[1] && process.argv[1].endsWith("rescore-junk.mjs")) await main();
