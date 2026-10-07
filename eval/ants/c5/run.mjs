// eval/ants/c5/run.mjs — C5: the per-turn prompt built TWO ways (CURRENT vs SALIENT) for the scripted 12-turn conversation (conversation.json),
// with the same functions fold-chat.js uses, then both arms through local Ollama gemma2:2b at temperature 0.
//   node eval/ants/c5/run.mjs [--dry] [--tag name]       --dry builds and measures prompts only (no model)
// Pre-registered in eval/ants/C5-PREREG.md. Writes eval/ants/c5/results-<tag>.json (raw, never edited after the fact).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planTurn } from "../../../fold-chat-flow.js";
import { classifyTurn } from "../../../fold-chat-discourse.js";
import { hintsFor } from "../../../fold-chat-hints.js";
import { admitReferents, emptyReferents } from "../../../fold-chat-mind.js";
import { applyCarry } from "../../../fold-chat-carry.js";
import { applyExchange, exchangesOf, exchangeFlow } from "../../../fold-chat-exchange.js";
import { askTerms, salientSources, continuesThread, salientHistory, salientSummary } from "../../../fold-chat-salience.js";
import { salientHistory as salientHistoryFixed } from "./salience-fixed.js";   // wire.diff applied (exchange-aligned + char-capped history)
import { functionWordsOf } from "../../../fold-chat-snippets.js";
import { modelHistory } from "../../../fold-chat-channels.js";
import { sourcesPrompt, SMALLTALK_LINE } from "../../../fold-chat-gaps.js";
import { threadPrompt } from "../../../fold-chat-thread.js";
import { languageInstruction } from "../../../fold-chat-lang.js";
import * as memory from "../../../fold-chat-memory.js";
import { makeDoor } from "../../../fold-chat-gary.js";
import * as FOLD from "../../../vendor/the-fold/fold.js";
import { buildSummarySystemMessage } from "../../../vendor/the-fold/fold.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const conv = JSON.parse(fs.readFileSync(path.join(HERE, "conversation.json"), "utf8"));
const PAGES = JSON.parse(fs.readFileSync(path.join(HERE, "pages.json"), "utf8"));
const args = process.argv.slice(2);
const DRY = args.includes("--dry");
const TAG = args.includes("--tag") ? args[args.indexOf("--tag") + 1] : new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const MODEL = process.env.C5_MODEL || "gemma2:2b";
const OLLAMA = process.env.OLLAMA || "http://127.0.0.1:11434";

// the fold preset's own system text, read from fold-chat.js so it is the shipped one (not retyped here)
const foldSrc = fs.readFileSync(path.join(HERE, "../../../fold-chat.js"), "utf8");
const PRESET_FOLD = (/\bfold:\s*\{\s*label:\s*"Fold",\s*system:\s*("(?:[^"\\]|\\.)*")/.exec(foldSrc) || [])[1];
if (!PRESET_FOLD) throw new Error("could not read the fold preset from fold-chat.js");
const FOLD_SYSTEM = JSON.parse(PRESET_FOLD);
const VERBATIM_MAX_CHARS = 1600;   // fold-chat.js conversationVerbatim
const FW = functionWordsOf("en");
const door = makeDoor();

const chars = (msgs) => msgs.reduce((n, m) => n + String(m.content || "").length, 0);
const passageOf = (t) => ({ ref: "Wikipedia — " + PAGES[t].title, source: PAGES[t].url, url: PAGES[t].url, text: PAGES[t].text, via: "wikipedia" });

/** A session state; the arm's own answers are appended to it as the conversation goes. */
const newState = () => ({ messages: [], referents: emptyReferents(), summary: FOLD.emptySummary() });
const cloneState = (s) => ({ messages: s.messages.map((m) => ({ ...m })), referents: JSON.parse(JSON.stringify(s.referents)), summary: JSON.parse(JSON.stringify(s.summary)) });

/**
 * Build the prompt for turn `t` as fold-chat.js run() would, on the state BEFORE the turn. `state` is mutated only by the caller (addAnswer).
 * arm "current" = SALIENCE off; "salient" = SALIENCE on (the exact branch of fold-chat.js, lines ~2119-2140).
 * Returns { kind, plan, model:boolean, messages?, info }.
 */
export function buildPrompt(state, t, arm) {
  const s = { ...state, messages: [...state.messages, { role: "user", content: t.ask }] };
  const askAt = s.messages.length - 1;
  const prior = s.messages.slice(0, askAt);
  const said = t.ask;
  const follow = planTurn(said, prior, { referents: s.referents || null, rejected: null, hints: hintsFor("en") });
  const question = follow.retry || said;
  const searchQ = follow.search || question;
  const kind = classifyTurn(question, { hasMaterial: false });
  const info = { n: t.n, ask: t.ask, kind, follow: { kind: follow.kind, mode: follow.mode, search: follow.search || null, carried: follow.carried || [] } };
  if (kind === "smalltalk") return { kind, follow, model: false, info: { ...info, note: "greeting/thanks: the fold's fixed line, no search, no model" } };
  const threadTurn = follow.mode === "thread" ? follow.thread : null;
  const webPassages = follow.mode === "web" ? (t.pages || []).map(passageOf) : [];
  let sourceBlock = threadTurn ? threadPrompt(threadTurn) : webPassages.length ? sourcesPrompt(webPassages) : null;
  const history = modelHistory(s.messages);
  const recencyWindow = (() => { const total = history.reduce((n, m) => n + String(m.content || "").length, 0); return history.length > 1 && total > 0 && total <= VERBATIM_MAX_CHARS ? history.length : undefined; })();
  const langLine = languageInstruction(question, { prior: "en" });
  const basePrompt = [FOLD_SYSTEM, memory.systemContext({ readerName: null, facts: {} })].filter(Boolean).join(" ");
  const turnBase = [basePrompt, langLine].filter(Boolean).join(" ");
  const fromWeb = !!webPassages.length && !threadTurn;
  let promptHistory = history.slice(0, -1), promptSummary = s.summary, promptPassages = webPassages;
  const sal = { used: false, continues: null, pages: null, dropped: [] };
  if (arm === "salient" || arm === "fixed") {
    sal.used = true;
    const termsS = askTerms({ question, searchQ }, FW);
    if (termsS) {
      const exS = exchangesOf(s.messages.slice(0, askAt));
      const continuesS = continuesThread({ follow, terms: termsS, lastExchange: exS[exS.length - 1] || null });
      sal.continues = continuesS;
      promptHistory = arm === "fixed" ? salientHistoryFixed(promptHistory, { continues: continuesS, fw: FW }) : salientHistory(promptHistory, { continues: continuesS });
      promptSummary = salientSummary(s.summary, { continues: continuesS, terms: termsS, exchanges: exS, flowOf: exchangeFlow, empty: FOLD.emptySummary() });
      if (fromWeb && !webPassages.some((p) => p.recipe)) {
        const r = salientSources(webPassages, termsS);
        sal.dropped = r.dropped;
        if (r.passages.length) {
          promptPassages = r.passages;
          sourceBlock = sourcesPrompt(promptPassages);
          sal.pages = r.passages.map((p) => ({ ref: p.ref, kept: p.excerpt.sentences.kept, of: p.excerpt.sentences.of, chars: p.text.length, excerpt: p.text }));
        }
      }
    }
  }
  const composed = door.composeTurn({
    basePrompt: turnBase, cues: [], summary: promptSummary, history: promptHistory, question, sourceBlock, recencyWindow,
    shrinkSource: fromWeb ? (maxChars) => sourcesPrompt(promptPassages.map((p) => ({ ...p, text: String(p.text || "").slice(0, maxChars) }))) : null,
  }, { model: MODEL, maxTokens: 1024, material: webPassages.length + (threadTurn ? 1 : 0) });
  const messages = composed.messages;
  if (composed.refused.length) return { kind, follow, model: false, info: { ...info, note: "REFUSED by the door: " + composed.refused.map((f) => f.rule).join(",") } };
  const sys = String(messages[0]?.role === "system" ? messages[0].content : "");
  const sourceText = sourceBlock && sys.includes(sourceBlock.slice(0, 60)) ? sys.slice(sys.indexOf(sourceBlock.slice(0, 60))) : "";
  const outsideSources = [sys.slice(0, sys.length - sourceText.length), ...messages.slice(1).map((m) => m.content)].join("\n");
  const carriedMsgs = messages.slice(1, -1);
  const pastDiscourse = buildSummarySystemMessage(promptSummary);
  if (!sal.pages && fromWeb) sal.pages = webPassages.map((p) => ({ ref: p.ref, kept: sentenceCount(p.text), of: sentenceCount(p.text), chars: p.text.length, excerpt: null }));
  info.sizes = {
    chars: chars(messages), tokens4: Math.round(chars(messages) / 4),
    system: sys.length, sources: sourceText.length, pastDiscourse: pastDiscourse ? pastDiscourse.length : 0,
    history: chars(carriedMsgs), historyMsgs: carriedMsgs.length, question: String(messages.at(-1)?.content || "").length,
  };
  info.sal = sal;
  info.withheld = composed.withheld || [];
  return { kind, follow, model: true, messages, sourceText, outsideSources, info, threadTurn, webPassages, question, searchQ };
}
const sentenceCount = (text) => (String(text).match(/[^.!?]+[.!?]+(\s|$)/g) || [String(text)]).length;

/** Fold the finished turn into the arm's state the way fold-chat.js does after a turn (answer message, referents, exchange summary). */
function addAnswer(state, t, built, answerText) {
  const asst = answerText != null && answerText !== ""
    ? { role: "assistant", content: answerText, mode: "chat" }
    : { role: "assistant", content: "", notices: [{ kind: "alone", text: SMALLTALK_LINE }] };
  state.messages.push({ role: "user", content: t.ask }, asst);
  const used = built.model && built.webPassages?.length ? [{ title: PAGES[t.pages[0]].title }] : [];
  state.referents = admitReferents(state.referents || emptyReferents(), { question: built.question || t.ask, answer: answerText || "", sources: used });
  state.summary = applyExchange(applyCarry(state.summary, state), state);
}

// ── the model: local Ollama, temperature 0 ──────────────────────────────────────────────────────────────────────────────
async function ollama(messages) {
  // unload first so the prefix cache cannot hide prompt tokens from prompt_eval_count
  try { await fetch(OLLAMA + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, messages: [], keep_alive: 0 }) }); } catch {}
  const r = await fetch(OLLAMA + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, messages, stream: false, options: { temperature: 0, seed: 0, num_ctx: 8192, num_predict: 400 } }) });
  const j = await r.json();
  if (!j.message) throw new Error("ollama: " + JSON.stringify(j).slice(0, 200));
  return { text: String(j.message.content || "").trim(), promptEval: j.prompt_eval_count ?? null, evalCount: j.eval_count ?? null };
}

// ── the criteria (C5-PREREG.md) ─────────────────────────────────────────────────────────────────────────────────────────
const has = (hay, needle) => String(hay).toLowerCase().includes(String(needle).toLowerCase());
function judge(t, built, state) {
  if (t.chitchat) return { pass: !built.model, why: built.model ? "model was called on chit-chat" : "model not called (fixed line)", checks: {} };
  if (!built.model) return { pass: false, why: "no model prompt: " + built.info.note, checks: {} };
  const checks = {};
  const body = built.messages.map((m) => m.content).join("\n");
  if (t.needle && !t.thread) checks.needle = has(built.sourceText, t.needle);
  if (t.dependent) {
    const prevAsk = state.messages.filter((m) => m.role === "user").at(-1)?.content || "";
    const prevAns = state.messages.filter((m) => m.role === "assistant" && m.content).at(-1)?.content || "";
    const ch = built.outsideSources + (t.thread ? "\n" + built.sourceText : "");
    checks.dConv = has(ch, prevAsk) && has(ch, prevAns.slice(0, 80)) && has(ch, t.referent);
    checks.prevAskPresent = has(ch, prevAsk); checks.prevAnswerPresent = has(ch, prevAns.slice(0, 80)); checks.referentPresent = has(ch, t.referent);
  }
  if (t.switch) { const leaks = (t.markers || []).filter((w) => has(built.outsideSources, w)); checks.leak = leaks; checks.noLeak = leaks.length === 0; }
  const keys = Object.entries(checks).filter(([k]) => ["needle", "dConv", "noLeak"].includes(k)).map(([, v]) => v);
  return { pass: keys.length > 0 && keys.every(Boolean), checks };
}

// ── run ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const result = { tag: TAG, model: MODEL, dry: DRY, at: new Date().toISOString(), arms: { current: [], salient: [], ...(args.includes("--fixed") ? { fixed: [] } : {}) }, paired: [] };
const states = { current: newState(), salient: newState(), fixed: newState() };
for (const t of conv.turns) {
  for (const arm of Object.keys(result.arms)) {
    const st = states[arm];
    const built = buildPrompt(st, t, arm);
    // PAIRED size: on the CURRENT arm's transcript, also build the salient prompt (identical history for both)
    if (arm === "current") { const b2 = buildPrompt(cloneState(st), t, "salient"); result.paired.push({ n: t.n, current: built.info.sizes || null, salient: b2.info.sizes || null, salientSal: b2.info.sal || null }); }
    const verdict = judge(t, built, st);
    let answer = null, model = null;
    if (built.model && !DRY) {
      model = await ollama(built.messages);
      answer = model.text;
    }
    const rec = { n: t.n, ask: t.ask, role: t.role, kind: built.kind, info: built.info, verdict, answer, model, messages: built.messages || null };
    result.arms[arm].push(rec);
    // the answer is the history of the next turn: the arm's own (DRY: the first source sentence stands in, labelled)
    const said = built.model ? (answer ?? (built.webPassages?.[0] ? built.webPassages[0].text.split(/(?<=[.!?])\s+/)[1] : "(dry)")) : "";
    addAnswer(st, t, built, said);
    console.log(`[${arm}] T${t.n} ${built.kind.padEnd(8)} ${built.model ? built.info.sizes.chars + " chars" : "no model call"} pass=${verdict.pass} ${JSON.stringify(verdict.checks)}${answer ? "\n      -> " + answer.replace(/\s+/g, " ").slice(0, 160) : ""}`);
  }
}
fs.writeFileSync(path.join(HERE, `results-${TAG}.json`), JSON.stringify(result, null, 1));
console.log("wrote results-" + TAG + ".json");
