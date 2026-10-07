// The archon dossiers are a gate, not a document: every archon needs a dossier that passes the disclosure rule,
// and khora's generated archon-dossiers.js must match them. Fails the build if either drifts.
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

const run = (script, args = []) => spawnSync("node", [script, ...args], { encoding: "utf8" });

test("every archon dossier passes the disclosure rule", () => {
  const r = run("scripts/archon-dossier-check.mjs");
  assert.equal(r.status, 0, r.stdout.split("\n").filter((l) => l.startsWith("FAIL")).join("\n"));
  assert.equal(r.stdout.split("\n").filter((l) => l.startsWith("ok")).length, 83);
});

test("khora's generated archon-dossiers.js is current against the dossiers", () => {
  const r = run("scripts/archon-dossiers-export.mjs", ["--check"]);
  assert.equal(r.status, 0, r.stderr);
});
