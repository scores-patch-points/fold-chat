// fold-chat-gaps.test.mjs — what the app says, in its OWN voice, when a turn has no answer or no source:
// the model never speaks alone; a search is narrated from the trace, not by the model; a live ask is a gap;
// a blank or failed turn is never blank.
import test from "node:test";
import assert from "node:assert/strict";
import {
  UNSOURCED_ANSWERS, unsourcedPlan, ALONE_KINDS, modelSpeaksAlone, aloneTurn, SMALLTALK_LINE, sourcesPrompt,
  searchAttempts, searchSummary, unreachedGap, liveGap, liveAsk, emptyNotice, errorNotice, gapAnswerLine, noModelFallbackNotice,
} from "./fold-chat-gaps.js";

const TRACE = [
  { scope: "web", q: "easy banana bread", engine: "DuckDuckGo · this machine", n: 0, ok: true },
  { scope: "route", ok: true, engine: "source router", picked: ["web"], skipped: [], webDown: true },
  { scope: "wikipedia", q: "easy banana bread", ok: false, why: "Wikipedia answered 429." },
  { scope: "topic", ok: true, skippedOff: 2, engine: "swarm gate" },
  { read: "https://a.test/x", ok: false, via: null },
  { read: "https://b.test/y", via: "direct", chars: 1200 },
];

// ── the one policy ─────────────────────────────────────────────────────────
test("UNSOURCED_ANSWERS: 'refuse' is the only behaviour — with no source the model is NOT asked (it never speaks alone)", () => {
  assert.equal(UNSOURCED_ANSWERS, "refuse");
  for (const policy of ["refuse", "label", undefined]) {
    const p = unsourcedPlan(policy, {});
    assert.equal(p.callModel, false, String(policy));
    assert.equal(p.sourceBlock, null);
    assert.equal(p.gap, "unreached");
    assert.equal(p.standing, null, "there is no 'from the model' standing any more");
  }
  assert.equal(unsourcedPlan("refuse", { live: true }).gap, "live");
});

test("ALONE_KINDS: no kind may be answered by the model alone by default; each has an app-authored turn", () => {
  assert.deepEqual([...ALONE_KINDS], []);
  for (const k of ["smalltalk", "compute", "code", "transform", "compose", "generate", "research"]) assert.equal(modelSpeaksAlone(k), false, k);
  assert.equal(aloneTurn("smalltalk").notice.text, SMALLTALK_LINE);
  assert.match(SMALLTALK_LINE, /show you what the sources say/);
  assert.equal(aloneTurn("compute").notice, null, "the result card is the answer");
  for (const k of ["code", "transform", "compose", "generate"]) { const n = aloneTurn(k).notice; assert.equal(n.kind, "no-sources"); assert.match(n.text, /no sources for this kind of ask/); assert.match(n.text, /nothing was written/); }
});

// ── what was searched, from the trace ──────────────────────────────────────
test("searchAttempts: the engines that answered or failed, the queries, the pages that could not be read — from the trace only", () => {
  const f = searchAttempts(TRACE);
  assert.deepEqual(f.attempts.map((a) => [a.name, a.ok, a.n, a.why]), [["Web", true, 0, null], ["Wikipedia", false, null, "Wikipedia answered 429."]]);
  assert.deepEqual(f.queries, ["easy banana bread"]);
  assert.equal(f.readOk, 1); assert.equal(f.readFailed, 1); assert.equal(f.webDown, true); assert.equal(f.failures, 1);
  assert.deepEqual(searchAttempts(null).attempts, []);
  assert.deepEqual(searchAttempts([null, 3, "x", {}]).attempts, []);
});

test("searchSummary: one sentence composed from those facts; it names no query, engine or failure the trace lacks", () => {
  const s = searchSummary(searchAttempts(TRACE), "What's a good recipe for banana bread?");
  assert.match(s, /Searched for “What's a good recipe for banana bread\?”/);
  assert.match(s, /Web \(DuckDuckGo · this machine\) returned 0 results/);
  assert.match(s, /Wikipedia failed — Wikipedia answered 429;?/);
  assert.match(s, /1 page found but could not be read/);
  assert.doesNotMatch(s, /keywords|cookbook|recipe websites|I /i, "no invented narration");
  assert.match(searchSummary([], "q"), /No search ran/);
});

test("unreachedGap: the typed 'unreached' gap, app-authored — engines, attempts, note, how to close it", () => {
  const g = unreachedGap(TRACE, "What's a good recipe for banana bread?");
  assert.equal(g.kind, "unreached");
  assert.deepEqual(g.tried, ["DuckDuckGo · this machine", "Wikipedia"]);
  assert.equal(g.attempts.length, 2); assert.equal(g.readFailed, 1);
  assert.match(g.note, /^Searched for/);
  assert.ok(g.closeBy.length >= 2);
  assert.match(gapAnswerLine(g), /No answer was written/);
  assert.equal(gapAnswerLine(null), "");
});

// ── live data ──────────────────────────────────────────────────────────────
test("liveAsk: weather, prices, scores and today's news are live feeds (en + es/fr/de/ru/zh)", () => {
  const live = {
    weather: ["what's the weather like in Seattle today", "Will it rain tomorrow in Paris?", "¿Qué tiempo hace hoy en Madrid? el tiempo hoy", "météo à Lyon", "Wetter in Berlin heute", "погода в Москве сегодня", "东京今天天气怎么样"],
    price: ["bitcoin price", "what is the stock price of AAPL", "USD to EUR exchange rate", "cotización del dólar", "курс доллара", "比特币价格"],
    score: ["live score of the Lakers game", "who won the game last night", "what's the score"],
    news: ["latest news", "news today", "breaking news", "今日新闻", "dernières nouvelles"],
  };
  for (const [what, list] of Object.entries(live)) for (const q of list) assert.equal(liveAsk(q)?.what, what, q);
});

test("liveAsk: explanations, history and past years are NOT live — they are searched and answered normally", () => {
  for (const q of ["how does weather forecasting work", "why does it rain", "what is the average temperature in Seattle", "price of bitcoin in 2017", "history of the stock market", "who won the 2018 World Cup", "what causes thunderstorms", "What's the capital of Australia?", "tell me about mercury", ""]) assert.equal(liveAsk(q), null, q);
});

test("liveGap: the typed 'live data — nothing reachable' gap; what WAS read is listed as a snapshot that did not establish it", () => {
  const g = liveGap(TRACE, "weather in Seattle", { read: [{ title: "Seattle Weather", domain: "weather.com", url: "https://weather.com/s" }], what: "weather" });
  assert.equal(g.kind, "live"); assert.equal(g.what, "weather");
  assert.match(g.note, /weather right now/); assert.match(g.note, /snapshots/);
  assert.equal(g.read.length, 1);
  const none = liveGap(TRACE, "weather in Seattle", { what: "weather" });
  assert.match(none.note, /Searched for/);
  assert.match(gapAnswerLine(g), /live data/);
});

// ── a blank or failed turn is never blank ──────────────────────────────────
test("emptyNotice: a typed, retry-able note for a model that wrote no text", () => {
  const n = emptyNotice({ tokens: 0, model: "gemma2:2b" });
  assert.equal(n.kind, "empty"); assert.equal(n.retry, true);
  assert.match(n.text, /gemma2:2b/); assert.match(n.text, /returned no text/); assert.match(n.text, /nothing here is an answer/i);
  assert.match(emptyNotice({ tokens: 3 }).text, /3 tokens streamed/);
});

test("errorNotice: the bridge's own words, typed, with a retry — timeout, rate limit, unreachable, refused, other", () => {
  const cases = [
    [Object.assign(new Error("the turn timed out (180s)"), { status: 504 }), /timed out before the model finished/],
    [Object.assign(new Error("heimdall bridge answered 429"), { status: 429 }), /rate-limited/],
    [Object.assign(new Error("bridge unreachable: Failed to fetch"), { status: 0 }), /could not be reached/],
    [Object.assign(new Error("sealed-external gate refused this model"), { status: 400 }), /request was refused/],
    [new Error("boom"), /The turn failed: boom/],
  ];
  for (const [err, re] of cases) { const n = errorNotice(err); assert.equal(n.kind, "error"); assert.equal(n.retry, true); assert.match(n.text, re); assert.match(n.text, /Nothing was written/); }
  assert.match(errorNotice("error: x").text, /x/);
  assert.doesNotThrow(() => errorNotice(undefined));
});

test("errorNotice: an in-tab failure is worded as an in-tab failure, never as an unreachable bridge", () => {
  const cdn = errorNotice(Object.assign(new Error("Failed to fetch dynamically imported module"), { place: "tab" }));
  assert.doesNotMatch(cdn.text, /bridge/i);
  assert.match(cdn.text, /in-tab model/i); assert.match(cdn.text, /Nothing was written/);
  for (const kind of ["no-gpu", "loader", "load-failed", "generate-failed", "declined"]) {
    const n = errorNotice(Object.assign(new Error("load failed: NetworkError"), { kind }));
    assert.doesNotMatch(n.text, /bridge/i, kind); assert.match(n.text, /in-tab model/i, kind); assert.equal(n.retry, true);
  }
  // a real bridge failure still says bridge; an in-tab timeout keeps the timeout words
  assert.match(errorNotice(Object.assign(new Error("Failed to fetch"), { status: 0 })).text, /bridge could not be reached/);
  assert.match(errorNotice(Object.assign(new Error("timed out (180s)"), { status: 504, place: "tab", kind: "timeout" })).text, /timed out before the model finished/);
});

test("noModelFallbackNotice: no standalone bridge to start; says the Fold's own server or the in-tab model", () => {
  const n = noModelFallbackNotice({ code: "bridge-down", text: "x" });
  assert.doesNotMatch(n.text, /heimdall up/);
  assert.match(n.text, /npm run serve/); assert.match(n.text, /in-tab model/i);
  assert.equal(n.kind, "fold"); assert.equal(n.why, "bridge-down");
  assert.match(noModelFallbackNotice({ code: "no-models", text: "serves no model" }).text, /serves no model/);
});

test("sourcesPrompt: labels are the fold's, never the model's; the model may not name a source not in the block", () => {
  const p = sourcesPrompt([{ ref: "Wikipedia — Tokyo", text: "Tokyo is big." }, { ref: "x — y", text: "More." }]);
  assert.match(p, /\[W1\] Wikipedia — Tokyo\nTokyo is big\./); assert.match(p, /\[W2\] x — y/);
  assert.match(p, /do not write them/); assert.match(p, /never name a website/); assert.match(p, /language the person wrote in/);
});

// ── G2: a writing request is never answered by quoting pages (fold-chat-genvoid.js) ─────────────
import { genVoid } from "./fold-chat-genvoid.js";
test("gapAnswerLine: a generate void's line is the app's sentence naming the thing; the other kinds are untouched", () => {
  const g = genVoid({ outputType: { type: "essay", topic: "this" } });
  assert.equal(gapAnswerLine(g.void), "No essay was written.");
  assert.equal(gapAnswerLine(genVoid({ outputType: { type: "image", topic: "a dog" } }).void), "No image was made.");
  assert.match(g.void.note, /^I can't write the essay: /, "the reason is the gap block's note, not the empty-answer line");
  assert.match(gapAnswerLine({ kind: "unreached" }), /No answer was written/);
  assert.equal(gapAnswerLine({ kind: "unsupported" }), "");
});
test("aloneTurn: with the output type, a barred writing request names it and carries the typed void; without it, the old note stands", async () => {
  const { aloneTurn } = await import("./fold-chat-gaps.js");
  const a = aloneTurn("generate", { outputType: { type: "essay", topic: "this" } });
  assert.match(a.notice.text, /I can't write the essay/); assert.equal(a.void.kind, "generate"); assert.equal(a.void.reason, "no-topic");
  const b = aloneTurn("compose", { outputType: { type: "cover letter", topic: "my job", needsSources: false, voidIfMissing: ["details"] } });
  assert.match(b.notice.text, /cover letter/); assert.equal(b.void.reason, "own-text-missing");
  const c = aloneTurn("generate"); assert.match(c.notice.text, /There are no sources for this kind of ask/); assert.equal(c.void, undefined);
  assert.equal(aloneTurn("smalltalk", { outputType: { type: "essay" } }).notice.kind, "alone");
});
