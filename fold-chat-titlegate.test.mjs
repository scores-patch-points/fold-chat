// The title gate (fold-chat-web.js): the entity's own page is read before pages that merely share its name,
// and the safety-gate fallback note (fold-chat-gaps.js) — pure, no DOM.
import test from "node:test";
import assert from "node:assert/strict";
import { titleGate, isOwnPage, pageNameOf, searchWeb } from "./fold-chat-web.js";
import { declinedFallbackNotice } from "./fold-chat-gaps.js";
import { chat } from "./fold-chat-client.js";
import { snipsOf, strandText, verifySnips } from "./fold-chat-strand.js";

const Q = "Who founded the city of Nashville, and when?";
const R = (title, url = "https://example.org/" + encodeURIComponent(title)) => ({ title, url, snippet: "", source: "example.org", kind: "web" });

test("pageNameOf / isOwnPage: the entity's own page vs a longer name for another thing", () => {
  assert.equal(pageNameOf("Nashville, Tennessee - Wikipedia"), "Nashville, Tennessee");
  assert.equal(pageNameOf("Nashville | Tennessee Encyclopedia"), "Nashville");
  assert.ok(isOwnPage("Nashville, Tennessee", "Nashville"));
  assert.ok(isOwnPage("Nashville (disambiguation)", "Nashville"));
  assert.ok(isOwnPage("Wikipedia — Nashville", "Nashville"));
  assert.ok(!isOwnPage("Nashville SC", "Nashville"));
  assert.ok(!isOwnPage("Nashville school shooting", "Nashville"));
});

test("a founding question: pages named for another thing that shares the name go behind the entity's own pages", () => {
  const pool = [R("Nashville SC"), R("2023 Nashville school shooting"), R("Nashville, Tennessee - Wikipedia"), R("Founding of Nashville | Tennessee Encyclopedia")];
  const g = titleGate(pool, Q);
  assert.deepEqual(g.pool.slice(0, 2).map((r) => r.title), ["Nashville, Tennessee - Wikipedia", "Founding of Nashville | Tennessee Encyclopedia"]);
  assert.deepEqual(g.off.map((o) => o.title).sort(), ["2023 Nashville school shooting", "Nashville SC"]);
  assert.ok(g.off.every((o) => o.why === "shares-only-the-name"));
  assert.equal(g.pool.length, pool.length, "demoted, never deleted: they are read only if every better candidate failed");
});

test("a title that shares no word with the ask is demoted when other candidates fit", () => {
  const g = titleGate([R("Weather forecast for Tuesday"), R("History of Nashville")], "What is the history of Nashville?");
  assert.equal(g.pool[0].title, "History of Nashville");
  assert.equal(g.off[0].why, "no-shared-word");
});

test("it never starves a turn: nothing fits better means the order is left alone", () => {
  const pool = [R("Weather forecast"), R("Cat videos")];
  const g = titleGate(pool, "What is the history of Nashville?");
  assert.deepEqual(g.pool, pool); assert.deepEqual(g.off, []);
  const one = titleGate([R("Cat videos")], Q);
  assert.deepEqual(one.off, []);
});

test("an ask with no names or content words leaves the pool alone", () => {
  const pool = [R("a"), R("b")];
  assert.deepEqual(titleGate(pool, "ok?").off, []);
});

test("people-record asks are not disturbed: the entity's own record pages and swarm results stay in order", () => {
  const pool = [R("Judy Liff - Whitepages"), R("Zachary Liff - Elementix Investors"), R("Judy (film)")];
  const g = titleGate(pool, "find the relationship between Judy and Zachary Liff from Nashville");
  assert.equal(g.pool[2].title, "Judy (film)");
});

test("searchWeb: the demoted pages are read last, and the trace says so", async () => {
  const read = [];
  const f = async (url, init) => {
    url = String(url);
    const j = (o) => ({ ok: true, status: 200, headers: new Headers({ "content-type": "application/json" }), json: async () => o, text: async () => JSON.stringify(o) });
    if (/holodeck-proxy.*\/search/.test(url) && /scope=web|"scope":"web"/.test(url + (init?.body || "")) || /\/search/.test(url)) {
      return j({ scope: "web", engine: "DDG", count: 4, results: [
        { title: "Nashville SC", url: "https://en.wikipedia.org/wiki/Nashville_SC", snippet: "Nashville", source: "en.wikipedia.org" },
        { title: "2023 Nashville school shooting", url: "https://news.example/shooting", snippet: "Nashville", source: "news.example" },
        { title: "Nashville, Tennessee", url: "https://en.wikipedia.org/wiki/Nashville,_Tennessee", snippet: "Nashville", source: "en.wikipedia.org" },
        { title: "Founding of Nashville", url: "https://tnencyclopedia.example/founding", snippet: "Nashville founded", source: "tnencyclopedia.example" }] });
    }
    read.push(url);
    return { ok: true, status: 200, headers: new Headers({ "content-type": "text/html" }), text: async () => "<title>x</title><p>" + "Nashville was founded in 1779 by James Robertson and John Donelson. ".repeat(10) + "</p>", json: async () => ({}) };
  };
  const steps = [];
  const w = await searchWeb(Q, { fetchImpl: f, effort: "balanced", route: false, scopes: ["web"], onStep: (s) => steps.push(s), webBudgetMs: 2000 });
  const topic = (w.trace || []).find((t) => t.engine === "title gate");
  assert.ok(topic, "the trace names the title gate");
  const order = steps.filter((s) => s.phase === "reading").map((s) => s.url);
  assert.ok(order.length >= 1);
  assert.ok(!/Nashville_SC|shooting/.test(order.slice(0, 2).join(" ")), "the two namesake pages are not among the first reads: " + order.join(", "));
  assert.ok(steps.some((s) => s.phase === "demoted"));
});

// ---- the gate refuses the MODEL: the turn falls back to the strand, never to nothing ----------------------------
const GATE = "refused by the safety-and-ethics gate (AntiStrauss): the call contravenes the standing law — terror attack planning";
const gate403 = async () => ({ ok: false, status: 403, headers: new Headers({ "content-type": "application/json" }), json: async () => ({ error: { message: GATE } }), text: async () => JSON.stringify({ error: GATE }) });

test("a stubbed 403 from the bridge carries the gate's own words, and the note quotes them", async () => {
  let err = null;
  try { await chat("gemma2:2b", [{ role: "user", content: "hi" }], { base: "http://x", fetchImpl: gate403 }); } catch (e) { err = e; }
  assert.equal(err?.status, 403);
  const n = declinedFallbackNotice(err);
  assert.equal(n.kind, "declined"); assert.equal(n.retry, true); assert.equal(n.fellBackFrom, "facing");
  assert.ok(n.text.startsWith("The model declined this request (the safety gate said: " + GATE + "). Showing what the sources say instead."), n.text);
  assert.equal(n.gate, GATE);
});

test("a 403 with a bare-string error body is quoted the same way", async () => {
  const f = async () => ({ ok: false, status: 403, headers: new Headers(), json: async () => ({ error: "gate says no" }), text: async () => "" });
  let err; try { await chat("m", [], { base: "http://x", fetchImpl: f }); } catch (e) { err = e; }
  assert.match(declinedFallbackNotice(err).text, /safety gate said: gate says no\)/);
});

test("a non-gate failure falls back too, and says it was not the gate", () => {
  const e = Object.assign(new Error("bridge unreachable: Failed to fetch"), { status: 0 });
  const n = declinedFallbackNotice(e);
  assert.match(n.text, /^The model could not answer \(bridge unreachable: Failed to fetch\)\. Showing what the sources say instead\.$/);
});

test("the fallback strand is the sources' own words, cited and verified, with no model call", () => {
  const text = "Nashville was founded on Christmas Day 1779 by James Robertson and John Donelson, and was named for Francis Nash, a general of the American Revolutionary War. It is the capital of Tennessee.";
  const passages = [{ ref: "en.wikipedia.org — Nashville, Tennessee", source: "https://en.wikipedia.org/wiki/Nashville,_Tennessee", url: "https://en.wikipedia.org/wiki/Nashville,_Tennessee", text }];
  const strand = snipsOf(passages, Q);
  assert.ok(strand.snips.length >= 1);
  assert.ok(verifySnips(strand.snips, passages).ok);
  assert.ok(text.includes(strandText(strand.snips).replace(/\s+/g, " ").slice(0, 60)));
  assert.equal(strand.snips[0].site, "en.wikipedia.org");
});

// ---- no model reachable: the turn is not stopped; it falls back to the strand ------------------------------------
import { noModelFallbackNotice } from "./fold-chat-gaps.js";
import { noModelWhy } from "./fold-chat-loaded.js";

test("no bridge: the app's own note says no bridge answered and the tab has no model, is kind 'fold', and offers a retry", () => {
  const n = noModelFallbackNotice(noModelWhy({ bridgeUp: false }));
  assert.equal(n.kind, "fold"); assert.equal(n.retry, true); assert.equal(n.fellBackFrom, "facing");
  assert.equal(n.text, "No model is reachable (no bridge answered and this tab has none loaded), so this shows what the sources say. Run `npm run serve` (the Fold's own server) or use the in-tab model for written answers.");
});

test("a bridge that is up but serves nothing says that instead of blaming the bridge", () => {
  const n = noModelFallbackNotice(noModelWhy({ bridgeUp: true, models: [] }));
  assert.match(n.text, /^No model is available \(the bridge is up but serves no model/);
  assert.match(n.text, /so this shows what the sources say\.$/);
  assert.equal(n.kind, "fold");
});

test("with no bridge, the sources-only strand still draws cited verbatim snips from read pages (no model, no network)", () => {
  const text = "Nashville was founded on Christmas Day 1779 by James Robertson and John Donelson, and was named for Francis Nash, a general of the American Revolutionary War. It is the capital of Tennessee.";
  const passages = [{ ref: "en.wikipedia.org — Nashville, Tennessee", source: "https://en.wikipedia.org/wiki/Nashville,_Tennessee", url: "https://en.wikipedia.org/wiki/Nashville,_Tennessee", text }];
  const { snips } = snipsOf(passages, Q);
  assert.ok(snips.length >= 1 && verifySnips(snips, passages).ok);
  assert.ok(snips.every((s) => s.source && s.site));
});
