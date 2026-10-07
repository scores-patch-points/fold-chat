// eval/ants/c3/lib.mjs — confusion matrices for the C3 battery. Pure.
export const LABELS = ["E", "T", "C", "U"];
/** rows[i][key] is "ACCEPT"|"REJECT". → { E:{ACCEPT,REJECT}, … } over the rows kept by `keep`. */
export function matrix(rows, key, keep = () => true) {
  const m = Object.fromEntries(LABELS.map((l) => [l, { ACCEPT: 0, REJECT: 0 }]));
  for (const r of rows) if (keep(r)) m[r.label][r[key]]++;
  return m;
}
export function stats(m) {
  const tp = m.E.ACCEPT, fn = m.E.REJECT;
  const fp = ["T", "C", "U"].reduce((a, l) => a + m[l].ACCEPT, 0), tn = ["T", "C", "U"].reduce((a, l) => a + m[l].REJECT, 0);
  const n = tp + fn + fp + tn;
  return { tp, fn, fp, tn, n, accuracy: n ? (tp + tn) / n : null, precision: tp + fp ? tp / (tp + fp) : null, recall: tp + fn ? tp / (tp + fn) : null, falseAccept: fp + tn ? fp / (fp + tn) : null, falseReject: tp + fn ? fn / (tp + fn) : null };
}
const f = (x) => (x == null ? "n/a" : (Math.round(x * 1000) / 10) + "%");
export function report(name, rows, key) {
  const lines = [`== ${name}`];
  for (const [tag, keep] of [[`all ${rows.length}`, () => true], ["without loose", (r) => !r.loose]]) {
    const m = matrix(rows, key, keep), s = stats(m);
    lines.push(`  ${tag}: label x ACCEPT/REJECT  ` + LABELS.map((l) => `${l} ${m[l].ACCEPT}/${m[l].REJECT}`).join("  ") + `  | acc ${f(s.accuracy)} prec ${f(s.precision)} rec ${f(s.recall)} falseAccept ${f(s.falseAccept)} falseReject ${f(s.falseReject)}`);
  }
  return lines.join("\n");
}
/** AUC of `score` for positives (label in pos) vs negatives (label in neg); ties count half. */
export function auc(rows, score, pos, neg) {
  const P = rows.filter((r) => pos.includes(r.label)), N = rows.filter((r) => neg.includes(r.label));
  let w = 0; for (const p of P) for (const n of N) w += p[score] > n[score] ? 1 : p[score] === n[score] ? 0.5 : 0;
  return P.length && N.length ? w / (P.length * N.length) : null;
}
