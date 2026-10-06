import test from "node:test";
import assert from "node:assert/strict";
import { createDeid, namesIn, placeholderRanges, spanIsMasked } from "./fold-chat-deid.js";
import { createRedactor, deidentify } from "./fold-chat-redact.js";
import { createTaint, gradeRequest } from "./fold-chat-seal.js";

const taintOf = (...t) => { const x = createTaint(); for (const [term, kind] of t) x.add(term, kind); return x; };
/** A stand-in for the Python redactor: reports PERSON spans for the given words wherever they occur. */
const fakeRedact = (...words) => async (texts) => texts.map((t) => words.flatMap((w) => [...t.matchAll(new RegExp(w, "gi"))].map((m) => ({ start: m.index, end: m.index + m[0].length, type: "PERSON", score: 0.85 }))));
const PH = /^(?:[A-Z]+)_[a-hj-km-np-z2-9]{6}$/;

test("registry terms, home-path usernames, emails and keys are replaced; the structure of the code is not", () => {
  const taint = taintOf(["Eleanor Voss", "local-read"], ["/Users/mlacy/Documents/clinic", "folder path"], ["intake_form.csv", "filename"]);
  const d = createDeid({ taint });
  const src = 'const owner = "Eleanor Voss"; // mail eleanor@clinic.org\nfetch("/Users/mlacy/Documents/clinic/intake_form.csv");\nconst apiKey = "sk-abcdefghijklmnopqrstuvwx";\npassword = "hunter2hunter2";\nfor (const r of rows) total += r.n;';
  const [m] = d.maskAll([src]);
  for (const secret of ["Eleanor", "Voss", "eleanor@", "clinic.org", "mlacy", "intake_form", "sk-abcdef", "hunter2"]) assert.ok(!m.includes(secret), secret + " must not survive: " + m);
  assert.match(m, /for \(const r of rows\) total \+= r\.n;/);
  assert.match(m, /password = "SECRET_[a-hj-km-np-z2-9]{6}"/, "the name of a password stays, only the value goes");
  assert.deepEqual(d.residual(m), []);
  assert.equal(d.unmask(m), src, "the round trip returns exactly what was written");
});

test("ids are per-turn: a type and six random characters, different on the next turn for the very same name", () => {
  const a = createDeid({ extra: ["Voss"] }).mask("Voss and Voss");
  const b = createDeid({ extra: ["Voss"] }).mask("Voss and Voss");
  const [x1, , x2] = a.split(" ");
  assert.match(x1, PH); assert.equal(x1, x2, "within a turn the same name is the same id");
  assert.notEqual(a, b, "across turns it is not");
  assert.ok(!/\d$/.test(x1.slice(0, 5)) && !/Voss/.test(a));
});

test("different details never share an id, and a model-derived name still unmasks", () => {
  const d = createDeid({ extra: ["Voss", "Marlow"] });
  const m = d.mask("Voss met Marlow. Voss left.");
  const ids = m.match(/[A-Z]+_[a-hj-km-np-z2-9]{6}/g);
  assert.equal(new Set(ids).size, 2); assert.equal(ids.length, 3);
  assert.equal(d.unmask(`function greet_${ids[0]}() { return 'hi ${ids[1]}'; }`), "function greet_Voss() { return 'hi Marlow'; }");
});

test("a reply that changed the case of an id still finds its way home; an id this turn never issued is left alone", () => {
  const d = createDeid({ extra: ["Voss"] });
  const id = d.mask("Voss").trim();
  assert.equal(d.unmask(id.toUpperCase().replace("_", "_")), "Voss");
  assert.equal(d.unmask("PERSON_zzzzzz and NAME_aaaaaa"), "PERSON_zzzzzz and NAME_aaaaaa");
});

test("case variants are kept apart so the reply does not change anyone's capitalisation", () => {
  const d = createDeid({ taint: taintOf(["voss", "local-read"]) });
  const m = d.mask("VOSS and Voss and voss");
  assert.equal(new Set(m.split(" and ")).size, 3);
  assert.equal(d.unmask(m), "VOSS and Voss and voss");
});

test("a registry term inside a longer identifier is still masked (the scan is substring) and the text around it survives", () => {
  const d = createDeid({ taint: taintOf(["getUserName", "local-read"]) });
  const src = "getUserNameFromCache(); getUserName2(); getUserName";
  const m = d.mask(src);
  assert.ok(!/getUserName/.test(m)); assert.deepEqual(d.residual(m), []);
  assert.match(m, /FromCache\(\);/); assert.match(m, /2\(\);/);
  assert.equal(d.unmask(m), src);
});

test("text that already looks like one of our ids is never confused with one", () => {
  const d = createDeid({ extra: ["Voss"] });
  const m = d.mask("PERSON_abcdef is a constant; Voss is a person");
  assert.match(m, /^PERSON_abcdef is a constant; /);
  assert.equal(d.unmask(m), "PERSON_abcdef is a constant; Voss is a person");
});

test("phones, ssn-shaped ids, private addresses and internal hosts are masked; public hosts and versions are not", () => {
  const d = createDeid();
  const src = "call (615) 555-0142, ssn 123-45-6789, db at 10.0.4.17 and 192.168.1.5, wiki.corp.local, cdn.jsdelivr.net, v10.2.3";
  const m = d.mask(src);
  for (const s of ["555-0142", "123-45-6789", "10.0.4.17", "192.168.1.5", "wiki.corp.local"]) assert.ok(!m.includes(s), s);
  assert.match(m, /cdn\.jsdelivr\.net/); assert.match(m, /v10\.2\.3/);
  assert.equal(d.unmask(m), src);
});

test("a Windows home path loses its username and keeps its shape; generic usernames are left alone", () => {
  const d = createDeid();
  const m = d.mask("C:\\Users\\kowalski\\proj\\a.js and /home/kowalski/x");
  assert.ok(!/kowalski/.test(m)); assert.match(m, /C:\\Users\\USER_[a-hj-km-np-z2-9]{6}\\proj\\a\.js/);
  assert.match(createDeid().mask("/home/runner/work and admin"), /^\/home\/USER_[a-hj-km-np-z2-9]{6}\/work and admin$/);
});

test("a title and the name after it are masked; 'Drive Thru' is not a title", () => {
  const m = createDeid().mask("book with Dr. Kim or Mrs Okafor, not Drive Thru");
  assert.ok(!/Kim|Okafor/.test(m)); assert.match(m, /Drive Thru/);
});

test("an email is masked as ONE email, before any name inside it is matched on its own", () => {
  const d = createDeid({ extra: ["kim", "clinic"] });
  const m = d.mask("write to dr.kim@clinic.org about the clinic");
  assert.match(m, /^write to EMAIL_[a-hj-km-np-z2-9]{6} about the NAME_[a-hj-km-np-z2-9]{6}$/);
  assert.equal(d.stats().kinds.EMAIL, 1);
  assert.equal(d.unmask(m), "write to dr.kim@clinic.org about the clinic");
});

test("spans from the redactor are applied in the text's own coordinates, including after an emoji", () => {
  const src = "😀 make a timer for priya at 4 elm st";
  const priya = src.indexOf("priya"), addr = src.indexOf("4 elm st");
  const d = createDeid();
  const m = d.mask(src, { spans: [{ start: priya, end: priya + 5, type: "PERSON", score: 0.85 }, { start: addr, end: addr + 8, type: "ADDRESS", score: 0.7 }] });
  assert.match(m, /^😀 make a timer for PERSON_[a-hj-km-np-z2-9]{6} at ADDRESS_[a-hj-km-np-z2-9]{6}$/);
  assert.equal(d.unmask(m), src);
});

test("overlapping reports become one masked span: the union masks more, never less", () => {
  const src = "ask eleanor voss now";
  const d = createDeid();
  const m = d.mask(src, { spans: [{ start: 4, end: 11, type: "NAME_CANDIDATE", score: 0.5 }, { start: 4, end: 16, type: "PERSON", score: 0.85 }, { start: 12, end: 16, type: "NAME_CANDIDATE", score: 0.5 }] });
  assert.match(m, /^ask PERSON_[a-hj-km-np-z2-9]{6} now$/);
});

test("modes: 'open' leaves places, organisations and links readable and STILL masks every personal identifier", () => {
  const src = "email bo@x.org, call priya in Nashville at Acme Corp, see https://acme.example";
  const find = (w, type) => ({ start: src.indexOf(w), end: src.indexOf(w) + w.length, type, score: 0.85 });
  const spans = [find("priya", "PERSON"), find("Nashville", "LOCATION"), find("Acme Corp", "ORGANIZATION"), find("https://acme.example", "URL"), find("bo@x.org", "EMAIL_ADDRESS")];
  const def = createDeid({ mode: "default" }).mask(src, { spans });
  const open = createDeid({ mode: "open" }).mask(src, { spans });
  for (const s of ["priya", "Nashville", "Acme Corp", "acme.example", "bo@x.org"]) assert.ok(!def.includes(s), "default masks " + s);
  for (const s of ["priya", "bo@x.org"]) assert.ok(!open.includes(s), "open still masks " + s);
  for (const s of ["Nashville", "Acme Corp", "https://acme.example"]) assert.ok(open.includes(s), "open leaves " + s);
  assert.equal(spanIsMasked({ type: "DATE_TIME", score: 0.9 }), false, "a date alone does not identify");
});

test("residual reports kinds, never values", () => {
  const d = createDeid({ taint: taintOf(["Eleanor Voss", "local-read"]) });
  const hits = d.residual("Eleanor Voss wrote sk-abcdefghijklmnopqrstuvwx");
  assert.ok(hits.length >= 2);
  assert.ok(!JSON.stringify(hits).includes("Eleanor") && !JSON.stringify(hits).includes("sk-abc"));
});

test("stats say how much was masked and of what kind, not what it was", () => {
  const d = createDeid({ extra: ["Voss"] });
  d.mask("Voss a@b.org");
  assert.deepEqual(d.stats(), { count: 2, kinds: { NAME: 1, EMAIL: 1 }, mode: "default" });
});

test("placeholderRanges finds exactly our ids", () => {
  const d = createDeid({ extra: ["Voss"] });
  const m = d.mask("x Voss y");
  assert.deepEqual(placeholderRanges(m), [[2, m.indexOf(" y")]]);
  assert.deepEqual(placeholderRanges("PERSON_abc and NOTAKIND_abcdef"), []);
});

test("namesIn finds capitalised multi-word names and nothing lowercase", () => {
  assert.deepEqual(namesIn("make a timer for Eleanor Voss and mary jones, see Marlow Dental"), ["Eleanor Voss", "Marlow Dental"]);
});

test("graded: masked content with nothing left is 'masked' — not sealed, not raw — and one stray particular drops it back to gate", () => {
  const messages = [{ role: "system", content: "You are an engineer." }, { role: "user", content: "fix NAME_k3f9ax" }];
  const g = gradeRequest({ messages, segments: [{ provenance: "template" }, { provenance: "masked" }], gate: true });
  assert.equal(g.level, "masked"); assert.equal(g.sealed, false); assert.equal(g.raw, false);
  const leaky = gradeRequest({ messages: [{ role: "user", content: "fix Eleanor Voss" }], segments: [{ provenance: "masked" }], gate: true }, { taint: taintOf(["Eleanor Voss", "local-read"]) });
  assert.equal(leaky.level, "gate"); assert.equal(leaky.leaks.length, 1);
});

test("graded: what masking leaves behind (password = SECRET_xxxxxx, /Users/USER_xxxxxx/) is not a leak, and a real key still is", () => {
  const ok = gradeRequest({ messages: [{ role: "user", content: 'password = "SECRET_k3f9ax" in /Users/USER_k3f9ax/proj' }], segments: [{ provenance: "masked" }], gate: true });
  assert.equal(ok.level, "masked"); assert.equal(ok.leaks.length, 0);
  const bad = gradeRequest({ messages: [{ role: "user", content: "key sk-abcdefghijklmnopqrstuvwx" }], segments: [{ provenance: "masked" }], gate: true });
  assert.equal(bad.level, "gate"); assert.equal(bad.leaks.length, 1);
});

// ── fold-chat-redact.js ──

test("deidentify asks the redactor again about the MASKED text and masks what it still finds", async () => {
  let calls = 0;
  const redact = async (texts) => { calls++; return texts.map((t) => (calls === 1 ? [] : [...t.matchAll(/tink/g)].map((m) => ({ start: m.index, end: m.index + 4, type: "NAME_CANDIDATE", score: 0.5 })))); };
  const out = await deidentify(["ask tink"], { redact });
  assert.ok(!/tink/.test(out.texts[0])); assert.equal(out.passes, 2); assert.equal(out.viaRedactor, true);
  assert.equal(out.deid.unmask(out.texts[0]), "ask tink");
});

test("deidentify never mistakes our own ids for details: a redactor that reads a placeholder as a name changes nothing", async () => {
  const readsEverything = async (texts) => texts.map((t) => [...t.matchAll(/[A-Za-z_0-9]+/g)].map((m) => ({ start: m.index, end: m.index + m[0].length, type: "NAME_CANDIDATE", score: 0.5 })));
  const out = await deidentify(["a b"], { redact: readsEverything });
  assert.equal(out.passes, 1, "the second look finds only our own ids");
  assert.ok(!/\ba\b|\bb\b/.test(out.texts[0]));
});

test("deidentify refuses, rather than leaks, when the redactor keeps finding more after every pass", async () => {
  const oneMorePerLook = async (texts) => texts.map((t) => { const m = [...t.matchAll(/[A-Za-z_0-9]+/g)].find((x) => !/^[A-Z]+_[a-hj-km-np-z2-9]{6}$/.test(x[0])); return m ? [{ start: m.index, end: m.index + m[0].length, type: "NAME_CANDIDATE", score: 0.5 }] : []; });
  await assert.rejects(deidentify(["a b c d e"], { redact: oneMorePerLook, maxPasses: 2 }), (e) => e.notSent && /still finds/.test(e.message));
});

test("deidentify FAILS CLOSED: a redactor that cannot answer means nothing is sent, and the error carries no text", async () => {
  await assert.rejects(deidentify(["secret plan for Eleanor"], { redact: async () => { throw new Error("connect ECONNREFUSED Eleanor"); } }), (e) => e.notSent && !/Eleanor|secret/.test(e.message));
  await assert.rejects(deidentify(["x"], { redact: async () => "not a list" }), (e) => e.notSent);
});

test("deidentify without a redactor runs the floor and says so: viaRedactor is false", async () => {
  const out = await deidentify(["mail a@b.org"], {});
  assert.equal(out.viaRedactor, false); assert.ok(!/a@b\.org/.test(out.texts[0]));
});

test("createRedactor speaks to the local door, tells it nothing else, and a bad answer is an error", async () => {
  const seen = [];
  const ok = createRedactor({ base: "http://127.0.0.1:1", fetchImpl: async (u, o) => { seen.push([u, JSON.parse(o.body)]); return { ok: true, json: async () => ({ spans: [[{ start: 0, end: 1, type: "PERSON", score: 1 }]] }) }; } });
  assert.deepEqual(await ok.spans(["a"]), [[{ start: 0, end: 1, type: "PERSON", score: 1 }]]);
  assert.equal(seen[0][0], "http://127.0.0.1:1/redact"); assert.deepEqual(Object.keys(seen[0][1]).sort(), ["texts", "threshold"]);
  await assert.rejects(createRedactor({ fetchImpl: async () => ({ ok: true, json: async () => ({ spans: [] }) }) }).spans(["a"]), /did not fit/);
  await assert.rejects(createRedactor({ fetchImpl: async () => { throw new Error("x"); } }).spans(["a"]), /did not answer/);
  assert.equal(await createRedactor({ fetchImpl: async () => { throw new Error("x"); } }).health(), null);
});

test("open: a proper-noun tag inside a place the redactor named stays readable with it; default masks both", () => {
  const src = "a shop on delmar for tink";
  const at = (w, type, score = 0.5) => ({ start: src.indexOf(w), end: src.indexOf(w) + w.length, type, score });
  const spans = [at("delmar", "LOCATION", 0.85), at("delmar", "NAME_CANDIDATE"), at("tink", "NAME_CANDIDATE")];
  const open = createDeid({ mode: "open" }).mask(src, { spans });
  assert.match(open, /^a shop on delmar for NAME_[a-hj-km-np-z2-9]{6}$/);
  assert.match(createDeid({ mode: "default" }).mask(src, { spans }), /^a shop on LOC_[a-hj-km-np-z2-9]{6} for NAME_[a-hj-km-np-z2-9]{6}$/);
});

test("exempt: code-ish tokens a name tagger reads as names are left alone; shapes and the registry are never exempt", () => {
  const src = "set(k2,138) set(k5,322) for priya, key sk-abcdefghijklmnopqrstuvwx";
  const at = (w) => ({ start: src.indexOf(w), end: src.indexOf(w) + w.length, type: "NAME_CANDIDATE", score: 0.5 });
  const spans = [at("k2"), at("k5"), at("priya")];
  const m = createDeid({ exempt: [/[a-z]\d+/i] }).mask(src, { spans });
  assert.match(m, /^set\(k2,138\) set\(k5,322\) for NAME_[a-hj-km-np-z2-9]{6}, key SECRET_/);
  const reg = createDeid({ taint: taintOf(["k2k2", "local-read"]), exempt: ["k2k2"] }).mask("k2k2 here", {});
  assert.ok(!/k2k2/.test(reg), "a registry term is masked even if an exempt rule would match it");
});

test("deidentifyJSON masks only string VALUES: keys, quotes and structure survive, and the reply object maps back", async () => {
  const { deidentifyJSON, unmaskJSON } = await import("./fold-chat-redact.js");
  const redact = async (texts) => texts.map((t) => [...t.matchAll(/priya|"|obligation/gi)].map((m) => ({ start: m.index, end: m.index + m[0].length, type: "PERSON", score: 0.9 })));
  const req = { obligation: "C-bounded", note: "ask priya", ops: ["set(k2,138)"], n: 3 };
  const out = await deidentifyJSON(req, { redact });
  assert.deepEqual(Object.keys(out.value), ["obligation", "note", "ops", "n"], "keys untouched");
  assert.equal(out.value.n, 3);
  assert.ok(!/priya/.test(JSON.stringify(out.value)));
  assert.deepEqual(unmaskJSON(out.deid, out.value).note, "ask priya");
});

test("CODE_CALLS: call-shaped fragments with number/short-token arguments are exempt as a whole; a name inside a call is not", async () => {
  const { CODE_CALLS } = await import("./fold-chat-deid.js");
  const run = (src, w) => { const a = src.indexOf(w); return createDeid({ exempt: [CODE_CALLS] }).mask(src, { spans: [{ start: a, end: a + w.length, type: "NAME_CANDIDATE", score: 0.5 }] }); };
  const seq = "set(k2,138) set(k5,322) set(k4,655) set(k3,891)";
  assert.equal(run(seq, seq), seq);
  assert.equal(run(seq, "set(k2,138) set(k5,322) set(k4,655) set(k3,891"), seq, "a span that stops before the closing paren is still exempt");
  assert.ok(!/priya/.test(run("greet(priya)", "greet(priya)")), "a name argument keeps the span masked");
});

test("origin: a leaf the caller vouches is public skips the redactor's judgement but NOT shapes, the registry or the residual check", async () => {
  const { deidentifyJSON } = await import("./fold-chat-redact.js");
  const redact = async (texts) => texts.map((t) => [...t.matchAll(/var |bill|priya/g)].map((m) => ({ start: m.index, end: m.index + m[0].length, type: "NAME_CANDIDATE", score: 0.5 })));
  const code = 'var bill = document.getElementById("bill"); // key sk-abcdefghijklmnopqrstuvwx';
  const req = { specimen: code, scenario: "bill 100 for priya" };
  const taint = taintOf(["getElementById", "local-read"]);
  const none = await deidentifyJSON(req, { redact });
  assert.ok(!none.value.specimen.includes("var bill"), "without an origin everything is masked");
  const out = await deidentifyJSON(req, { redact, originOf: (v, path) => (path === "specimen" ? "public" : null) });
  assert.match(out.value.specimen, /^var bill = document\.getElementById\("bill"\); \/\/ key SECRET_/, "public code survives; a key inside it is still masked");
  assert.ok(!/priya/.test(out.value.scenario), "the user's text is still masked");
  const t = await deidentifyJSON(req, { redact, taint, originOf: (v, path) => (path === "specimen" ? "public" : null) });
  assert.ok(!t.value.specimen.includes("getElementById"), "a registry term is masked even in public text");
});
