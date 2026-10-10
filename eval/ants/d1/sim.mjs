// eval/ants/d1/sim.mjs — the LIVE TURN DECISION + BOOKKEEPING of fold-chat.js run(), minus the DOM and the model, driving the app's own pure modules.
// The model is an EXTRACTIVE STAND-IN (the two source sentences that best overlap the ask, verbatim, with their support addresses). Everything the app DECIDES
// (plan, recall, thread, search, what is handed to the model, what is stored) is the app's own code. See D1-PREREG.md "What the harness is".
import fs from "node:fs";
import * as web from "../../../fold-chat-web.js";
import { planTurn } from "../../../fold-chat-flow.js";
import { pre as watchPre, post as watchPost, batonReply, inspectReply, withoutAppAnswered } from "../../../fold-chat-watch.js";
import { sourceRecall } from "../../../fold-chat-sourceask.js";
import { recallOf } from "../../../fold-chat-recall.js";
import { lookupWarranted } from "../../../fold-chat-self.js";
import { classifyTurn, skipsSearch } from "../../../fold-chat-discourse.js";
import { modelSpeaksAlone, sourcesPrompt } from "../../../fold-chat-gaps.js";
import { salientSentences } from "../../../fold-chat-present.js";
import { hintsFor } from "../../../fold-chat-hints.js";
import { detectLang, threadLanguage } from "../../../fold-chat-lang.js";
import { functionWordsOf } from "../../../fold-chat-snippets.js";
import { rejectedSurfaces, mindsClause } from "../../../fold-chat-minds.js";
import { modelHistory } from "../../../fold-chat-channels.js";
import { continuesByAnaphora } from "../../../fold-chat-anaphora.js";
import { threadPrompt } from "../../../fold-chat-thread.js";
import { claimsOfTurn, appendClaims, pointerOf } from "../../../fold-chat-record.js";
import { freshnessOf } from "../../../fold-chat-freshness.js";
import { applyCarry } from "../../../fold-chat-carry.js";
import { applyExchange, usedRefs, foldAnswer, exchangesOf, exchangeFlow } from "../../../fold-chat-exchange.js";
import { admitReferents, emptyReferents } from "../../../fold-chat-mind.js";
import { askTerms, salientSources, continuesThread, salientHistory, salientSummary } from "../../../fold-chat-salience.js";
import { classifyUrl } from "../../../fold-chat-budget.js";
import * as memory from "../../../fold-chat-memory.js";
import * as ground from "../../../fold-chat-ground.js";
import * as FOLD from "../../../vendor/the-fold/fold.js";
import { sentencesWithOffsets } from "../../../fold-chat-impression.js";

const SRC = fs.readFileSync(new URL("../../../fold-chat.js", import.meta.url), "utf8");
const m = /fold: \{ label: "Fold", system: "((?:[^"\\]|\\.)*)"/.exec(SRC);
export const PRESET_FOLD = m ? JSON.parse('"' + m[1] + '"') : "You are the fold.";

const truncate = (x, n) => (String(x || "").length > n ? String(x).slice(0, n - 1) + "…" : String(x || ""));
export const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

export function newSession(id = "s") {
  return { id, messages: [], summary: FOLD.emptySummary(), claims: [], referents: null, minds: null, facts: {}, attachments: [], preset: "fold", clock: 0 };
}

// copied VERBATIM from fold-chat.js refreshSummaryMechanical (not exported there)
function refreshSummaryMechanical(s) {
  if (!s?.summary) return;
  const msgs = (s.messages || []).filter((x) => x.role === "user" && x.content && !x.attachment);
  const first = msgs.find((x) => String(x.content).trim().length >= 24) || msgs[0];
  const topic = first ? String(first.content).trim().split(/[.?!\n]/)[0].slice(0, 120) : s.summary.topic;
  const fromK = (s.attachments || []).flatMap((a) => (a.names || []));
  const entities = [...new Set(fromK.map((x) => String(x).trim()).filter((x) => x.length > 1 && x.length < 40))].slice(0, 8);
  const flow = `${s.summary.turnCount} turn(s) · opening on "${truncate(topic || "", 60)}"`;
  const lastRec = (s.summary.records || []).slice(-1)[0];
  const context = lastRec && (lastRec.unsupported?.length || lastRec.open?.length) ? `open: ${(lastRec.open?.length ? lastRec.open : lastRec.unsupported).join("; ")}` : s.summary.context;
  s.summary = { ...s.summary, topic: topic || s.summary.topic, flow, entities: entities.length ? entities : s.summary.entities, context: context || null, language: s.summary.language || "en" };
}

// fold-chat.js conversationVerbatim
const VERBATIM_MAX_CHARS = 1600;
const conversationVerbatim = (s) => { const msgs = modelHistory(s.messages); const total = msgs.reduce((n, x) => n + String(x.content || "").length, 0); return msgs.length > 1 && total > 0 && total <= VERBATIM_MAX_CHARS; };

// the stand-in model: the two visible source sentences that best overlap the ask (verbatim); support = `<ref>#<from>-<to>` in the passage's own text
function standIn({ visible, full, ask, fw, prefer = null }) {
  const askStems = new Set(ground.tokenize(ask).filter((t) => !fw.has(t) && t.length > 1).map(ground.stemOf));
  const cands = [];
  for (const v of visible) {
    const whole = (full.find((p) => p.ref === v.ref) || v);
    const title = String(v.ref).includes(" — ") ? String(v.ref).slice(String(v.ref).indexOf(" — ") + 3) : String(v.ref);
    const titleBonus = 2 * [...new Set(ground.tokenize(title).map(ground.stemOf))].filter((t) => askStems.has(t)).length;   // a reader weights the page that is ABOUT the ask
    for (const sn of sentencesWithOffsets(String(v.text))) {
      if (ground.tokenize(sn.text).length < 5) continue;
      const at = String(whole.text).indexOf(sn.text);
      if (at < 0) continue;
      const st = new Set(ground.tokenize(sn.text).map(ground.stemOf));
      const score = [...askStems].filter((t) => st.has(t)).length + titleBonus + (/\d/.test(sn.text) ? 0.25 : 0);
      cands.push({ ref: v.ref, text: sn.text, from: at, to: at + sn.text.length, score: score + (prefer && norm(sn.text).includes(prefer) ? 100 : 0) });
    }
  }
  cands.sort((a, b) => b.score - a.score || a.from - b.from);
  return cands.slice(0, 2).sort((a, b) => (a.ref === b.ref ? a.from - b.from : 0));
}

const CHIT = /^(hi|hey|hello|hola|bonjour|salut|thanks|thank you|thx|gracias|merci|ok|okay|ok cool|cool|vale|d'accord|interesting|nice|great|bye|adios|au revoir)\b/i;

/** One turn. ctx: { fetch, memo, count(fn), arms:true }. Returns a TurnReport; mutates s as the live app does. */
export async function runTurn(s, said, ctx) {
  const fw0 = (lang) => functionWordsOf(lang === "unknown" ? "en" : lang);
  const now = () => (s.clock += 1000);
  s.messages.push({ role: "user", content: said, at: now() });
  const askAt = s.messages.length - 1;
  const prior = s.messages.slice(0, askAt);
  const threadLang = threadLanguage(prior);
  const lang0 = detectLang(said, { prior: threadLang }).lang;
  const hints = hintsFor(lang0 === "unknown" ? "en" : lang0);
  const popts = { referents: s.referents || null, rejected: rejectedSurfaces(s.minds), hints };
  const follow = planTurn(said, prior, popts);
  let watcherPre = null; try { watcherPre = watchPre({ ask: said, prior, opts: popts }); } catch {}
  const question = follow.retry || said;
  const searchQ = follow.search || question;
  let threadTurn = follow.mode === "thread" ? follow.thread : null;
  const kind = classifyTurn(question, { hasMaterial: false });
  const history = modelHistory(withoutAppAnswered(s.messages), { styleSafe: { kind, classify: (q) => classifyTurn(q, {}), leansOnLast: continuesByAnaphora(follow) } });
  const fw = fw0(lang0);
  const lookup = !skipsSearch(kind) && !!question && follow.mode === "web" ? lookupWarranted({ question, follow, fw }) : null;
  const noLookup = !!(lookup && !lookup.warranted);
  const recall = !skipsSearch(kind) && !!question && follow.mode === "web" ? recallOf({ question, claims: s.claims || [], fw }) : null;
  const watchText = watcherPre && follow.mode !== "cold-gap" ? (watcherPre.want === "inspect" ? inspectReply(prior, said) : null) : null;
  let srcRecall = follow.kind === "source-ask" && follow.mode === "web" ? sourceRecall(prior, said) : null;
  if (!srcRecall && !watchText && watcherPre && follow.kind === "source-ask" && follow.mode === "web") { const br = batonReply(watcherPre); if (br) srcRecall = { text: br, fromBaton: true }; }
  if (!srcRecall && watchText) srcRecall = { text: watchText, fromBaton: true, inspect: true };
  const wantWeb = !skipsSearch(kind) && !!question && follow.mode === "web" && !noLookup && !recall && !srcRecall && kind !== "self";
  const rep = { turn: s.messages.filter((x) => x.role === "user").length, said, kind, follow: { kind: follow.kind, mode: follow.mode, search: follow.search || null, carried: follow.carried || [], reason: follow.reason }, path: null, searchQ: null, web: 0, pages: 0, webKeys: [], pageKeys: [], recallTurn: null, recallText: null, passages: [] };
  const reqs = []; ctx.count.set((url, o) => { const c = classifyUrl(url, (o && o.method) || "GET"); if (c) reqs.push(c); });
  let webPassages = [], sourceBlock = null, text = "", units = [], fixedLine = null;
  if (wantWeb) {
    rep.path = "web"; rep.searchQ = searchQ;
    const nEnt = web.queriesFor(searchQ).length;
    const w = await web.searchWeb(searchQ, { effort: "balanced", read: Math.min(6, Math.max(3, nEnt)), memo: ctx.memo, fetchImpl: ctx.fetch });
    webPassages = w.passages || [];
    if (webPassages.length) sourceBlock = sourcesPrompt(webPassages.map((p) => { const sal = salientSentences(p.text, searchQ, 4); return sal.length >= 2 ? { ...p, text: sal.join(" ") } : p; }));
  } else if (threadTurn) {
    rep.path = "thread";
    sourceBlock = threadPrompt(threadTurn);
    const prevAns = s.messages[threadTurn.answerIndex] || [...s.messages].reverse().find((x) => x.role === "assistant" && x.grounding);
    const pg = prevAns?.grounding || {};
    const carried = pg.passages?.length ? pg.passages : (pg.sources || []).filter((x) => String(x.span || x.text || "").length >= 40).map((x) => ({ ref: x.ref, source: x.address, text: String(x.span || x.text) }));
    if (carried.length) { webPassages = carried.map((p) => ({ ...p })); sourceBlock += "\n\n" + sourcesPrompt(webPassages); threadTurn.carried = webPassages.length; }
  } else if (recall) { rep.path = "recall"; rep.recallTurn = recall.turn; rep.recallText = recall.text; }
  else if (srcRecall) rep.path = "srcrecall";
  else if (follow.mode === "cold-gap") rep.path = "cold-gap";
  else if (noLookup) rep.path = "nolookup";
  else if (kind === "self") rep.path = "self";
  else rep.path = "model-alone";   // greeting / chit-chat / own-text kinds
  ctx.count.set(null);
  rep.web = new Set(reqs.filter((r) => r.kind === "web").map((r) => r.key)).size; rep.pages = new Set(reqs.filter((r) => r.kind === "pages").map((r) => r.key)).size;
  rep.webReq = reqs.filter((r) => r.kind === "web").length; rep.pageReq = reqs.filter((r) => r.kind === "pages").length;
  rep.webKeys = [...new Set(reqs.filter((r) => r.kind === "web").map((r) => r.key))]; rep.pageKeys = [...new Set(reqs.filter((r) => r.kind === "pages").map((r) => r.key))];
  rep.passages = webPassages.map((p) => ({ ref: p.ref, chars: String(p.text || "").length }));

  // ── what the model is handed (the live config) ──
  const identityLine = memory.systemContext({ readerName: null, facts: s.facts || {} });
  const basePrompt = [PRESET_FOLD, identityLine].filter(Boolean).join(" ");
  const modelBarred = !(wantWeb && webPassages.length) && !threadTurn;
  const histForPrompt = history.slice(0, -1);
  // (G3) THE GATE ON THE PROMPT (fold-chat.js, working tree 2026-10-07): an ask that does not lean on the earlier turn is handed none of the exchange and none of the summary
  const gateOn = !!(follow.gate && !continuesByAnaphora(follow) && (kind === "research" || kind === "chat" || kind === "advice"));
  rep.gateOn = gateOn;
  const recencyWindow = conversationVerbatim(s) ? history.length : undefined;
  const build = ({ hist, summary, src, rw }) => FOLD.buildTurnMessages({ basePrompt, summary, history: hist, question, sourceBlock: src, recencyWindow: rw });
  const parts = (msgs) => ({ chars: FOLD.charCount(msgs), sys: String(msgs[0]?.content || "").length, hist: msgs.slice(1, -1).reduce((n, x) => n + x.content.length, 0), q: msgs[msgs.length - 1].content.length, text: msgs.map((x) => x.content).join("\n") });
  rep.modelCalled = !modelBarred;
  const arms = {};
  const liveSummary = gateOn ? salientSummary(s.summary, { continues: false, empty: FOLD.emptySummary() }) : s.summary, liveHist = gateOn ? [] : histForPrompt;
  const liveMsgs = build({ hist: liveHist, summary: liveSummary, src: sourceBlock, rw: recencyWindow });
  arms.live = parts(liveMsgs);
  arms.livePreG3 = parts(build({ hist: histForPrompt, summary: s.summary, src: sourceBlock, rw: recencyWindow }));
  const sSum = liveSummary ? FOLD.buildSummarySystemMessage(liveSummary) : null, sRec = liveSummary ? FOLD.buildRecordSystemMessage(liveSummary) : null;
  arms.live.summaryChars = sSum ? sSum.length : 0; arms.live.recordChars = sRec ? sRec.length : 0; arms.live.sourceChars = sourceBlock ? sourceBlock.length : 0; arms.live.baseChars = basePrompt.length;
  // SALIENCE ON (fold-chat.js lines 2167-2185, verbatim logic)
  {
    let ph = histForPrompt, ps = s.summary, pp = webPassages, src = sourceBlock;
    const termsS = askTerms({ question, searchQ }, fw);
    if (termsS) {
      const exS = exchangesOf(s.messages.slice(0, askAt));
      const cont = continuesThread({ follow, terms: termsS, lastExchange: exS[exS.length - 1] || null });
      ph = salientHistory(ph, { continues: cont });
      ps = salientSummary(s.summary, { continues: cont, terms: termsS, exchanges: exS, flowOf: exchangeFlow, empty: FOLD.emptySummary() });
      if (wantWeb && webPassages.length) { const sal = salientSources(webPassages, termsS); if (sal.passages.length) { pp = sal.passages; src = sourcesPrompt(pp); } }
    }
    arms.salience = parts(build({ hist: ph, summary: ps, src, rw: recencyWindow }));
    var salHist = ph, salSum = ps;
  }
  // KEEP-EVERYTHING: the whole transcript as the history (T) and, in TP, every page read so far as well
  {
    const all = modelHistory(withoutAppAnswered(s.messages)).slice(0, -1);
    arms.keepallT = parts(build({ hist: all, summary: FOLD.emptySummary(), src: sourceBlock, rw: all.length || undefined }));
    const seen = new Map(); for (const mm of s.messages) for (const p of mm.grounding?.passages || []) seen.set(p.ref + "|" + p.text.length, p);
    const bank = "Pages read earlier in this conversation:\n" + [...seen.values()].map((p) => `${p.ref}\n${p.text}`).join("\n\n");
    arms.keepallTP = parts(build({ hist: all, summary: FOLD.emptySummary(), src: [sourceBlock, bank].filter(Boolean).join("\n\n"), rw: all.length || undefined }));
  }
  const memBuild = (hist, summary, rw) => norm(FOLD.buildTurnMessages({ basePrompt: "", summary, history: hist, question: "", sourceBlock: null, recencyWindow: rw }).map((x) => x.content).join("\n"));
  rep.memText = { live: memBuild(liveHist, liveSummary, recencyWindow), livePreG3: memBuild(histForPrompt, s.summary, recencyWindow), salience: memBuild(salHist, salSum, recencyWindow), keepallT: memBuild(modelHistory(withoutAppAnswered(s.messages)).slice(0, -1), FOLD.emptySummary(), 1e6) };
  arms.keepnone = parts(build({ hist: [], summary: FOLD.emptySummary(), src: sourceBlock, rw: 1 }));
  rep.arms = Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, { chars: v.chars, sys: v.sys, hist: v.hist, q: v.q, ...(v.summaryChars != null ? { summaryChars: v.summaryChars, recordChars: v.recordChars, sourceChars: v.sourceChars, baseChars: v.baseChars } : {}) }]));
  rep.promptText = Object.fromEntries(Object.entries(arms).map(([k, v]) => [k, norm(v.text)]));   // for needle checks only; stripped before saving
  rep.promptText.read = norm(webPassages.map((p) => String(p.text || "")).join("\n"));   // RETRIEVAL level: what this turn READ (before the model-facing compression); for the ceiling check only
  rep.historyMsgs = (recencyWindow ? history.length : Math.min(4, histForPrompt.length)) ;

  // ── the turn's answer (stand-in) and the bookkeeping the live app does at the end ──
  let notices = [], watchEvents = [];
  if (rep.path === "web") { watchEvents.push({ type: "t", op: "line", title: "The query", note: `searching for “${searchQ}”` }); for (const p of webPassages) watchEvents.push({ type: "t", op: "line", title: "Read " + p.ref, note: "" }); watchEvents.push({ type: "t", op: "line", title: "Searched web", note: "" }); }
  if (rep.path === "recall") watchEvents.push({ type: "t", op: "line", title: "Read back what I said", note: "no search, no model" });
  if (!modelBarred) {
    const visible = (() => { const t = new Map(); for (const p of webPassages) { const sal = salientSentences(p.text, searchQ, 4); t.set(p.ref, { ref: p.ref, text: sal.length >= 2 ? sal.join(" ") : p.text }); } return [...t.values()]; })();
    const best = threadTurn && !wantWeb ? (() => { const first = String(threadTurn.answer || "").split(/(?<=[.!?])\s+/)[0] || ""; return first ? [{ ref: (webPassages[0] && webPassages[0].ref) || "thread", text: first, from: 0, to: first.length, score: 1 }] : []; })() : standIn({ visible, full: webPassages, ask: searchQ, fw, prefer: ctx.prefer || null });
    units = best.map((b) => ({ kind: "sentence", text: b.text, support: `${b.ref}#${b.from}-${b.to}` }));
    text = units.map((u) => u.text).join(" ");
  } else if (rep.path === "model-alone" || rep.path === "self") { text = rep.path === "self" ? "I'm the fold, a reading and research tool." : (CHIT.test(said) ? "You're welcome." : ""); }
  else if (["recall", "srcrecall", "cold-gap", "nolookup"].includes(rep.path)) { text = ""; notices = [{ kind: "alone", text: rep.recallText || "" }]; }
  else if (wantWeb && !webPassages.length) { text = ""; notices = [{ kind: "no-sources" }]; }
  const turn = s.messages.filter((x) => x.role === "assistant").length + 1;
  const material = webPassages.map((p) => ({ ref: p.ref, text: String(p.text || "") }));
  const record = { sources: units.map((u) => ({ address: u.support, text: u.text, ref: u.support.split("#")[0] })) };
  // FRESHNESS (live: feed note only), against the pages this turn carries
  let fresh = null; try { fresh = freshnessOf({ claims: s.claims || [], pages: material }); } catch {}
  rep.fresh = fresh ? { checked: fresh.checked, counts: fresh.counts, stale: fresh.stale.length } : null;
  const pivotRes = units.length ? { units } : null;
  const turnClaims = claimsOfTurn({ turn, pivot: pivotRes, record, material });
  s.claims = appendClaims(s.claims, turnClaims);
  const foldLine = FOLD.mechanicalFoldLine(question, foldAnswer({ text, strand: null }));
  const warrant = { ...FOLD.buildWarrantRecord({ turn, plane: "world", gist: foldLine, channels: [webPassages.length ? "web" : null, "model"].filter(Boolean), refs: record.sources.map((r) => r.address), unsupported: [], open: [] }), ...pointerOf({ turn, claims: turnClaims, forWhom: question }) };
  s.summary = FOLD.addWarrantRecord(FOLD.advanceSummaryFold(s.summary, foldLine), warrant);
  refreshSummaryMechanical(s);
  // the message (grounding as the live app stores it: passages up to 8 x 2400 chars; sources = the spoken sentences' addresses)
  const grounding = recordable(kind) ? { kind, passages: webPassages.slice(0, 8).map((p) => ({ ref: p.ref, source: p.source || p.url, url: p.url, title: p.title, domain: p.domain, text: String(p.text || "").slice(0, 2400) })), sources: record.sources.map((r) => ({ address: r.address, text: r.text, ref: r.ref })) } : null;
  let aw = null;
  try { aw = watchPost({ ask: said, prior, pre: watcherPre, reads: webPassages.map((p) => String(p.url || p.source || "")).filter(Boolean), events: watchEvents, passages: webPassages, spoken: text, reached: !!srcRecall }); } catch {}
  const msg = { role: "assistant", content: text, at: now(), mode: "chat", grounding, ...(aw ? { watch: { relation: aw.relation, want: aw.want, flags: aw.flags.map((f) => f.flag), baton: aw.baton, ...(aw.detail ? { detail: aw.detail } : {}), ...(aw.appAnswered ? { appAnswered: true } : {}) } } : {}), ...(notices.length ? { notices } : {}) };
  s.messages.push(msg);
  try {
    const used = usedRefs({ pivot: pivotRes, record });
    s.referents = admitReferents(s.referents || emptyReferents(), { question, answer: text, sources: webPassages.filter((p) => used.has(String(p.ref || ""))).map((p) => ({ title: (String(p.ref || "").includes(" — ") ? String(p.ref).slice(String(p.ref).indexOf(" — ") + 3) : String(p.ref || "")).split(/\s+[|–—-]\s+/)[0] })).filter((x) => x.title.trim().split(/\s+/).length <= 4) });
    s.summary = applyExchange(applyCarry(s.summary, s), s);
  } catch (e) { rep.bookkeepingError = String(e.message || e); }
  rep.spoken = text; rep.claimsAdded = turnClaims.length; rep.assistantTurn = turn;
  rep.carryNotice = follow.kind === "carried" ? follow.carried : null;
  rep.stored = { claimsBytes: JSON.stringify(turnClaims).length, warrantBytes: JSON.stringify(warrant).length, groundingBytes: JSON.stringify(grounding || {}).length, msgBytes: JSON.stringify(msg).length };
  rep.stored.summaryBytes = JSON.stringify({ topic: s.summary.topic, flow: s.summary.flow, entities: s.summary.entities, folds: s.summary.folds }).length;
  rep.referents = (s.referents?.entities || []).slice(0, 4).map((e) => e.surface);
  return rep;
}
const recordable = (kind) => kind === "research" || kind === "chat" || kind === "generate" || kind === "advice" || kind === "compute" || kind === "transform" || kind === "code" || kind === "compose";

export function makeCtx({ fetchImpl, memoMode = "kept" } = {}) {
  let hook = null; const ctx = { memo: web.makeMemo(), count: { set: (f) => { hook = f; } }, memoMode };
  ctx.fetch = (u, o) => { if (hook) { try { hook(typeof u === "string" ? u : u.url, o); } catch {} } return fetchImpl(u, o); };
  ctx.newMemo = () => { ctx.memo = web.makeMemo(); };
  return ctx;
}
