// prep.mjs — trims two REAL recorded turns into the inline data the three structure mocks embed.
//   node docs/playback/structure/prep.mjs   (no network, no model; reads recorded turns only)
// Inputs : eval/ants/falsify-checks/f3/real-b.json [10]  (Great Wall, 2 laps)   docs/playback/fixtures/turns.json [0] (telephone)
// Output : docs/playback/structure/data/{wall,phone}.json
// Everything shown in a quoted position is a substring of recorded text. The SEG cut is the app's own deriveGraph (run
// as shipped, by importing a copy of fold-chat-presentview.js with an export shim); the binds and the stitches are
// deterministic string matches defined below (no model, no embeddings).
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const ROOT = path.resolve(HERE, "../../..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "pvshim-"));
for (const f of ["fold-chat-present.js", "fold-chat-eot.js", "fold-chat-lang.js", "fold-chat-ground.js", "fold-chat-falsify-answer.js"]) fs.symlinkSync(path.join(ROOT, f), path.join(tmp, f));
fs.symlinkSync(path.join(ROOT, "vendor"), path.join(tmp, "vendor"));
fs.writeFileSync(path.join(tmp, "pv.mjs"), fs.readFileSync(path.join(ROOT, "fold-chat-presentview.js"), "utf8") + "\nexport { deriveGraph, tagOf };\n");
globalThis.document = { createElement() { return {}; }, addEventListener() {} }; globalThis.localStorage = { getItem() { return null; } };
const { deriveGraph } = await import(pathToFileURL(path.join(tmp, "pv.mjs")).href);

const STOP = new Set("a an the of in on at to for from by with as is are was were be been being it its this that these those and or but not no nor so if than then there here he she they we you i his her their our your my who whom which what when where why how can could would should may might will shall do does did have has had also only even just more most such very into over under about after before between while".split(" "));
const norm = (w) => String(w).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/[’]/g, "'");
const words = (s) => String(s).split(/\s+/).filter(Boolean);
const domainOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };
const SENT_RE = /(?<=[.!?])\s+(?=[\p{Lu}\d"“(])/u;
const stem = (w) => norm(w).slice(0, 5);

function loadTurn(rec, { id, label, ask }) {
  const g = rec.grounding;
  // ---- sources and their kept lines (a "line" is one \n-separated segment of the kept text) ----
  const byUrl = new Map(); const order = [];
  const addPassage = (p, pid, clipped) => {
    const url = p.url || p.source; if (!url) return;
    if (!byUrl.has(url)) { byUrl.set(url, { url, domain: domainOf(url), ref: p.ref, passages: [], clipped: false }); order.push(url); }
    byUrl.get(url).passages.push({ pid, text: p.text }); if (clipped) byUrl.get(url).clipped = true;
  };
  g.passages.forEach((p, i) => addPassage(p, "p" + i, false));
  // pages that reached the tape only through a later lap (clipped to 900 characters by the tape's slimP)
  for (const e of g.tape) if (e.kind === "deep" && e.ps) for (const p of e.ps) if (!byUrl.has(p.url)) addPassage(p, "t" + e.seq, true);
  const reads = (g.web || []).filter((w) => w.read);
  const sources = order.map((url, si) => {
    const s = byUrl.get(url); const rd = reads.find((r) => r.read === url) || {};
    const title = String(s.ref).split(" — ").slice(1).join(" — ");
    const lines = []; const seen = new Set();
    for (const p of s.passages) p.text.split("\n").forEach((t, li) => { t = t.trim(); if (!t || seen.has(t)) return; seen.add(t); lines.push({ t, pid: p.pid }); });
    return { id: si, domain: s.domain, site: String(s.ref).split(" — ")[0], title, url, chars: rd.chars ?? null, kept: rd.kept ?? null, via: rd.via ?? null, lap: rd.lap ?? 0, clipped: s.clipped, lines };
  });
  const failed = reads.filter((r) => r.ok === false).map((r) => ({ url: r.read, domain: domainOf(r.read) }));
  // ---- sentences (within lines) ----
  const sentences = [];
  sources.forEach((s) => s.lines.forEach((ln, li) => { let off = 0; for (const t of ln.t.split(SENT_RE)) { const at = ln.t.indexOf(t, off); off = at + t.length; if (t.length > 14) sentences.push({ src: s.id, line: li, t, at }); } }));

  // ---- SEG: the app's own cut, one row per page ----
  const askStems = new Set((ask.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).filter((w) => !STOP.has(w)).map((w) => w.slice(0, 5)));
  const cuts = [];
  for (const s of sources) {
    const text = s.lines.map((l) => l.t).join("\n");
    const G = deriveGraph([{ text, url: s.url, ref: s.site }], ask); const r = G.rows[0]; if (!r) continue;
    const toks = r.toks; const roles = r.roles; const tags = r.tags;
    const vFirst = tags.findIndex((t, i) => i > 0 && (t === "aux" || t === "verb"));
    // locate the sentence (the app collapses whitespace before splitting, so match on the first words)
    const flat = text.replace(/\s+/g, " "); const at = flat.indexOf(r.sentence.slice(0, 40));
    let li = 0, acc = 0; const lens = s.lines.map((l) => l.t.replace(/\s+/g, " ").length + 1); while (li < lens.length - 1 && acc + lens[li] <= at) { acc += lens[li]; li++; }
    let lj = li, accj = acc; const endAt = at + r.sentence.length; while (lj < lens.length - 1 && accj + lens[lj] < endAt) { accj += lens[lj]; lj++; }
    const q = /\?\s*$/.test(r.sentence);
    // groups: contiguous original tokens (small words inside a group stay inside it, so each box is a verbatim phrase)
    const groups = []; let i = 0;
    while (i < toks.length) {
      const role = roles[i];
      if (role === "s" || role === "v" || role === "o") {
        let j = i; for (let k = i + 1; k < toks.length; k++) { if (roles[k] === role) j = k; else if (roles[k] === "f") continue; else break; }
        groups.push({ role, i0: i, i1: j }); i = j + 1;
      } else i++;
    }
    const ws = new Set((r.sentence.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).map((w) => w.slice(0, 5)));
    const hits = [...new Set(toks.filter((t) => askStems.has(stem(t))).map(norm))];
    cuts.push({ src: s.id, line: li, lineEnd: lj, sentence: r.sentence, toks, roles, tags, groups, flags: { q, glued: lj > li, verbGuess: vFirst < 1, capped: roles.includes("x"), capTail: toks.length >= 26 }, hits, lang: r.lang, nLines: s.lines.length });
  }

  // ---- CON: things named by two or more pages (a capitalised name inside a sentence, matched verbatim) ----
  const cand = new Map(); // key(lower) -> {label, pages:Set, occ:[{src,sent}]}
  for (const st of sentences) {
    const w = words(st.t); const nw = w.map(norm);
    for (let i = 0; i < w.length; i++) for (let n = 1; n <= 4 && i + n <= w.length; n++) {
      const seg = w.slice(i, i + n); const sn = nw.slice(i, i + n);
      if (!sn[0] || !sn[n - 1] || STOP.has(sn[0]) || STOP.has(sn[n - 1])) continue;
      const isCap = (x) => /^\p{Lu}/u.test(x.replace(/^[^\p{L}]+/u, ""));
      if (!isCap(seg[0]) || (i === 0 && n === 1)) continue;   // a name starts with a capital that is not just the sentence start
      if (!seg.every((x, k) => STOP.has(sn[k]) || isCap(x) || /^\d/.test(sn[k]))) continue;   // every content word of a name is capitalised
      if (n === 1 && (sn[0].length < 4)) continue;
      const interiorOk = sn.slice(1, -1).every((x) => STOP.has(x) || /^\p{Lu}/u.test(seg[sn.indexOf(x)] || "") || true);
      const key = sn.join(" "); const label = seg.map((x) => x.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).join(" ");
      if (!cand.has(key)) cand.set(key, { key, label, pages: new Set(), occ: [] });
      const c = cand.get(key); c.pages.add(st.src); c.occ.push({ src: st.src, sent: st });
    }
  }
  let things = [...cand.values()].filter((c) => c.pages.size >= 2);
  // drop a phrase when a longer phrase holds exactly the same pages
  things = things.filter((c) => !things.some((d) => d !== c && d.key.length > c.key.length && d.key.includes(c.key) && [...c.pages].every((p) => d.pages.has(p))));
  const askHit = (c) => c.key.split(" ").some((k) => askStems.has(k.slice(0, 5))) ? 1 : 0;
  things.sort((a, b) => askHit(b) - askHit(a) || b.pages.size - a.pages.size || b.key.length - a.key.length);
  const tokKey = (t) => norm(t);
  const binds = things.slice(0, 8).map((c) => {
    const rows = [];
    for (const s of sources) {
      const occ = c.occ.filter((o) => o.src === s.id); if (!occ.length) continue;
      // the page's sentence that names it and bears most on the ask
      const score = (o) => (o.sent.t.toLowerCase().match(/[\p{L}\p{N}]{4,}/gu) || []).filter((w) => askStems.has(w.slice(0, 5))).length;
      const best = occ.slice().sort((a, b) => score(b) - score(a) || a.sent.line - b.sent.line)[0].sent;
      const w = words(best.t); const nk = c.key.split(" "); let at = -1;
      for (let i = 0; i + nk.length <= w.length; i++) if (nk.every((k, j) => norm(w[i + j]) === k)) { at = i; break; }
      if (at < 0) continue;
      rows.push({ src: s.id, line: best.line, sentence: best.t, ref: [at, at + nk.length - 1], toks: w });
    }
    // words shared (a run of 2+ words, not all small words) between the right-hand sides of two rows
    rows.forEach((r) => { const right = r.toks.slice(r.ref[1] + 1); r.shared = right.map(() => false);
      rows.forEach((o) => { if (o === r) return; const oright = o.toks.slice(o.ref[1] + 1).map(tokKey);
        for (let i = 0; i < right.length; i++) for (let j = 0; j < oright.length; j++) { let n = 0; while (i + n < right.length && j + n < oright.length && tokKey(right[i + n]) === oright[j + n] && tokKey(right[i + n])) n++; if (n >= 2 && right.slice(i, i + n).some((x) => !STOP.has(tokKey(x)))) for (let k = 0; k < n; k++) r.shared[i + k] = true; } }); });
    return { label: c.label, key: c.key, pages: [...c.pages].sort(), rows };
  });
  const edges = []; for (let a = 0; a < sources.length; a++) for (let b = a + 1; b < sources.length; b++) { const both = binds.filter((x) => x.pages.includes(a) && x.pages.includes(b)); const ks = both.filter((x) => !both.some((y) => y !== x && y.key.includes(x.key) && y.key.length > x.key.length)).map((x) => x.label); if (ks.length) edges.push({ a, b, keys: ks }); }
  // the whole-pool tally for the field view: for every kept sentence, which bound things it names
  const field = sentences.map((st) => ({ src: st.src, line: st.line, names: binds.map((b, bi) => (b.rows.length && st.t.toLowerCase().includes(b.key) ? bi : -1)).filter((x) => x >= 0) }));

  // ---- SYN: each answer sentence, stitched from verbatim runs of the kept lines ----
  const answer = String(rec.content || "").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
  const lineWords = []; sources.forEach((s) => s.lines.forEach((l, li) => lineWords.push({ src: s.id, line: li, w: words(l.t).map(norm), raw: words(l.t) })));
  const syn = answer.map((text, ai) => {
    const aw = words(text); const an = aw.map(norm); const used = aw.map(() => null); const runs = [];
    for (;;) {
      let best = null;
      for (let i = 0; i < an.length; i++) { if (used[i]) continue;
        for (const L of lineWords) for (let j = 0; j < L.w.length; j++) { let n = 0; while (i + n < an.length && j + n < L.w.length && !used[i + n] && an[i + n] && an[i + n] === L.w[j + n]) n++;
          if (n >= 2 && (n >= 3 || an.slice(i, i + n).filter((x) => !STOP.has(x)).length >= 2) && an.slice(i, i + n).some((x) => !STOP.has(x)) && (!best || n > best.n)) best = { i, n, L, j }; } }
      if (!best) break;
      for (let k = 0; k < best.n; k++) used[best.i + k] = true;
      runs.push({ i0: best.i, i1: best.i + best.n - 1, src: best.L.src, line: best.L.line, from: best.j, srcText: best.L.raw.slice(best.j, best.j + best.n).join(" ") });
    }
    runs.sort((x, y) => x.i0 - y.i0);
    // every other page that carries the same run verbatim (so a run is not credited to one page by accident)
    runs.forEach((r) => { const key = an.slice(r.i0, r.i1 + 1).join(" "); r.also = [...new Set(lineWords.filter((L) => !(L.src === r.src && L.line === r.line) && L.w.join(" ").includes(key)).map((L) => L.src))].filter((s) => s !== r.src); });
    const cov = (g.coverage.entries || []).find((e) => e.text === text) || (g.coverage.entries || [])[ai] || null;
    let cite = null;
    if (cov && cov.ref) { const url = cov.source; const s = sources.find((x) => x.url === url);
      const P = s && byUrl.get(url).passages.find((p) => p.text.slice(cov.span.start, cov.span.end).length && cov.span.end <= p.text.length && (p.text.slice(cov.span.start, cov.span.end).trim().length > 3) && text.toLowerCase().includes(norm(p.text.slice(cov.span.start, cov.span.end)).slice(0, 12)));
      if (s && P) { const t = P.text.slice(cov.span.start, cov.span.end); const li = s.lines.findIndex((l) => l.t.includes(t.trim())); cite = { src: s.id, line: li, start: cov.span.start, end: cov.span.end, text: t, pid: P.pid, score: cov.score }; } }
    return { i: ai, text, toks: aw, runs, own: aw.map((w, k) => (used[k] ? null : w)), cite, coverage: cov ? { grounded: !!cov.ref, why: cov.why || null, detail: cov.detail || null, score: cov.score } : null };
  });
  const lapInfo = (g.loop?.passes || []).map((p) => ({ lap: p.lap, failing: (p.failing || []).map((f) => ({ i: f.i, verdict: f.verdict, query: f.query, why: f.why })), added: p.added, reImpressed: (p.reImpressed || []).map((r) => ({ url: r.url, domain: domainOf(r.url), kept: r.kept, chars: r.chars, segments: r.segments })) }));
  const route = (g.web || []).find((w) => w.scope === "route");
  return { id, label, ask, answer, sources, failed, cuts, binds, edges, field, syn, loop: { passes: lapInfo, cleared: g.loop?.cleared, after: g.loop?.after, line: g.loop?.processLine }, route: route ? { picked: route.picked, skipped: route.skipped } : null,
    tape: { n: g.tape.length, deep: g.tape.filter((e) => e.kind === "deep").map((e) => `${e.k}.${e.sub}`), kinds: [...new Set(g.tape.map((e) => e.kind))], draft: g.tape.filter((e) => e.kind === "draft").length, writing: g.tape.find((e) => e.kind === "writing") || null } };
}

const wallRec = JSON.parse(fs.readFileSync(path.join(ROOT, "eval/ants/falsify-checks/f3/real-b.json"), "utf8"))[10];
const wall = loadTurn(wallRec.rec, { id: "wall", label: "Is the Great Wall of China visible from space?", ask: wallRec.ask });
fs.writeFileSync(path.join(HERE, "data/wall.json"), JSON.stringify(wall));
const fx = path.join(ROOT, "docs/playback/fixtures/turns.json"); const out = [wall];
if (fs.existsSync(fx)) { const t = JSON.parse(fs.readFileSync(fx, "utf8")); const arr = Array.isArray(t) ? t : t.turns; const picks = arr.map((x, i) => ({ x, i })); for (const { x, i } of picks) { const d = loadTurn(x, { id: "t" + i, label: x.ask, ask: x.ask }); fs.writeFileSync(path.join(HERE, `data/t${i}.json`), JSON.stringify(d)); out.push(d); } }
console.log(out.map((d) => `${d.id}: ${d.sources.length} sources, ${d.cuts.length} cuts, ${d.binds.length} binds, ${d.edges.length} edges, ${d.syn.length} sentences`).join("\n"));
