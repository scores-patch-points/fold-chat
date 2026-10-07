// A1: the origin lane, offline in Node with REAL fetches. For each ask: the Wikipedia passage the chat would read, then originatePassages (public path) and a
// stage-by-stage probe (index -> locate -> refs -> read each -> supportOf for ALL refs, not just the first 3).
import fs from "node:fs"; import { createHash } from "node:crypto";
import * as web from "../../../fold-chat-web.js";
import * as O from "../../../fold-chat-origin.js";
import { originatePassages } from "../../../fold-chat-originwire.js";
import { snipsOf } from "../../../fold-chat-strand.js";
import { splitSentences } from "../../../fold-chat-ground.js";
const ASKS = [["Who is the king of the UK?", "https://en.wikipedia.org/wiki/Monarchy_of_the_United_Kingdom"], ["How tall is the Eiffel Tower?", "https://en.wikipedia.org/wiki/Eiffel_Tower"], ["What is the capital of Australia?", "https://en.wikipedia.org/wiki/List_of_Australian_capital_cities"], ["How many legs does a spider have?", "https://en.wikipedia.org/wiki/Spider_anatomy"], ["When did Marie Curie die?", "https://en.wikipedia.org/wiki/Marie_Curie"]];   // the pages the REAL browser run quoted (browser-run.json)
const CACHE = new URL("./cache/", import.meta.url); fs.mkdirSync(CACHE, { recursive: true });
let n429 = 0;
// Wikipedia API answers are cached on disk and a 429 is retried after its retry-after (the swarm shares one IP); everything else is a plain real fetch.
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => {
  const s = String(u);
  if (!/wikipedia\.org\/w\/api\.php/.test(s)) return realFetch(u, o);
  const key = createHash("sha1").update(s).digest("hex") + ".json"; const f = new URL(key, CACHE);
  if (fs.existsSync(f)) return new Response(fs.readFileSync(f, "utf8"), { status: 200 });
  for (let i = 0; i < 6; i++) { const r = await realFetch(u, o); if (r.status !== 429) { const b = await r.text(); if (r.ok) fs.writeFileSync(f, b); return new Response(b, { status: r.status }); } n429++; await new Promise((z) => setTimeout(z, (Number(r.headers.get("retry-after")) || 10) * 1000 + 500)); }
  return realFetch(u, o);
};
const only = process.argv[2];
const log = [];
const logFetch = async (u, o) => { const t = Date.now(); try { const r = await fetch(u, o); log.push({ u: String(u).slice(0, 200), status: r.status, ms: Date.now() - t }); return r; } catch (e) { log.push({ u: String(u).slice(0, 200), err: String(e.cause?.code || e.message), ms: Date.now() - t }); throw e; } };
const res = [];
for (const [q, wurl] of ASKS) {
  if (only && !q.includes(only)) continue;
  const memo = web.makeMemo();
  // what the chat's own search returns for the encyclopedia scope
  let hits = []; try { hits = (await web.search("wikipedia", q, 0, { fetchImpl: fetch })).results; } catch (e) { hits = [{ err: String(e) }]; }
  const url = wurl;
  const rd = await web.readText(url, { fetchImpl: fetch, memo });
  const passage = { ref: `${rd.title}`, title: rd.title, url, source: url, text: rd.text };
  const claims = []; try { const sn = snipsOf([passage], q).snips; for (const s of sn) for (const x of splitSentences(String(s.text))) if (x.trim().split(/\s+/).length >= 5 && claims.length < 3) claims.push(x); } catch (e) { claims.push("ERR " + e.message); }
  log.length = 0;
  const idx = await O.wikiIndex(url, { fetchImpl: fetch, memo });
  const stage = { ask: q, hits: hits.slice(0, 3).map((h) => h.url), url, readOk: rd.ok, textLen: (rd.text || "").length, claims, index: idx ? { title: idx.title, blocks: idx.blocks.length, notes: idx.notes.size, withUrl: [...idx.notes.values()].filter((n) => n.url).length, hosts: [...new Set([...idx.notes.values()].map((n) => n.host).filter(Boolean))].length } : null, perClaim: [] };
  for (const c of claims) {
    const pc = { claim: c };
    if (!idx) { pc.stop = "unindexed"; stage.perClaim.push(pc); continue; }
    const marks = O.noteMarksFor(idx.blocks, c);
    pc.located = marks !== null; pc.marks = marks ? marks.map((m) => m.n) : null;
    let refs = [];
    if (marks) { const seen = new Set(); for (const mk of marks) { const n = idx.notes.get(mk.id); if (n && !seen.has(n.url || n.id)) { seen.add(n.url || n.id); refs.push({ ...n, claim: mk.claim }); } } }
    pc.refsUnderSentence = refs.map((r) => ({ n: r.n, host: r.host, url: r.url, archived: r.archived, label: r.label?.slice(0, 60) }));
    if (marks && !refs.some((r) => r.url || r.archived)) {
      const b = O.bodyMarksFor(idx.blocks, c);
      pc.bodyFallback = b ? { sentence: b.sentence.slice(0, 160), share: +b.share.toFixed(2), n: b.marks.map((m) => m.n) } : null;
      if (b) { const seen = new Set(); refs = []; for (const mk of b.marks) { const n = idx.notes.get(mk.id); if (n && !seen.has(n.url || n.id)) { seen.add(n.url || n.id); refs.push({ ...n, claim: "" }); } } pc.refsViaBody = refs.map((r) => ({ n: r.n, host: r.host, url: r.url })); }
    }
    pc.reads = [];
    for (const r of refs) {
      const rec = { n: r.n, host: r.host, url: r.url, archived: r.archived };
      if (!r.url && !r.archived) { rec.skip = "no page (book/print)"; pc.reads.push(rec); continue; }
      const t = Date.now();
      const x = await web.readText(r.url || r.archived, { fetchImpl: fetch, memo: web.makeMemo(), timeoutMs: 6000 });
      rec.ms = Date.now() - t; rec.ok = x.ok; rec.via = x.via; rec.err = x.error; rec.len = (x.text || "").length;
      if (!x.ok && r.archived && r.url) { const y = await web.readText(r.archived, { fetchImpl: fetch, memo: web.makeMemo(), timeoutMs: 6000 }); rec.archivedOk = y.ok; rec.archivedVia = y.via; if (y.ok) { x.text = y.text; x.title = y.title; x.ok = true; } }
      if (x.ok) {
        const claim = r.claim && r.claim.length >= 12 ? r.claim : c;
        const s = O.supportOf(claim, { url: r.url, title: x.title, text: x.text }, { forWhom: q });
        rec.verdict = s.verdict; rec.why = s.why; rec.detail = (s.detail || "").slice(0, 100); rec.supportClaimUsed = claim.slice(0, 120); rec.pageSentence = (s.sentence || "").slice(0, 140);
        const s2 = O.supportOf(c, { url: r.url, title: x.title, text: x.text }, { forWhom: q });
        rec.verdictFullSentence = s2.verdict + (s2.why ? "/" + s2.why : "");
      }
      pc.reads.push(rec);
    }
    stage.perClaim.push(pc);
  }
  // the public path
  const passages = [{ ...passage }];
  const t0 = Date.now();
  const { trails } = await originatePassages(passages, q, { fetchImpl: logFetch, memo: web.makeMemo() });
  stage.public = { ms: Date.now() - t0, trails: trails.map((t) => ({ claim: t.claim.slice(0, 100), status: t.trail.status, refs: t.trail.refs.length, tried: t.trail.tried.map((x) => ({ n: x.n, host: (x.url || "").replace(/^https?:\/\/(www\.)?/, "").split("/")[0], read: x.read, verdict: x.verdict, why: x.why?.slice(0, 80) })) })) , appended: passages.length - 1 };
  res.push(stage);
  console.log(q, JSON.stringify(stage.public.trails.map((t) => t.status)), "429s so far", n429);
}
fs.writeFileSync(new URL(only ? "./node-chain-" + only.replace(/\W+/g, "_") + ".json" : "./node-chain.json", import.meta.url), JSON.stringify(res, null, 1));
