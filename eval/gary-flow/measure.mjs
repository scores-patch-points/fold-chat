// eval/gary-flow/measure.mjs — BEFORE / AFTER / AFTER-NC on the pre-registered sets (see PREREG.md). Node, no browser.
//   node eval/gary-flow/measure.mjs                 run the arms against gemma2:2b on the local Ollama (needs :11435), write results.json
//   node eval/gary-flow/measure.mjs --report        print the tables from results.json
// Passages are fetched through the app's own searchWeb the first time a query is needed and cached in passages.json by query, so
// every arm that searches the same query reads the SAME sources. Nothing here touches the app's config.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import * as FOLD from "../../vendor/the-fold/fold.js";
import { classifyTurn, skipsSearch, KIND_PROMPT } from "../../fold-chat-discourse.js";
import { sourcesPrompt, modelSpeaksAlone } from "../../fold-chat-gaps.js";
import { turnPlan, threadPrompt } from "../../fold-chat-thread.js";
import { planTurn, cuesFor, actOf } from "../../fold-chat-flow.js";
import { readFelt } from "../../fold-chat-pathos.js";
import { door, noteWindows } from "../../fold-chat-gary.js";
import { CARD_PROMPT } from "../../fold-chat-snip.js";
import { stripScaffolding } from "../../fold-chat-attribution.js";
import { stripSelfCitations } from "../../fold-chat-ground.js";
import { modelHistory } from "../../fold-chat-channels.js";
import { systemContext } from "../../fold-chat-memory.js";
import { languageInstruction, sameLanguage, detectLang } from "../../fold-chat-lang.js";
import { admitReferents, emptyReferents } from "../../fold-chat-mind.js";
import { hintsFor } from "../../fold-chat-hints.js";
import * as web from "../../fold-chat-web.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OLLAMA = process.env.OLLAMA || "http://127.0.0.1:11435";
const MODEL = "gemma2:2b";
const MAX_TOKENS = 400;
const ARGS = new Set(process.argv.slice(2));
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(",")) : null;
const f = (n) => path.join(HERE, n);
const readJson = (n, d) => { try { return JSON.parse(fs.readFileSync(f(n), "utf8")); } catch { return d; } };
const writeJson = (n, v) => fs.writeFileSync(f(n), JSON.stringify(v, null, 1));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── the sets ───────────────────────────────────────────────────────────────────────────────────────────────────────────────
const EVERYDAY = fs.readFileSync("/private/tmp/claude-501/-Users-mlacy-Documents-3-0-the-fold/079c90f2-e828-4baf-8c6c-5d90024766de/scratchpad/everyday.mjs", "utf8");
const PARA = JSON.parse(EVERYDAY.match(/const PARA = (".*?");/s)[1]);
const E25 = [
  ["greet", "hi", /./], ["recipe", "What's a good recipe for banana bread?", /banana|bread|flour|bake/i], ["science", "Explain the difference between a virus and a bacterium", /virus|bacteri/i],
  ["code", "How do I reverse a string in Python?", /reverse|\[::-1\]|string/i], ["math", "What is 15% of 240?", /36/], ["travel", "Give me a 3-day itinerary for Lisbon", /lisbon|lisboa/i],
  ["capital", "What's the capital of Australia?", /canberra/i], ["write", "Write a short thank-you note to my neighbor for watering my plants", /thank|plant|water/i],
  ["translate", "Translate 'where is the train station' into Spanish and French", /estación|gare|station/i], ["health", "Is it safe to eat eggs after the expiration date?", /egg/i],
  ["compare", "Compare iPhone and Android for a first-time smartphone user", /iphone|android/i], ["summarize", "Summarize this in one sentence: " + PARA, /bike|maple|council/i],
  ["worldcup", "Who won the World Cup in 2018?", /france/i], ["calories", "How many calories are in an avocado?", /calor|avocado/i], ["weather", "what's the weather like in Seattle today", /seattle|weather/i],
  ["sleep", "Give me tips to fall asleep faster", /sleep|bed/i], ["interest", "How does compound interest work? Give an example.", /interest|compound/i], ["typo", "wat is the tallest mountain on earth lol", /everest|mountain/i],
  ["ambig", "tell me about mercury", /mercury/i], ["austen1", "Who wrote Pride and Prejudice?", /austen/i], ["guitar1", "I want to learn guitar", /guitar/i],
  ["es", "¿Cuál es la capital de Francia?", /par[ií]s|francia/i], ["zh", "东京有多少人口？", /东京|人口|万/], ["de", "Wie funktioniert ein Elektromotor?", /motor|strom|magnet/i], ["advice", "I have a job interview tomorrow and I'm nervous. Any advice?", /interview|nervous/i],
].map(([id, q, topic]) => ({ id, set: "E25", turns: [{ q, topic }] }));
const C10 = [
  ["c1", "cookie", [["show me a cookie recipe", /cookie|butter|sugar|flour/i], ["i want a chewier one", /chew|cookie|sugar|butter/i, { search: [/chew/i, /cookie/i] }], ["what?", /cookie|butter|sugar|chew/i, { mode: "thread" }]]],
  ["c2", "austen", [["Who wrote Pride and Prejudice?", /austen/i], ["when was it published?", /1813|publish/i], ["are you sure?", /austen|pride|1813|publish/i, { mode: "thread" }]]],
  ["c3", "guitar", [["I want to learn guitar", /guitar|chord|string/i], ["where should I start?", /guitar|chord|string|lesson/i], ["shorter", /guitar|chord|string|start/i, { mode: "thread" }]]],
  ["c4", "interest", [["How does compound interest work?", /interest|compound/i], ["give me an example", /interest|\$|principal|year/i], ["so what does it all mean", /interest|compound|grow|money/i, { mode: "thread" }]]],
  ["c5", "capital", [["What's the capital of Australia?", /canberra/i], ["why not Sydney?", /sydney|canberra|capital/i], ["prove it", /canberra|capital|sydney|melbourne/i, { mode: "thread" }]]],
  ["c6", "virus", [["Explain the difference between a virus and a bacterium", /virus|bacteri/i], ["which is worse?", /virus|bacteri/i], ["i don't get it", /virus|bacteri|cell/i, { mode: "thread" }]]],
  ["c7", "es", [["¿Cuál es la capital de Francia?", /par[ií]s|francia/i], ["¿y la de Italia?", /roma|italia/i], ["¿qué?", /par[ií]s|francia|roma|capital/i, { gap: true }]]],
  ["c8", "zh", [["东京有多少人口？", /东京|人口|万/], ["那大阪呢？", /大阪|人口|万/], ["什么？", /东京|大阪|人口|万/, { gap: true }]]],
  ["c9", "code", [["How do I reverse a string in Python?", /reverse|string/i], ["in javascript instead", /javascript|reverse/i, { gap: true }], ["what?", /./, { mode: "cold-gap" }]]],
].map(([id, name, turns]) => ({ id, set: "C10", name, turns: turns.map(([q, topic, gold]) => ({ q, topic, gold: gold || null })) }));
const C10COLD = ["what?", "are you sure?", "prove it"].map((q, i) => ({ id: "c10-" + (i + 1), set: "C10", name: "cold", turns: [{ q, topic: /./, gold: { mode: "cold-gap" } }] }));
const C11 = { id: "c11", set: "C11", name: "flat", turns: [
  { q: "who wrote Emma?", canned: "Jane Austen wrote Emma. It is a novel. It is a comedy. It is set in England." },
  { q: "who wrote Persuasion?", canned: "Jane Austen wrote Persuasion. It is a novel. It is a romance. It is set in England." },
  { q: "who wrote Northanger Abbey?", canned: "Jane Austen wrote Northanger Abbey. It is a novel. It is a satire. It is set in England." },
  { q: "who wrote Mansfield Park?", topic: /austen|mansfield/i },
] };
const CASES = [...E25, ...C10, ...C10COLD, C11];

// ── AFTER-INFO: the two blocks as plain information (harness-only experiment; PREREG addendum 2) ──────────────────────────
const infoSources = (passages) => "The pages below were read for the question. Their texts are the whole of what is known here: an answer states what they say, in plain sentences, in the language the person wrote in, and where they leave something out it says what is missing. If they turn out to be about something else, or are only an error or verification page, one plain sentence says so. Each text starts with a bracketed label that only marks where it begins.\n\n"
  + passages.map((p, i) => `[W${i + 1}] ${p.ref}\n${String(p.text ?? "").slice(0, 4000)}`).join("\n\n");
const infoThread = (t) => "The person is following up on an earlier exchange: what they ask about is what the answer below says. A reply restates, shortens, simplifies or explains it, in their language, in a few sentences, with nothing added that the answer does not contain; if it does not contain what they ask, one plain sentence says so.\n\n"
  + (t.ask ? `[T1] What the person asked earlier:\n${String(t.ask).slice(0, 1200)}\n\n` : "") + `[T2] The answer given:\n${String(t.answer || "").slice(0, 4000)}`;

// ── what the app puts in the prompt (copied from run(), not re-derived) ───────────────────────────────────────────────────
const APP = fs.readFileSync(path.join(HERE, "../../fold-chat.js"), "utf8");
const FOLD_SYSTEM = JSON.parse(APP.match(/fold: \{ label: "Fold", system: (".*?") \},\n/s)[1]);
const basePromptFor = () => [FOLD_SYSTEM, systemContext({ readerName: null, facts: {} })].filter(Boolean).join(" ");
const VERBATIM_MAX_CHARS = 1600;
const verbatim = (s) => { const m = modelHistory(s.messages); const total = m.reduce((n, x) => n + String(x.content || "").length, 0); return m.length > 1 && total > 0 && total <= VERBATIM_MAX_CHARS; };
const topicWordsOK = (re, text) => re.test(String(text || ""));
const estTokens = (msgs) => Math.ceil(msgs.map((m) => String(m.content ?? "")).join("\n").length / 4);

// ── passages: a read-through store, frozen after the harvest pass ────────────────────────────────────────────────────────
const PASSAGES = readJson("passages.json", {});
async function passagesFor(query, { allowFetch }) {
  if (PASSAGES[query]) return PASSAGES[query];
  if (!allowFetch) return null;
  let w = null;
  for (let i = 0; i < 2 && !w; i++) {
    try { w = await web.searchWeb(query, { effort: "balanced", fetchImpl: fetch, webBudgetMs: 45000 }); } catch { await sleep(5000); }
  }
  PASSAGES[query] = { passages: (w?.passages || []).map((p) => ({ ref: p.ref, text: String(p.text || "").slice(0, 4000), recipe: p.recipe || undefined })), reached: !!(w?.passages || []).length };
  writeJson("passages.json", PASSAGES);
  await sleep(1200);
  return PASSAGES[query];
}

// ── one turn under one arm ─────────────────────────────────────────────────────────────────────────────────────────────────
async function ollama(messages) {
  const r = await fetch(OLLAMA + "/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, messages, temperature: 0, max_tokens: MAX_TOKENS, stream: false }), signal: AbortSignal.timeout(180000) });
  if (!r.ok) throw new Error("ollama " + r.status);
  const j = await r.json();
  return String(j.choices?.[0]?.message?.content ?? "");
}

const LEAK = ["[w1", "[w2", "[t1]", "[t2]", "earlier turn", "answer only", "the prompt", "the passage", "the material", "the sources", "according to the source", "the fold",
  "hand the thread back", "the guest", "drawn out", "gone flat", "pushed back", "standing it earned", "leave room for"];
const leaksOf = (t) => { const x = String(t).toLocaleLowerCase(); return LEAK.filter((w) => x.includes(w)); };
const endsQ = (t) => /\?\s*["”')\]]*\s*$/u.test(String(t).trim());
const words = (t) => (String(t).match(/[\p{L}\p{N}'’]+/gu) || []).length;

async function runTurn(arm, c, ti, s, { allowFetch, callModel }) {
  const T = c.turns[ti];
  const q = T.q;
  s.messages.push({ role: "user", content: q });
  if (T.canned) { s.messages.push({ role: "assistant", content: T.canned, mode: "chat", grounding: { model: MODEL } }); const n = s.messages.filter((m) => m.role === "assistant").length; s.summary = { ...FOLD.emptySummary(), topic: c.turns[0].q, turnCount: n }; return { id: c.id, turn: ti, q, arm, canned: true, plan: { mode: "canned" } }; }
  const askAt = s.messages.length - 1;
  const prior = s.messages.slice(0, askAt);
  const lang0 = detectLang(q).lang;
  const follow = (arm === "before" ? turnPlan : planTurn)(q, prior, { referents: s.referents || null, hints: hintsFor(lang0 === "unknown" ? "en" : lang0) });
  const kind = classifyTurn(q, { hasMaterial: false });
  const wantWeb = !skipsSearch(kind) && follow.mode === "web";
  const threadTurn = follow.mode === "thread" ? follow.thread : null;
  const searchQ = follow.search || q;
  const got = wantWeb ? await passagesFor(searchQ, { allowFetch }) : { passages: [], reached: false };
  if (got === null) { s.messages.pop(); return { missing: searchQ }; }
  const passages = got.passages;
  const rec = { id: c.id, turn: ti, q, arm, kind, plan: { mode: follow.mode, kind: follow.kind, search: follow.search || null, act: follow.act || null }, searched: wantWeb, passages: passages.length, modelCalled: false };
  let sourceBlock = null;
  const info = arm === "after-info";
  const srcFor = (ps) => (info ? infoSources(ps) : sourcesPrompt(ps)) + (ps.some((p) => p.recipe) ? "\n\n" + CARD_PROMPT : "");
  if (passages.length) sourceBlock = srcFor(passages);
  else if (threadTurn) sourceBlock = info ? infoThread(threadTurn) : threadPrompt(threadTurn);
  const aloneBarred = !wantWeb && !modelSpeaksAlone(kind) && !threadTurn;
  const barred = (wantWeb && !passages.length) || aloneBarred;
  rec.barred = barred;
  const langLine = languageInstruction(q);
  const turnBase = [basePromptFor(), kind === "advice" ? KIND_PROMPT.advice : null, langLine].filter(Boolean).join(" ");
  const history = modelHistory(s.messages);
  const recencyWindow = verbatim(s) ? history.length : undefined;
  let messages = null;
  if (!barred) {
    if (arm === "before") {
      messages = FOLD.buildTurnMessages({ basePrompt: turnBase, summary: s.summary, history: history.slice(0, -1), question: q, sourceBlock, recencyWindow });
    } else {
      const conversational = kind === "research" || kind === "chat" || kind === "advice" || !!threadTurn;
      let cues = [];
      if ((arm === "after" || arm === "after-dd" || arm === "after-info") && conversational) {
        const felt = readFelt(prior, { convo: c.id, memo: s.pathos });
        if (!felt.gap) s.pathos = felt.memo;
        const flow = cuesFor({ act: follow.act || actOf(q), felt: felt.felt, pathosCue: felt.cue, door });
        cues = flow.cues; rec.cues = cues.map((x) => x.from); rec.cueDropped = flow.dropped.length || undefined;
      }
      door.drain();
      const fromWeb = !!passages.length && !threadTurn;
      const composed = door.composeTurn({ basePrompt: turnBase, cues, summary: s.summary, history: history.slice(0, -1), question: q, sourceBlock, recencyWindow,
        shrinkSource: fromWeb ? (n) => srcFor(passages.map((p) => ({ ...p, text: String(p.text).slice(0, n) }))) : null },
      { model: MODEL, maxTokens: MAX_TOKENS, material: passages.length + (threadTurn ? 1 : 0), dedupe: arm === "after-dd" || arm === "after-info" });
      messages = composed.messages;
      rec.gary = { findings: composed.findings.map((x) => x.rule), withheld: composed.withheld, refused: composed.refused.map((x) => x.rule), struck: composed.struck };
      if (composed.refused.length) { rec.barred = true; messages = null; }
    }
  }
  if (messages) {
    rec.tokens = estTokens(messages);
    rec.over4096 = rec.tokens + MAX_TOKENS > 4096;
    const last = messages.at(-1);
    rec.questionLast = last.role === "user" && last.content === q;
    rec.messageRoles = messages.map((m) => m.role).join(",");
    if (callModel) {
      const raw = await ollama(messages);
      let text = stripSelfCitations(raw).text;
      text = stripScaffolding(text, passages).text;
      rec.modelCalled = true; rec.raw = raw; rec.text = text;
      rec.leaks = leaksOf(text); rec.topical = topicWordsOK(T.topic, text); rec.endsQ = endsQ(text); rec.words = words(text);
      const sl = sameLanguage(q, text);
      rec.lang = { q: sl.question.lang, reply: sl.reply?.lang || null, same: sl.same };
    }
  }
  // the turn lands on the conversation as run() leaves it
  const text = rec.text || "";
  s.messages.push({ role: "assistant", content: text, mode: "chat", grounding: text ? { model: MODEL } : undefined, ...(text ? {} : { notices: [{ kind: "gap" }] }) });
  const n = s.messages.filter((m) => m.role === "assistant").length;
  const first = s.messages.find((m) => m.role === "user")?.content || "";
  s.summary = { ...FOLD.emptySummary(), topic: first.split(/[.?!\n]/)[0].slice(0, 120), flow: `${n} turn(s) · opening on "${first.slice(0, 60)}"`, turnCount: n };
  try { s.referents = admitReferents(s.referents || emptyReferents(), { question: q, answer: text, sources: passages.map((p) => ({ title: String(p.ref || "").includes(" — ") ? String(p.ref).slice(String(p.ref).indexOf(" — ") + 3) : String(p.ref || "") })) }); } catch {}
  // gold
  const g = T.gold;
  if (g) {
    if (g.mode) rec.routeOK = follow.mode === g.mode && (g.mode !== "cold-gap" || (!rec.modelCalled && !text));
    if (g.search) rec.routeOK = follow.mode === "web" && g.search.every((re) => re.test(searchQ));
    if (g.gap) rec.routeOK = null;   // recorded, not scored
  }
  return rec;
}

// ── the run ────────────────────────────────────────────────────────────────────────────────────────────────────────────────
async function main() {
  if (ARGS.has("--report")) return report();
  { const ps = await fetch(OLLAMA + "/api/ps").then((r) => r.json()).catch(() => null); const m = ps?.models?.find((x) => x.name === MODEL); if (m) noteWindows([{ id: MODEL, ctx: m.context_length }]); }
  const arms = ["before", "after", "after-nc", "after-dd", "after-info"];
  const results = readJson("results.json", []);
  const shared = readJson("turn1.json", {});    // the prior assistant turns every arm shares (generated once under BEFORE)
  for (const c of CASES) {
    if (ONLY && !ONLY.has(c.id)) continue;
    for (const arm of arms) {
      if (results.some((r) => r.id === c.id && r.arm === arm && r.turn === c.turns.length - 1)) continue;
      const s = { messages: [], summary: FOLD.emptySummary(), referents: null, pathos: null };
      for (let ti = 0; ti < c.turns.length; ti++) {
        const key = c.id + ":" + ti;
        const rec = await runTurn(arm, c, ti, s, { allowFetch: true, callModel: true });
        if (rec.canned) continue;
        if (arm === "before" && ti < c.turns.length - 1) shared[key] = { text: rec.text || "" };
        if (arm !== "before" && ti < c.turns.length - 1 && shared[key]) {
          // the follow-up is the only variable: the earlier answer is the one BEFORE wrote, verbatim, in every arm
          const last = s.messages.at(-1); last.content = shared[key].text;
          if (shared[key].text) { last.grounding = { model: MODEL }; delete last.notices; } else { delete last.grounding; last.notices = [{ kind: "gap" }]; }
        }
        results.push(rec);
        console.log(`${arm.padEnd(8)} ${c.id.padEnd(9)} t${ti} ${String(rec.plan.mode).padEnd(9)} ${rec.barred ? "barred" : "model "} ${(rec.text || "").replace(/\s+/g, " ").slice(0, 70)}`);
      }
    }
    writeJson("results.json", results); writeJson("turn1.json", shared);
  }
  console.log("passages.json sha256", crypto.createHash("sha256").update(fs.readFileSync(f("passages.json"))).digest("hex"));
  report();
}

function report() {
  const R = readJson("results.json", []);
  const arms = ["before", "after", "after-nc", "after-dd", "after-info"].filter((a) => R.some((r) => r.arm === a));
  const by = (arm, pred = () => true) => R.filter((r) => r.arm === arm && pred(r));
  const pct = (a, b) => (b ? `${a}/${b}` : "n/a");
  const lines = [];
  const row = (name, fn) => lines.push(name.padEnd(46) + arms.map((a) => String(fn(a)).padEnd(14)).join(""));
  lines.push("criterion".padEnd(46) + arms.map((a) => a.padEnd(14)).join(""));
  const follow = (r) => r.routeOK !== undefined && r.routeOK !== null;
  row("R route correct (gold follow-ups)", (a) => pct(by(a, (r) => follow(r) && r.routeOK).length, by(a, follow).length));
  const model = (r) => r.modelCalled;
  row("model turns (n)", (a) => by(a, model).length);
  row("T topical (model turns)", (a) => pct(by(a, (r) => model(r) && r.topical).length, by(a, model).length));
  row("L leak failures", (a) => by(a, (r) => model(r) && r.leaks.length).length);
  row("Q question last+verbatim (model turns)", (a) => pct(by(a, (r) => model(r) && r.questionLast).length, by(a, model).length));
  const nonEn = (r) => r.lang && r.lang.q !== "en" && r.lang.q !== "unknown";
  row("G language matches (model turns)", (a) => pct(by(a, (r) => model(r) && r.lang?.same).length, by(a, model).length));
  row("G language matches (non-English asks)", (a) => pct(by(a, (r) => model(r) && nonEn(r) && r.lang.same).length, by(a, (r) => model(r) && nonEn(r)).length));
  const mean = (xs) => (xs.length ? (xs.reduce((p, q) => p + q, 0) / xs.length).toFixed(0) : "n/a");
  row("K mean prompt tokens (est)", (a) => mean(by(a, (r) => r.tokens).map((r) => r.tokens)));
  row("K max prompt tokens (est)", (a) => Math.max(0, ...by(a, (r) => r.tokens).map((r) => r.tokens)));
  row("K calls over 4096 window", (a) => by(a, (r) => r.over4096).length);
  const e25 = (r) => r.id && !/^c\d/.test(r.id) && model(r);
  row("E ends-with-question rate (E25)", (a) => pct(by(a, (r) => e25(r) && r.endsQ).length, by(a, e25).length));
  row("W mean words (model turns)", (a) => mean(by(a, model).map((r) => r.words)));
  row("cold/gap turns with zero model calls", (a) => pct(by(a, (r) => r.plan.mode === "cold-gap" && !r.modelCalled).length, by(a, (r) => r.plan.mode === "cold-gap").length));
  // the bars that compare arms on the SAME turns
  const key = (r) => r.id + ":" + r.turn;
  const both = (a, b2) => { const A = new Map(by(a, model).map((r) => [key(r), r])); return by(b2, model).filter((r) => A.has(key(r))).map((r) => [A.get(key(r)), r]); };
  lines.push("");
  lines.push("same-turn comparisons (turns BOTH arms answered with the model):");
  for (const [a, b2] of [["before", "after"], ["after-nc", "after"], ["after", "after-dd"], ["after-dd", "after-info"], ["before", "after-info"]]) {
    if (!by(a).length || !by(b2).length) continue;
    const pairs = both(a, b2);
    const th = pairs.filter(([, y]) => y.plan.mode === "thread");
    const c = (rows, f) => rows.filter(([x, y]) => f(x)).length + "→" + rows.filter(([x, y]) => f(y)).length;
    // c(rows, f) counts f over the FIRST arm then the SECOND
    const cnt = (rows, f, i) => rows.filter((pr) => f(pr[i])).length;
    const tok = (rows, i) => mean(rows.map((pr) => pr[i].tokens));
    lines.push(`  ${a} → ${b2}: n=${pairs.length}  T ${cnt(pairs, (r) => r.topical, 0)}→${cnt(pairs, (r) => r.topical, 1)}  L ${cnt(pairs, (r) => r.leaks.length, 0)}→${cnt(pairs, (r) => r.leaks.length, 1)}  G ${cnt(pairs, (r) => r.lang?.same, 0)}→${cnt(pairs, (r) => r.lang?.same, 1)}  tokens ${tok(pairs, 0)}→${tok(pairs, 1)}   | thread turns n=${th.length}: T ${cnt(th, (r) => r.topical, 0)}→${cnt(th, (r) => r.topical, 1)} L ${cnt(th, (r) => r.leaks.length, 0)}→${cnt(th, (r) => r.leaks.length, 1)} G ${cnt(th, (r) => r.lang?.same, 0)}→${cnt(th, (r) => r.lang?.same, 1)} tokens ${tok(th, 0)}→${tok(th, 1)}`);
    void c;
  }
  console.log(lines.join("\n"));
  console.log("\nper-turn routing of the follow-ups (BEFORE → AFTER):");
  for (const r of by("after", follow)) {
    const b = R.find((x) => x.arm === "before" && x.id === r.id && x.turn === r.turn);
    console.log(`  ${r.id} t${r.turn} ${JSON.stringify(r.q).padEnd(30)} before=${b?.plan.mode}${b?.plan.search ? "(" + b.plan.search + ")" : ""} ${b?.routeOK ? "ok" : "X"}   after=${r.plan.mode}${r.plan.kind ? "/" + r.plan.kind : ""} ${r.routeOK ? "ok" : "X"}`);
  }
}
await main();
