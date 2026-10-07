#!/usr/bin/env node
// eval/ants/mark.mjs — the shared MEDIUM the ants coordinate through (stigmergy: workers never talk, they read and write marks). Append-only JSONL; marks decay (half-life 45 min); `veto` repels.
//   node eval/ants/mark.mjs add <ant> <kind> <path-or-"-"> "<note>"     kinds: claim | found | blocked | veto | done | question
//   node eval/ants/mark.mjs read [--all]                                 live marks with their DECAYED strength, newest first (--all includes evaporated ones)
//   node eval/ants/mark.mjs claimed <path>                               who holds <path> (claim/veto marks still live) — check BEFORE touching a file
// A `claim` on a path is a request not to edit it; a `veto` is a prohibition (e.g. other sessions' files); `found`/`blocked` carry what an ant learned; `done` ends an ant's atom.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), "marks.jsonl");
const HALF_LIFE_MS = 45 * 60 * 1000, LIVE = 0.1;
const read = () => (fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8").split("\n").filter(Boolean).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean) : []);
const strengthOf = (m, now = Date.now()) => (m.kind === "veto" ? 1 : Math.pow(0.5, (now - m.at) / HALF_LIFE_MS));
const [cmd, ...a] = process.argv.slice(2);
if (cmd === "add") {
  const [ant, kind, p, ...note] = a;
  if (!ant || !kind) { console.error("usage: add <ant> <kind> <path|-> <note>"); process.exit(2); }
  fs.appendFileSync(FILE, JSON.stringify({ at: Date.now(), iso: new Date().toISOString(), ant, kind, path: p === "-" ? null : p, note: note.join(" ") }) + "\n");
  console.log("marked", ant, kind, p);
} else if (cmd === "read") {
  const all = a.includes("--all"), now = Date.now();
  for (const m of read().reverse()) { const s = strengthOf(m, now); if (!all && s < LIVE) continue; console.log(`${m.iso.slice(11, 19)} s=${s.toFixed(2)} [${m.ant}] ${m.kind}${m.path ? " " + m.path : ""} — ${m.note}`); }
} else if (cmd === "claimed") {
  const now = Date.now(); const hit = read().filter((m) => (m.kind === "claim" || m.kind === "veto") && m.path && (m.path === a[0] || a[0].startsWith(m.path.replace(/\*$/, ""))) && strengthOf(m, now) >= LIVE);
  if (!hit.length) console.log("free"); else for (const m of hit) console.log(`${m.kind.toUpperCase()} by ${m.ant}: ${m.note}`);
} else { console.error("commands: add | read [--all] | claimed <path>"); process.exit(2); }
