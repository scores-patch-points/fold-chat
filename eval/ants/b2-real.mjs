#!/usr/bin/env node
// eval/ants/b2-real.mjs — the REAL run of fold-chat-counsel.js: "Is there a God?" over real canon, real local gemma2:2b (Ollama), draft temp 0.6, pointing temp 0.
//   node eval/ants/b2-real.mjs [handle ...]      default: ramakrishna vivekananda mozi      (add --lies to also run the forced-fabrication control on the same real canon)
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { counselFor, verifyCounsel } from "../../fold-chat-counsel.js";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const WORLD = path.resolve(ROOT, "..");
const args = process.argv.slice(2), lies = args.includes("--lies");
const handles = args.filter((a) => !a.startsWith("--"));
const HANDLES = handles.length ? handles : ["ramakrishna", "vivekananda", "mozi"];
const QUESTION = process.env.B2_QUESTION || "Is there a God?";
const index = JSON.parse(fs.readFileSync(path.join(ROOT, "voice/voice-index.json"), "utf8"));
const canonPath = (p) => [path.join(WORLD, p), path.join(WORLD, p.replace(/^live_priors\//, "ethos/"))].find((x) => fs.existsSync(x));
const OLLAMA = process.env.OLLAMA_URL || "http://127.0.0.1:11434/api/chat", MODEL = process.env.B2_MODEL || "gemma2:2b";
const chat = (temperature) => async (messages) => {
  const r = await fetch(OLLAMA, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model: MODEL, messages, stream: false, options: { temperature, num_ctx: 4096 } }) });
  if (!r.ok) throw new Error("ollama " + r.status);
  return (await r.json()).message?.content ?? "";
};
const shortGiver = (g) => g.replace(/\s*\(.*$/, "").trim();
const shortWork = (w) => w.split(/[,(—]/)[0].trim();
// each lie carries ANCHOR words; a lie whose anchors occur in the thinker's canon is not a lie for that thinker and is dropped (and said)
const LIES = (g) => [
  [`${g} holds that God is an impersonal cosmic force without will or intention.`, /impersonal|cosmic force/i],
  [`${g} holds that God commands the faithful to pray five times each day facing Mecca.`, /\bMecca\b|five times/i],
  [`${g} holds that God will judge every soul at the end of time and cast sinners into fire.`, /end of time|cast sinners/i],
  [`${g} holds that the world is an illusion and only the supreme Brahman is real.`, /illusion|Brahman/i],
  [`${g} holds that God created the heavens and the earth in six days and rested on the seventh.`, /six days|seventh day/i],
  [`${g} holds that God must exist because a being than which no greater can be conceived cannot lack existence.`, /ontological|Anselm|greater can be conceived/i],
  [`${g} holds that God is a computer program written by engineers.`, /computer|\bprogram\b|engineers?/i],
  [`${g} holds that God is dead and we have killed him.`, /we have killed|killed him/i],
  [`${g} holds that prayer to God is a waste of breath for fools.`, /waste of breath/i],
];
let totals = { assertions: 0, tied: 0, bad: 0, calls: 0 };
for (const h of HANDLES) {
  const rec = index.archons.find((a) => a.handle === h);
  if (!rec) { console.log("no such archon", h); continue; }
  const cp = canonPath(rec.source.path);
  const buf = fs.readFileSync(cp);
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  if (sha !== rec.source.sha256) { console.log("REFUSED (sha256 differs)", h); continue; }
  const text = buf.toString("utf8");
  const giver = shortGiver(rec.giver), work = shortWork(rec.work);
  const thinker = { handle: h, giver, work, source: { path: rec.source.path, sha256: rec.source.sha256 }, text };
  console.log("\n════════════════════════════════════════════════════════════════");
  console.log(`${giver} — ${work}   (${text.length} chars, sha256 ${sha.slice(0, 12)}… verified)   Q: ${QUESTION}`);
  const seen = { draft: null };
  const draft = async (m) => { seen.draft = { messages: m, out: "" }; const out = await chat(0.6)(m); seen.draft.out = out; return out; };
  const t0 = Date.now();
  const r = await counselFor({ question: QUESTION, thinker, draft, point: chat(0) });
  if (r.why) console.log("-- result note:", r.why);
  if (!seen.draft) { console.log("-- the draft was not obtained:", r.why || "(unknown)", JSON.stringify(r.assertions)); continue; }
  console.log("\n-- the raw material handed to the draft model (the thinker's own sentences, chosen mechanically):");
  for (const l of seen.draft.messages[1].content.split("QUESTION")[0].split("\n").filter((x) => x.startsWith("- "))) console.log("  " + l);
  console.log("\n-- the model's draft (verbatim):\n" + seen.draft.out.split("\n").map((l) => "  | " + l).join("\n"));
  console.log("\n-- assertions:");
  for (const a of r.assertions) {
    console.log(`  ${a.tied ? "TIED     " : "WITHHELD "} ${a.text}`);
    console.log(`            ${a.tied ? "why: " + a.why : "why not: " + a.why}`);
    if (a.tied) console.log(`            quote [${a.pointer.start}..${a.pointer.end}]: “${a.pointer.quote.replace(/\s+/g, " ")}”`);
  }
  console.log("\n-- the narration the person would read:\n  " + r.narration.text.replace(/\s+/g, " "));
  const v = verifyCounsel({ result: r, canon: text });
  console.log(`\n-- verifyCounsel: ${v.ok ? "OK" : "FAILED " + JSON.stringify(v.bad)}   calls: draft ${r.calls.draft}, point ${r.calls.point}   ${Date.now() - t0} ms`);
  totals.assertions += r.assertions.length; totals.tied += r.assertions.filter((a) => a.tied).length; totals.bad += v.ok ? 0 : 1; totals.calls += r.calls.draft + r.calls.point;
  if (lies) {
    const all = LIES(giver), L = all.filter(([, re]) => !re.test(text)).map(([l]) => l).slice(0, 4);
    for (const [l, re] of all) if (re.test(text)) console.log(`   (control lie dropped: its anchor ${re} occurs in this canon)`);
    const lr = await counselFor({ question: QUESTION, thinker, draft: async () => L.join("\n"), point: chat(0) });
    const lr2 = await counselFor({ question: QUESTION, thinker, draft: async () => L.join("\n"), point: async () => "1" });
    console.log(`\n-- CONTROL forced-fabrication draft on the same real canon: real pointer tied ${lr.assertions.filter((a) => a.tied).length}/${L.length}; sycophantic pointer (#1) tied ${lr2.assertions.filter((a) => a.tied).length}/${L.length}`);
    for (const a of [...lr.assertions, ...lr2.assertions].filter((a) => a.tied)) console.log("   FALSE ACCEPT:", a.text, "<-", a.pointer.quote.replace(/\s+/g, " "));
  }
}
console.log("\nTOTAL", JSON.stringify(totals));
