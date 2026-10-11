// esc-table.mjs — the escalation table: per rung, G vs F on correctness and time, and how often G escalated (precise gate G; the walls variants Gw/Gl listed beside)
import { BATTERY, median, bootCI, mean } from "./lib.mjs";
import { load } from "./g.mjs";
const G = load(process.env.GARM || "G"), Gw = load("Gw"), F = load("F"), Fo = load("Fo");
const rungs = [...new Set(BATTERY.map((q) => q.rung))];
console.log("| rung | n | F correct | G correct | Gw correct | G escalated | G routed to a typed gap (opinion) | median ms F | median ms G | G faster than F | G - F correct (95% CI of the paired difference) |");
console.log("|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of rungs) {
  const qs = BATTERY.filter((q) => q.rung === r);
  const ok = (m) => qs.map((q) => (m.get(q.id)?.grade?.ok ? 1 : 0));
  const f = ok(F), g = ok(G), gw = ok(Gw);
  const esc = qs.filter((q) => G.get(q.id)?.escalated).length, gap = qs.filter((q) => G.get(q.id)?.stage === "gap").length;
  const mf = Math.round(median(qs.map((q) => F.get(q.id)?.ms || 0))), mg = Math.round(median(qs.map((q) => G.get(q.id)?.ms || 0)));
  const faster = qs.filter((q) => (G.get(q.id)?.ms || 0) < (F.get(q.id)?.ms || 0)).length;
  const d = g.map((x, i) => x - f[i]); const [lo, hi] = bootCI(d);
  const sum = (a) => a.reduce((x, y) => x + y, 0);
  console.log(`| R${r} | ${qs.length} | ${sum(f)}/${qs.length} | ${sum(g)}/${qs.length} | ${sum(gw)}/${qs.length} | ${esc}/${qs.length} | ${gap} | ${mf} | ${mg} | ${faster}/${qs.length} | ${(mean(d) >= 0 ? "+" : "") + (100 * mean(d)).toFixed(0)} pts (${(100 * lo).toFixed(0)}..${(100 * hi).toFixed(0)}) |`);
}
const all = BATTERY; const s = (m) => all.filter((q) => m.get(q.id)?.grade?.ok).length;
console.log(`\nall 138: F ${s(F)}  G ${s(G)}  Gw ${s(Gw)}  Fo(oracle evidence) ${s(Fo)} | G escalated ${all.filter((q) => G.get(q.id)?.escalated).length} of 138 | median ms F ${Math.round(median(all.map((q) => F.get(q.id)?.ms || 0)))} G ${Math.round(median(all.map((q) => G.get(q.id)?.ms || 0)))}`);
// the pivot (mechanical final pass) on the escalated model drafts: how many wrong drafts did it stop?
let esc = 0, wrongBefore = 0, wrongAfter = 0, withheld = 0, correctLost = 0;
for (const q of all) { const g = G.get(q.id); if (!g?.escalated) continue; esc++; const before = g.grade?.beforePivot; if (!before) wrongBefore++; if (!g.grade.ok) wrongAfter++; if ((g.grade.pivotDropped || 0) > 0) withheld++; if (before && !g.grade.ok) correctLost++; }
console.log(`pivot final pass on ${esc} escalated drafts: wrong before ${wrongBefore}, wrong after ${wrongAfter}; drafts with a withheld sentence ${withheld}; correct drafts lost to the pivot ${correctLost}`);
// G's time when the slot pipeline (B) is not waited for (B answered 11 of 120 and 3 correctly; its tail is up to 120 s of rate-limited Wikipedia probing)
const Bm = load("B");
const gnb = (q) => { const g = G.get(q.id); return Math.max(1, (g?.ms || 0) - (g?.stage === "B" ? 0 : (Bm.get(q.id)?.ms || 0))); };
console.log(`G without waiting for B: median ms ${Math.round(median(all.map(gnb)))}; by rung range R1-5 ${Math.round(median(all.filter((q) => q.rung <= 5).map(gnb)))} R6-13 ${Math.round(median(all.filter((q) => q.rung >= 6 && q.rung <= 13).map(gnb)))}; F: R1-5 ${Math.round(median(all.filter((q) => q.rung <= 5).map((q) => F.get(q.id).ms)))} R6-13 ${Math.round(median(all.filter((q) => q.rung >= 6 && q.rung <= 13).map((q) => F.get(q.id).ms)))}`);
console.log(`B's correct answers: ${all.filter((q) => G.get(q.id)?.stage === "B" && G.get(q.id).grade.ok).length} routed through G; B stages in G: ${all.filter((q) => G.get(q.id)?.stage === "B").length}`);
console.log("G stage mix:", JSON.stringify(all.reduce((m, q) => { const s = G.get(q.id).stage; m[s] = (m[s] || 0) + 1; return m; }, {})));
console.log("G correct by stage:", JSON.stringify(all.reduce((m, q) => { const g = G.get(q.id); (m[g.stage] ??= { n: 0, ok: 0 }); m[g.stage].n++; if (g.grade.ok) m[g.stage].ok++; return m; }, {})));

// raw (pre-registered, un-normalised) pivot vs normalised: correct drafts lost
import { pivoted } from "./g.mjs";
let lostRaw = 0, lostNorm = 0, wrongRaw = 0, wrongNorm = 0, nEsc = 0;
for (const q of all) { const g = G.get(q.id); if (!g?.escalated) continue; nEsc++; const fr = F.get(q.id); const raw = pivoted(q, fr, { normalize: false }), nor = pivoted(q, fr, { normalize: true }); if (fr.grade.ok && !raw.grade.ok) lostRaw++; if (fr.grade.ok && !nor.grade.ok) lostNorm++; if (!raw.grade.ok) wrongRaw++; if (!nor.grade.ok) wrongNorm++; }
console.log(`pivot on ${nEsc} escalated drafts: correct drafts lost RAW ${lostRaw} / NORMALISED ${lostNorm}; incorrect after pivot RAW ${wrongRaw} / NORMALISED ${wrongNorm}`);
