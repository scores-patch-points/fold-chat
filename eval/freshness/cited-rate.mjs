// eval/freshness/cited-rate.mjs — how often does a claim carry the bytes it was cited for, and does the freshness check read them right?
// Replays the REAL gemma2:2b drafts recorded in eval/pivot/live-results.json (sourced rows) over the REAL pages in eval/pivot/data/pages.json
// through the chat's own path — pivotText → ground.turnRecord → claimsOfTurn — with no model call and no browser. Then asks three questions:
//   Q1  of the `said` claims that have a support address, how many carry basis.cited?            (the rate the record session flagged unmeasured)
//   Q2  where cited is present, does it EQUAL the page's bytes at the support address?            (is it well-formed, or only present)
//   Q3  freshnessOf against (a) the same page, (b) the page with a paragraph added above, (c) the page rewritten: exact / shifted / gone.
//   node eval/freshness/cited-rate.mjs        → eval/freshness/cited-rate-results.json + a table
// Limits, stated: one small model, 8 Wikipedia intros, 16 asks (two per page); a rate on this set is not a rate on the web. Nothing here is
// judged for truth. The edit in (b) and the rewrite in (c) are constructed, so Q3 tests the chain, not how often real pages change.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pivotText } from "../../fold-chat-pivot.js";
import * as ground from "../../fold-chat-ground.js";
import { claimsOfTurn } from "../../fold-chat-record.js";
import { freshnessOf } from "../../fold-chat-freshness.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const live = JSON.parse(fs.readFileSync(path.join(HERE, "../pivot/live-results.json"), "utf8"));
const P = JSON.parse(fs.readFileSync(path.join(HERE, "../pivot/data/pages.json"), "utf8"));
const titleOf = (id) => /^S-(.+)-\d$/.exec(id)?.[1];

const rows = [];
const tot = { turns: 0, said: 0, supported: 0, cited: 0, citedAbsent: 0, wellFormed: 0, malformed: 0, showed: 0 };
const q3 = { same: { exact: 0, shifted: 0, moved: 0, gone: 0, unchecked: 0, skipped: 0 }, added: { exact: 0, shifted: 0, moved: 0, gone: 0, unchecked: 0, skipped: 0 }, rewritten: { exact: 0, shifted: 0, moved: 0, gone: 0, unchecked: 0, skipped: 0 } };
const absentWhy = [];
const add = (to, c) => { for (const k of Object.keys(to)) to[k] += c[k] ?? 0; };

for (const r of live.rows.filter((x) => x.sourced)) {
  const page = P[titleOf(r.id)]; if (!page) continue;
  const ref = page.title + " — Wikipedia";
  const material = [{ ref, source: page.url, text: page.text }];
  const pv = pivotText({ draft: r.draft, ask: r.ask, material, requireGrounding: true, kind: "chat" });
  const record = ground.turnRecord(pv.text, material, { turn: 1, question: r.ask, model: "gemma2:2b" });
  const claims = claimsOfTurn({ turn: 1, pivot: pv, record, material });   // cited = the material's own bytes at the support address (not record.sources[].text, which is the spoken sentence)
  tot.turns++;
  for (const c of claims) {
    if (c.rel === "showed") { tot.showed++; continue; }
    tot.said++;
    if (!c.basis?.support) continue;
    tot.supported++;
    if (typeof c.basis.cited === "string") {
      tot.cited++;
      const m = /#(\d+)-(\d+)$/.exec(c.basis.support);
      const bytes = m ? page.text.slice(+m[1], +m[2]) : null;
      if (bytes === c.basis.cited) tot.wellFormed++; else tot.malformed++;
    } else {
      tot.citedAbsent++;
      absentWhy.push({ id: r.id, support: c.basis.support, inRecord: (record?.sources || []).some((s) => s.address === c.basis.support), recordAddresses: (record?.sources || []).slice(0, 3).map((s) => s.address) });
    }
  }
  const added = { ref, text: "A paragraph added above the intro by an editor.\n\n" + page.text };
  const rewritten = { ref, text: "This page was replaced entirely with unrelated text about something else, so none of what was cited survives anywhere in it." };
  for (const [k, pages] of [["same", [{ ref, text: page.text }]], ["added", [added]], ["rewritten", [rewritten]]]) {
    const f = freshnessOf({ claims, pages });
    add(q3[k], { ...f.counts, skipped: f.skipped });
  }
  rows.push({ id: r.id, ask: r.ask, claims: claims.length, said: claims.filter((c) => c.rel === "said").length, cited: claims.filter((c) => typeof c.basis?.cited === "string").length });
}

const pct = (n, d) => (d ? (100 * n / d).toFixed(0) + "%" : "n/a");
console.log(`turns replayed: ${tot.turns} (real gemma2:2b drafts, real pages)   showed-claims: ${tot.showed}`);
console.log(`Q1 said claims ${tot.said}; with a support address ${tot.supported}; of those carrying basis.cited ${tot.cited} (${pct(tot.cited, tot.supported)}), absent ${tot.citedAbsent}`);
console.log(`Q2 cited present ${tot.cited}: equals the page's bytes at the address ${tot.wellFormed}, does NOT ${tot.malformed}`);
for (const k of ["same", "added", "rewritten"]) console.log(`Q3 ${k.padEnd(9)} ${JSON.stringify(q3[k])}`);
if (absentWhy.length) console.log(`cited-absent examples (${absentWhy.length}):`, JSON.stringify(absentWhy.slice(0, 3)));
fs.writeFileSync(path.join(HERE, "cited-rate-results.json"), JSON.stringify({ at: new Date().toISOString(), model: live.model, source: "eval/pivot/live-results.json", tot, q3, absentWhy, rows }, null, 1));
