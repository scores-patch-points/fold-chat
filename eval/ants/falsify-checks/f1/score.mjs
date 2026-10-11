// Score one record: for NUL / SIG / INS the FIGURE grain (row.status) and the HEADLINE rule the UI uses
// (presentview.js ~l.352: failed if any grain failed; flagged if any grain is gap|refused). flagged = failed || gap || refused.
import { falsifiersOf } from "../../../../fold-chat-present.js";
const IDX = { NUL: 0, SIG: 1, INS: 2 };
export function scoreRec(rec) {
  const rows = falsifiersOf(rec);
  const out = {};
  for (const [op, i] of Object.entries(IDX)) {
    const r = rows[i];
    const grains = { ground: r.ground.status, figure: r.figure.status, pattern: r.pattern.status };
    const st = Object.values(grains);
    const headline = st.includes("failed") ? "failed" : st.includes("gap") || st.includes("refused") ? "flagged" : "clear";
    out[op] = { figure: r.status, figureFlag: r.status !== "held" && r.status !== "n/a", headline, headlineFlag: headline !== "clear", grains, found: r.found, foundFigure: r.figure.found };
  }
  const nine = rows.map((r) => { const st = [r.ground, r.figure, r.pattern].map((c) => c?.status); return st.includes("failed") ? "failed" : st.includes("gap") || st.includes("refused") ? "flagged" : "clear"; });
  out.nineFlagged = nine.filter((x) => x !== "clear").length;
  out.nineStatuses = rows.map((r) => r.op + ":" + r.status);
  return out;
}
