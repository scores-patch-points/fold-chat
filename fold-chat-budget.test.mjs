// fold-chat-budget.test.mjs — the per-ask request budget (eval/ants/C4-PREREG.md claims M1..M9). Run: node --test fold-chat-budget.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { makeBudget, presetFor, configOf, classifyUrl, guardFetch, BudgetRefused, PRESETS, KINDS, TIERS } from "./fold-chat-budget.js";

const clock = (t = 0) => { const c = () => t; c.set = (v) => { t = v; }; c.add = (v) => { t += v; }; return c; };
const mk = (config, now = clock()) => makeBudget({ config, now });
const cfg = (o) => ({ ms: 1000, hedge: 2, web: { answer: 0, corroborate: 0, origin: 0 }, pages: { answer: 0, corroborate: 0, origin: 0 }, models: { answer: 0, corroborate: 0, origin: 0 }, ...o });

test("M1 a kind's total never exceeds its cap, whoever asks", () => {
  const b = mk(cfg({ web: { answer: 2, corroborate: 1, origin: 1 } }));
  let ok = 0;
  for (let i = 0; i < 20; i++) for (const t of TIERS) if (b.spend("web", t, "k" + i + t).ok) ok++;
  assert.equal(ok, 4);
  assert.equal(b.count("web"), 4);
  assert.equal(b.spend("web", "answer", "more").ok, false);
});

test("M1 a kind with no allowance refuses with none-allowed (chat has no web)", () => {
  const b = makeBudget({ preset: "chat" });
  const r = b.spend("web", "answer", "q");
  assert.equal(r.ok, false); assert.equal(r.why, "none-allowed");
  assert.equal(b.spend("models", "answer").ok, true);
  assert.equal(b.spend("models", "answer").ok, false);   // chat: one model call
});

test("M2 priority: the answer is never starved by corroboration or origin spending first", () => {
  const b = mk(cfg({ pages: { answer: 2, corroborate: 1, origin: 1 } }));
  // origin and corroborate rush in first: they may take only what the answer does not hold
  assert.equal(b.spend("pages", "origin", "o1").ok, true);          // 4 cap - 2 reserved(answer) - 1 reserved(corroborate) = 1 for origin
  assert.equal(b.spend("pages", "origin", "o2").ok, false);
  assert.equal(b.spend("pages", "corroborate", "c1").ok, true);
  assert.equal(b.spend("pages", "corroborate", "c2").ok, false);
  assert.equal(b.spend("pages", "answer", "a1").ok, true);
  assert.equal(b.spend("pages", "answer", "a2").ok, true);
  assert.equal(b.spend("pages", "answer", "a3").ok, false);
});

test("M2 the answer may borrow what lower tiers have not spent", () => {
  const b = mk(cfg({ pages: { answer: 1, corroborate: 1, origin: 1 } }));
  assert.equal(b.spend("pages", "answer", "a1").ok, true);
  assert.equal(b.spend("pages", "answer", "a2").ok, true);
  assert.equal(b.spend("pages", "answer", "a3").ok, true);
  assert.equal(b.spend("pages", "answer", "a4").ok, false);
  assert.equal(b.spend("pages", "origin", "o").ok, false);          // nothing left
});

test("M3 a lower tier cannot take a working higher tier's reserve; done() releases it", () => {
  const b = mk(cfg({ web: { answer: 2, corroborate: 1, origin: 0 } }));
  assert.equal(b.spend("web", "answer", "a1").ok, true);            // answer spent 1 of 2; 1 is still held
  assert.equal(b.spend("web", "corroborate", "c1").ok, true);       // 3 cap - 1 spent - 1 reserved = 1 room
  const r = b.spend("web", "corroborate", "c2");
  assert.equal(r.ok, false); assert.equal(r.why, "reserved-for-higher-priority");
  b.done("answer");                                                  // the answer step ended with a spare
  assert.equal(b.spend("web", "corroborate", "c2").ok, true);
});

test("M3 done() of a LOWER tier does not release anything to a higher one it never held back", () => {
  const b = mk(cfg({ web: { answer: 1, corroborate: 0, origin: 1 } }));
  b.done("origin");
  assert.equal(b.spend("web", "answer", "a").ok, true);
  assert.equal(b.spend("web", "answer", "b").ok, true);             // the answer may borrow the origin tier's allowance, done or not
  assert.equal(b.spend("web", "answer", "c").ok, false);
});

test("M4 the same key charges once; a different key charges again; kinds do not share keys", () => {
  const b = mk(cfg({ pages: { answer: 1, corroborate: 0, origin: 0 }, web: { answer: 1, corroborate: 0, origin: 0 } }));
  assert.deepEqual(b.spend("pages", "answer", "https://x/p"), { ok: true });
  assert.deepEqual(b.spend("pages", "answer", "https://x/p"), { ok: true, free: true });
  assert.deepEqual(b.spend("pages", "answer", "https://x/p"), { ok: true, free: true });
  assert.equal(b.count("pages"), 1);
  assert.equal(b.spend("pages", "answer", "https://x/q").ok, false);
  assert.deepEqual(b.spend("web", "answer", "https://x/p"), { ok: true });   // same string, other kind
});

test("M4 a key already paid for stays free even after the budget is spent or time is up", () => {
  const c = clock();
  const b = mk(cfg({ pages: { answer: 1, corroborate: 0, origin: 0 } }), c);
  b.spend("pages", "answer", "u"); c.set(99999);
  assert.deepEqual(b.spend("pages", "answer", "u"), { ok: true, free: true });
});

test("M5 exhausted(kind) is exactly 'the next spend would be refused'", () => {
  const c = mk(cfg({ models: { answer: 1, corroborate: 1, origin: 0 } }));
  assert.equal(c.exhausted("models"), false);
  c.spend("models", "answer");
  assert.equal(c.exhausted("models"), false);                       // the corroborate allowance is still there for the answer to borrow
  c.spend("models", "corroborate");
  assert.equal(c.exhausted("models"), true);
  assert.equal(c.exhausted("models", "origin"), true);
  assert.equal(c.spend("models", "answer").ok, false);
});

test("M5 exhausted agrees with spend for every state of a small budget (exhaustive)", () => {
  for (const [a, c, o] of [[0, 0, 0], [1, 0, 0], [1, 1, 0], [2, 1, 1], [0, 2, 0]]) {
    for (const first of [[], ["origin"], ["corroborate"], ["answer"], ["origin", "corroborate", "answer"]]) {
      for (const tier of TIERS) {
        const b = mk(cfg({ web: { answer: a, corroborate: c, origin: o } }));
        first.forEach((t, i) => b.spend("web", t, "p" + i));
        const predicted = b.exhausted("web", tier);
        const real = !b.spend("web", tier, "probe").ok;
        assert.equal(predicted, real, `${a}/${c}/${o} after ${first} as ${tier}`);
      }
    }
  }
});

test("M6 the clock: corroborate and origin stop at ms, the answer tier at 2 x ms; the clock is injected", () => {
  const c = clock(1000);
  const b = mk(cfg({ ms: 100, web: { answer: 5, corroborate: 5, origin: 5 } }), c);
  assert.equal(b.spend("web", "corroborate", "a").ok, true);
  c.add(100);
  const r = b.spend("web", "corroborate", "b");
  assert.equal(r.ok, false); assert.equal(r.why, "time");
  assert.equal(b.spend("web", "origin", "c").why, "time");
  assert.equal(b.spend("web", "answer", "d").ok, true);
  assert.equal(b.exhausted("ms", "corroborate"), true);
  assert.equal(b.exhausted("ms", "answer"), false);
  c.add(100);
  assert.equal(b.spend("web", "answer", "e").why, "time");
  assert.equal(b.exhausted("ms", "answer"), true);
  assert.equal(b.exhausted("web", "answer"), true);
  assert.equal(b.elapsed(), 200);
});

test("M7 readPlan charges a page once and returns the hedge; a refusal hedges nothing; the hedge cap holds", () => {
  const b = mk(cfg({ pages: { answer: 1, corroborate: 0, origin: 0 }, hedge: 2 }));
  assert.deepEqual(b.readPlan("https://a/p", "answer"), { ok: true, hedge: 2 });
  assert.deepEqual(b.readPlan("https://a/p", "answer"), { ok: true, hedge: 2, free: true });
  const r = b.readPlan("https://b/p", "answer");
  assert.equal(r.ok, false); assert.equal(r.hedge, 0);
  assert.equal(b.hedge(), 2);
  assert.equal(b.hedgeSlot("k"), true); assert.equal(b.hedgeSlot("k"), true); assert.equal(b.hedgeSlot("k"), false);
  assert.equal(b.hedgeSlot("other"), true);
  assert.equal(makeBudget({ preset: "chat" }).hedge(), 0);
  assert.ok(configOf({ hedge: -3 }).hedge >= 0);
});

test("M8 unknown kind or tier is a typed refusal, never a throw; junk config is normalised; snapshot is plain JSON", () => {
  const b = makeBudget({ preset: "balanced" });
  assert.deepEqual(b.spend("bogus", "answer"), { ok: false, why: "unknown" });
  assert.deepEqual(b.spend("web", "bogus"), { ok: false, why: "unknown" });
  assert.equal(b.exhausted("bogus"), true);
  assert.equal(b.count("bogus"), 0);
  assert.doesNotThrow(() => makeBudget({ config: { web: "lots", pages: null, ms: "x", models: { answer: -4 } } }));
  const j = makeBudget({ config: { web: { answer: "x" } } });
  assert.equal(j.config.web.answer, PRESETS.balanced.web.answer);
  b.spend("web", "answer", "q"); b.spend("web", "origin", "q2");
  const snap = b.snapshot();
  assert.deepEqual(JSON.parse(JSON.stringify(snap)), snap);
  assert.equal(snap.schema, "AskBudget@1");
  assert.ok(snap.refused.every((r) => typeof r.why === "string"));
});

test("M8 every refusal is recorded with its why (the record can say what was not asked)", () => {
  const b = mk(cfg({ web: { answer: 1, corroborate: 0, origin: 0 } }));
  b.spend("web", "answer", "a"); b.spend("web", "origin", "z");
  assert.deepEqual(b.snapshot().refused.map((r) => [r.kind, r.tier, r.why]), [["web", "origin", "spent"]]);
});

test("presets: the declared numbers, and presetFor", () => {
  const tot = (p, k) => TIERS.reduce((n, t) => n + p[k][t], 0);
  assert.deepEqual([tot(PRESETS.balanced, "web"), tot(PRESETS.balanced, "pages"), tot(PRESETS.balanced, "models"), PRESETS.balanced.ms, PRESETS.balanced.hedge], [3, 4, 2, 20000, 2]);
  assert.deepEqual([tot(PRESETS.fast, "web"), tot(PRESETS.fast, "pages"), tot(PRESETS.fast, "models")], [1, 2, 1]);
  assert.deepEqual([tot(PRESETS.chat, "web"), tot(PRESETS.chat, "pages"), tot(PRESETS.chat, "models")], [0, 0, 1]);
  assert.equal(presetFor({ effort: "deep", wantWeb: true }), "deep");
  assert.equal(presetFor({ effort: "deep", wantWeb: false }), "chat");
  assert.equal(presetFor({ effort: "nonsense" }), "balanced");
  assert.equal(presetFor({ effort: "chat", wantWeb: true }), "balanced");
  assert.ok(Object.isFrozen(PRESETS) && Object.isFrozen(KINDS));
});

test("classifyUrl: a proxy-wrapped page is its target; search/article/model are typed; housekeeping is not counted", () => {
  const t = "https://www.worldatlas.com/articles/how-tall.html";
  const keyOf = (u, m) => (classifyUrl(u, m) || {}).key;
  const target = "page:" + t;
  assert.equal(keyOf(t), target);
  for (const u of [
    "https://holodeck-proxy.prometheoid.workers.dev/raw?url=" + encodeURIComponent(t),
    "https://api.allorigins.win/raw?url=" + encodeURIComponent(t),
    "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(t),
    "https://corsproxy.io/?url=" + encodeURIComponent(t),
    "https://cors.eu.org/" + t, "https://thingproxy.freeboard.io/fetch/" + t,
  ]) { assert.equal(keyOf(u), target, u); assert.equal(classifyUrl(u).kind, "pages"); assert.equal(classifyUrl(u).proxy, true); }
  assert.equal(classifyUrl(t).proxy, undefined);
  assert.deepEqual(classifyUrl("https://holodeck-proxy.prometheoid.workers.dev/search?scope=web&q=eiffel"), { kind: "web", key: "search:web:eiffel" });
  assert.equal(classifyUrl("https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=eiffel&format=json").kind, "web");
  const p1 = classifyUrl("https://en.wikipedia.org/w/api.php?action=parse&page=Eiffel%20Tower&prop=text&redirects=1");
  const p2 = classifyUrl("https://en.wikipedia.org/w/api.php?action=parse&page=Eiffel%20Tower&prop=text%7Crevid&redirects=1");
  assert.equal(p1.kind, "pages"); assert.equal(p1.key, p2.key);   // the article once, however many claims ask
  assert.deepEqual(classifyUrl("http://127.0.0.1:8815/heimdall/v1/chat/completions", "POST"), { kind: "models", key: null });
  assert.equal(classifyUrl("http://127.0.0.1:8815/heimdall/api/meter"), null);
  assert.equal(classifyUrl("not a url"), null);
});

test("guardFetch: spends before it sends; refused → typed BudgetRefused and NOTHING is sent; hedges beyond the cap never leave", async () => {
  const sent = [];
  const fetchImpl = async (u) => { sent.push(String(u)); return { ok: true }; };
  const b = mk(cfg({ pages: { answer: 1, corroborate: 0, origin: 0 }, web: { answer: 1, corroborate: 0, origin: 0 }, hedge: 2 }));
  const g = guardFetch(b, fetchImpl);
  const t = "https://news.example/a";
  await g(t);
  for (const base of ["https://holodeck-proxy.prometheoid.workers.dev/raw?url=", "https://api.allorigins.win/raw?url=", "https://corsproxy.io/?url="]) {
    try { await g(base + encodeURIComponent(t)); } catch (e) { assert.ok(e instanceof BudgetRefused); assert.equal(e.why, "hedge"); }
  }
  assert.equal(sent.length, 3);                                    // the direct fetch + 2 hedges; the third proxy never left
  await assert.rejects(() => g("https://news.example/b"), (e) => e.name === "BudgetRefused" && e.kind === "pages" && e.why === "spent");
  assert.equal(sent.length, 3);
  await g("https://holodeck-proxy.prometheoid.workers.dev/search?scope=web&q=x");
  await assert.rejects(() => g("https://holodeck-proxy.prometheoid.workers.dev/search?scope=web&q=y"), BudgetRefused);
  await g("http://127.0.0.1:8815/heimdall/api/meter");              // housekeeping passes uncounted
  assert.equal(sent.length, 5);
});

test("guardFetch: the tier can be a function of what has been spent (first pages the answer's, the next corroboration)", async () => {
  const sent = [];
  const b = mk(cfg({ pages: { answer: 1, corroborate: 1, origin: 0 } }));
  const g = guardFetch(b, async (u) => { sent.push(u); }, { tier: (info, bud) => (bud.count("pages") < 1 ? "answer" : "corroborate") });
  await g("https://a.example/1"); await g("https://a.example/2");
  await assert.rejects(() => g("https://a.example/3"), BudgetRefused);
  assert.equal(b.snapshot().spent.pages.answer, 1); assert.equal(b.snapshot().spent.pages.corroborate, 1);
});

test("M9 purity: the module touches no DOM, no network, no timers, no storage", () => {
  const src = fs.readFileSync(new URL("./fold-chat-budget.js", import.meta.url), "utf8").replace(/\/\/.*$/gm, "");
  for (const bad of [/\bdocument\b/, /\bwindow\b/, /\bsetTimeout\b/, /\bsetInterval\b/, /\blocalStorage\b/, /\bfetch\s*\(/, /Date\.now/, /\bimport\s/]) assert.equal(bad.test(src), false, String(bad));
});

test("guardFetch dedupe: the same GET url is sent once and every caller gets a readable clone; a failure is not cached; POST is never shared", async () => {
  let sent = 0;
  const f = async () => { sent++; return new Response("body-" + sent); };
  const b = mk(cfg({ pages: { answer: 3, corroborate: 0, origin: 0 } }));
  const g = guardFetch(b, f);
  const [r1, r2, r3] = await Promise.all([g("https://en.wikipedia.org/w/api.php?action=parse&page=X"), g("https://en.wikipedia.org/w/api.php?action=parse&page=X"), g("https://en.wikipedia.org/w/api.php?action=parse&page=X")]);
  assert.equal(sent, 1);
  assert.deepEqual([await r1.text(), await r2.text(), await r3.text()], ["body-1", "body-1", "body-1"]);
  assert.equal(b.count("pages"), 1);
  let n = 0; const bad = async () => { n++; if (n === 1) throw new Error("net"); return new Response("ok"); };
  const g2 = guardFetch(mk(cfg({ pages: { answer: 3, corroborate: 0, origin: 0 } })), bad);
  await assert.rejects(() => g2("https://x.example/a"));
  await new Promise((r) => setImmediate(r));
  assert.equal(await (await g2("https://x.example/a")).text(), "ok");
  assert.equal(n, 2);
  let posts = 0; const g3 = guardFetch(mk(cfg({ pages: { answer: 3, corroborate: 0, origin: 0 } })), async () => { posts++; return new Response("p"); });
  await g3("https://x.example/a", { method: "POST" }); await g3("https://x.example/a", { method: "POST" });
  assert.equal(posts, 2);
  const gOff = guardFetch(mk(cfg({ pages: { answer: 3, corroborate: 0, origin: 0 } })), async () => { posts++; return new Response("q"); }, { dedupe: false });
  await gOff("https://x.example/b"); await gOff("https://x.example/b");
  assert.equal(posts, 4);
});

test("guardFetch: a tier function returning null refuses without asking (the ladder is full) and spends nothing", async () => {
  const b = mk(cfg({ pages: { answer: 3, corroborate: 0, origin: 0 } }));
  const g = guardFetch(b, async () => new Response("x"), { tier: () => null });
  await assert.rejects(() => g("https://a.example/p"), (e) => e instanceof BudgetRefused && e.why === "ladder");
  assert.equal(b.count("pages"), 0);
});

test("M6b timeModels:false — the clock stops web and pages but never a model call (a small local model's latency is not fan-out); true (the default) stops all three", () => {
  for (const [timeModels, modelOk] of [[true, false], [false, true]]) {
    const c = clock();
    const b = mk(cfg({ ms: 100, timeModels, web: { answer: 2, corroborate: 2, origin: 0 }, models: { answer: 1, corroborate: 2, origin: 0 } }), c);
    c.add(150);
    assert.equal(b.spend("web", "corroborate", "w").ok, false);
    assert.equal(b.spend("models", "corroborate", "m").ok, modelOk, "timeModels=" + timeModels);
    assert.equal(b.exhausted("models", "corroborate"), !modelOk);
    assert.equal(b.remaining("models", "corroborate") > 0, modelOk);
    assert.equal(b.exhausted("ms", "corroborate"), true);
  }
  { const c = clock(); const b = mk(cfg({ ms: 100, timeModels: false, models: { answer: 1, corroborate: 0, origin: 0 } }), c); c.add(10000); assert.equal(b.spend("models", "answer").ok, true); assert.equal(b.spend("models", "answer").ok, false); assert.equal(b.snapshot().refused[0].why, "spent"); }
  assert.equal(configOf("balanced").timeModels, true);
  assert.equal(configOf({ timeModels: "no" }).timeModels, true);
});

test("makeBudget: a partial config overrides the NAMED preset, not balanced", () => {
  const b = makeBudget({ preset: "fast", config: { timeModels: false } });
  assert.equal(b.config.timeModels, false);
  assert.equal(b.config.ms, PRESETS.fast.ms);
  assert.equal(b.config.web.answer, PRESETS.fast.web.answer);
  assert.equal(b.config.pages.corroborate, 0);
  const c = makeBudget({ preset: "chat", config: { hedge: 5 } });
  assert.equal(c.config.hedge, 5); assert.equal(c.config.web.answer, 0);
  assert.equal(makeBudget({ preset: "nonsense" }).config.ms, PRESETS.balanced.ms);
});
