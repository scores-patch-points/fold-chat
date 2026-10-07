// A1: the CEILING of "follow the article's footnotes": for each ask, EVERY cited sentence of the article (full parse HTML) that states the fact (atoms regex), the footnotes under it,
// each footnote page read (Node direct+chain as the chat's readText), and supportOf(claim, page) for the claim the chat spoke. Not the lane's own selection: an oracle over the whole article.
import fs from "node:fs"; import { createHash } from "node:crypto";
import * as web from "../../../fold-chat-web.js";
import * as O from "../../../fold-chat-origin.js";
const CACHE = new URL("./cache/", import.meta.url); fs.mkdirSync(CACHE, { recursive: true });
const realFetch = globalThis.fetch;
globalThis.fetch = async (u, o) => { const s = String(u); if (!/wikipedia\.org\/w\/api\.php/.test(s)) return realFetch(u, o); const f = new URL(createHash("sha1").update(s).digest("hex") + ".json", CACHE); if (fs.existsSync(f)) return new Response(fs.readFileSync(f, "utf8"), { status: 200 });
  for (let i = 0; i < 6; i++) { const r = await realFetch(u, o); if (r.status !== 429) { const b = await r.text(); if (r.ok) fs.writeFileSync(f, b); return new Response(b, { status: r.status }); } await new Promise((z) => setTimeout(z, (Number(r.headers.get("retry-after")) || 10) * 1000 + 500)); } return realFetch(u, o); };
const CASES = [
  { ask: "king", pages: ["Monarchy_of_the_United_Kingdom", "Charles_III"], claim: "The monarch since 8 September 2022 is King Charles III, who ascended the throne on the death of his mother, Queen Elizabeth II.", spoken: "King Charles III is the king of the UK.", atoms: [/Charles III/, /\b2022\b|reign|monarch|king/i] },
  { ask: "eiffel", pages: ["Eiffel_Tower"], claim: "The tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris.", spoken: "The Eiffel Tower is 330 meters (1,083 feet) tall.", atoms: [/\b330\b|1,083|\b324\b|\b300 m/, /metre|meter|\bm\b|\bft\b|feet/i] },
  { ask: "australia", pages: ["List_of_Australian_capital_cities", "Canberra", "Australian_Capital_Territory"], claim: "One of these, Canberra, is also the national capital.", spoken: "Canberra is the capital of Australia.", atoms: [/Canberra/, /capital/i] },
  { ask: "spider", pages: ["Spider_anatomy", "Spider"], claim: "Spiders typically have eight walking legs (insects have six).", spoken: "Spiders typically have eight walking legs.", atoms: [/\beight\b|\b8\b|four pairs/i, /\blegs?\b/i] },
  { ask: "curie", pages: ["Marie_Curie"], claim: "Marie Curie died on 4 July 1934.", spoken: "Marie Curie died on 4 July 1934.", atoms: [/4 July 1934|July 4, 1934/, /./] },
];
const out = [];
for (const C of CASES) {
  for (const pg of C.pages) {
    const url = `https://en.wikipedia.org/wiki/${pg}`;
    const idx = await O.wikiIndex(url, { fetchImpl: fetch });
    if (!idx) { out.push({ ask: C.ask, page: pg, error: "unindexed" }); continue; }
    const cited = [];
    for (const b of idx.blocks) {
      const sents = b.text.split(/(?<=[.!?])\s+(?=[A-Z0-9"“(])/);
      let from = 0;
      for (const s of sents) {
        const at = b.text.indexOf(s, from); from = at + s.length;
        if (!C.atoms.every((r) => r.test(s))) continue;
        const marks = b.marks.filter((m) => m.at > at && m.at <= at + s.length + 1);
        cited.push({ sentence: s.slice(0, 200), marks: marks.map((m) => m.n), refs: marks.map((m) => idx.notes.get(m.id)).filter(Boolean).map((n) => ({ n: n.n, url: n.url, archived: n.archived, host: n.host, text: n.text.slice(0, 90) })) });
      }
    }
    const withMarks = cited.filter((c) => c.refs.length), withUrl = cited.filter((c) => c.refs.some((r) => r.url || r.archived));
    const rec = { ask: C.ask, page: pg, blocks: idx.blocks.length, notes: idx.notes.size, sentencesWithAtoms: cited.length, citedSentences: withMarks.length, citedWithUrl: withUrl.length, reads: [] };
    const seen = new Set();
    for (const c of withUrl.slice(0, 12)) for (const r of c.refs) {
      const u = r.url || r.archived; if (!u || seen.has(u)) continue; seen.add(u); if (seen.size > 14) break;
      const x = await web.readText(u, { fetchImpl: fetch, memo: web.makeMemo(), timeoutMs: 6000 });
      const e = { n: r.n, url: u, host: r.host, underSentence: c.sentence.slice(0, 110), ok: x.ok, via: x.via, err: x.error, len: (x.text || "").length };
      if (x.ok) for (const [lab, cl] of [["claim", C.claim], ["spoken", C.spoken], ["underSentence", c.sentence]]) { const s = O.supportOf(cl, { url: u, title: x.title, text: x.text }, { forWhom: C.spoken }); e["v_" + lab] = s.verdict + (s.why ? "/" + s.why : ""); if (lab === "spoken" || lab === "claim") e["s_" + lab] = (s.sentence || "").slice(0, 120); }
      rec.reads.push(e);
    }
    rec.sample = cited.slice(0, 6);
    out.push(rec);
    console.log(C.ask, pg, "sentences", cited.length, "cited", withMarks.length, "withUrl", withUrl.length, "reads", rec.reads.length, "ok", rec.reads.filter((r) => r.ok).length, "same(any)", rec.reads.filter((r) => /^same/.test(r.v_spoken) || /^same/.test(r.v_claim) || /^same/.test(r.v_underSentence)).length);
  }
}
fs.writeFileSync(new URL("./ceiling.json", import.meta.url), JSON.stringify(out, null, 1));
