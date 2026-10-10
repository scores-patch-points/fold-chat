// extract.mjs — turn REAL turn records into the small model the three Existence mocks draw from. No model calls, no network.
// Sources: eval/ants/falsify-checks/f3/real-a.json (Everest, Australia) and docs/playback/fixtures/turns.json (telephone, ...).
// Everything the mocks print as a source's words is copied from the record; derived numbers are marked derived in the model.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { typeOf } from "../../../fold-chat-present.js";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const flat = (s) => String(s || "").replace(/\s+/g, " ").trim();
const SCOPES = ["web", "wikipedia", "github", "archive", "openalex", "crossref"];
const SCOPE_NAME = { web: "The web", wikipedia: "Wikipedia", github: "GitHub", archive: "Internet Archive", openalex: "OpenAlex", crossref: "Crossref" };


// What recurs across pages (INS Pattern): word runs of 4+ words and figures that stand in the kept passages of two or more
// DIFFERENT pages. Derived here by string comparison of two recorded texts; the product would compute the same from the record.
const norm = (w) => w.toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
export function recurOf(handed) {
  const byUrl = new Map();
  for (const h of handed) { const u = h.url; const cur = byUrl.get(u) || { url: u, domain: h.domain, toks: [] }; cur.toks.push(...String(h.text || "").split(/\s+/).filter(Boolean)); byUrl.set(u, cur); }
  const pages = [...byUrl.values()];
  const N = 4;
  const stops = (t) => /[.?!;:\u2026]["\u201d)]?$/.test(t);
  const grams = pages.map((p) => { const ks = p.toks.map(norm); const m = new Map(); for (let i = 0; i + N <= ks.length; i++) { const g = ks.slice(i, i + N).join(" "); if (ks.slice(i, i + N).some((x) => !x)) continue; if (p.toks.slice(i, i + N - 1).some(stops)) continue; if (!m.has(g)) m.set(g, i); } return { ks, m }; });
  const runs = new Map();
  pages.forEach((p, a) => {
    const { ks } = grams[a];
    const cover = new Array(ks.length).fill(false);
    for (let i = 0; i + N <= ks.length; i++) { const g = ks.slice(i, i + N).join(" "); if (grams[a].m.has(g) && pages.some((_, b) => b !== a && grams[b].m.has(g))) for (let j = i; j < i + N; j++) cover[j] = true; }
    let i = 0;
    while (i < ks.length) { if (!cover[i]) { i++; continue; } let j = i; while (j < ks.length && cover[j]) j++; const key = ks.slice(i, j).join(" "); const text = p.toks.slice(i, j).join(" ").replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}%)]+$/gu, ""); let tx = text; { const o = (tx.match(/\(/g) || []).length, c = (tx.match(/\)/g) || []).length; if (o > c) tx = tx.slice(0, tx.lastIndexOf("(")).trim(); }
      const longw = tx.split(/\s+/).filter((w) => norm(w).length >= 4).length;
      if (j - i >= N && longw >= 2 && !/^\d[\d\s.,]*$/.test(key)) { const has = pages.map((q, b) => (` ${grams[b].ks.join(" ")} `).includes(` ${key} `)); const n = has.filter(Boolean).length; if (n >= 2 && !runs.has(key)) runs.set(key, { text: tx, words: j - i, in: pages.filter((_, b) => has[b]).map((q) => q.url) }); } i = j; }
  });
  // drop runs that sit inside a longer run found on the same pages
  const all = [...runs.entries()];
  const kept = all.filter(([k, r]) => !all.some(([k2, r2]) => k2 !== k && k2.includes(k) && r.in.every((u) => r2.in.includes(u))));
  const out = kept.map(([, r]) => r).sort((x, y) => y.in.length - x.in.length || y.words - x.words).slice(0, 8);
  // figures: numeric tokens on two or more pages
  const fig = new Map();
  for (const p of pages) for (const tok of new Set(p.toks.map((t) => t.replace(/^[^\d]+|[^\d]+$/g, "")).filter((t) => /\d/.test(t) && t.length >= 3))) { const l = fig.get(tok) || []; l.push(p.url); fig.set(tok, l); }
  const figures = [...fig.entries()].filter(([, l]) => l.length >= 2).map(([text, l]) => ({ text, in: l })).sort((x, y) => y.in.length - x.in.length).slice(0, 6);
  return { pages: pages.map((p) => ({ url: p.url, domain: p.domain })), runs: out, figures, derived: "string comparison of the passages the record keeps" };
}

export function modelOf(id, label, ask, rec) {
  const g = rec.grounding || rec;
  const tape = g.tape || [];
  const end = (tape.find((e) => e.kind === "done") || tape[tape.length - 1] || {}).at || 0;
  // laps: a reframe line starts the next lap
  const reframes = tape.filter((e) => e.kind === "ev" && e.e && e.e.op === "line" && /Reframe, lap/.test(e.e.title || "")).map((e) => e.at);
  const lapAt = (t) => 1 + reframes.filter((r) => r <= t).length;
  const laps = [{ n: 1, t0: 0 }, ...reframes.map((r, i) => ({ n: i + 2, t0: r }))];
  laps.forEach((l, i) => { l.t1 = i + 1 < laps.length ? laps[i + 1].t0 : end; });
  // engines (SIG): searching -> found | failed
  const engines = [];
  const open = new Map();
  for (const e of tape) {
    if (e.kind !== "st") continue;
    const s = e.st;
    if (s.phase === "searching") { const l = { scope: s.scope, name: SCOPE_NAME[s.scope] || s.scope, q: s.q, lap: lapAt(e.at), t0: e.at, t1: null, n: null, ok: null, why: null, waited: null }; engines.push(l); open.set(s.scope + "|" + s.q, l); }
    if (s.phase === "waiting") { const l = open.get(s.scope + "|" + (engines.filter((x) => x.scope === s.scope).pop() || {}).q); if (l) l.waited = e.at; }
    if (s.phase === "found" || s.phase === "failed") { const l = open.get(s.scope + "|" + s.q) || [...engines].reverse().find((x) => x.scope === s.scope); if (l) { l.t1 = e.at; l.ok = s.phase === "found"; l.n = s.n ?? null; l.why = s.why || null; } }
  }
  // engine names from web[] records (DuckDuckGo etc.)
  const webRows = g.web || [];
  for (const l of engines) { const w = webRows.find((x) => x.scope === l.scope && x.q === l.q && x.engine); if (w) l.engine = w.engine; }
  // pages (SIG lanes / INS grounds)
  const reads = webRows.filter((w) => w.read);
  const pages = [];
  const popen = new Map();
  for (const e of tape) {
    if (e.kind !== "st") continue;
    const s = e.st;
    if (!s.url) continue;
    if (s.phase === "reading") { const p = { url: s.url, domain: domainOf(s.url), site: s.site || domainOf(s.url), title: s.title || "", lap: lapAt(e.at), t0: e.at, t1: null, state: "reading", chars: null, kept: null, text: "" }; pages.push(p); popen.set(s.url + "|" + p.lap, p); }
    if (s.phase === "read" || s.phase === "unread" || s.phase === "snippet") { const p = popen.get(s.url + "|" + lapAt(e.at)) || [...pages].reverse().find((x) => x.url === s.url); if (p) { p.t1 = e.at; p.state = s.phase; p.chars = s.chars ?? null; p.kept = s.kept ?? null; p.text = s.text || ""; if (s.title) p.title = s.title; } }
  }
  // the engine's own words about a read (ev end note), by page url, in time order
  const notes = tape.filter((e) => e.kind === "ev" && e.e && e.e.op === "end" && /^r:/.test(e.e.id || "")).map((e) => ({ url: e.e.id.slice(2), at: e.at, note: e.e.note || "", ms: e.e.ms }));
  for (const p of pages) { const n = notes.find((x) => x.url === p.url && p.t1 != null && Math.abs(x.at - p.t1) < 0.05); if (n) { p.note = n.note; p.ms = n.ms; } }
  // join the record's own read rows (via / hash / not-used flag / lap) in order per url
  const used = new Map();
  for (const p of pages) {
    const rs = reads.filter((r) => r.read === p.url);
    const k = used.get(p.url) || 0; used.set(p.url, k + 1);
    const r = rs.find((x) => (x.lap || 0) + 1 === p.lap) || rs[k];
    if (r) { p.via = r.via || null; p.notUsed = !!r.skipped; if (r.ok === false) p.state = "unread"; }
  }
  const topic = webRows.find((w) => w.scope === "topic");
  const demoted = (topic ? topic.demoted : []).map((d) => { const m = /^(.*) \(([a-z-]+)\)$/.exec(d); return m ? { title: m[1], reason: m[2] } : { title: d, reason: "" }; });
  const route = webRows.find((w) => w.scope === "route") || {};
  // passages handed to the writer, as the tape saw them (quick) and as the record keeps them (g.passages, full)
  const quick = tape.filter((e) => e.kind === "quick").map((e) => ({ lap: lapAt(e.at), n: e.n, of: e.of, at: e.at, ref: e.p.ref, url: e.p.url, domain: domainOf(e.p.url), site: (e.p.ref || "").split(" — ")[0], title: (e.p.ref || "").split(" — ").slice(1).join(" — "), text: e.p.text }));
  const handed = (g.passages || []).map((p) => ({ url: p.url || p.source, domain: domainOf(p.url || p.source), ref: p.ref, text: p.text }));
  const cited = ((g.facing || {}).sources || []).map((s) => {
    const pg = [...pages].reverse().find((x) => x.url === s.url);
    return { n: s.n, domain: s.domain || domainOf(s.url), url: s.url, ref: s.ref, label: s.label, text: s.text, mark: s.mark, before: s.before, after: s.after, span: s.span, keptLen: pg ? pg.kept : null, chars: pg ? pg.chars : null };
  });
  const queries = [{ lap: 1, q: ask }];
  for (const p of (g.loop && g.loop.passes) || []) for (const f of p.failing || []) if (f.query) queries.push({ lap: p.lap + 1, q: f.query, why: f.why, claim: f.s, verdict: f.verdict });
  const lines = (g.feed || []).filter((f) => f.type === "t" && f.op === "line").map((f) => ({ title: f.title, note: f.note }));
  const types = {};
  for (const d of new Set([...pages.map((p) => p.domain), ...handed.map((p) => p.domain), ...cited.map((c) => c.domain), ...quick.map((q) => q.domain)])) types[d] = typeOf(d);
  const claims = ((g.facing || {}).response || []).map((r) => ({ text: r.text, grounded: r.grounded, tag: r.tag }));
  return {
    id, label, ask, kind: g.kind || null, language: g.language || null, effort: g.effort || null, answerMode: g.answerMode || null,
    process: g.process || [], dur: end, laps, queries, engines, route: { picked: route.picked || [], skipped: route.skipped || [], why: route.why || {}, webDown: !!route.webDown, scopes: SCOPES.map((s) => ({ scope: s, name: SCOPE_NAME[s] })) },
    demoted, pages, quick, handed, cited, claims, loop: g.loop ? { processLine: g.loop.processLine, firstTry: g.loop.firstTry, cleared: g.loop.cleared, passes: (g.loop.passes || []).map((p) => ({ lap: p.lap, failing: p.failing, reImpressed: p.reImpressed, added: p.added })) } : null,
    void: g.void || null, coverage: g.coverage ? { grounded: g.coverage.grounded, total: g.coverage.total } : null, lines, types,
    hasMaterial: g.hasMaterial, nSources: g.nSources, recur: recurOf(handed),
  };
}

export function loadAll() {
  const out = [];
  const A = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/ants/falsify-checks/f3/real-a.json"), "utf8"));
  const pick = (q) => A.find((x) => x.ask === q && x.rec);
  const ev = pick("How tall is Mount Everest?"); if (ev) out.push(modelOf("everest", "Mount Everest", ev.ask, ev.rec));
  let T = []; try { T = JSON.parse(fs.readFileSync(path.join(ROOT, "docs/playback/fixtures/turns.json"), "utf8")); } catch {}
  const tel = T.find((x) => /telephone/.test(x.ask)); if (tel) out.push(modelOf("telephone", "the telephone", tel.ask, tel));
  const au = pick("What is the capital of Australia?"); if (au) out.push(modelOf("australia", "Australia", au.ask, au.rec));
  return out;
}
if (process.argv[1] && process.argv[1].endsWith("extract.mjs")) { const all = loadAll(); fs.writeFileSync(path.join(HERE, "data.json"), JSON.stringify(all)); console.log(all.map((m) => `${m.id}: ${m.pages.length} pages ${m.engines.length} engines ${m.quick.length} passages ${m.cited.length} cited laps ${m.laps.length}`).join("\n")); }
