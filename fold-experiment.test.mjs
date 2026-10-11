// fold-experiment.test.mjs — the "best of all worlds" guarantee, locked.
// Every complicated generation task run in AGENTIC mode must come out SEALED:
// each proposition is grounded in the source (bound edge, or a verbatim
// wandered sentence witnessed at its byte) OR an explicit terrain-altitude
// voice cited to a source span — with zero ungrounded fails. Deterministic
// (no model): the voice lane uses the machine's own cited thoughts.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { setup, runAgentic, TASKS } from "./fold-experiment.mjs";

const SOURCE = "/Users/mlacy/Documents/3.0/pg2600.txt";

test("agentic composition: every task seals — grounded + cited terrain-voice, zero fails", { skip: fs.existsSync(SOURCE) ? false : `corpus absent (${SOURCE})` }, async () => {
  const s = await setup();
  for (const task of TASKS.slice(0, 4)) {
    const run = await runAgentic(s, task, { voiceModel: false });
    const L = run.lanes.counts;
    assert.equal(run.sealed.verdict, "SEALED", `${task.topic}: ${JSON.stringify(L)} — ${run.sealed.reason}`);
    assert.equal(L.fail, 0, `${task.topic} has ungrounded propositions`);
    assert.ok(L.grounded > 0);
    assert.ok(L.voice > 0);
    for (const x of run.lanes.sentences.filter((z) => z.lane === "voice")) assert.ok(x.cites > 0, "every voice thought cites a source span");
  }
});