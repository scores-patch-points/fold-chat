#!/usr/bin/env node
// eval/ants/B1-mutate.mjs — mutation check (README rule 6): delete each gate of fold-chat-thinkers.js in a temporary copy; fold-chat-thinkers.test.mjs must FAIL on every mutant (and pass on the original).
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SRC = fs.readFileSync(path.join(ROOT, "fold-chat-thinkers.js"), "utf8");
const MUT = path.join(ROOT, ".mut-thinkers.js");
const MUTANTS = [
  ["closed-class filter removed", "closed.has(t) || ", ""],
  ["number filter removed", "/\\d/.test(t) || ", ""],
  ["query-stem cap removed", "Math.min(cap, ", "Math.min(1e9, "],
  ["minimum-evidence gate removed", "if (known.length < P.m && !(P.gateMinEvidence === false))", "if (false)"],
  ["top-3 mass gate removed", "if (mass3 < P.tau && !(P.gateMass === false))", "if (false)"],
  ["no-known-stems rule removed", "if (!known.length) return none(\"no-known-content-stems\", { carried });", ""],
  ["distractor (technical) classes offered", "orderOf(post, model.speaks)", "orderOf(post)"],
  ["prior put into the gate", "const gPost = P.gatePrior || !bonusVec ? post : posteriorOf(s, P.T), gOrd = P.gatePrior || !bonusVec ? ord : orderOf(gPost, model.speaks);", "const gPost = post, gOrd = ord;"],
  ["prior bonus not applied", "bonusVec[t] = b;", "bonusVec[t] = 0;"],
  ["background not the per-thinker mean (pooled)", "bg[id] = a / T;", "bg[id] = 1 / V;"],
];
const run = (modulePath) => spawnSync(process.execPath, ["--test", "fold-chat-thinkers.test.mjs"], { cwd: ROOT, env: { ...process.env, THINKERS_MODULE: modulePath }, encoding: "utf8" });
const base = run("./fold-chat-thinkers.js");
console.log("original:", base.status === 0 ? "tests pass" : "TESTS FAIL ON THE ORIGINAL\n" + base.stdout.slice(-1500));
let survived = 0;
try {
  for (const [name, from, to] of MUTANTS) {
    if (!SRC.includes(from)) { console.log("MISSING PATTERN", name); survived++; continue; }
    fs.writeFileSync(MUT, SRC.split(from).join(to));
    const r = run("./.mut-thinkers.js"); const killed = r.status !== 0;
    console.log((killed ? "killed   " : "SURVIVED ") + name); if (!killed) survived++;
  }
} finally { try { fs.unlinkSync(MUT); } catch {} }
console.log(survived ? `${survived} mutant(s) survived` : "all mutants killed");
process.exit(survived || base.status !== 0 ? 1 : 0);
