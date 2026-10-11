// eval/ants/e2/primary-par.test.mjs — PROPOSED test for the findPrimary parallel patch (diff: primary-par.diff). It imports "./fold-chat-primary.js", so it runs where that
// file sits (the repo root after the diff is applied; or a scratch dir holding the patched copy — see E2-RESULTS.md). Mutation check: against the tracked (serial) file the timing test FAILS.
import test from "node:test";
import assert from "node:assert/strict";
import { functionWordsOf } from "./fold-chat-snippets.js";
import { findPrimary } from "./fold-chat-primary.js";
const FW = functionWordsOf("en");
const CLAIM = "The Eiffel Tower is 330 metres tall.";
const SENTENCE = "The Eiffel Tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building.";
const WIKI_TEXT = ["The Eiffel Tower is a wrought-iron lattice tower on the Champ de Mars in Paris, France.", SENTENCE].join(" ");
const PAD = "Visit the official site for opening times, ticket prices and accessibility information before you plan your trip to the monument.";
const PAGE_A = "The Eiffel Tower is 330 metres tall, which is about the height of an 81-storey building. The tower was built by the company of Gustave Eiffel for the 1889 World's Fair. " + PAD;
const PAGE_B = "Nothing here concerns height, only the history of the fair of 1889 and the many millions of visitors who have come to Paris since then to see the iron tower. " + PAD;
const PAGE_C = "The monument stands 330 metres high including its antennas, and a lift carries visitors to the second floor. " + PAD;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const URLS = ["https://www.toureiffel.paris/en/the-monument", "https://www.paris.fr/pages/eiffel", "https://www.example-travel.com/eiffel"];
const MAP = { [URLS[0]]: PAGE_A, [URLS[1]]: PAGE_B, [URLS[2]]: PAGE_C };
const pointer = (needle) => async (messages) => { const lines = String(messages[1].content).split("\n").filter((l) => /^\[\d+\]/.test(l)); const hit = lines.find((l) => l.includes(needle)); return hit ? /^\[(\d+)\]/.exec(hit)[1] : "NONE"; };
function rig(delay) {
  const log = { searches: [], reads: [], active: 0, maxActive: 0 };
  const search = async (q) => { log.searches.push(q); log.active++; log.maxActive = Math.max(log.maxActive, log.active); await wait(delay); log.active--; return URLS.map((u) => ({ title: u, url: u, snippet: "" })); };
  const readPage = async (u) => { log.reads.push(u); await wait(delay); return MAP[u]; };
  return { log, search, readPage };
}
const run = (r) => findPrimary({ claim: CLAIM, sentence: SENTENCE, indexHost: "en.wikipedia.org", fw: FW, indexText: WIKI_TEXT, search: r.search, readPage: r.readPage, point: pointer("330 metres"), limits: { maxVerified: 5 } });

test("E2 L3: the searches go out together and the pages are fetched together — same trail, same pointers, a fraction of the wait", async () => {
  const r0 = rig(0); const z0 = Date.now(); await run(r0); const compute = Date.now() - z0;   // the gate/pointing work with no network wait: subtracted, so a loaded machine cannot fail the test
  const r = rig(150);
  const t0 = Date.now();
  const out = await run(r);
  const ms = Date.now() - t0 - compute;
  assert.ok(out.pointers.length >= 1, "still verifies a primary page");
  assert.equal(out.pointers[0].url, URLS[0]);
  // serial cost = (#queries + #pages) * 150 ms; parallel cost ~ 2 * 150 ms (+ model stub). Allow slack for a loaded machine.
  const nSerial = (r.log.searches.length + r.log.reads.length) * 150;
  assert.ok(ms < nSerial * 0.5, `waited ${ms} ms on the network, a serial run waits ${nSerial} ms`);
  assert.ok(r.log.maxActive >= 2 || r.log.searches.length === 1, "queries overlapped");
});

test("E2 L3: the trail and verdict order do not depend on which fetch finishes first", async () => {
  // the SLOWEST page ranks first: the loop must still take pages in rank order
  const mk = (slowFirst) => { const log = []; return { log, search: async () => URLS.map((u) => ({ title: u, url: u, snippet: "" })), readPage: async (u) => { log.push(u); await wait(slowFirst ? (u === URLS[0] ? 120 : 5) : 5); return MAP[u]; } }; };
  const a = await run(mk(true)), b = await run(mk(false));
  assert.deepEqual(a.trail.map((t) => `${t.host}:${t.verdict}`), b.trail.map((t) => `${t.host}:${t.verdict}`));
  assert.deepEqual(a.pointers.map((p) => p.url), b.pointers.map((p) => p.url));
});

test("E2 L3: a search that fails is a trail row, a read that throws is a trail row; neither stops the others; an AbortError still rejects", async () => {
  const flaky = { search: async (q) => { if (/^"/.test(q)) throw new Error("boom"); return URLS.map((u) => ({ title: u, url: u, snippet: "" })); }, readPage: async (u) => { if (u === URLS[1]) throw new Error("nope"); return MAP[u]; } };
  const out = await run(flaky);
  assert.ok(out.trail.some((t) => /search_failed/.test(t.why || "")));
  assert.ok(out.trail.some((t) => /read_failed/.test(t.why || "")));
  assert.ok(out.pointers.length >= 1);
  const abort = Object.assign(new Error("stopped"), { name: "AbortError" });
  await assert.rejects(() => run({ search: async () => { throw abort; }, readPage: async () => null }), (e) => e.name === "AbortError");
});
