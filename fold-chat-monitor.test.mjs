// fold-chat-monitor.test.mjs — the external-calls monitor: what it says about each call must be computed from the ledger, never softened.
import test from "node:test";
import assert from "node:assert/strict";
import { createOutbound, cleanMasking } from "./fold-chat-outbound.js";
import { createDeid } from "./fold-chat-deid.js";
import { createTaint } from "./fold-chat-seal.js";
import { describeEntry, monitorSummary, placeholderPieces, FILTERS } from "./fold-chat-monitor.js";

const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const rawMsgs = [{ role: "system", content: "sys" }, { role: "user", content: "make a timer" }];

test("a raw escalation is shown as NOT anonymized, never softened", () => {
  const o = createOutbound({ storage: store() });
  o.sendModel({ auditId: "a", model: "m", messages: rawMsgs });
  const d = describeEntry(o.list()[0]);
  assert.match(d.state, /NOT anonymized/); assert.equal(d.tone, "bad");
  assert.equal(monitorSummary(o.list()).unanonymized, 1);
  assert.equal(FILTERS.attention(o.list()[0]), true);
});

test("a masked request reports how many details were taken out, by kind, from the masker's own count", () => {
  const taint = createTaint(); taint.add("/Users/eleanor/cases", "folder path");
  const deid = createDeid({ taint, extra: [{ term: "Eleanor Voss", kind: "name" }] });
  const [m] = deid.maskAll(["Eleanor Voss keeps notes in /Users/eleanor/cases and mails eleanor@example.org"]);
  const masking = { ...deid.stats(), viaRead: false };
  const o = createOutbound({ storage: store(), taint });
  o.sendModel({ auditId: "b", model: "claude", messages: [{ role: "system", content: "sys" }, { role: "user", content: m }], segments: [{ role: "system", chars: 3, provenance: "template" }, { role: "user", chars: m.length, provenance: "masked" }], masking });
  const d = describeEntry(o.list()[0]);
  assert.match(d.state, /^masked — \d+ details? taken out/);
  assert.equal(d.maskedCount, masking.count); assert.ok(d.maskedCount >= 3);
  assert.match(d.detail, /emails?\b/);
  assert.equal(d.tone, "ok");
});

test("a masked grade with no stats says the masker did not report — it does not invent a count", () => {
  const o = createOutbound({ storage: store() });
  o.sendModel({ auditId: "c", model: "m", messages: rawMsgs, segments: [{ role: "system", chars: 3, provenance: "template" }, { role: "user", chars: 12, provenance: "masked" }] });
  const d = describeEntry(o.list()[0]);
  assert.equal(d.state, "masked"); assert.match(d.detail, /did not report/); assert.equal(d.maskedCount, 0);
});

test("falsifier: a leak flagged on a masked request turns the row bad, and the summary counts it", () => {
  const taint = createTaint(); taint.add("Kettering", "place");
  const o = createOutbound({ storage: store(), taint });
  o.sendModel({ auditId: "d", model: "m", messages: [{ role: "user", content: "a nurse in Kettering" }], segments: [{ role: "user", chars: 20, provenance: "masked" }], masking: { count: 1, kinds: { TERM: 1 } } });
  const d = describeEntry(o.list()[0]);
  assert.equal(d.tone, "bad"); assert.ok(d.leaks.length >= 1);
  assert.equal(monitorSummary(o.list()).flagged, 1);
});

test("a direct web call is 'direct', never presented as anonymized", () => {
  const o = createOutbound({ storage: store() });
  o.sendDirect({ url: "https://en.wikipedia.org/w/api.php?search=eiffel", purpose: "web search" });
  const d = describeEntry(o.list()[0]);
  assert.match(d.state, /^direct/); assert.notEqual(d.tone, "ok");
  assert.equal(FILTERS.web(o.list()[0]), true); assert.equal(FILTERS.model(o.list()[0]), false);
});

test("the masking record keeps counts only: no values can ride along", () => {
  const m = cleanMasking({ count: 2, kinds: { USER: 1, PATH: 1, "alice@x.org": 1, evil: 9 }, viaRead: 1, secretValue: "hunter2" });
  assert.deepEqual(m, { count: 2, kinds: { USER: 1, PATH: 1 }, viaRead: true });
  assert.equal(cleanMasking(null), null);
  const o = createOutbound({ storage: store() });
  o.sendModel({ auditId: "e", model: "m", messages: rawMsgs, masking: { count: 1, kinds: { USER: 1 }, original: "alice" } });
  assert.ok(!o.exportJson().includes("alice"), "an original never reaches the export");
});

test("placeholders are found and split out exactly; look-alikes are left alone", () => {
  const p = placeholderPieces("hi USER_1, see PATH_12/FILE_3 and EMAIL_2. not USERS_1 or SECRET_x");
  assert.deepEqual(p.filter((x) => x.kind).map((x) => x.text), ["USER_1", "PATH_12", "FILE_3", "EMAIL_2"]);
  assert.equal(p.map((x) => x.text).join(""), "hi USER_1, see PATH_12/FILE_3 and EMAIL_2. not USERS_1 or SECRET_x", "nothing lost or reordered");
});

test("summary and rows survive an empty ledger and a failed call", () => {
  const o = createOutbound({ storage: store() });
  assert.equal(monitorSummary(o.list()).calls, 0);
  const h = o.sendModel({ auditId: "f", model: "m", messages: rawMsgs });
  h.done({ ok: false, error: "HTTP 429", status: 429 });
  const d = describeEntry(o.list()[0]);
  assert.equal(d.status, "failed"); assert.equal(monitorSummary(o.list()).failed, 1);
  assert.equal(FILTERS.attention(o.list()[0]), true);
});

test("end to end: the real remoteCode path puts the masker's own counts on the ledger entry, and no original with them", async () => {
  const { setAuditHook, remoteCode } = await import("./fold-chat-client.js");
  const ledger = createOutbound({ storage: store() });
  setAuditHook({ before: (i) => ledger.sendModel({ auditId: i.auditId, model: i.model, messages: i.messages, segments: i.segments, purpose: i.purpose, masking: i.masking }).done });
  const fetchImpl = async () => new Response(JSON.stringify({ message: { content: "done for USER_1" }, choices: [{ message: { content: "done for USER_1" } }] }), { status: 200, headers: { "content-type": "application/json" } });
  try {
    await remoteCode("write a timer for dr.kim@clinic.org", { candidates: ["live"], fetchImpl }).catch(() => {});
    const [e] = ledger.list();
    assert.ok(e, "the call was recorded");
    assert.ok(e.masking && e.masking.count >= 1, "the entry says how many details were taken out");
    assert.equal(Object.values(e.masking.kinds).reduce((n, v) => n + v, 0), e.masking.count, "the by-kind counts add up to the total");
    const sent = JSON.stringify(e.messages);
    assert.ok(!sent.includes("dr.kim@clinic.org") && !/\bkim\b/i.test(sent) && !/clinic/i.test(sent), "neither the address nor the name or organisation in it left");
    assert.match(describeEntry(e).state, /^masked — \d+ details? taken out/);
  } finally { setAuditHook(null); }
});

test("the by-kind line is grammatical: one of a kind is singular", () => {
  const o = createOutbound({ storage: store() });
  o.sendModel({ auditId: "g", model: "m", messages: rawMsgs, segments: [{ role: "system", chars: 3, provenance: "template" }, { role: "user", chars: 12, provenance: "masked" }], masking: { count: 4, kinds: { TERM: 2, PATH: 1, FILE: 1 } } });
  assert.equal(describeEntry(o.list()[0]).detail, "2 names & terms, 1 folder path, 1 file name");
});

test("masked-but-flagged is reported as both, never as plain 'raw'", () => {
  const o = createOutbound({ storage: store() });
  o.sendModel({ auditId: "h", model: "m", messages: [{ role: "user", content: "password: SECRET_1 under /Users/USER_1/x, and a key left in: sk-abcdefghijklmnopqrstuvwx" }], segments: [{ role: "user", chars: 90, provenance: "masked" }], masking: { count: 2, kinds: { SECRET: 1, USER: 1 } } });
  const e = o.list()[0];
  assert.equal(e.grade.level, "gate", "the ledger's grade is the worse one");
  const d = describeEntry(e);
  assert.match(d.state, /^masked 2, but \d+ patterns? still flagged/); assert.equal(d.tone, "bad");
  assert.ok(!/NOT anonymized/.test(d.state), "it was masked; saying 'raw' would be wrong");
});
