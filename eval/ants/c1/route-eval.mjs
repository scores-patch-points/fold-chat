// C1 I2 / I3 / Fix-6 measurement. Pre-registered in ../C1-PREREG.md (written before any run).
//   node eval/ants/c1/route-eval.mjs corpus | five | fix6 [--only id,id]
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import * as BASE from "./origin-base.mjs"; import * as FIX from "./origin-fixed.mjs";
import { kindOf } from "../../../fold-chat-primary.js";
import { classifyPage } from "../primary-oracle.mjs";
import { cachedFetch, search, readPage, stats, closeBrowser, web } from "./io.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const corpus = JSON.parse(fs.readFileSync(path.join(HERE, "../primary-corpus.json"), "utf8"));
const [mode, ...rest] = process.argv.slice(2); const ONLY = rest.includes("--only") ? rest[rest.indexOf("--only") + 1].split(",") : null;
const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const stamp = (process.env.C1_TAG || "pre") + "-" + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

// the original gate with the route (what Fix 2 alone does): a generated copy of origin-fixed with minAtomsSlot = 3
const slot3 = path.join(HERE, "origin-fixed-slot3.mjs");
fs.writeFileSync(slot3, fs.readFileSync(path.join(HERE, "origin-fixed.mjs"), "utf8").replace("minAtomsSlot: 2,", "minAtomsSlot: 3,"));
const SLOT3 = await import("./origin-fixed-slot3.mjs");

const frames = {};
const frameOf = async (q) => (frames[q] ??= (await BASE.readFrame(q, { fetchImpl: cachedFetch })) || null);
const rankOf = (u) => kindOf(hostOf(u)).rank ?? 0;
const byRank = (hits) => hits.map((h, i) => ({ h, i })).sort((a, b) => rankOf(b.h.url) - rankOf(a.h.url) || a.i - b.i).map((x) => x.h);
const summarise = (r) => ({ origin: r.origin ? { url: r.origin.url, host: r.origin.host, sentence: r.origin.sentence, rung: r.origin.rung } : null, tried: r.tried.map((t) => `${t.read ? (t.verdict || "?") + (t.why ? "/" + t.why : "") : "UNREAD"} ${t.host}`) });

if (mode === "corpus") {
  const arms = ["today", "gate", "nogate", "min3", "rank"]; const rows = [];
  for (const c of corpus.claims) {
    if (ONLY && !ONLY.includes(c.id)) continue;
    const claim = c.claimLean; let hits = await search(c.question), q = c.question;
    if (!hits.length) { hits = await search(claim); q = claim; }
    const reading = await frameOf(c.question), forWhom = c.question;
    const opts = { read: readPage, fetchImpl: cachedFetch, forWhom, reading };
    const row = { id: c.id, claim, query: q, hits: hits.map((h) => h.url), framed: !!reading, arms: {} };
    // today: the original module, the pages the turn already read (the first 3 non-encyclopedia hits) as `alongside`, no gate beyond wikipedia
    const three = []; for (const h of hits.filter((h) => !BASE.isTertiary(h.url))) { if (three.length >= 3) break; const rd = await readPage(h.url); if (rd.ok) three.push({ url: rd.url || h.url, title: rd.title, text: rd.text }); }
    const t0 = Date.now(); const td = BASE.corroboration(claim, three, { forWhom, reading }); row.arms.today = { ms: Date.now() - t0, origin: td ? { url: td.url, host: td.host, sentence: td.sentence, rung: td.rung } : null, tried: three.map((p) => hostOf(p.url)), page: td ? td.passage : null };
    for (const [name, fn] of [["gate", () => FIX.corroborateAnswer(claim, hits, opts)], ["nogate", () => FIX.corroborateAnswer(claim, hits, { ...opts, admit: (u) => !FIX.tertiaryOf(u) })], ["min3", () => SLOT3.corroborateAnswer(claim, hits, opts)], ["rank", () => FIX.corroborateAnswer(claim, byRank(hits), opts)]]) {
      const t1 = Date.now(); const r = await fn(); row.arms[name] = { ms: Date.now() - t1, ...summarise(r), page: r.origin ? r.origin.passage : null };
    }
    for (const a of arms) { const o = row.arms[a].origin; row.arms[a].cls = o ? classifyPage({ url: o.url, text: row.arms[a].page.text }, c, corpus) : null; delete row.arms[a].page; }
    rows.push(row);
    console.log(c.id.padEnd(20), arms.map((a) => a + ":" + (row.arms[a].origin ? row.arms[a].cls.cls + "@" + row.arms[a].origin.host : "-")).join("  "), row.framed ? "" : "(no frame)");
  }
  const tot = {};
  for (const a of arms) { const rs = rows.map((r) => r.arms[a]); tot[a] = { origins: rs.filter((x) => x.origin).length, reach: rs.filter((x) => x.cls?.cls === "reach").length, forbidden: rs.filter((x) => x.cls?.cls === "forbidden").length, wrongFA: rs.filter((x) => ["host_ok_text_fails", "unlisted_fails_text"].includes(x.cls?.cls)).length, unlistedPass: rs.filter((x) => x.cls?.cls === "unlisted_passes_text").length, claims: rows.length }; }
  console.log(JSON.stringify(tot, null, 1));
  fs.writeFileSync(path.join(HERE, `corpus-run-${stamp}.json`), JSON.stringify({ at: new Date().toISOString(), totals: tot, stats, rows }, null, 1));
}

if (mode === "five") {
  const ASK = [
    { ask: "Who is the king of the UK?", claim: "King Charles III is the king of the UK.", primary: /(^|\.)(royal\.uk|gov\.uk|parliament\.uk|bbc\.com|bbc\.co\.uk|reuters\.com|apnews\.com)$/i },
    { ask: "How tall is the Eiffel Tower?", claim: "The Eiffel Tower is 330 meters (1,083 ft) tall.", primary: /(^|\.)(toureiffel\.paris|reuters\.com|apnews\.com|bbc\.com|bbc\.co\.uk)$/i },
    { ask: "What is the capital of Australia?", claim: "Canberra is the capital of Australia.", primary: /(\.gov\.au|canberra\.com\.au|visitcanberra\.com\.au)$/i },
    { ask: "How many legs does a spider have?", claim: "A spider has eight legs.", primary: /(\.edu|\.gov|si\.edu|nature\.com|amnh\.org|nationalgeographic\.com)$/i },
    { ask: "When did Marie Curie die?", claim: "Marie Curie died on 4 July 1934.", primary: /(^|\.)(nobelprize\.org|curie\.fr|aip\.org|nih\.gov)$|\.edu$/i },
  ];
  const run3 = JSON.parse(fs.readFileSync(path.join(HERE, "../a1/browser3-run.json"), "utf8")), sim = JSON.parse(fs.readFileSync(path.join(HERE, "../a1/search-fix-sim.json"), "utf8"));
  const rows = [];
  for (const A of ASK) {
    const call = run3.find((r) => r.ask === A.ask).a1.calls[0], hits = sim.find((r) => r.ask === A.ask).rows.map((r) => ({ url: r.url, title: "" }));
    const reading = await frameOf(A.ask); const memoOf = () => web.makeMemo();
    const wikiPass = call.passages.filter((p) => BASE.isTertiary(p.url)), alongside = call.passages.filter((p) => !BASE.isTertiary(p.url) && !p.snippetOnly && p.text).map((p) => ({ url: p.url, title: p.title, text: p.text }));
    const claims = call.trails.map((t) => ({ url: t.url, claim: t.claim, was: t.trail.status }));
    const arm = async (M, { withHits, answer }) => {
      const out = []; let first = null;
      for (const c of claims) {
        const p = wikiPass.find((x) => x.url === c.url); if (!p) continue;
        const t = await M.followClaim({ sentence: c.claim, passage: { url: p.url, title: p.title, ref: p.ref, text: p.text }, fetchImpl: cachedFetch, memo: memoOf(), read: readPage, alongside, forWhom: A.ask, reading, ...(withHits ? { hits, answerClaim: A.claim } : {}) });
        out.push(t.status + (t.status === "origin" ? "@" + t.origin.host : "")); if (t.status === "origin" && !first) first = t;
        if (withHits && first && answer) break;
      }
      return { statuses: out, origin: first && first.origin ? { url: first.origin.url, host: first.origin.host, sentence: first.origin.sentence, via: first.path.some((h) => h.kind === "alongside") ? "alongside/search" : "footnote", rung: first.origin.rung } : null };
    };
    const row = { ask: A.ask, claim: A.claim, hits: hits.length, claims: claims.length, arms: {
      L0: await arm(BASE, {}), L1: await arm(FIX, {}), L2: await arm(SLOT3, { withHits: true }), L3: await arm(FIX, { withHits: true }),
    } };
    // route alone, on the answer claim, no footnote walk (the route as the diff exposes it): gate vs nogate, for the listing
    const r = await FIX.corroborateAnswer(A.claim, hits, { read: readPage, fetchImpl: cachedFetch, forWhom: A.ask, reading }); row.route = summarise(r);
    for (const k of Object.keys(row.arms)) { const o = row.arms[k].origin; if (o) o.primary = A.primary.test(o.host); }
    rows.push(row);
    console.log(A.ask.padEnd(34), Object.entries(row.arms).map(([k, v]) => k + ":" + (v.origin ? (v.origin.primary ? "PRIMARY " : "unlisted ") + v.origin.host : "-")).join("  "));
  }
  const tot = {}; for (const k of ["L0", "L1", "L2", "L3"]) tot[k] = { origins: rows.filter((r) => r.arms[k].origin).length, primary: rows.filter((r) => r.arms[k].origin && r.arms[k].origin.primary).length };
  console.log(JSON.stringify(tot));
  fs.writeFileSync(path.join(HERE, `five-run-${stamp}.json`), JSON.stringify({ at: new Date().toISOString(), totals: tot, stats, rows }, null, 1));
}

if (mode === "fix6") {
  const run3 = JSON.parse(fs.readFileSync(path.join(HERE, "../a1/browser3-run.json"), "utf8")); const { splitSentences } = await import("../../../fold-chat-ground.js");
  const urls = [...new Set(run3.flatMap((r) => r.a1.calls[0].passages.filter((p) => BASE.isTertiary(p.url)).map((p) => p.url))), "https://en.wikipedia.org/wiki/Eiffel_Tower", "https://en.wikipedia.org/wiki/Canberra", "https://en.wikipedia.org/wiki/Spider", "https://en.wikipedia.org/wiki/Charles_III"];
  const res = [];
  for (const u of [...new Set(urls)]) {
    const idx = await BASE.wikiIndex(u, { fetchImpl: cachedFetch }); if (!idx) { res.push({ url: u, indexed: false }); continue; }
    // every sentence of the article's own prose (plain text of the blocks, pronunciations and all) AND the plain-text extract form (pronunciation brackets removed as the extract has them)
    const sents = new Set(); for (const b of idx.blocks) for (const s of splitSentences(b.text)) if (s.trim().split(/\s+/).length >= 5) sents.add(s);
    const extractForm = (s) => s.replace(/\/[^\/\n]{1,80}\/\s*ⓘ?/g, "").replace(/\s*ⓘ\s*/g, " ");
    let located0 = 0, located1 = 0, moved = 0, lost = 0, gained = 0, gainedExtract = 0, lostExtract = 0, n = 0;
    const pick = [...sents].filter((s, i) => i % Math.max(1, Math.ceil(sents.size / 120)) === 0 || /EYE|ⓘ|\[[^\]]*[ˈəɪʁɛ][^\]]*\]/.test(s)); const nAll = sents.size;
    for (const s of pick) {
      n++; const a = BASE.noteMarksFor(idx.blocks, s), b = FIX.noteMarksFor(idx.blocks, s);
      if (a) located0++; if (b) located1++; if (a && !b) lost++; if (!a && b) gained++;
      if (a && b && JSON.stringify(a) !== JSON.stringify(b)) moved++;
      const e = extractForm(s); if (e !== s) { const a2 = BASE.noteMarksFor(idx.blocks, e), b2 = FIX.noteMarksFor(idx.blocks, e); if (!a2 && b2) gainedExtract++; if (a2 && !b2) lostExtract++; }
    }
    res.push({ url: u, indexed: true, sentencesInArticle: nAll, sentencesChecked: n, located_before: located0, located_after: located1, lost, moved, gained, extractForm_gained: gainedExtract, extractForm_lost: lostExtract });
    console.log(u.slice(-40).padEnd(42), JSON.stringify(res[res.length - 1]));
  }
  // the Eiffel lead exactly as the chat quoted it (plain-text extract) in the live run
  const idx = await BASE.wikiIndex("https://en.wikipedia.org/wiki/Eiffel_Tower", { fetchImpl: cachedFetch });
  const lead = "The Eiffel Tower ( EYE-fəl; French: Tour Eiffel [tuʁ ɛfɛl] ) is a lattice tower on the Champ de Mars in Paris, France.";
  const out = { eiffelLead: { before: BASE.noteMarksFor(idx.blocks, lead) !== null, after: FIX.noteMarksFor(idx.blocks, lead) !== null }, res };
  console.log(JSON.stringify(out.eiffelLead)); fs.writeFileSync(path.join(HERE, `fix6-run-${stamp}.json`), JSON.stringify(out, null, 1));
}
await closeBrowser(); process.exit(0);
