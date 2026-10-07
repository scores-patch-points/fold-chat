// fold-chat-voiceshost.mjs — the SERVER side of "voices on this question": reads voice/thinkers-profile.json and the canon files from disk, checks each file's sha256 against the profile, and answers
// ask(question) -> { voices, line, why, ms } with the classifier's candidates (fold-chat-thinkers.js) and fold-chat-voices.js. No model, no network. NOT wired: eval/ants/c2/wire.diff mounts it at /fold/api/voices.
// The canon files live in the sibling eo-teachings checkout (path as the profile records it, relative to the directory ABOVE this checkout). A missing or differing file is refused (its thinker is silent), never read anyway.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { decodeProfile, classify } from "./fold-chat-thinkers.js";
import { voicesFor, thinkerTable } from "./fold-chat-voices.js";
import { functionWordsOf } from "./fold-chat-snippets.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
export function createVoicesHost({ root = HERE, world = path.resolve(HERE, ".."), readFile = (p) => fs.readFileSync(p), exists = (p) => fs.existsSync(p) } = {}) {
  let model = null, thinkers = null;
  const canons = new Map();
  const load = () => {
    if (model) return;
    const profile = JSON.parse(readFile(path.join(root, "voice/thinkers-profile.json")).toString("utf8"));
    model = decodeProfile(profile); thinkers = thinkerTable(profile);
  };
  const canonOf = (handle, th) => {
    if (canons.has(handle)) return canons.get(handle);
    const p = th.source.path, file = [path.join(world, p), path.join(world, p.replace(/^live_priors\//, "ethos/"))].find((x) => exists(x));
    let rec = null;
    if (file) { const buf = readFile(file); rec = { text: buf.toString("utf8"), sha256: crypto.createHash("sha256").update(buf).digest("hex") }; }
    canons.set(handle, rec);
    return rec;
  };
  const fw = functionWordsOf("en");
  return {
    /** Never throws: a failure is `{ voices: [], line: "", why }`. */
    ask(question) {
      const t0 = performance.now();
      try {
        load();
        const cls = classify(String(question ?? ""), { model });
        const r = voicesFor({ question: String(question ?? ""), candidates: cls.candidates || [], thinkers, canonOf, fw });
        return { voices: r.voices, line: r.line, why: r.why, ms: +(performance.now() - t0).toFixed(1) };
      } catch (e) { return { voices: [], line: "", why: "error: " + String(e?.message || e).slice(0, 80), ms: +(performance.now() - t0).toFixed(1) }; }
    },
  };
}
