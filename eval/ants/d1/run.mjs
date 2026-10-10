// run.mjs — run the frozen battery through the sim. Resumable: a conversation whose out/conv-<id>.json exists is skipped (use --force to redo).
//   node eval/ants/d1/run.mjs [--record] [--force] [--only E01,E02] [--cold]    --record: let unseen requests reach the real network (and store them)
import fs from "node:fs";
import { makeReplayFetch, loadStore } from "./lib/replay.mjs";
import { newSession, runTurn, makeCtx, norm } from "./sim.mjs";
import * as web from "../../../fold-chat-web.js";
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f), val = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : null; };
const OUT = new URL("./out/", import.meta.url); fs.mkdirSync(OUT, { recursive: true });
const SET = process.env.SET || "A";
const cases = JSON.parse(fs.readFileSync(new URL(SET === "B" ? "./cases-B.json" : "./cases.json", import.meta.url), "utf8"));
const CLEAN = has("--clean");
const only = val("--only") ? val("--only").split(",") : null;
const store = loadStore();
const f = makeReplayFetch({ mode: has("--record") ? "record" : "replay", store });

const stripPT = (r) => { const { promptText, memText, ...rest } = r; return rest; };
const ARMS = ["live", "livePreG3", "salience", "keepallT", "keepallTP", "keepnone", "read"];

for (const c of cases) {
  if (only && !only.includes(c.id)) continue;
  const file = new URL(`./out/${SET === "B" ? "B-" : ""}${CLEAN ? "clean" : "conv"}-${c.id}.json`, import.meta.url);
  if (fs.existsSync(file) && !has("--force")) { console.log("skip (done)", c.id); continue; }
  const t0 = Date.now();
  const s = newSession(c.id), ctx = makeCtx({ fetchImpl: f });
  const reps = [];
  const anchorRefs = new Set();           // refs of every page that carries the anchor's needles (any turn)
  const needles = [norm(c.anchor.needle0), norm(c.anchor.needle1)];
  const anchorTurns = new Set();           // assistant turns whose spoken claims were witnessed by such a page
  const readBefore = new Set();            // refs whose pages were read before this turn
  let fi = 0; let anchorMem = null;
  for (let t of c.turns) {
    if (CLEAN && t.kind === "pron-bg") { const tk = c.roster[fi++ % c.roster.length]; const bank = JSON.parse(fs.readFileSync(new URL("./corpus/asks.json", import.meta.url), "utf8"))[c.lang]; t = { ...t, kind: "ask", topic: tk, text: bank[tk].qa[0] }; }
    if (CLEAN && t.role === "probe") { const tk = c.roster[fi++ % c.roster.length]; const bank = JSON.parse(fs.readFileSync(new URL("./corpus/asks.json", import.meta.url), "utf8"))[c.lang]; t = { ...t, role: "filler", kind: "ask", topic: tk, text: bank[tk].qa[0], probe: undefined }; }
    const msgsBefore = s.messages.length;
    const pagesBefore = [...ctx.memo.pages.values()].map((v) => norm(v.val.text));
    const rep = await runTurn(s, t.text, ctx);
    // forgetting curve: is the turn-3 exchange still in what the model is handed (memory part only, no current sources)? and which earlier exchanges survive, by age and kind
    if (rep.turn === 3) { const c1 = s.claims.find((x) => x.id.startsWith(`t${rep.assistantTurn}c`)); anchorMem = { ask: norm(t.text).slice(0, 36), claim: c1 ? norm(c1.roles.ARG1).slice(0, 40) : null }; }
    if (rep.turn > 3 && anchorMem) { rep.anchorMem = Object.fromEntries(Object.entries(rep.memText).map(([a, tx]) => [a, { ask: tx.includes(anchorMem.ask), claim: anchorMem.claim ? tx.includes(anchorMem.claim) : null }])); }
    rep.ret = []; for (let age = 1; age <= 14; age++) { const j = reps.length - age; if (j < 0) break; const e = reps[j]; rep.ret.push({ age, kind: e.tkind || e.role, ask: norm(e.said).length >= 12, present: rep.memText.live.includes(norm(e.said).slice(0, 36)) }); }
    const memTexts = rep.memText; delete rep.memText;
    rep.role = t.role; rep.tkind = t.kind || null; rep.topic = t.topic || null;
    // anchor bookkeeping (dynamic gold)
    const storedBefore = s.messages.slice(0, msgsBefore).flatMap((m) => (m.grounding?.passages || []).map((p) => norm(p.text)));
    const passageTexts = (s.messages[s.messages.length - 1].grounding?.passages || []);
    // which of this turn's passages hold the needles
    const holding = (s.messages[s.messages.length - 1].grounding?.passages || []).filter((p) => needles.some((nd) => norm(p.text).includes(nd)));
    holding.forEach((p) => anchorRefs.add(p.ref));
    const cl = s.claims.filter((x) => x.id.startsWith(`t${rep.assistantTurn}c`));
    if (cl.some((x) => anchorRefs.has(String(x.basis?.support || "").split("#")[0]))) anchorTurns.add(rep.assistantTurn);
    if (t.role === "probe") {
      const p = t.probe, g = p.gold;
      const nd = g.type === "needle" ? needles[g.idx] : null;
      rep.probe = { ...p, anchorTurns: [...anchorTurns].filter((x) => x !== rep.assistantTurn) };
      rep.needleIn = nd ? Object.fromEntries(ARMS.map((a) => [a, rep.promptText[a].includes(nd)])) : null;
      rep.storedHasNeedle = nd ? storedBefore.some((x) => x.includes(nd)) : null;
      rep.keepallPages = { needle: nd ? pagesBefore.some((x) => x.includes(nd)) : null, pages: pagesBefore.length, chars: pagesBefore.reduce((a, x) => a + x.length, 0) };
      rep.recallRight = rep.path === "recall" ? anchorTurns.has(rep.recallTurn) && rep.recallTurn !== rep.assistantTurn : null;
      rep.rightMaterial = g.type === "needle" ? (rep.path === "recall" ? !!rep.recallRight : !!rep.needleIn.live) : null;
      if (g.type === "needle" && rep.path === "thread") rep.rightMaterial = !!rep.needleIn.live;
      rep.needleMem = nd ? { live: memTexts.live.includes(nd), livePreG3: memTexts.livePreG3.includes(nd), salience: memTexts.salience.includes(nd), keepallT: memTexts.keepallT.includes(nd), keepallTP: storedBefore.some((x) => x.includes(nd)) || memTexts.keepallT.includes(nd), keepallPages: pagesBefore.some((x) => x.includes(nd)) } : null;
      rep.rightRead = g.type === "needle" ? (rep.path === "recall" ? !!rep.recallRight : !!rep.needleIn.read) : null;
      // the same ask asked COLD (fresh session, fresh memo): what does it cost and does it find the needle without any prior knowledge?
      if (!has("--no-cold")) {
        const cs = newSession("cold"), cctx = makeCtx({ fetchImpl: f });
        const cr = await runTurn(cs, t.text, cctx);
        rep.cold = { path: cr.path, web: cr.web, pages: cr.pages, webReq: cr.webReq, pageReq: cr.pageReq, needle: nd ? cr.promptText.live.includes(nd) : null, needleRead: nd ? cr.promptText.read.includes(nd) : null, searchQ: cr.searchQ };
      }
    }
    reps.push(stripPT(rep));
  }
  // 4d: does a stored claim's address resolve back to bytes, from what is STORED, and in the real page?
  const pageCache = new Map(); const asst = s.messages.filter((m) => m.role === "assistant");
  const ptr = { claims: 0, noCited: 0, inStoredMsg: 0, spanFitsStored: 0, storedSliceEqCited: 0, hasUrl: 0, pageRead: 0, pageSliceEqCited: 0, pageContainsCited: 0, spanBeyond2400: 0 };
  for (const cl of s.claims.slice(0, 40)) {
    const sup = String(cl.basis?.support || ""); const at = sup.lastIndexOf("#"); if (at < 1) continue;
    const m = sup.slice(at + 1).match(/^(\d+)-(\d+)$/); if (!m) continue; const ref = sup.slice(0, at), a = +m[1], b = +m[2];
    ptr.claims++; const cited = cl.basis?.cited; if (typeof cited !== "string") { ptr.noCited++; continue; }
    const turn = Number(cl.id.match(/^t(\d+)/)[1]); const msg = asst[turn - 1]; const pp = (msg?.grounding?.passages || []).find((p) => p.ref === ref);
    if (b > 2400) ptr.spanBeyond2400++;
    if (pp) { ptr.inStoredMsg++; if (b <= pp.text.length) { ptr.spanFitsStored++; if (pp.text.slice(a, b) === cited) ptr.storedSliceEqCited++; } if (pp.url) ptr.hasUrl++;
      if (pp.url) { let pg = pageCache.get(pp.url); if (pg === undefined) { try { pg = await web.readText(pp.url, { fetchImpl: f, memo: null }); } catch { pg = null; } pageCache.set(pp.url, pg && pg.ok ? pg.text : null); pg = pageCache.get(pp.url); } if (pg) { ptr.pageRead++; if (pg.slice(a, b) === cited) ptr.pageSliceEqCited++; if (pg.includes(cited)) ptr.pageContainsCited++; } } }
  }
  const allP = asst.flatMap((m) => m.grounding?.passages || []); const uniq = new Map(allP.map((p) => [p.ref + "|" + p.text, p]));
  const dup = { passages: allP.length, uniquePassages: uniq.size, bytes: allP.reduce((a, p) => a + JSON.stringify(p).length, 0), uniqueBytes: [...uniq.values()].reduce((a, p) => a + JSON.stringify(p).length, 0), distinctRefs: new Set(allP.map((p) => p.ref)).size };
  const out = { dup, ptr, id: c.id, lang: c.lang, length: c.length, anchor: c.anchor, anchorRefs: [...anchorRefs], anchorTurns: [...anchorTurns], turns: reps, claimsBytes: JSON.stringify(s.claims).length, sessionBytes: JSON.stringify(s).length, tookMs: Date.now() - t0 };
  fs.writeFileSync(file, JSON.stringify(out));
  f.flush();
  console.log(c.id, c.lang, "turns", c.length, "ms", Date.now() - t0, "web", reps.reduce((a, r) => a + r.web, 0), "pages", reps.reduce((a, r) => a + r.pages, 0), JSON.stringify(f.stats));
}
f.flush();
