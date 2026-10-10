// stale.mjs — claim (2d): when a fact CHANGED after the turn that said it, does the app serve the old claim as current, or tell? Also the person's correction.
//   node eval/ants/d1/stale.mjs     writes out/stale.json.   The "page edit" is SYNTHETIC (the recorded Wikipedia extract of the anchor topic has one figure rewritten in the
//   replayed response after the anchor turn) because no real page changed during this study. Everything else is the app's own code.
import fs from "node:fs";
import { makeReplayFetch } from "./lib/replay.mjs";
import { newSession, runTurn, makeCtx, norm } from "./sim.mjs";
const NEEDLES = JSON.parse(fs.readFileSync(new URL("./corpus/needles.json", import.meta.url), "utf8")).en;
const base = makeReplayFetch({ mode: "replay" });
// the edit: from `edited=true` on, every replayed body that carries OLD carries NEW instead
const FIG = { everest: [/8,840 m/, "8,850 m"], titanic: [/15 April 1912/, "16 April 1912"], canberra: [/484,630/, "484,999"], curie: [/7 November 1867/, "8 November 1867"] };
let edited = false, editFig = null;
const fetchImpl = async (u, o) => { const r = await base(u, o); if (!edited || !editFig) return r; const body = await r.text(); const nb = body.replace(new RegExp(editFig[0].source, "g"), editFig[1]); return new Response(nb, { status: r.status, headers: r.headers }); };
const out = [];
for (const [topic, spec] of Object.entries(FIG)) {
  const A = JSON.parse(fs.readFileSync(new URL("./corpus/asks.json", import.meta.url), "utf8")).en[topic];
  const s = newSession("stale-" + topic), ctx = makeCtx({ fetchImpl }); ctx.prefer = norm(NEEDLES[topic][0]);   // the stand-in says the sentence that carries the figure, so the claim holds it
  edited = false; editFig = spec;
  const log = [];
  const say = async (label, text) => { const r = await runTurn(s, text, ctx); const row = { label, said: text, path: r.path, web: r.web, pages: r.pages, spoken: r.spoken.slice(0, 200), recallTurn: r.recallTurn, fresh: r.fresh, carried: r.follow.carried, search: r.follow.search }; log.push(row); return r; };
  await say("anchor", A.qa[0]);
  const claimAtAnchor = s.claims.map((c) => c.roles.ARG1).join(" ");
  for (const f of ["Who invented the telephone?", "How long is the Great Wall of China?", "What is photosynthesis?"].filter((q) => !A.qa.includes(q))) await say("filler", f);
  edited = true;   // the page now says something else
  // (a) the person asks what was said: the store answers
  const a = await say("recall-after-edit", `What did you tell me about ${A.name} earlier?`);
  // (b) the same ask again: the app searches and reads the page as it is now
  const b = await say("repeat-after-edit-within-TTL", A.qa[0]);          // the page memo (10 min) still holds the page as it WAS
  ctx.newMemo();                                                          // ten minutes later
  const b2 = await say("repeat-after-edit-after-TTL", A.qa[0]);
  // (c) the person corrects the figure, then asks for the earlier answer again
  const c = await say("correction", `Actually, it was ${spec[1]}.`);
  const d = await say("recall-after-correction", `What did you tell me about ${A.name} earlier?`);
  // (d) a thread follow-up straight after an answer about an edited page
  const s2 = newSession("stale2-" + topic); edited = false; await runTurn(s2, A.qa[0], ctx); edited = true;
  const e = await runTurn(s2, "shorter", ctx);
  const claimNow = (r) => (r.spoken || r.recallText || "");
  out.push({ topic, figure: [spec[0].source, spec[1]], claimAtAnchor: claimAtAnchor.slice(0, 300),
    recallAfterEdit: { path: a.path, said: (a.recallText || "").slice(0, 300), hasOldFigure: spec[0].test(a.recallText || ""), staleSignal: !!(a.fresh && a.fresh.stale), freshness: a.fresh },
    repeatAfterTTL: { path: b2.path, web: b2.web, pages: b2.pages, spokenHasNew: norm(b2.spoken).includes(norm(spec[1])), spokenHasOld: spec[0].test(b2.spoken), fresh: b2.fresh },
    repeatAfterEdit: { path: b.path, web: b.web, pages: b.pages, spokenHasNew: norm(b.spoken).includes(norm(spec[1])), spokenHasOld: spec[0].test(b.spoken), fresh: b.fresh },
    correction: { path: c.path, web: c.web, searchQ: c.searchQ, followKind: c.follow.kind, spoken: c.spoken.slice(0, 160) },
    recallAfterCorrection: { path: d.path, said: (d.recallText || "").slice(0, 300), hasOldFigure: spec[0].test(d.recallText || ""), hasCorrectedFigure: norm(d.recallText || "").includes(norm(spec[1])) },
    threadAfterEdit: { path: e.path, web: e.web, spoken: e.spoken.slice(0, 200), hasOldFigure: spec[0].test(e.spoken), staleSignal: !!(e.fresh && e.fresh.stale), freshness: e.fresh },
    log });
  console.log(topic, JSON.stringify({ recall: out.at(-1).recallAfterEdit.hasOldFigure, recallSignal: out.at(-1).recallAfterEdit.staleSignal, repeat: out.at(-1).repeatAfterEdit.spokenHasNew, repeatFresh: out.at(-1).repeatAfterEdit.fresh, corr: out.at(-1).correction.path + "/" + out.at(-1).correction.web, recallAfterCorr: out.at(-1).recallAfterCorrection.hasOldFigure, thread: out.at(-1).threadAfterEdit.path }));
}
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./out/stale.json", import.meta.url), JSON.stringify({ misses: base.stats.misses, out }, null, 1));
