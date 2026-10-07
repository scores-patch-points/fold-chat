import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { watchTurn, audit } from "./fold-chat-watch.js";

const king = [{ role: "user", content: "Who is the king of the UK?" }, { role: "assistant", content: "King Charles III is the king of the UK." }];

test("relations: a source-ask, a push-back, a standalone", () => {
  assert.equal(watchTurn("find a primary source", king).relation, "source-ask");
  assert.equal(watchTurn("are you sure", king).relation, "push-back");
  assert.equal(watchTurn("what is the capital of Australia?", king).relation, "opens");
  assert.equal(watchTurn("find a primary source", king).expect.topic, "Who is the king of the UK?");
});
test("THE MEASURED FAILURE: the pre-fix live run — teacher guides read for 'where did you get that?' — is flagged", () => {
  const run = JSON.parse(fs.readFileSync(new URL("./eval/ants/watch-fixture-before-fix.json", import.meta.url), "utf8")).turns;
  const prior = [{ role: "user", content: run[0].ask }, { role: "assistant", content: run[0].spoken }, { role: "user", content: run[1].ask }, { role: "assistant", content: run[1].spoken }];
  const a = audit({ ask: run[2].ask, prior, reads: run[2].reads, spoken: run[2].spoken });
  assert.ok(a.flags.some((f) => f.flag === "follow_up_searched_literally"), JSON.stringify(a));
});
test("the same ask with reads on the topic raises nothing", () => {
  const a = audit({ ask: "find a primary source", prior: king, reads: ["royal.uk/the-king", "en.wikipedia.org/wiki/Charles_III"], spoken: "King Charles III is the king." });
  assert.deepEqual(a.flags, []);
});
test("a no-search plan that read pages, a loop, and a drift are each flagged", () => {
  assert.ok(audit({ ask: "are you sure", prior: king, reads: ["x.com/a"], spoken: "Yes." }).flags.some((f) => f.flag === "searched_when_none_expected"));
  assert.ok(audit({ ask: "are you sure", prior: king, reads: [], spoken: "King Charles III is the king of the UK." }).flags.some((f) => f.flag === "repeated_last_answer"));
  assert.ok(audit({ ask: "i want a chewier one", prior: [{ role: "user", content: "Show me a chocolate chip cookie recipe" }, { role: "assistant", content: "Use butter and brown sugar." }], reads: [], spoken: "The Eiffel Tower is 330 metres tall." }).flags.some((f) => f.flag === "drifted_from_thread"));
});
test("a standalone ask is never flagged for reading pages about its own words", () => {
  assert.deepEqual(audit({ ask: "what is a primary source", prior: king, reads: ["archives.gov/education/research/primary-sources"], spoken: "A primary source is an original document." }).flags, []);
});

import { pre, post, batonOf, wantLine } from "./fold-chat-watch.js";

test("PRE: names what the person wants, before any search", () => {
  const p = pre({ ask: "find a primary source", prior: king });
  assert.equal(p.want, "source"); assert.equal(p.sub, "new"); assert.equal(p.expect.topic, "Who is the king of the UK?");
  assert.match(wantLine(p), /source for the last answer/);
  assert.equal(pre({ ask: "where did you get that?", prior: king }).sub, "recall");
  assert.equal(pre({ ask: "what is the capital of Australia?", prior: king }).want, "answer");
  assert.equal(pre({ ask: "are you sure", prior: king }).want, "challenge");
});
test("POST leaves a baton; the NEXT watcher's PRE takes it in — an unmet source want and the hosts already tried", () => {
  const p1 = pre({ ask: "find a primary source", prior: king });
  const o1 = post({ ask: "find a primary source", prior: king, pre: p1, reads: ["https://en.wikipedia.org/wiki/Monarchy_of_the_United_Kingdom", "https://www.britannica.com/x"], spoken: "x", reached: false });
  assert.equal(o1.baton.met, false); assert.deepEqual(o1.baton.tried, ["en.wikipedia.org", "britannica.com"]);
  const prior2 = [...king, { role: "user", content: "find a primary source" }, { role: "assistant", content: "Sources only.", watch: { baton: o1.baton } }];
  assert.deepEqual(batonOf(prior2), o1.baton);
  const p2 = pre({ ask: "got a better source?", prior: prior2 });
  assert.equal(p2.unmet.want, "source"); assert.deepEqual(p2.avoid, ["en.wikipedia.org", "britannica.com"]);
  assert.ok(p2.notes.some((n) => /do not repeat the same hosts/.test(n)));
  const o2 = post({ ask: "got a better source?", prior: prior2, pre: p2, reads: ["https://www.royal.uk/the-king"], spoken: "y", reached: true, tier: "primary" });
  assert.equal(o2.baton.met, true); assert.ok(o2.baton.tried.includes("royal.uk") && o2.baton.tried.includes("britannica.com"));
});
test("a baton is separate from the discourse summary and a thread without one starts clean", () => {
  assert.equal(batonOf(king), null);
  assert.equal(pre({ ask: "find a primary source", prior: king }).unmet, null);
  const o = post({ ask: "find a primary source", prior: king, reads: [], spoken: "z", reached: true, tier: "index" });
  assert.equal(o.baton.met, false);   // a secondary page is not what a 'primary' request wanted
  assert.ok(o.baton.open.length);
});

import { actionsOf, contentOf, pageVerdicts, topicStemsOf, keepOnTopic, batonReply, isInspectAsk, inspectReply } from "./fold-chat-watch.js";
const ev = (op, title, note = "") => ({ type: "t", op, title, ...(note ? { note } : {}) });

test("ACTIONS: the watcher knows what the turn did, read off the feed's own words", () => {
  const a = actionsOf([ev("line", "Read your question", "question of fact"), ev("line", "Followed on from the last answer", "searching for “Who is the king of the UK?”"), ev("line", "Searched the web", "10 results via DuckDuckGo"), ev("line", "Read en.wikipedia.org — Monarchy"), ev("line", "Could not read loc.gov"), ev("line", "Wrote the answer · gemma2:2b"), ev("line", "Verified where it came from", "1 source")]);
  assert.deepEqual(a.searched.includes("Who is the king of the UK?"), true);
  assert.equal(a.read, 1); assert.equal(a.unreadable, 1); assert.equal(a.modelCalls, 1); assert.deepEqual(a.lanes, ["provenance"]);
});
test("CONTENT: the measured pages — a film and a singer called King are not about King Charles III; the monarchy page is", () => {
  const pr = pre({ ask: "find a primary source", prior: king });
  const stems = topicStemsOf(pr, king);
  assert.ok(stems.includes("king") && stems.includes("charl"));
  const pages = [
    { url: "https://en.wikipedia.org/wiki/Monarchy_of_the_United_Kingdom", text: "The monarch since 8 September 2022 is King Charles III, who ascended the throne." },
    { url: "https://en.wikipedia.org/wiki/The_Kid_Who_Would_Be_King", text: "The Kid Who Would Be King is a 2019 urban fantasy film directed by Joe Cornish." },
    { url: "https://en.wikipedia.org/wiki/Paul_King_(VJ)", text: "Paul King is a British-Irish singer, musician, VJ and TV presenter, lead vocalist of the band King." },
  ];
  const v = pageVerdicts(contentOf(pages), stems);
  assert.deepEqual(v.map((x) => x.bears), [true, false, false]);
  assert.deepEqual(keepOnTopic(pages, pr, king).map((p) => p.url), [pages[0].url]);
  const o = post({ ask: "find a primary source", prior: king, pre: pr, passages: pages, events: [ev("line", "Searched the web", "x")], spoken: "s", reached: false });
  assert.ok(o.flags.some((f) => f.flag === "surfed_content_off_topic"));
  assert.equal(o.baton.did.offTopicN, 2);
  assert.equal(o.baton.did.searches, 1);
});
test("never an empty hand: if no page bears, keepOnTopic keeps what there is", () => {
  const pr = pre({ ask: "find a primary source", prior: king });
  const pages = [{ url: "https://a.com/x", text: "nothing relevant" }];
  assert.equal(keepOnTopic(pages, pr, king).length, 1);
});
test("BATON REPLY: 'where did you get that?' after an unmet source want is answered from what was DONE, no search", () => {
  const baton = { met: false, want: "source", sub: "new", tried: ["en.wikipedia.org", "britannica.com"], did: { read: 5, offTopicN: 2 } };
  const prior = [...king, { role: "user", content: "find a primary source" }, { role: "assistant", content: "Sources.", watch: { baton } }];
  const r = batonReply(pre({ ask: "where did you get that?", prior }));
  assert.match(r, /read 5 pages \(en\.wikipedia\.org, britannica\.com\), 2 of them did not bear on it, and could not point to a sentence/);
  assert.equal(batonReply(pre({ ask: "where did you get that?", prior: king })), null);
});

test("THE BATON IS COMPACT: domains and a gist only — no full URL, no query, no step list; the detail is kept apart", () => {
  const pr = pre({ ask: "find a primary source", prior: king });
  const o = post({ ask: "find a primary source", prior: king, pre: pr, reads: ["https://en.wikipedia.org/wiki/Monarchy_of_the_United_Kingdom", "https://www.britannica.com/biography/Charles-III"],
    events: [ev("line", "Followed on from the last answer", "searching for \u201cWho is the king of the UK?\u201d"), ev("line", "Searched the web", "10 results"), ev("line", "Read en.wikipedia.org"), ev("line", "Read britannica.com")], spoken: "s", reached: false });
  const flat = JSON.stringify(o.baton);
  assert.ok(!/https?:|Monarchy_of/.test(flat) && !flat.includes('\\u201c'), flat);   // no URL, no search query
  assert.deepEqual(o.baton.did.domains, ["en.wikipedia.org", "britannica.com"]);
  assert.match(o.baton.did.gist, /searched 1 time, read 2 pages on 2 domains/);
  assert.ok(o.detail.urls[0].includes("Monarchy_of_the_United_Kingdom") && o.detail.queries[0] === "Who is the king of the UK?");
});
test("DRILL DOWN: 'what did you search for?' / 'which pages?' open the stored detail — and only when there is one", () => {
  for (const q of ["what did you search for?", "which pages did you read", "what did you actually do", "how did you search that", "show me your steps"]) assert.equal(isInspectAsk(q), true, q);
  for (const q of ["what is the capital of Australia", "who did you vote for", "what did you say"]) assert.equal(isInspectAsk(q), false, q);
  const pr = pre({ ask: "find a primary source", prior: king });
  const o = post({ ask: "find a primary source", prior: king, pre: pr, reads: ["https://en.wikipedia.org/wiki/A", "https://www.britannica.com/b"], events: [ev("line", "Followed on", "searching for \u201cking uk\u201d"), ev("line", "Searched the web", "x")], spoken: "s", reached: false });
  const prior = [...king, { role: "user", content: "find a primary source" }, { role: "assistant", content: "Sources.", watch: { baton: o.baton, detail: o.detail } }];
  assert.equal(pre({ ask: "what did you search for?", prior }).want, "inspect");
  const r = inspectReply(prior);
  assert.match(r, /I searched for: \u201cking uk\u201d\./); assert.match(r, /I read: en\.wikipedia\.org\/wiki\/A, britannica\.com\/b\./);
  assert.equal(pre({ ask: "what did you search for?", prior: king }).want, "answer");   // nothing stored: nothing to drill into
  assert.equal(inspectReply(king), null);
});

import { withoutAppAnswered, challengeReply } from "./fold-chat-watch.js";
test("a read-back turn carries the unmet baton forward; its ask and reply stay out of the model's history; drill-down is tailored to the ask", () => {
  const baton = { schema: "Baton@1", want: "source", sub: "new", met: false, tried: ["en.wikipedia.org"], open: ["x"], did: { gist: "searched 1 time", domains: ["en.wikipedia.org"], read: 5, offTopicN: 0 } };
  const detail = { queries: ["king uk"], searches: 1, urls: ["https://en.wikipedia.org/wiki/A"], unreadable: 0, offTopic: [], steps: [], lanes: [] };
  const prior = [...king, { role: "user", content: "find a primary source" }, { role: "assistant", content: "Sources.", watch: { baton, detail } }];
  const p = pre({ ask: "where did you get that?", prior });
  const o = post({ ask: "where did you get that?", prior, pre: p, events: [ev("line", "Read back what the last turn did")], spoken: "", reached: true });
  assert.equal(o.baton.met, false); assert.equal(o.baton.carried, true); assert.equal(o.appAnswered, true); assert.equal(o.detail, null);
  const msgs = [...prior, { role: "user", content: "where did you get that?" }, { role: "assistant", content: "", watch: { baton: o.baton, appAnswered: true } }, { role: "user", content: "what is the capital of Australia?" }];
  assert.deepEqual(withoutAppAnswered(msgs).map((m) => m.content), ["Who is the king of the UK?", "King Charles III is the king of the UK.", "find a primary source", "Sources.", "what is the capital of Australia?"]);
  assert.match(inspectReply(prior, "what did you search for?"), /I searched for/); assert.doesNotMatch(inspectReply(prior, "what did you search for?"), /I read:/);
  assert.match(inspectReply(prior, "which pages did you read"), /I read:/); assert.doesNotMatch(inspectReply(prior, "which pages did you read"), /I searched for/);
});

test("'are you sure?' about a looked-up answer is said by the app from the stored source line, by tier", () => {
  const mk = (pointers) => [{ role: "user", content: "capital?" }, { role: "assistant", content: "Canberra.", grounding: {}, provenance: { schema: "Provenance@1", claim: "Canberra is the capital.", verified: 1, pointers, parts: [] } }];
  const idx = challengeReply(pre({ ask: "are you sure?", prior: mk([{ host: "en.wikipedia.org", tier: "index" }]) }), mk([{ host: "en.wikipedia.org", tier: "index" }]));
  assert.match(idx.text, /^Not fully\. The only place I found it was en\.wikipedia\.org/);
  const prim = challengeReply(pre({ ask: "are you sure?", prior: mk([{ host: "nca.gov.au", tier: "primary" }]) }), mk([{ host: "nca.gov.au", tier: "primary" }]));
  assert.match(prim.text, /^I checked it against nca\.gov\.au/);
  const none = [{ role: "user", content: "q" }, { role: "assistant", content: "A.", grounding: {} }];
  assert.match(challengeReply(pre({ ask: "are you sure?", prior: none }), none).text, /^I am not sure/);
  const chat = [{ role: "user", content: "hi" }, { role: "assistant", content: "Hello." }];
  assert.equal(challengeReply(pre({ ask: "are you sure?", prior: chat }), chat), null);   // no lookup behind it
  assert.equal(challengeReply(pre({ ask: "what is the capital?", prior: chat }), chat), null);
});
