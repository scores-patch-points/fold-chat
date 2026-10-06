#!/usr/bin/env node
// scripts/vendor-fold.mjs — vendor the Fold server's gate ledger into the chat, byte-identical and pinned (the vendor-khora.mjs rules).
//   node scripts/vendor-fold.mjs          copy FILES from ../fold/server into vendor/fold/ and write vendor/fold/VENDOR-FOLD.json
//   node scripts/vendor-fold.mjs --check  verify vendor/fold is byte-identical to the pin
//   --src /path/to/fold                   default: ../fold
// Why these two files: gate-ledger.mjs (a900f6e, "the gate-history ledger") and the reasoning-stages.mjs it imports for `gateVerdict`.
// A FROZEN COPY: never edit by hand; a tweak goes in fold-chat-gates.js or in the fold itself.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const arg = (n, d) => (process.argv.includes(n) ? process.argv[process.argv.indexOf(n) + 1] : d);
const SRC = path.resolve(arg("--src", path.join(ROOT, "..", "fold")));
const DEST = path.join(ROOT, "vendor", "fold");
const FILES = ["server/gate-ledger.mjs", "server/reasoning-stages.mjs"];
const PIN = path.join(DEST, "VENDOR-FOLD.json");
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

if (process.argv.includes("--check")) {
  const pin = JSON.parse(fs.readFileSync(PIN, "utf8"));
  let bad = 0;
  for (const [f, h] of Object.entries(pin.files)) {
    const have = fs.existsSync(path.join(DEST, path.basename(f))) ? sha(fs.readFileSync(path.join(DEST, path.basename(f)))) : null;
    if (have !== h) { bad++; console.error("DRIFT", f); }
  }
  console.log(bad ? `${bad} file(s) drifted from ${pin.commit}` : `vendor/fold is byte-identical to ${pin.commit}`);
  process.exit(bad ? 1 : 0);
}
const head = execFileSync("git", ["-C", SRC, "rev-parse", "--short", "HEAD"]).toString().trim();
const dirty = execFileSync("git", ["-C", SRC, "status", "--porcelain", "--", ...FILES]).toString().trim();
if (dirty) { console.error("refusing: the source files have uncommitted changes in ../fold:\n" + dirty); process.exit(2); }
fs.mkdirSync(DEST, { recursive: true });
const files = {};
for (const f of FILES) { const b = fs.readFileSync(path.join(SRC, f)); fs.writeFileSync(path.join(DEST, path.basename(f)), b); files[f] = sha(b); }
fs.writeFileSync(PIN, JSON.stringify({ schema: "VendorFold@1", source: "../fold", commit: head, note: "gate-history ledger (a900f6e) + gateVerdict; frozen copy", files }, null, 1) + "\n");
console.log("vendored", FILES.join(", "), "at", head);
