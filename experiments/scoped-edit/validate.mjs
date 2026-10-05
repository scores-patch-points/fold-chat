// validate.mjs — the experiment must be valid before it measures anything:
//   · the pristine fixture passes its own tests
//   · each task's hidden tests FAIL on the unedited code (so they detect the task)
//   · each task's hidden tests PASS on the golden solution (so they are satisfiable)
import { loadFixture, runTests, withHiddenTests } from "./harness.mjs";
import { TASKS } from "./tasks.mjs";
const base = loadFixture();
const b = runTests(base);
console.log(`pristine fixture: ${b.pass}/${b.tests} pass`, b.ok ? "OK" : "BROKEN");
let bad = !b.ok;
for (const t of TASKS) {
  const hidden = withHiddenTests(base, t);
  const before = runTests(hidden);
  const after = runTests({ ...hidden, ...t.golden });
  const detects = !before.ok, satisfiable = after.ok;
  if (!detects || !satisfiable) bad = true;
  console.log(`${t.id.padEnd(24)} unedited: ${before.pass}/${before.tests} (${detects ? "fails ✓" : "PASSES ✗ — test detects nothing"})   golden: ${after.pass}/${after.tests} (${satisfiable ? "passes ✓" : "FAILS ✗"})${satisfiable ? "" : "\n" + after.output}`);
}
console.log(bad ? "\nEXPERIMENT INVALID" : "\nexperiment valid: every task is detectable and satisfiable");
process.exit(bad ? 1 : 0);
