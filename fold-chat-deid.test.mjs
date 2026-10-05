import test from "node:test";
import assert from "node:assert/strict";
import { createDeid, namesIn } from "./fold-chat-deid.js";
import { createTaint, gradeRequest } from "./fold-chat-seal.js";

const taintOf = (...t) => { const x = createTaint(); for (const [term, kind] of t) x.add(term, kind); return x; };

test("registry terms, home-path usernames, emails and keys are replaced; the structure of the code is not", () => {
  const taint = taintOf(["Eleanor Voss", "local-read"], ["/Users/mlacy/Documents/clinic", "folder path"], ["intake_form.csv", "filename"]);
  const d = createDeid({ taint });
  const src = 'const owner = "Eleanor Voss"; // mail eleanor@clinic.org\nfetch("/Users/mlacy/Documents/clinic/intake_form.csv");\nconst apiKey = "sk-abcdefghijklmnopqrstuvwx";\npassword = "hunter2hunter2";\nfor (const r of rows) total += r.n;';
  const [m] = d.maskAll([src]);
  for (const secret of ["Eleanor", "Voss", "eleanor@", "clinic.org", "mlacy", "intake_form", "sk-abcdef", "hunter2"]) assert.ok(!m.includes(secret), secret + " must not survive: " + m);
  assert.match(m, /for \(const r of rows\) total \+= r\.n;/);
  assert.match(m, /password = "SECRET_\d+"/, "the name of a password stays, only the value goes");
  assert.deepEqual(d.residual(m), [], "a scan of the masked bytes finds nothing");
  assert.equal(d.unmask(m), src, "the round trip returns exactly what was written");
});

test("the same detail gets the same placeholder, different details do not collide, and a model-derived name still unmasks", () => {
  const d = createDeid({ taint: taintOf(["Voss", "local-read"], ["Marlow", "local-read"]) });
  const m = d.mask("Voss met Marlow. Voss left.");
  assert.equal(m, "TERM_1 met TERM_2. TERM_1 left.");
  assert.equal(d.unmask("function greet_TERM_1() { return 'hi TERM_2'; }"), "function greet_Voss() { return 'hi Marlow'; }");
});

test("case variants are kept apart so the reply does not change anyone's capitalisation", () => {
  const d = createDeid({ taint: taintOf(["voss", "local-read"]) });
  const m = d.mask("VOSS and Voss and voss");
  assert.equal(new Set(m.split(" and ")).size, 3);
  assert.equal(d.unmask(m), "VOSS and Voss and voss");
});

test("a term inside a longer identifier is still masked (the scan is substring) and the digit that follows it survives", () => {
  const d = createDeid({ taint: taintOf(["getUserName", "local-read"]) });
  const m = d.mask("getUserNameFromCache(); getUserName2(); getUserName");
  assert.ok(!/getUserName/.test(m));
  assert.deepEqual(d.residual(m), []);
  assert.equal(d.unmask(m), "getUserNameFromCache(); getUserName2(); getUserName");
});

test("more than nine placeholders: TERM_1 followed by a digit is not mistaken for TERM_10 on the way back", () => {
  const terms = Array.from({ length: 12 }, (_, i) => ["Name" + String.fromCharCode(97 + i) + "xyz", "local-read"]);
  const d = createDeid({ taint: taintOf(...terms) });
  const src = terms.map(([t]) => t).join(" ") + " " + terms[0][0] + "0";
  assert.equal(d.unmask(d.mask(src)), src);
});

test("text that already looks like a placeholder is never confused with one of ours", () => {
  const d = createDeid({ taint: taintOf(["Voss", "local-read"]) });
  const m = d.mask("TERM_1 is a constant; Voss is a person");
  assert.equal(d.unmask(m), "TERM_1 is a constant; Voss is a person");
  assert.ok(!/TERM_1 is a constant; TERM_1/.test(m), "ours is numbered past the one already in the text");
});

test("a placeholder this request never issued is left as the model wrote it", () => {
  const d = createDeid({ taint: taintOf(["Voss", "local-read"]) });
  d.mask("Voss");
  assert.equal(d.unmask("TERM_9 and EMAIL_3"), "TERM_9 and EMAIL_3");
});

test("phones, ssn-shaped ids, private addresses and internal hosts are masked; public hosts and versions are not", () => {
  const d = createDeid();
  const src = "call (615) 555-0142, ssn 123-45-6789, db at 10.0.4.17 and 192.168.1.5, wiki.corp.local, cdn.jsdelivr.net, v10.2.3";
  const m = d.mask(src);
  for (const s of ["555-0142", "123-45-6789", "10.0.4.17", "192.168.1.5", "wiki.corp.local"]) assert.ok(!m.includes(s), s);
  assert.match(m, /cdn\.jsdelivr\.net/); assert.match(m, /v10\.2\.3/);
  assert.equal(d.unmask(m), src);
});

test("a Windows home path loses its username and keeps its shape", () => {
  const d = createDeid();
  const m = d.mask("C:\\Users\\kowalski\\proj\\a.js and /home/kowalski/x");
  assert.ok(!/kowalski/.test(m)); assert.match(m, /C:\\Users\\USER_1\\proj\\a\.js/);
});

test("generic usernames are left alone — masking 'admin' everywhere would only damage the code", () => {
  const d = createDeid();
  assert.equal(d.mask("/home/runner/work and admin"), "/home/USER_1/work and admin");
});

test("residual reports kinds, never values", () => {
  const d = createDeid({ taint: taintOf(["Eleanor Voss", "local-read"]) });
  const hits = d.residual("Eleanor Voss wrote sk-abcdefghijklmnopqrstuvwx");
  assert.ok(hits.length >= 2);
  assert.ok(!JSON.stringify(hits).includes("Eleanor") && !JSON.stringify(hits).includes("sk-abc"));
});

test("stats say how much was masked and of what kind, not what it was", () => {
  const d = createDeid({ taint: taintOf(["Voss", "local-read"]) });
  d.mask("Voss a@b.org");
  assert.deepEqual(d.stats(), { count: 2, kinds: { TERM: 1, EMAIL: 1 } });
});

test("graded: masked content with nothing left is 'masked' — not sealed, not raw — and one stray particular drops it back to gate", () => {
  const messages = [{ role: "system", content: "You are an engineer." }, { role: "user", content: "fix TERM_1" }];
  const segments = [{ provenance: "template" }, { provenance: "masked" }];
  const g = gradeRequest({ messages, segments, gate: true });
  assert.equal(g.level, "masked"); assert.equal(g.sealed, false); assert.equal(g.raw, false);
  assert.match(g.notes.join(" "), /can still read the structure/);
  const leaky = gradeRequest({ messages: [{ role: "user", content: "fix Eleanor Voss" }], segments: [{ provenance: "masked" }], gate: true }, { taint: taintOf(["Eleanor Voss", "local-read"]) });
  assert.equal(leaky.level, "gate"); assert.equal(leaky.leaks.length, 1);
});

test("extra terms (what the holograph's read of the ask names) are masked as whole words, never as pieces of other words", () => {
  const d = createDeid({ extra: ["Priya", "Main", { term: "Franklin", kind: "place" }] });
  const src = "Priya runs Main Street in Franklin; maintain the Maintainer list, Priya's desk.";
  const m = d.mask(src);
  assert.ok(!/Priya|Franklin/.test(m)); assert.match(m, /maintain the Maintainer list/); assert.ok(!/\bMain\b/.test(m));
  assert.deepEqual(d.residual(m), []);
  assert.equal(d.unmask(m), src);
});

test("a title and the name after it are masked, with or without the dot", () => {
  const d = createDeid();
  const m = d.mask("book with Dr. Kim or Mrs Okafor, not Drive Thru");
  assert.ok(!/Kim|Okafor/.test(m)); assert.match(m, /Drive Thru/);
});

test("namesIn finds capitalised multi-word names and nothing lowercase", () => {
  assert.deepEqual(namesIn("make a timer for Eleanor Voss and mary jones, see Marlow Dental"), ["Eleanor Voss", "Marlow Dental"]);
});
