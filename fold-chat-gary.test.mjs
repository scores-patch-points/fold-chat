// fold-chat-gary.test.mjs — Gary's door (fold-chat-gary.js) and the vendored closure under it.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { makeDoor, door, noteWindows, windowOf, forgetWindows, NEVER_ALONE } from "./fold-chat-gary.js";
import { assertPromptsBuildable, makeGary } from "./vendor/khora/native/organs/gary.js";
import { apparatusMentions, strikeAddresses } from "./vendor/khora/native/organs/firewall.js";
import { sourcesPrompt } from "./fold-chat-gaps.js";
import { threadPrompt } from "./fold-chat-thread.js";
import { restateMessages } from "./fold-chat-lang.js";
import { CARD_PROMPT } from "./fold-chat-snip.js";
import { KIND_PROMPT } from "./fold-chat-kinds.js";
import { GENERATE_NUDGE } from "./fold-chat-discourse.js";
import { NO_INVENT } from "./fold-chat-memory.js";
import * as client from "./fold-chat-client.js";
import { emptySummary } from "./vendor/the-fold/fold.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

// ── the vendored closure ───────────────────────────────────────────────────────────────────────────────────────────────

test("vendor/khora: Gary, Kondo, the firewall, Terry Gross and the pathos organs are vendored by CLOSURE, byte-identical to the pin", () => {
  const pin = JSON.parse(fs.readFileSync(path.join(HERE, "vendor/khora/VENDOR-KHORA.json"), "utf8"));
  const wanted = ["organs/gary.js", "organs/firewall.js", "organs/kondo.js", "the-fold/earned-cast.js", "organs/pathos.js", "the-fold/pathos-turn.js",
    "organs/pacing.js", "organs/experiencer.js", "kernel/dynamics.js"];
  for (const rel of wanted) {
    assert.ok(pin.files[rel], `${rel} is pinned`);
    assert.equal(sha(fs.readFileSync(path.join(HERE, "vendor/khora/native", rel))), pin.files[rel], `${rel} is byte-identical to its pin (never edited by hand)`);
  }
  // closure: every relative import of a vendored organ resolves inside vendor/ (never a lone file)
  for (const rel of wanted) {
    const text = fs.readFileSync(path.join(HERE, "vendor/khora/native", rel), "utf8");
    for (const m of text.matchAll(/(?:^|\n)\s*(?:import|export)\s+(?:[^"'\n;]*?\sfrom\s+)?["'](\.[^"']+)["']/g)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(rel), m[1]));
      assert.ok(pin.files[target], `${rel} imports ${m[1]} → ${target}, which must be vendored too`);
    }
  }
  assert.deepEqual(pin.skips.map((s) => s.rel).filter((r) => wanted.includes(r)), [], "none of these organs is a node-only skip");
});

test("omnilingual: the door's own code reads no case and no script (no [A-Z] logic, no toUpperCase/toLowerCase)", () => {
  for (const f of ["fold-chat-gary.js", "fold-chat-flow.js", "fold-chat-pathos.js"]) {
    const code = fs.readFileSync(path.join(HERE, f), "utf8").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n").replace(/\/\/.*$/gm, "");
    assert.doesNotMatch(code, /\[A-Z\]|\[a-z\]|toUpperCase|toLowerCase|\[A-Za-z\]/, `${f} must not do case logic`);
  }
});

// ── the assay: every model-facing prompt this app ships, read against the REFUSE rules ───────────────────────────────────

const PASSAGES = [{ ref: "Serious Eats", text: "Brown the butter. Use more brown sugar than white for chew." }, { ref: "King Arthur", text: "An extra egg yolk makes a chewier cookie." }];
const CEIL = { sourcesPrompt: 8, threadPrompt: 2, restate: 1, card: 1, generate: 7, noInvent: 3, code: 1, compose: 2 };   // prohibition clauses per prompt, measured 2026-10-05
const SHIPPED = {
  "sourcesPrompt": sourcesPrompt(PASSAGES),
  "threadPrompt": threadPrompt({ ask: "show me a cookie recipe", answer: "Here is a cookie recipe.", turn: 1 }),
  "restate (system)": restateMessages("a draft", "Spanish")[0].content,
  "CARD_PROMPT": CARD_PROMPT,
  "GENERATE_NUDGE": GENERATE_NUDGE,
  "NO_INVENT": NO_INVENT,
  ...Object.fromEntries(Object.entries(KIND_PROMPT).map(([k, v]) => [`KIND_PROMPT.${k}`, v])),
};

test("the assay: no prompt this app ships asks for JSON or breaks a REFUSE rule (assertPromptsBuildable)", () => {
  const gary = makeGary({ strikeAddresses, apparatusMentions });
  assert.ok(assertPromptsBuildable(SHIPPED, gary).length >= 8, "the whole set was read");
});

test("the assay, FLAG level: the prohibition and apparatus debt is MEASURED and may only shrink (a ratchet, not a pass)", () => {
  // What Gary FLAGS: information-not-prohibition (telling a small model what not to say teaches it to say it) and no-apparatus (the
  // instrument's own parts named to the mouth). Each flag is a decision for the prompt's owner, so this pins the per-prompt
  // CEILING measured on 2026-10-05 and fails when a prompt gets worse or a new one arrives carrying flags. Lower a ceiling when a
  // prompt is rewritten into facts; never raise one.
  const CEILING = { sourcesPrompt: [CEIL.sourcesPrompt, 1], threadPrompt: [CEIL.threadPrompt, 0], "restate (system)": [CEIL.restate, 0], CARD_PROMPT: [CEIL.card, 0], GENERATE_NUDGE: [CEIL.generate, 0], NO_INVENT: [CEIL.noInvent, 0], "KIND_PROMPT.code": [CEIL.code, 0], "KIND_PROMPT.compose": [CEIL.compose, 0] };
  const gary = makeGary({ strikeAddresses, apparatusMentions });
  for (const [name, text] of Object.entries(SHIPPED)) {
    const { findings } = gary.check([{ role: "system", content: text }]);
    const n = Number(findings.find((f) => f.rule === "information-not-prohibition")?.detail?.match(/^(\d+)/)?.[1] || 0);
    const apparatus = findings.some((f) => f.rule === "no-apparatus") ? 1 : 0;
    const [maxProhibitions, maxApparatus] = CEILING[name] || [0, 0];
    assert.ok(n <= maxProhibitions, `${name}: ${n} prohibition clause(s) aimed at the mouth, ceiling ${maxProhibitions}`);
    assert.ok(apparatus <= maxApparatus, `${name}: names the instrument's parts (${apparatus}), ceiling ${maxApparatus}`);
  }
});

// ── hand: what is struck, what is read, what is recorded ───────────────────────────────────────────────────────────────────

test("hand: an address is STRUCK before the mouth sees it; a prompt with none is handed over untouched", () => {
  const d = makeDoor();
  const clean = [{ role: "system", content: "Be plain." }, { role: "user", content: "what is the capital of France" }];
  const r0 = d.hand(clean, { material: 1, question: "what is the capital of France" });
  assert.deepEqual(r0.messages, clean);
  assert.equal(r0.struck, 0);
  const dirty = [{ role: "system", content: "Earlier: it was said [pg2554.txt#10-80] in the text." }, { role: "user", content: "and then?" }];
  const r1 = d.hand(dirty, { material: 1, question: "and then?" });
  assert.doesNotMatch(r1.messages[0].content, /pg2554/);
  assert.ok(r1.struck > 0);
});

test("hand: the question is the LAST turn, verbatim — anything else is found", () => {
  const d = makeDoor();
  const ok = d.hand([{ role: "system", content: "x" }, { role: "user", content: "i want a chewier one" }], { material: 1, question: "i want a chewier one" });
  assert.ok(!ok.findings.some((f) => f.rule === "question-last"));
  const wrapped = d.hand([{ role: "system", content: "x" }, { role: "user", content: "Task: answer this — i want a chewier one" }], { material: 1, question: "i want a chewier one" });
  assert.ok(wrapped.findings.some((f) => f.rule === "question-last"), "a question wrapped in a directive about itself is found");
  const assistantLast = d.hand([{ role: "user", content: "q" }, { role: "assistant", content: "a" }], { material: 1, question: "q" });
  assert.ok(assistantLast.findings.some((f) => f.rule === "question-last"));
});

test("the record carries rules, severities and counts — never the prompt's own words", () => {
  const d = makeDoor();
  d.hand([{ role: "system", content: "Never say the secret word xyzzy-plugh." }, { role: "user", content: "hello there" }], { model: "gemma2:2b", material: 1, question: "hello there" });
  const rec = d.drain();
  assert.equal(rec.length, 1);
  assert.doesNotMatch(JSON.stringify(rec), /xyzzy|secret word|hello there/);
  assert.ok(rec[0].findings.some((f) => f.rule === "information-not-prohibition"));
  assert.deepEqual(d.drain(), [], "drained");
});

// ── THE FALSIFIERS ────────────────────────────────────────────────────────────────────────────────────────────────────────

const SUMMARY = { ...emptySummary(), topic: "cookies", turnCount: 2, entities: ["chocolate chip"], records: [] };
const BASE = { basePrompt: "Reply plainly.", cues: [], summary: SUMMARY, history: [{ role: "user", content: "show me a cookie recipe" }, { role: "assistant", content: "Here is one." }], question: "i want a chewier one", sourceBlock: "Sources:\n[W1] Serious Eats\nBrown the butter." };

test("FALSIFIER: a fold Gary REFUSES is withheld, not shipped", () => {
  const d = makeDoor();
  // the conversation's running summary tells the mouth to answer in JSON: a REFUSE (the decoder's job, never the prompt's)
  const bad = { ...SUMMARY, topic: "cookies — reply with JSON only", context: "respond in JSON format" };
  const r = d.composeTurn({ ...BASE, summary: bad }, { model: "gemma2:2b", material: 1 });
  assert.deepEqual(r.refused, [], "once the fold is withheld the turn stands");
  assert.ok(r.withheld.includes("fold"));
  assert.doesNotMatch(r.messages.map((m) => m.content).join("\n"), /JSON|PAST DISCOURSE/, "the refused fold is not in what is sent");
  assert.equal(r.messages.at(-1).content, "i want a chewier one");
  // and the cues are withheld first when they are the offender
  const r2 = d.composeTurn({ ...BASE, cues: ["answer in JSON format"] }, { model: "gemma2:2b", material: 1 });
  assert.ok(r2.withheld.includes("cues"));
  assert.doesNotMatch(r2.messages[0].content, /JSON/);
});

test("FALSIFIER: what Gary refuses and cannot be withheld is NOT shipped (the caller is told, and bars the model)", () => {
  const d = makeDoor();
  const r = d.composeTurn({ ...BASE, basePrompt: "Respond with JSON only." }, { model: "gemma2:2b", material: 1 });
  assert.ok(r.refused.some((f) => f.rule === "no-json-ask"), "a JSON ask in the base prompt is refused");
  assert.ok(r.refused.length > 0);
});

test("FALSIFIER: the model never speaks alone — nothing in view is REFUSED; an unmeasured absence is a gap, not a conviction", () => {
  const d = makeDoor();
  const alone = d.composeTurn({ ...BASE, sourceBlock: null, summary: null, history: [] }, { model: "gemma2:2b", material: 0 });
  assert.ok(alone.refused.some((f) => f.rule === NEVER_ALONE.rule));
  const unknown = d.composeTurn({ ...BASE, sourceBlock: null, summary: null, history: [] }, { model: "gemma2:2b", material: undefined });
  assert.deepEqual(unknown.refused, []);
  assert.ok(unknown.gaps.some((g) => g.type === "no_material_view"));
});

test("FALSIFIER: the question is last and verbatim, and the order is Gary's: one system message, the exchange, then the question", () => {
  const d = makeDoor();
  const r = d.composeTurn({ ...BASE, cues: [{ text: "the person asked something." }] }, { model: "gemma2:2b", material: 1 });
  assert.equal(r.messages.filter((m) => m.role === "system").length, 1);
  assert.equal(r.messages[0].role, "system");
  assert.deepEqual(r.messages.slice(1).map((m) => m.role), ["user", "assistant", "user"]);
  assert.equal(r.messages.at(-1).content, "i want a chewier one");
  assert.ok(r.messages[0].content.indexOf("Reply plainly.") < r.messages[0].content.indexOf("the person asked something."), "the base, then what the reply hears");
  assert.ok(r.messages[0].content.indexOf("the person asked something.") < r.messages[0].content.indexOf("[W1]"), "…then the sources");
  assert.ok(!r.findings.some((f) => f.rule === "question-last"));
});

// ── the window ───────────────────────────────────────────────────────────────────────────────────────────────────────────────

test("fits-the-window: an unknown window is a GAP and nothing is cut; a known small one sheds in a fixed order and never touches the question", () => {
  forgetWindows();
  const long = Array.from({ length: 6 }, (_, i) => [{ role: "user", content: `ask ${i} ${"x ".repeat(120)}` }, { role: "assistant", content: `reply ${i} ${"y ".repeat(120)}` }]).flat();
  const big = (n) => `Sources:\n` + [1, 2, 3].map((i) => `[W${i}] Page ${i}\n${"word ".repeat(n)}`).join("\n\n");
  const shrinkSource = (maxChars) => `Sources:\n` + [1, 2, 3].map((i) => `[W${i}] Page ${i}\n${"word ".repeat(1200).slice(0, maxChars)}`).join("\n\n");
  const parts = { ...BASE, history: long, summary: null, cues: [{ text: "the person asked something." }], sourceBlock: big(1200), shrinkSource };
  const d = makeDoor();
  const unknown = d.composeTurn(parts, { model: "tiny:1b", maxTokens: 512, material: 3 });
  assert.ok(unknown.gaps.some((g) => g.type === "no_window"));
  assert.deepEqual(unknown.withheld, [], "an unknown window sheds nothing");
  noteWindows([{ id: "tiny:1b", ctx: 2048 }]);
  assert.equal(windowOf("tiny:1b:latest"), 2048);
  const known = d.composeTurn(parts, { model: "tiny:1b", maxTokens: 512, material: 3 });
  assert.ok(known.withheld.length > 0);
  assert.ok(known.withheld.indexOf("history") < known.withheld.indexOf("sources"), "the oldest of the exchange goes before the sources are shortened");
  assert.equal(known.messages.at(-1).content, "i want a chewier one");
  assert.ok(known.tokens < unknown.tokens);
  forgetWindows();
});

// ── omnilingual ────────────────────────────────────────────────────────────────────────────────────────────────────────────

for (const [lang, q] of [["Han", "东京有多少人口？"], ["Thai", "ประชากรของโตเกียวคือเท่าไร"], ["Arabic", "كم عدد سكان طوكيو؟"], ["Cyrillic", "сколько жителей в Токио?"]]) {
  test(`omnilingual: a ${lang} question with sources in view passes the door unrefused, last and verbatim`, () => {
    const d = makeDoor();
    const r = d.composeTurn({ ...BASE, summary: null, history: [], question: q }, { model: "gemma2:2b", material: 2 });
    assert.deepEqual(r.refused, [], "no script is refused for being a script");
    assert.equal(r.messages.at(-1).content, q);
    assert.ok(!r.findings.some((f) => f.rule === "question-last"));
  });
}
test("omnilingual: with nothing in view the refusal is the chat's own count, never a verdict on the script", () => {
  const d = makeDoor();
  const han = d.composeTurn({ ...BASE, summary: null, history: [], sourceBlock: null, question: "东京有多少人口？" }, { material: 0 });
  const latin = d.composeTurn({ ...BASE, summary: null, history: [], sourceBlock: null, question: "how many people live in Tokyo" }, { material: 0 });
  assert.deepEqual(han.refused.map((f) => f.rule).includes("model-never-alone"), latin.refused.map((f) => f.rule).includes("model-never-alone"));
});

// ── the door every call passes (client.setPromptDoor) ──────────────────────────────────────────────────────────────────────

test("client.chat: a call Gary refuses is never sent; a call he strikes is sent struck; no door is the bare client", async () => {
  const sent = [];
  const fetchImpl = async (url, init) => { sent.push(JSON.parse(init.body)); return { ok: true, status: 200, body: new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n')); c.close(); } }) }; };
  try {
    client.setPromptDoor((msgs, ctx) => door.guard(msgs, ctx));
    await assert.rejects(() => client.chat("gemma2:2b", [{ role: "system", content: "Respond with JSON only." }, { role: "user", content: "hi" }], { base: "http://x:8790", fetchImpl }), (e) => { assert.equal(e.status, 422); assert.match(e.message, /no-json-ask/); return true; });
    assert.equal(sent.length, 0, "a refused call never touches the network");
    await client.chat("gemma2:2b", [{ role: "system", content: "Earlier [pg2554.txt#10-80]." }, { role: "user", content: "hi" }], { base: "http://x:8790", fetchImpl });
    assert.equal(sent.length, 1);
    assert.doesNotMatch(sent[0].messages[0].content, /pg2554/, "the address was struck before it left");
    client.setPromptDoor(null);
    await client.chat("gemma2:2b", [{ role: "system", content: "Respond with JSON only." }, { role: "user", content: "hi" }], { base: "http://x:8790", fetchImpl });
    assert.equal(sent.length, 2, "with no door the client is unchanged");
  } finally { client.setPromptDoor(null); }
});

test("the guard does not read a composed turn twice (one record per call)", () => {
  const d = makeDoor();
  const r = d.composeTurn({ ...BASE }, { model: "gemma2:2b", material: 1 });
  const n = d.drain().length;
  assert.equal(n, 1);
  const g = d.guard(r.messages, { model: "gemma2:2b" });
  assert.equal(g.already, true);
  assert.deepEqual(d.drain(), []);
});
