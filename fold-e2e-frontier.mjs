// fold-e2e-frontier.mjs — the Fold's real outbound path against a real frontier model.
//
//   ANTHROPIC_KEY=sk-ant-... node fold-e2e-frontier.mjs [model]
//
// Runs the Fold's own client code — the de-identifier, the audit hook, the ledger, the unmasking — and sends the model
// call to api.anthropic.com. The one thing NOT exercised is heimdall itself (its gate and its second ledger): the call
// goes through a thin shim standing where the bridge would, which also records the exact bytes that left, so the check
// "did anything private leave" is made against the wire, not against the Fold's own account of it.
//
// The key is read from the environment, used only as a request header, and never printed or written anywhere.
// Each run makes at most a handful of tiny requests. Exit code 1 if any check fails.

import { setAuditHook, remoteCode, chat } from "./fold-chat-client.js";
import { createOutbound } from "./fold-chat-outbound.js";
import { createTaint } from "./fold-chat-seal.js";
import { describeEntry, monitorSummary } from "./fold-chat-monitor.js";

const KEY = process.env.ANTHROPIC_KEY;
const MODEL = process.argv[2] || "claude-haiku-4-5-20251001";
if (!KEY) { console.error("set ANTHROPIC_KEY"); process.exit(2); }

const wire = [];            // every body that actually left toward Anthropic
let calls = 0;
const shim = async (url, opts = {}) => {
  if (!String(url).endsWith("/v1/chat/completions")) throw new Error("unexpected url " + url);
  const body = JSON.parse(opts.body);
  const sys = body.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const msgs = body.messages.filter((m) => m.role !== "system").map((m) => ({ role: m.role, content: m.content }));
  const out = { model: MODEL, max_tokens: Math.min(body.max_tokens || 300, 300), messages: msgs, ...(sys ? { system: sys } : {}) };
  const raw = JSON.stringify(out);
  wire.push(raw); calls++;
  const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: { "content-type": "application/json", "anthropic-version": "2023-06-01", "x-api-key": KEY }, body: raw, signal: opts.signal });
  if (!r.ok) { const t = await r.text(); return new Response(JSON.stringify({ error: { message: "anthropic " + r.status + ": " + t.slice(0, 160) } }), { status: r.status }); }
  const j = await r.json();
  const text = (j.content || []).map((c) => c.text || "").join("");
  const sse = `data: ${JSON.stringify({ choices: [{ delta: { content: text } }], usage: j.usage })}\n\ndata: [DONE]\n\n`;
  return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
};

const store = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; };
const results = [];
const check = (name, ok, note = "") => { results.push({ name, ok }); console.log((ok ? "  PASS " : "  FAIL ") + name + (note ? " — " + note : "")); };

// planted identifiers: none may appear in anything that leaves
const PLANTED = ["Eleanor Voss", "eleanor.voss@example.org", "555 0142", "/Users/eleanor", "kettering-clinic"];
const leaked = (s) => PLANTED.filter((p) => s.toLowerCase().includes(p.toLowerCase()));

const taint = createTaint(); taint.add("/Users/eleanor/cases/kettering-clinic", "folder path");
const ledger = createOutbound({ storage: store(), taint });
setAuditHook({ before: (i) => ledger.sendModel({ auditId: i.auditId, model: i.model, messages: i.messages, segments: i.segments, worlds: i.worlds, symmetry: i.symmetry, gate: i.privacy === "sealed-external" || i.privacy === "explicit", purpose: i.purpose, run: i.run, base: i.base, masking: i.masking }).done });

console.log(`model ${MODEL}\n`);

// 1. masked round trip: private details in, frontier answers using the placeholders, originals restored locally
console.log("1. masked round trip");
const ask = "Write a two-line shell comment header for a script by Eleanor Voss (eleanor.voss@example.org, +1 615 555 0142) kept at /Users/eleanor/cases/kettering-clinic/notes.sh. Repeat her name, email, phone and the path exactly as I gave them, then the single line: echo ok";
const r1 = await remoteCode(ask, { candidates: [MODEL], taint, fetchImpl: shim, base: "http://shim.invalid" }).catch((e) => ({ error: e }));
if (r1.error) check("the call completed", false, r1.error.message);
else {
  check("the call completed through the Fold's own path", true, `${r1.text.length} chars back`);
  check("nothing planted appears in the bytes that left", leaked(wire[0] || "").length === 0, leaked(wire[0] || "").join(", ") || "wire clean");
  const sentUser = JSON.parse(wire[0]).messages.map((m) => m.content).join("\n");
  const phs = sentUser.match(/\b(?:USER|PATH|FILE|TERM|EMAIL|PHONE|SECRET|HOST|ID)_\d+\b/g) || [];
  check("placeholders stood in for the private details", phs.length >= 3, [...new Set(phs)].join(" "));
  const back = ["Eleanor Voss", "eleanor.voss@example.org", "555 0142"].filter((p) => r1.text.includes(p));
  check("the reply came back with originals restored locally", back.length >= 1, back.length ? "restored: " + back.join(" | ") : "model did not echo any placeholder: " + r1.text.slice(0, 120).replace(/\n/g, " "));
  check("no placeholder is left dangling in the reply", !/\b(?:USER|PATH|FILE|TERM|EMAIL|PHONE|SECRET|HOST|ID)_\d+\b/.test(r1.text), r1.text.match(/\b(?:USER|PATH|FILE|TERM|EMAIL|PHONE|SECRET|HOST|ID)_\d+\b/g)?.join(" ") || "");
  const e = ledger.list().at(-1);
  check("the ledger recorded the call as masked, with the masker's count", e?.grade.level === "masked" && e?.masking?.count >= 3, e ? `${e.grade.level}, ${e.masking?.count} details` : "no entry");
  check("the ledger entry holds no original", leaked(JSON.stringify(e)).length === 0, leaked(JSON.stringify(e)).join(", "));
  check("the monitor says so in words", /^masked — \d+ details/.test(e ? describeEntry(e).state : ""), e ? describeEntry(e).state : "");
}

// 2. every shape of identifier the masker claims to catch, in one request, checked against the wire
console.log("\n2. identifier shapes (checked against the bytes that left)");
const SHAPES = { "SSN": "123-45-6789", "private IP": "192.168.4.77", "password value": "hunter2-hunter2", "titled name": "Okafor", "internal host": "build01.corp", "home-path user": "/Users/mkowalski/" };
const ask2 = `Debug note: Dr. Okafor (SSN 123-45-6789) logs in to build01.corp from 192.168.4.77 with password: hunter2-hunter2; her files are under /Users/mkowalski/projects/app. Reply with only the word: received`;
const w0 = wire.length;
const r2 = await remoteCode(ask2, { candidates: [MODEL], taint, fetchImpl: shim, base: "http://shim.invalid" }).catch((e) => ({ error: e }));
if (r2.error) check("the request was either sent clean or refused before sending", wire.length === w0, "refused: " + r2.error.message.slice(0, 100));
else {
  const sent2 = wire.slice(w0).join("\n");
  for (const [k, v] of Object.entries(SHAPES)) check(`${k} did not leave`, !sent2.includes(v), sent2.includes(v) ? "LEAKED: " + v : "masked");
}

// 2b. a KNOWN gap, reported not asserted: the masker's own header says a lone lowercase name with no capital, no title and no registration is not found
const w1 = wire.length;
await remoteCode("my neighbour maria next door at 14 oak lane keeps asking about the build; reply with only: received", { candidates: [MODEL], taint, fetchImpl: shim, base: "http://shim.invalid" }).catch(() => {});
const gap = wire.slice(w1).join("\n");
console.log("  INFO known gap — lone lowercase name 'maria' + street address " + (/maria/i.test(gap) ? "LEFT the machine" : "was masked") + "; '14 oak lane' " + (/oak lane/i.test(gap) ? "LEFT the machine" : "was masked"));

// 3. control: the ordinary chat path sends what it is given. This is the baseline the monitor must call raw.
console.log("\n3. control — the ordinary chat path (no masking step)");
const raw = await chat(MODEL, [{ role: "user", content: "Say only: ok. (context: my name is Eleanor Voss)" }], { base: "http://shim.invalid", privacy: "sealed-external", fetchImpl: shim, maxTokens: 20, audit: { id: "ctl1", purpose: "control", segments: [{ role: "user", chars: 50, provenance: "ask" }] } }).catch((e) => ({ error: e }));
const ctl = ledger.get("ctl1");
check("the control call went out and is graded raw by the ledger", !raw.error && ctl?.grade.level === "gate" && ctl.grade.raw === true, ctl ? ctl.grade.level : String(raw.error?.message));
check("the monitor calls it NOT anonymized (the honest answer)", /NOT anonymized/.test(ctl ? describeEntry(ctl).state : ""), ctl ? describeEntry(ctl).state : "");
check("and the planted name really did leave on that path", leaked(wire.at(-1) || "").includes("Eleanor Voss"), "this is the gap: chat answers are not masked");

for (const e of ledger.list()) console.log(`  ledger #${e.n} ${e.purpose || e.kind} · grade ${e.grade.level} · ${e.masking ? e.masking.count + " masked" : "no masking record"} · segments ${e.segments.map((x) => x.provenance).join("/")}`);
const s = monitorSummary(ledger.list());
console.log(`\nsummary: ${s.calls} calls · ${s.masked} masked · ${s.unanonymized} not anonymized · ${s.detailsTaken} details taken out · ${calls} requests reached Anthropic`);
const failed = results.filter((r) => !r.ok);
console.log(failed.length ? `\n${failed.length} of ${results.length} checks FAILED` : `\nall ${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
