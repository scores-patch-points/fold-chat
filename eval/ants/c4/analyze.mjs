// C4 analysis: BEFORE table, REPLAY of the pre-registered budget over the recorded wire, LIVE-gated table, and the verdict on P1..P5. Prints markdown.
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { makeGate, ASKS } from "./measure.mjs";
import { PRESETS } from "../../../fold-chat-budget.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const load = (f) => { try { return JSON.parse(fs.readFileSync(path.join(HERE, f), "utf8")).runs; } catch { return null; } };
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0; };
const cnt = (reqs, k) => reqs.filter((r) => r.kind === k).length;
const logical = (reqs, k) => new Set(reqs.filter((r) => r.kind === k).map((r) => r.key)).size;
const isWiki = (k) => /wikipedia\.org/.test(k || "");
// replay
export function replay(run, config = null) {
  let clock = 0; const G = makeGate({ preset: run.kind === "chat" ? "chat" : "balanced", config: config && run.kind !== "chat" ? { ...PRESETS.balanced, ...config } : null, now: () => clock });
  const out = run.reqs.map((r) => { clock = r.t; const d = G.decide({ url: r.u, method: r.m }); return { ...r, d }; });
  const kept = out.filter((r) => r.d.allow);
  const bearing = out.filter((r) => r.bearing);
  const origin = out.filter((r) => r.d.count && r.d.tier === "origin" && r.kind === "pages" && !isWiki(r.key));
  const originLogical = new Map(); for (const r of origin) { const o = originLogical.get(r.key) || { ok: false, kept: false }; if (r.status === 200 && (r.len || 0) > 500) o.ok = true; if (r.d.allow) o.kept = true; originLogical.set(r.key, o); }
  return { wire: { web: cnt(kept, "web"), pages: cnt(kept, "pages"), models: cnt(kept, "models") }, logical: { web: logical(kept, "web"), pages: logical(kept, "pages") }, bearing: bearing.length, bearingKept: bearing.filter((r) => r.d.allow).length, answerSurvives: bearing.length === 0 ? null : bearing.some((r) => r.d.allow), originAsked: originLogical.size, originOk: [...originLogical.values()].filter((o) => o.ok).length, originKept: [...originLogical.values()].filter((o) => o.kept).length, originOkKept: [...originLogical.values()].filter((o) => o.ok && o.kept).length, refusedByWhy: kept.length ? null : null, snapshot: G.budget.snapshot() };
}
const row = (r) => ({ id: r.ask, kind: r.kind, wall: (r.wallMs / 1000).toFixed(1), wireWeb: cnt(r.reqs, "web"), wirePages: cnt(r.reqs, "pages"), wireModels: cnt(r.reqs, "models"), wire: r.reqs.filter((x) => x.kind).length, lWeb: logical(r.reqs, "web"), lPages: logical(r.reqs, "pages"), ok: r.answerOk, spoken: String(r.spoken || "").replace(/\s+/g, " ").slice(0, 70) });
const tbl = (rows, head) => ["| ask | kind | wall s | wire web | wire pages | wire models | **wire total** | logical web | logical pages | answer ok |", "|---|---|---|---|---|---|---|---|---|---|", ...rows.map((x) => `| ${x.id} | ${x.kind} | ${x.wall} | ${x.wireWeb} | ${x.wirePages} | ${x.wireModels} | **${x.wire}** | ${x.lWeb} | ${x.lPages} | ${x.ok} |`)].join("\n");
// LIVE: what actually left the browser = what the gate allowed (the route() gate aborts the rest before it is sent); what the page ATTEMPTED is counted separately
const sent = (r) => { const al = r.gate.log.filter((x) => x.allow); const by = (k) => al.filter((x) => x.kind === k); const den = r.gate.log.filter((x) => !x.allow); const why = {}; for (const d of den) why[d.why] = (why[d.why] || 0) + 1; return { web: by("web").length, pages: by("pages").length, models: by("models").length, lWeb: new Set(by("web").map((x) => x.key)).size, lPages: new Set(by("pages").map((x) => x.key)).size, attempted: r.gate.log.length, denied: den.length, why }; };
const liveRow = (r) => { const t = sent(r); return { id: r.ask, kind: r.kind, wall: (r.wallMs / 1000).toFixed(1), wireWeb: t.web, wirePages: t.pages, wireModels: t.models, wire: t.web + t.pages + t.models, lWeb: t.lWeb, lPages: t.lPages, ok: r.answerOk, attempted: t.attempted, denied: t.denied, why: JSON.stringify(t.why), spoken: String(r.spoken || "").replace(/\s+/g, " ").slice(0, 80) }; };
const sets = { "before-1": load("before-1.json"), "before-2": load("before-2.json"), live: load("live.json"), "live-2": load("live-2.json"), "live-h1": load("live-h1.json"), "live-p": load("live-p.json") };
const web = (rows) => rows.filter((r) => r.kind !== "chat");
const R = {};
for (const [name, runs] of Object.entries(sets)) if (runs) { R[name] = runs.map(name.startsWith("live") ? liveRow : row); console.log(`\n### ${name}${name.startsWith("live") ? " (SENT = allowed by the gate; the page attempted more, see 'attempted')" : ""}\n` + tbl(R[name])); if (name.startsWith("live")) console.log(R[name].map((x) => `- ${x.id}: attempted ${x.attempted}, denied ${x.denied} ${x.why}; spoken: ${x.spoken}`).join("\n")); }
const fact = (rows) => rows.filter((r) => r.kind === "factual");
if (R["before-1"]) {
  const all = [...(R["before-1"] || []), ...(R["before-2"] || [])];
  console.log(`\nBASELINE factual asks (n=${fact(all).length}): median wire ${median(fact(all).map((r) => r.wire))}, median logical web+pages ${median(fact(all).map((r) => r.lWeb + r.lPages))}, median wall ${median(fact(all).map((r) => +r.wall))} s, median models ${median(fact(all).map((r) => r.wireModels))}`);
  console.log(`BASELINE all web asks (n=${web(all).length}): median wire ${median(web(all).map((r) => r.wire))}; chit-chat wire: ${all.filter((r) => r.kind === "chat").map((r) => r.wire).join(", ")}`);
}
for (const name of ["before-1", "before-2"]) if (sets[name]) {
  console.log(`\n### REPLAY of the budget over ${name}\n| ask | wire kept (web/pages/models) | logical kept (web/pages) | answer-bearing requests (kept/total) | survives | origin reads asked / returned text / kept / kept+text |\n|---|---|---|---|---|---|`);
  for (const run of sets[name]) { const p = replay(run); console.log(`| ${run.ask} | ${p.wire.web}/${p.wire.pages}/${p.wire.models} | ${p.logical.web}/${p.logical.pages} | ${p.bearingKept}/${p.bearing} | ${p.answerSurvives} | ${p.originAsked} / ${p.originOk} / ${p.originKept} / ${p.originOkKept} |`); }
}

if (R.live) {
  const base = [...(R["before-1"] || []), ...(R["before-2"] || [])];
  const bMed = median(base.filter((r) => r.kind !== "chat").map((r) => r.wire));
  for (const name of ["live", "live-2", "live-h1", "live-p"]) if (R[name]) {
    const L = R[name]; const w = L.filter((r) => r.kind !== "chat");
    console.log(`\n${name.toUpperCase()} vs baseline: baseline median wire (web asks) ${bMed}; live median sent ${median(w.map((r) => r.wire))} (${(100 * median(w.map((r) => r.wire)) / bMed).toFixed(0)}%); max sent ${Math.max(...w.map((r) => r.wire))}; max logical web+pages ${Math.max(...w.map((r) => r.lWeb + r.lPages))}; max models ${Math.max(...w.map((r) => r.wireModels))}`);
    console.log(`${name} answers ok: ${w.filter((r) => r.ok).length}/${w.length} (factual ${L.filter((r) => r.kind === "factual" && r.ok).length}/4)`);
    console.log(`${name} chat: ${L.filter((r) => r.kind === "chat").map((r) => `${r.id} sent ${r.wire}`).join("; ")}`);
  }
}

// WHERE THE BASELINE FAN-OUT IS (every web ask of before-1 and before-2 whose search worked)
{
  const runs = [...(sets["before-1"] || []), ...(sets["before-2"] || [])].filter((r) => r.kind !== "chat" && r.reqs.some((x) => x.kind === "pages"));
  const cat = { search: 0, "page: direct fetch": 0, "page: proxy hedge": 0, "encyclopedia article (parse/extract)": 0, "footnote page (origin)": 0, "model call": 0 }; let n = 0;
  for (const run of runs) {
    n++; let originPhase = false;
    for (const r of run.reqs) {
      if (!r.kind) continue;
      if (r.kind === "models") cat["model call"]++;
      else if (r.kind === "web") cat.search++;
      else if (/action=parse/.test(r.u)) { originPhase = true; cat["encyclopedia article (parse/extract)"]++; }
      else if (/prop=extracts/.test(r.u)) cat["encyclopedia article (parse/extract)"]++;
      else if (originPhase) cat["footnote page (origin)"]++;
      else if (r.proxy) cat["page: proxy hedge"]++; else cat["page: direct fetch"]++;
    }
  }
  const tot = Object.values(cat).reduce((a, b) => a + b, 0);
  console.log(`\n### Where the baseline wire goes (${n} web asks with pages, summed)\n| request kind | n | share | per ask |\n|---|---|---|---|\n` + Object.entries(cat).map(([k, v]) => `| ${k} | ${v} | ${(100 * v / tot).toFixed(0)}% | ${(v / n).toFixed(1)} |`).join("\n") + `\n| **total** | ${tot} | | ${(tot / n).toFixed(1)} |`);
  console.log("\n### EXPLORATORY (post-hoc, NOT pre-registered): the same replay with hedge 1 and with hedge 0 (direct fetch only... plus none)");
  for (const h of [1, 0]) {
    const per = []; for (const name of ["before-1", "before-2"]) for (const run of sets[name] || []) { if (run.kind === "chat" || !run.reqs.some((x) => x.kind === "pages")) continue; const p = replay(run, { hedge: h }); per.push({ id: run.ask, wire: p.wire.web + p.wire.pages + p.wire.models, base: run.reqs.filter((x) => x.kind).length, surv: p.answerSurvives }); }
    console.log(`hedge ${h}: median replay wire ${median(per.map((x) => x.wire))} of baseline median ${median(per.map((x) => x.base))}; answer-bearing request kept in ${per.filter((x) => x.surv).length}/${per.length}`);
  }
}

// P5: WHAT THE CUT COSTS IN PRIMARY-SOURCE REACH
{
  const agg = { asked: 0, ok: 0, kept: 0, okKept: 0, asks: 0 };
  for (const name of ["before-1", "before-2"]) for (const run of sets[name] || []) { if (run.kind === "chat" || !run.reqs.some((x) => x.kind === "pages")) continue; const p = replay(run); agg.asks++; agg.asked += p.originAsked; agg.ok += p.originOk; agg.kept += p.originKept; agg.okKept += p.originOkKept; }
  console.log(`\n### P5 origin-following reach, REPLAY over ${agg.asks} baseline web asks: footnote pages (non-encyclopedia, after the article parse) asked ${agg.asked}; returned text ${agg.ok}; budget keeps ${agg.kept}; kept AND returned text ${agg.okKept}`);
  const prov = (runs) => runs.filter((r) => r.kind !== "chat").map((r) => { const p = r.grounding && r.grounding.provenance; return { id: r.ask, verified: !!(p && p.verified), hosts: p ? p.hosts : [], why: p ? p.why : null }; });
  for (const name of ["before-1", "before-2", "live", "live-2", "live-h1", "live-p"]) if (sets[name]) {
    const P = prov(sets[name]); const live = name.startsWith("live");
    const originSent = live ? sets[name].map((r) => r.gate.log.filter((x) => x.allow && x.tier === "origin" && x.kind === "pages" && !isWiki(x.key)).length) : null;
    console.log(`${name}: sources line (provenance) verified in ${P.filter((p) => p.verified).length}/${P.length} web asks; verified on a NON-wikipedia host ${P.filter((p) => p.verified && p.hosts.some((h) => !/wikipedia/.test(h))).length}; lost to the clock/budget: ${P.filter((p) => !p.verified && /call_failed|budget/.test(p.why || "")).length}${originSent ? "; footnote-page requests SENT per ask: " + originSent.join(",") : ""}`);
  }
}
