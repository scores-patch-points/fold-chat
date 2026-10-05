// fold-chat-outbound.test.mjs — the browser's ledger of what left this machine, and its
// cross-check against heimdall's. Fake storage and fake fetch; no network.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createOutbound, isLocalUrl, describeSummary, formatBytes } from "./fold-chat-outbound.js";
import { createTaint, canonMessages } from "./fold-chat-seal.js";
import { setAuditHook, chat, remoteCode } from "./fold-chat-client.js";

const hex = (s) => createHash("sha256").update(s).digest("hex");
const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const msgs = [{ role: "system", content: "sys" }, { role: "user", content: "make a timer" }];

test("isLocalUrl: loopback is not an exit; everything else is", () => {
  for (const u of ["http://localhost:8790/api/tags", "http://127.0.0.1:8795/x", "http://[::1]:1/x", "/relative"]) assert.equal(isLocalUrl(u), true, u);
  for (const u of ["https://en.wikipedia.org/w/api.php", "https://corsproxy.io/?url=x", "http://192.168.1.5:8790/"]) assert.equal(isLocalUrl(u), false, u);
});

test("a model request is recorded BEFORE it leaves, graded, and closed when it answers", () => {
  const o = createOutbound({ storage: store(), now: () => "T" });
  const h = o.sendModel({ auditId: "a1", model: "openai-fast", messages: msgs, run: "r1" });
  assert.equal(o.list().length, 1);
  assert.equal(h.entry.status, "sending", "on the ledger before the answer exists");
  assert.equal(h.entry.grade.level, "gate"); assert.equal(h.entry.grade.sealed, false); assert.equal(h.entry.grade.raw, true);
  h.done({ ok: true, status: 200 });
  assert.equal(o.get("a1").status, "answered");
});

test("falsifier: raw escalation is NEVER shown as sealed, and the summary says so in words", () => {
  const o = createOutbound({ storage: store() });
  o.sendModel({ auditId: "a1", model: "m", messages: msgs, host: "pollinations.ai" });
  const s = o.summary();
  assert.equal(s.sealed, 0); assert.equal(s.raw, 1); assert.equal(s.levels.gate, 1);
  assert.match(describeSummary(s), /1 as raw content under the gate/);
  assert.doesNotMatch(describeSummary(s), /abstract|possible worlds/);
});

test("a private particular in an outgoing request is flagged as a leak, by the registry the local reads fed", () => {
  const taint = createTaint().addFromText("Eleanor Voss ran the Office of the Keeper.");
  const o = createOutbound({ storage: store(), taint });
  const h = o.sendModel({ auditId: "a1", model: "m", messages: [{ role: "user", content: "Why did Eleanor Voss resign?" }] });
  assert.equal(h.entry.grade.leaks.length, 1);
  assert.equal(h.entry.grade.leaks[0].type, "particular");
  assert.match(describeSummary(o.summary()), /1 leak flagged/);
});

test("direct web calls are recorded with the full query — the query IS what leaves — and are never sealed", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => ({ ok: true, status: 200 });
  try {
    const taint = createTaint().add("Judy Liff");
    const o = createOutbound({ storage: store(), taint });
    const f = o.auditedFetch("web search", "r9");
    await f("https://en.wikipedia.org/w/api.php?action=query&srsearch=Judy+Liff+Nashville");
    await f("http://127.0.0.1:8790/api/tags");
    const l = o.list();
    assert.equal(l.length, 1, "the loopback call is not an exit");
    assert.equal(l[0].via, "direct"); assert.equal(l[0].grade.level, "direct"); assert.equal(l[0].grade.sealed, false);
    assert.match(l[0].url, /srsearch=Judy\+Liff\+Nashville/);
    assert.equal(l[0].grade.leaks[0].term, "Judy Liff", "a registered particular in a web query is a leak");
    assert.equal(l[0].run, "r9");
    assert.match(describeSummary(o.summary()), /1 direct from this page \(not through heimdall\)/);
  } finally { globalThis.fetch = realFetch; }
});

test("a failed direct call is recorded as failed, with its error", async () => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("offline"); };
  try {
    const o = createOutbound({ storage: store() });
    await assert.rejects(o.auditedFetch("web")("https://example.org/x"));
    assert.equal(o.list()[0].status, "failed"); assert.match(o.list()[0].error, /offline/);
  } finally { globalThis.fetch = realFetch; }
});

test("the ledger persists across a reload and stays bounded", () => {
  const st = store();
  const a = createOutbound({ storage: st, max: 3 });
  for (let i = 0; i < 5; i++) a.sendModel({ auditId: "x" + i, model: "m", messages: msgs });
  const b = createOutbound({ storage: st, max: 3 });
  assert.deepEqual(b.list().map((e) => e.id), ["x2", "x3", "x4"]);
  b.sendModel({ auditId: "x5", model: "m", messages: msgs });
  assert.equal(b.list().at(-1).n, 6, "numbering continues after a reload");
});

// ───────────────────────── verifying against heimdall's ledger ─────────────────────────

const heimdallSays = (entry) => async () => ({ ok: true, json: async () => ({ entries: entry ? [entry] : [] }) });

test("falsifier: verify() passes only when heimdall's content hash equals the one this page computed", async () => {
  const o = createOutbound({ storage: store(), auditUrl: "http://h", fetchImpl: heimdallSays({ privacy: "sealed-external", host: "p.test", provider: "p", model: "m", request: { contentSha256: hex(canonMessages(msgs)), sha256: "w", bytes: 10 }, response: { status: 200 } }) });
  o.sendModel({ auditId: "a1", model: "m", messages: msgs });
  const v = await o.verify("a1");
  assert.equal(v.verified, true); assert.equal(v.host, "p.test");
  assert.equal(o.get("a1").verification.verified, true);
  assert.equal(o.summary().unverified, 0);

  const tampered = createOutbound({ storage: store(), auditUrl: "http://h", fetchImpl: heimdallSays({ privacy: "sealed-external", request: { contentSha256: "deadbeef" } }) });
  tampered.sendModel({ auditId: "a2", model: "m", messages: msgs });
  assert.equal((await tampered.verify("a2")).verified, false);
  assert.equal(tampered.summary().mismatched, 1);
  assert.match(describeSummary(tampered.summary()), /did not match heimdall's record/);
});

test("verify() with no heimdall record, or an unreachable heimdall, is NOT verified — and says why", async () => {
  const none = createOutbound({ storage: store(), auditUrl: "http://h", fetchImpl: heimdallSays(null) });
  none.sendModel({ auditId: "a1", model: "m", messages: msgs });
  assert.match((await none.verify("a1")).problems[0], /no record/);
  const down = createOutbound({ storage: store(), auditUrl: "http://h", fetchImpl: async () => { throw new Error("ECONNREFUSED"); } });
  down.sendModel({ auditId: "a1", model: "m", messages: msgs });
  const v = await down.verify("a1");
  assert.equal(v.verified, false); assert.match(v.problems[0], /could not reach heimdall/);
});

test("a direct call has no second ledger to compare against, and verify() says exactly that", async () => {
  const o = createOutbound({ storage: store() });
  const h = o.sendDirect({ url: "https://en.wikipedia.org/w?q=x" });
  const v = await o.verify(h.entry.id);
  assert.equal(v.verified, null); assert.match(v.problems[0], /not sent through heimdall/);
});

test("exportJson carries the exact content and grades — and no credential ever enters the ledger", () => {
  const o = createOutbound({ storage: store(), now: () => "T" });
  o.sendModel({ auditId: "a1", model: "m", messages: msgs });
  const j = JSON.parse(o.exportJson());
  assert.equal(j.entries[0].messages[1].content, "make a timer");
  assert.equal(j.summary.requests, 1);
  assert.ok(!/authorization|bearer|api[_-]?key/i.test(o.exportJson()));
});

test("formatBytes", () => { assert.equal(formatBytes(12), "12 B"); assert.equal(formatBytes(2048), "2.0 KB"); assert.equal(formatBytes(3 * 1048576), "3.0 MB"); });

// ───────────────────────── the client hook: every chat reports before it leaves ─────────────────────────

function bridgeFetch(seen) {
  return async (url, opts) => {
    seen.push({ url, headers: opts.headers, body: JSON.parse(opts.body) });
    const data = "data: " + JSON.stringify({ choices: [{ delta: { content: "ok" } }] }) + "\n\ndata: [DONE]\n\n";
    return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(data)); c.close(); } }) };
  };
}

test("chat() reports to the audit hook BEFORE the request leaves, sends the audit id as a header, and reports the outcome", async () => {
  const seen = [], events = [];
  setAuditHook({ before: (info) => { events.push(["before", info.auditId, seen.length]); return (r) => events.push(["after", r.ok]); } });
  try {
    const out = await chat("openai-fast", msgs, { fetchImpl: bridgeFetch(seen), audit: { purpose: "t" } });
    assert.equal(events[0][0], "before"); assert.equal(events[0][2], 0, "the hook ran before the fetch");
    assert.equal(seen[0].headers["x-fold-audit"], events[0][1], "the same id rides the wire");
    assert.equal(out.auditId, events[0][1]);
    assert.deepEqual(events.at(-1), ["after", true]);
  } finally { setAuditHook(null); }
});

test("chat() sends the world SLOT in a header and never anything about which world is real", async () => {
  const seen = [];
  await chat("m", msgs, { fetchImpl: bridgeFetch(seen), audit: { worlds: { setId: "S9", slot: 2, n: 5 } } });
  assert.equal(seen[0].headers["x-fold-worlds"], "S9:2/5");
  assert.ok(!JSON.stringify(seen[0]).includes("real"));
});

test("remoteCode: by default each attempt is graded masked — not raw, not sealed — and the summary says so", async () => {
  const ledger = createOutbound({ storage: store() });
  setAuditHook({ before: (i) => ledger.sendModel({ auditId: i.auditId, model: i.model, messages: i.messages, segments: i.segments, purpose: i.purpose }).done });
  try {
    await remoteCode("a timer for dr.kim@clinic.org", { candidates: ["live"], prior: "<b>old</b>", fetchImpl: bridgeFetch([]) });
    const [e] = ledger.list();
    assert.deepEqual(e.segments.map((s) => s.provenance), ["template", "masked", "masked"]);
    assert.equal(e.grade.level, "masked"); assert.equal(e.grade.sealed, false); assert.equal(e.grade.raw, false); assert.equal(e.grade.leaks.length, 0);
    assert.ok(!JSON.stringify(e.messages).includes("dr.kim@clinic.org"), "the ledger holds what left, and the address did not");
    const sum = ledger.summary();
    assert.equal(sum.levels.masked, 1); assert.equal(sum.raw, 0);
    assert.match(describeSummary(sum), /1 with private details masked/);
  } finally { setAuditHook(null); }
});

test("a failed chat is reported to the hook as failed", async () => {
  const events = [];
  setAuditHook({ before: () => (r) => events.push(r) });
  try { await assert.rejects(chat("m", msgs, { fetchImpl: async () => ({ ok: false, status: 502 }) })); } finally { setAuditHook(null); }
  assert.equal(events[0].ok, false);
});

test("remoteCode: each fan-out attempt is its OWN audited request with provenance — sent as written (mask:false) it is graded gate, raw, not sealed", async () => {
  const seen = [], ledger = createOutbound({ storage: store() });
  setAuditHook({ before: (i) => ledger.sendModel({ auditId: i.auditId, model: i.model, messages: i.messages, segments: i.segments, purpose: i.purpose }).done });
  const answers = { dead: null, live: "<p>x</p>" };
  const fetchImpl = async (url, opts) => { seen.push(JSON.parse(opts.body).model); if (answers[JSON.parse(opts.body).model] == null) return { ok: false, status: 502 }; return bridgeFetch([])(url, opts); };
  try {
    const out = await remoteCode("a timer", { candidates: ["dead", "live"], prior: "<b>old</b>", mask: false, fetchImpl });
    assert.equal(out.model, "live");
    assert.deepEqual(seen, ["dead", "live"], "two providers were sent the same content");
    const l = ledger.list();
    assert.equal(l.length, 2, "both attempts are on the ledger");
    assert.deepEqual(l.map((e) => e.status), ["failed", "answered"]);
    assert.deepEqual(l[0].segments.map((s) => s.provenance), ["template", "generated", "ask"]);
    assert.ok(l.every((e) => e.grade.level === "gate" && !e.grade.sealed && e.grade.raw));
    assert.equal(ledger.summary().raw, 2);
    assert.equal(out.sent.length, 2); assert.notEqual(out.sent[0].auditId, out.sent[1].auditId);
  } finally { setAuditHook(null); }
});
