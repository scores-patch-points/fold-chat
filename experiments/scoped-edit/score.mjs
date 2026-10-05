// score.mjs — turn a model's answer into a verdict. Pure in the answer: the same text always scores the same,
// so a better parser can re-score every run already made without a single new model call.
import { createWorkspace, parseEdits, applyEdits } from "../../fold-chat-workspace.js";
import { runTests } from "./harness.mjs";

/** Score `answer` for `task` against `files`. `shown` = the files the model was shown (a single one is the default target). */
export function scoreAnswer(task, files, answer, shown = []) {
  const rec = { edits: 0, applied: 0, failedEdits: [], notes: [], changed: [], err: null, ok: false, tests: null };
  const ws = createWorkspace(files);
  const { edits, notes } = parseEdits(answer, { existing: shown.filter((p) => /^src\//.test(p)) });
  rec.edits = edits.length; rec.notes = notes;
  const real = edits.filter((e) => !/^tests\//.test(e.path || ""));       // the model may not edit the tests
  const r = applyEdits(ws, real);
  rec.applied = r.applied.length; rec.changed = r.changed;
  rec.failedEdits = r.failed.map((f) => `${f.op} ${f.path}: ${f.error}`.slice(0, 160));
  if (!edits.length) rec.err = "no-edits";
  else if (r.failed.length && !r.applied.length) rec.err = "edits-did-not-apply";
  const res = runTests({ ...ws.files, ...task.overrides });
  rec.tests = { pass: res.pass, fail: res.fail, tests: res.tests, failing: res.failing };
  rec.ok = res.ok && !rec.err;
  if (!rec.ok && !rec.err) rec.err = r.failed.length ? "partial-apply-then-tests-failed" : "tests-failed";
  return rec;
}
