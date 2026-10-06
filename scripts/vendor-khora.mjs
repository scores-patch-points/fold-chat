#!/usr/bin/env node
// scripts/vendor-khora.mjs — vendor the khora's REAL organs into the chat, by closure.
//
// The chat is a surface. It must not carry a lean fork of the organs (that is
// what fold-chat-ground.js is) — it runs the khora's own ES modules, the way the
// holodeck does, so the page stays a static, no-build, GitHub-Pages-deployable
// page and the organs stay defined in exactly one place.
//
//   node scripts/vendor-khora.mjs            copy the closure of ENTRIES into vendor/khora/
//   node scripts/vendor-khora.mjs --check    verify vendor/khora is byte-identical to the pinned commit's files
//   node scripts/vendor-khora.mjs --dry      print the closure and skips, copy nothing
//   node scripts/vendor-khora.mjs --add      copy ONLY files not yet pinned (a new organ), leaving every
//                                            pinned file byte-identical and the pin's commit untouched.
//                                            Use it when the khora working tree is ahead of the pin and you
//                                            want one more organ, not a refresh of all of them.
//   --src /path/to/khora                     default: ../khora
//
// Rules (same as holodeck/tools/vendor-er7.mjs):
//   - vendor/khora is a FROZEN COPY. Never edit it by hand; a tweak goes in
//     the chat's own fold-chat-*.js files or in the khora itself.
//   - Only the static import closure of ENTRIES is copied (relative imports
//     under native/). A file that statically imports a `node:` builtin cannot
//     run in a browser: it is NOT copied, and is recorded in
//     vendor/khora/VENDOR-KHORA.json under `skips` with the importing chain,
//     so the surface KNOWS the organ is unported (never silently dropped).
//   - Dynamic `import()` is not followed (guarded node-only paths live there).
//   - VENDOR-KHORA.json pins the khora commit, and each file's sha256.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const SRC = path.resolve(arg("--src", path.join(ROOT, "..", "khora")));
const DEST = path.join(ROOT, "vendor", "khora");
const DRY = process.argv.includes("--dry");
const CHECK = process.argv.includes("--check");
const ADD = process.argv.includes("--add");
const PIN = path.join(DEST, "VENDOR-KHORA.json");

// What the chat runs. Add an organ here when the chat starts using it.
export const ENTRIES = [
  "organs/source.js",
  "organs/fact-block.js",
  "organs/cite.js",
  "organs/grounding.js",
  "organs/witness-sentences.js",
  // organs/verbatim-snip.js — NOT vendored: it statically imports kernel/kleene-up.js, which
  // imports a node: builtin (permanent addresses need node:crypto). Unported until guarded in the khora.
  "organs/run-dmca.js",
  "organs/corroboration.js",
  // THE PROMPT DOOR (Gary, with Kondo and the firewall under him) — what the mouth is handed, in what order, and what
  // never enters: fold-chat-gary.js. Pure, no imports of their own.
  "organs/gary.js",
  "organs/firewall.js",
  "organs/kondo.js",
  // THE CONVERSATION'S FLOW (Terry Gross, in earned-cast.js): the speech act of the turn and the facts a reply hears — fold-chat-flow.js.
  "the-fold/earned-cast.js",
  // THE PATHOS ARCHONS: the felt shape of a run of answers for a DECLARED experiencer (Abhinavagupta, with Murch's pacing,
  // Panini's experiencer and the dynamics kernel), and the live turn's composition of it — fold-chat-pathos.js.
  "organs/pathos.js",
  "the-fold/pathos-turn.js",
  // the keyless memory (THE-HOLOGRAPH §3): sdrOf, Field.recall, nullBand — the shadow and echo tiers
  "the-fold/relative.js",
  // DOES A CITED SPAN STILL NAME ITS BYTES (span-drift.js): exact / shifted / moved / gone over `ref#start-end`, ambiguity said, never rewritten.
  // Pure; closes over record-log.js's resolveAddress. A pure function of its inputs, for the chat's citation check.
  "the-fold/span-drift.js",
];

const NODE_IMPORT = /(?:^|\n)\s*(?:import\s+(?:[^"'\n;]*?\sfrom\s+)?|export\s+[^"'\n;]*?\sfrom\s+)["']node:[^"']+["']/;
const STATIC_IMPORT = /(?:^|\n)\s*(?:import|export)\s+(?:[^"'\n;]*?\sfrom\s+)?["'](\.[^"']+)["']/g;
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

function resolveImport(fromRel, spec) {
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  return base;
}

// `stopAt`: files already pinned (the --add mode): they are leaves, never re-read from a khora tree that may be ahead.
function closure(entries = ENTRIES, stopAt = null) {
  const native = path.join(SRC, "native");
  const seen = new Map(); // rel -> { via }
  const skips = [];
  const missing = [];
  const queue = entries.map((e) => ({ rel: e, via: "(entry)" }));
  while (queue.length) {
    const { rel, via } = queue.shift();
    if (seen.has(rel)) continue;
    if (stopAt && stopAt[rel]) { seen.set(rel, { via, pinned: true }); continue; }
    const abs = path.join(native, rel);
    if (!fs.existsSync(abs)) { missing.push({ rel, via }); continue; }
    const text = fs.readFileSync(abs, "utf8");
    if (NODE_IMPORT.test(text)) { skips.push({ rel, via, why: "statically imports a node: builtin" }); seen.set(rel, { skipped: true }); continue; }
    seen.set(rel, { via });
    for (const m of text.matchAll(STATIC_IMPORT)) {
      const next = resolveImport(rel, m[1]);
      if (!/\.(m?js|json)$/.test(next)) continue;
      if (!seen.has(next)) queue.push({ rel: next, via: rel });
    }
  }
  const files = [...seen.entries()].filter(([, v]) => !v.skipped).map(([rel]) => rel).sort();
  return { files, skips, missing };
}

function khoraCommit() {
  try {
    const sha1 = execFileSync("git", ["-C", SRC, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
    const dirty = execFileSync("git", ["-C", SRC, "status", "--porcelain", "--", "native"], { encoding: "utf8" }).trim();
    return { commit: sha1, dirtyNative: dirty ? dirty.split("\n").length : 0 };
  } catch { return { commit: null, dirtyNative: null }; }
}

const pinForAdd = ADD && fs.existsSync(PIN) ? JSON.parse(fs.readFileSync(PIN, "utf8")) : null;
const { files, skips, missing } = pinForAdd
  ? closure(ENTRIES.filter((e) => !(pinForAdd.entries || []).includes(e)), pinForAdd.files)
  : closure();

if (CHECK) {
  if (!fs.existsSync(PIN)) { console.error("no vendor/khora/VENDOR-KHORA.json — run without --check first"); process.exit(2); }
  const pin = JSON.parse(fs.readFileSync(PIN, "utf8"));
  let bad = 0;
  for (const [rel, h] of Object.entries(pin.files)) {
    const f = path.join(DEST, "native", rel);
    if (!fs.existsSync(f)) { console.error("MISSING vendored", rel); bad++; continue; }
    if (sha(fs.readFileSync(f)) !== h) { console.error("EDITED vendored (must be byte-identical)", rel); bad++; }
  }
  const cur = khoraCommit();
  const behind = [];
  for (const rel of Object.keys(pin.files)) {
    const s = path.join(SRC, "native", rel);
    if (fs.existsSync(s) && sha(fs.readFileSync(s)) !== pin.files[rel]) behind.push(rel);
  }
  console.log(`vendor/khora: ${Object.keys(pin.files).length} files, pinned khora ${String(pin.khora?.commit).slice(0, 8)}, now ${String(cur.commit).slice(0, 8)}`);
  if (behind.length) console.log(`BEHIND upstream (${behind.length}):\n  ` + behind.join("\n  "));
  if (pin.skips?.length) console.log(`typed skips (unported, node-only): ${pin.skips.map((s) => s.rel).join(", ")}`);
  process.exit(bad ? 1 : 0);
}

console.log(`closure of ${ENTRIES.length} entries under ${SRC}/native: ${files.length} files, ${skips.length} skipped (node-only), ${missing.length} missing`);
for (const s of skips) console.log(`  SKIP ${s.rel}  (${s.why}; reached via ${s.via})`);
for (const m of missing) console.log(`  MISSING ${m.rel}  (imported by ${m.via})`);
if (DRY) { console.log(files.map((f) => "  " + f).join("\n")); process.exit(0); }

// --add: keep every pinned file exactly as it is; copy only what the pin does not hold yet.
const pinned = pinForAdd;
if (ADD && !pinned) { console.error("--add needs an existing pin (vendor/khora/VENDOR-KHORA.json)"); process.exit(2); }
if (!ADD) fs.rmSync(path.join(DEST, "native"), { recursive: true, force: true });
const hashes = pinned ? { ...pinned.files } : {};
const added = [];
for (const rel of files) {
  const from = path.join(SRC, "native", rel);
  const to = path.join(DEST, "native", rel);
  if (pinned && pinned.files[rel] && fs.existsSync(to)) { hashes[rel] = pinned.files[rel]; continue; }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.copyFileSync(from, to);
  hashes[rel] = sha(fs.readFileSync(to));
  added.push(rel);
}
const khora = pinned ? pinned.khora : khoraCommit();
fs.mkdirSync(DEST, { recursive: true });
fs.writeFileSync(PIN, JSON.stringify({
  repo: "scores-patch-points/khora",
  khora,
  note: "FROZEN COPY of the static import closure of `entries`. Refresh with `node scripts/vendor-khora.mjs`; verify with --check. Never edit by hand.",
  entries: ENTRIES,
  files: Object.fromEntries(Object.entries(hashes).sort(([a], [b]) => (a < b ? -1 : 1))),
  skips: pinned ? [...(pinned.skips || []), ...skips] : skips,
  missing: pinned ? [...(pinned.missing || []), ...missing] : missing,
}, null, 2) + "\n");
if (ADD) console.log(`added ${added.length} new file(s), kept ${files.length - added.length} pinned file(s) untouched:\n  ` + added.join("\n  "));
else console.log(`vendored ${files.length} files -> vendor/khora/  (khora ${String(khora.commit).slice(0, 8)}${khora.dirtyNative ? `, ${khora.dirtyNative} dirty native/ files in the khora working tree` : ""})`);
if (skips.length || missing.length) console.log("NOTE: skips/missing are recorded in VENDOR-KHORA.json — the surface must treat those organs as unported.");
