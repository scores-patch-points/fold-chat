// fold-chat-voiceswire.test.mjs — the page refuses anything that is not the module's own template; the host reads real files and refuses a changed one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { checkStored, askVoices, voicesParts, voicesEnabled, VOICES_URL } from "./fold-chat-voiceswire.js";
import { createVoicesHost } from "./fold-chat-voiceshost.mjs";
import { lineFor, TEMPLATES } from "./fold-chat-voices.js";

const V = (handle, giver, over = {}) => ({ handle, giver, quote: "God rewards the virtuous ruler.", frame: TEMPLATES.wrote({ giver }), source: { path: `x/${handle}.txt`, sha256: "ab", work: "W", section: "BOOK IV", start: 3, end: 40 }, ...over });
const good = () => ({ voices: [V("laozi", "Laozi"), V("mozi", "Mozi")], line: lineFor(2) });

test("checkStored accepts the module's own output and keeps nothing else", () => {
  const c = checkStored({ ...good(), extra: "x" });
  assert.equal(c.voices.length, 2); assert.equal(c.line, lineFor(2)); assert.equal("extra" in c, false);
});
test("checkStored refuses: a frame that is not the template, a line that is not, > 3, a long giver, a duplicate, no offsets, empty", () => {
  const bad = [
    (g) => { g.voices[0].frame = "Laozi would say:"; },
    (g) => { g.line = "Laozi is the best answer."; },
    (g) => { g.voices = [V("a", "A"), V("b", "B"), V("c", "C"), V("d", "D")]; g.line = lineFor(4); },
    (g) => { g.voices[0].giver = "Laozi (老子, 6th c. BC)"; },
    (g) => { g.voices[1] = { ...g.voices[0] }; },
    (g) => { delete g.voices[0].source.start; },
    (g) => { g.voices = []; },
    (g) => { g.voices[0].quote = ""; },
  ];
  for (const m of bad) { const g = good(); m(g); assert.equal(checkStored(g), null, m.toString()); }
  assert.equal(checkStored(null), null);
});
test("askVoices: silence on any failure; abort is rethrown; the question is in the query, not in the path", async () => {
  let seen = null;
  const ok = async (u) => { seen = u; return { ok: true, json: async () => good() }; };
  assert.equal((await askVoices({ question: "Is there a God?", fetchFn: ok })).voices.length, 2);
  assert.equal(seen, `${VOICES_URL}?q=${encodeURIComponent("Is there a God?")}`);
  assert.equal(await askVoices({ question: "x", fetchFn: async () => ({ ok: false }) }), null);
  assert.equal(await askVoices({ question: "x", fetchFn: async () => { throw new Error("net"); } }), null);
  assert.equal(await askVoices({ question: " ", fetchFn: ok }), null);
  const ac = new AbortController(); ac.abort();
  await assert.rejects(askVoices({ question: "x", fetchFn: async () => { throw Object.assign(new Error("a"), { name: "AbortError" }); }, signal: ac.signal }));
});
test("voicesParts: line, then frame / quote / cite per voice, whitespace collapsed for the eye", () => {
  const g = good(); g.voices[0].quote = "God rewards\nthe virtuous  ruler.";
  const p = voicesParts(checkStored(g));
  assert.deepEqual(p.map((x) => x.kind), ["line", "frame", "quote", "cite", "frame", "quote", "cite"]);
  assert.equal(p[2].text, "God rewards the virtuous ruler."); assert.equal(p[3].text, "W, BOOK IV");
  assert.deepEqual(voicesParts(null), []);
});
test("voicesEnabled is off by default and on only for 'on'", () => {
  assert.equal(voicesEnabled({ getItem: () => null }), false);
  assert.equal(voicesEnabled({ getItem: () => "on" }), true);
  assert.equal(voicesEnabled({ getItem: () => { throw new Error("blocked"); } }), false);
});

test("host: real files from a temp world, sha256 checked; a changed canon is refused and its thinker is silent", () => {
  const world = fs.mkdtempSync(path.join(os.tmpdir(), "voices-host-")), root = path.join(world, "fold");
  fs.mkdirSync(path.join(root, "voice"), { recursive: true }); fs.mkdirSync(path.join(world, "eo-teachings/sources"), { recursive: true });
  const canon = "THE WORKS\n\nBOOK ONE\n\nHeaven loves the people without partiality, and God rewards the virtuous ruler with long life and a peaceful state in all the years.\n";
  const file = path.join(world, "eo-teachings/sources/mozi.txt"); fs.writeFileSync(file, canon);
  const sha = crypto.createHash("sha256").update(canon).digest("hex");
  // a profile with one thinker whose counts make 'god' known and the thinker the top candidate
  const profile = { schema: "ThinkerProfile@1", vocab: "god ruler", calibration: { mu: 100, T: 1, m: 1, tau: 0.1 }, thinkers: [{ handle: "mozi", speaks: true, giver: "Mozi (Mo Tzu)", work: "W", source: { path: "eo-teachings/sources/mozi.txt", sha256: sha, chars: canon.length }, n: 100, c: "0:30,1:20" }, { handle: "other", speaks: true, giver: "Other", work: "O", source: { path: "eo-teachings/sources/none.txt", sha256: "00" }, n: 100, c: "0:5,1:5" }] };
  fs.writeFileSync(path.join(root, "voice/thinkers-profile.json"), JSON.stringify(profile));
  const r = createVoicesHost({ root, world }).ask("Is there a God?");
  assert.equal(r.voices.length, 1); assert.equal(r.voices[0].giver, "Mozi");
  assert.equal(canon.slice(r.voices[0].source.start, r.voices[0].source.end), r.voices[0].quote);
  assert.equal(checkStored(r) && true, true);
  fs.writeFileSync(file, canon + "tampered");
  const r2 = createVoicesHost({ root, world }).ask("Is there a God?");
  assert.deepEqual(r2.voices, []); assert.equal(r2.line, "");
  assert.deepEqual(createVoicesHost({ root: "/nonexistent", world }).ask("x").voices, []);
});
