/* REC (Generate x Interpretation): where each claim stands after the ground was rebuilt, and what going back changed.
   Ground / Atmosphere / Cultivating: the rebuilt ground, as a timeline of laps (what it went back for, what it re-read, what came of it).
   Figure / Lens / Making           : this claim's standing, the attempts it survived or did not (receipts), and its path across the laps.
   Pattern / Paradigm / Composing   : across the recorded turns, did going back help? Claims as cells, before and after. */
const CAT_ORDER = ["stands", "close", "differs", "nothing"];
const CAT_WORD = { stands: "stands", close: "close, not exact", differs: "pages read it differently", nothing: "nothing it read says it" };
const CAT_SHORT = { stands: "stands", close: "close", differs: "differs", nothing: "nothing says it" };
function stepsOf(t) {
  const L = t.loop, fin = t.claims.map((c) => CATOF[c.verdict] || "nothing");
  if (!L || !L.passes.length) return { steps: [{ label: "Now", cats: fin, why: [] }], disagree: false, laps: 0 };
  const catsFrom = (failing) => t.claims.map((c) => { const f = failing.find((x) => x.i === c.i); return f ? CATOF[f.verdict] : "stands"; });
  const steps = [{ label: "First reading", cats: catsFrom(L.passes[0].failing), why: L.passes[0].failing }];
  L.passes.forEach((p, j) => {
    const last = j === L.passes.length - 1;
    const cats = last ? (L.cleared ? t.claims.map(() => "stands") : fin) : catsFrom(L.passes[j + 1].failing);
    steps.push({ label: last ? `Now, after lap ${p.lap}` : `After lap ${p.lap}`, cats, why: last ? [] : L.passes[j + 1].failing, lap: p });
  });
  const disagree = L.cleared ? fin.some((c) => c !== "stands") : false;
  return { steps, disagree, laps: L.passes.length };
}
function ribbon(cats, claims) {
  return h("ul", { class: "rib" }, cats.map((c, i) => h("li", null, mark(STAND[c][0], 15), h("b", null, "s" + (claims[i].i + 1)), " ", CAT_WORD[c])));
}
const disagreeNote = (t) => h("div", { class: "gap", style: "margin-top:10px" }, h("b", null, "The record disagrees with itself. "), `The loop recorded that every sentence holds after going back. Run again over the pages the record saved, the cross-reference reads ${plural(t.claims.filter((c) => CATOF[c.verdict] !== "stands").length, "sentence")} differently (${t.claims.filter((c) => c.contradictions).map((c) => c.witnesses.filter((w) => w.verdict === "contradicts").map((w) => w.src).join(", ")).join("; ")}). The tape does not hold the per-sentence result of the lap, so the two cannot be reconciled from it.`);

function groundFace(t) {
  const { steps, disagree, laps } = stepsOf(t), L = t.loop;
  const cards = [];
  cards.push(h("li", { class: "tl" }, h("h3", null, laps ? "First reading" : "Nothing to go back for"), ribbon(steps[0].cats, t.claims),
    h("p", { class: "k" }, laps ? `Read ${plural(t.opened, "site")} and wrote the answer.` : `Read ${plural(t.opened, "site")}. Every sentence stood the first time, so the ground was rebuilt once, this turn.`),
    !laps && L ? h("p", { class: "k" }, "Record: “" + L.processLine + "”") : null));
  if (laps) L.passes.forEach((p, j) => {
    const after = steps[j + 1], seen = [], pages = p.reImpressed.filter((r) => !seen.includes(r.url) && seen.push(r.url));
    cards.push(h("li", { class: "tl" }, h("h3", null, `Lap ${p.lap}: went back for ${p.failing.map((f) => "s" + (f.i + 1)).join(", ")}`),
      p.failing.map((f) => h("div", { class: "why" }, h("p", { class: "sent", style: "font-size:14.5px;margin:0 0 2px" }, clip(f.s, 150)), h("p", { class: "k" }, `Record: “${f.why}”`),
        f.afterIns === "holds" ? h("p", { style: "margin:2px 0 6px" }, "Re-reading the pages already read was enough.") : h("p", { style: "margin:2px 0 6px" }, "Searched ", h("b", null, `“${f.query}”`), ", and it was still failing."))),
      h("p", { class: "k", style: "margin-top:8px" }, `Re-read ${plural(pages.length, "page")}${p.added ? `, read ${plural(p.added, "more source")}` : ", no new source"}`),
      h("ul", { class: "pgs" }, pages.slice(0, 5).map((r) => h("li", null, fav(r.domain), h("span", { class: "d" }, r.domain), h("span", { class: "bar2", "aria-hidden": "true" }, h("i", { style: "width:" + Math.min(100, r.kept / r.chars * 100).toFixed(1) + "%" })), h("span", { class: "k" }, `${fmtN(r.kept)} of ${fmtN(r.chars)} characters kept`))), pages.length > 5 ? h("li", { class: "k" }, `and ${pages.length - 5} more`) : null),
      p.restated && p.restated.length ? h("p", { class: "k", style: "margin-top:8px" }, `Tried rewriting: “${p.restated[0].why}”. ${p.restated.some((r) => r.kept) ? "Kept as written, and marked." : ""}`) : null,
      h("p", { class: "k", style: "margin:8px 0 2px" }, "After the lap"), ribbon(after.cats, t.claims)));
  });
  if (laps) cards.push(h("li", { class: "tl now" }, h("h3", null, "Now"), ribbon(steps[steps.length - 1].cats, t.claims), h("p", { class: "k" }, "Record: “" + L.processLine + "”"), disagree ? disagreeNote(t) : null));
  return h("ol", { class: "tls" }, cards);
}

/* the receipts: each attempt to break the claim, and what it did */
function testsOf(c) {
  const states = c.witnesses.filter((w) => w.verdict === "states"), best = states.slice().sort((a, b) => b.runN - a.runN)[0];
  const diff = c.witnesses.filter((w) => w.verdict === "contradicts");
  const out = [];
  out.push(["exact words", states.some((w) => w.runN >= 4) ? "held" : "differs", states.some((w) => w.runN >= 4) ? `${best.src} shares “${best.run}” (${plural(best.runN, "word")} in a row).` : "No page shares four words in a row with it."]);
  out.push(["figures", !c.figures.length ? "na" : c.figures.every((f) => states.some((w) => w.sentence.replace(/,/g, "").includes(String(f).replace(/,/g, "")))) ? "held" : "differs", !c.figures.length ? "The claim has no figure." : `${c.figures.join(", ")} ${c.figures.every((f) => states.some((w) => w.sentence.replace(/,/g, "").includes(String(f).replace(/,/g, "")))) ? "appear" : "do not all appear"} in a page's sentence.`]);
  out.push(["pages differ", c.contradictions ? "differs" : "held", c.contradictions ? `${diff.map((w) => w.src).join(", ")} ${diff.length === 1 ? "reads" : "read"} it differently. That is for a person to read; it is not a finding that the sentence is false.` : "No page reads against it."]);
  out.push(["second page", c.chains >= 2 ? "held" : c.chains === 1 ? "na" : "differs", c.chains >= 2 ? `${c.chains} independent pages state it.` : c.chains === 1 ? "Only one page states it, so there was nothing to set it against." : "No page states it."]);
  out.push(["wrong version", !c.swap.armed ? "na" : c.swap.discriminates ? "held" : "differs", !c.swap.armed ? "Nothing could be swapped." : `“${c.swap.from}” to “${c.swap.to}”: ${c.swap.discriminates ? "the page it was judged on told the two apart." : "the page it was judged on did not tell the two apart."}`]);
  return out;
}
const R_OUT = { held: ["states", "held"], differs: ["differs", "came out differently"], na: ["none", "did not apply"] };
function slope(t, steps, ci) {
  const W = 300, H = 150, px = (k) => (steps.length === 1 ? W / 2 : 48 + k * ((W - 70) / (steps.length - 1))), py = (cat) => 14 + CAT_ORDER.indexOf(cat) * 40;
  const box = h("div", { class: "slope", style: `height:${H}px;max-width:${W}px` });
  const svg = sv("svg", { viewBox: `0 0 ${W} ${H}`, width: "100%", height: H, "aria-hidden": "true" });
  CAT_ORDER.forEach((c) => svg.append(sv("line", { x1: 0, x2: W, y1: py(c), y2: py(c), stroke: "var(--hair)", "stroke-width": 1 })));
  t.claims.forEach((c, i) => { const pts = steps.map((s, k) => `${px(k)},${py(s.cats[i])}`).join(" "); svg.append(sv("polyline", { points: pts, fill: "none", stroke: "var(--ink)", "stroke-width": i === ci ? 2.4 : 1.2, "stroke-opacity": i === ci ? 1 : 0.45, "stroke-dasharray": i === ci ? "" : "4 3" })); });
  box.append(svg);
  CAT_ORDER.forEach((c) => box.append(h("span", { class: "yl", style: `top:${py(c) - 9}px` }, CAT_SHORT[c])));
  t.claims.forEach((c, i) => steps.forEach((s, k) => { const m = h("span", { class: "dot" + (i === ci ? " sel" : ""), style: `left:${(px(k) / W * 100).toFixed(2)}%;top:${py(s.cats[i])}px` }, mark(STAND[s.cats[i]][0], i === ci ? 17 : 13)); box.append(m); }));
  steps.forEach((s, k) => box.append(h("span", { class: "xl", style: `left:${(px(k) / W * 100).toFixed(2)}%` }, k === 0 && steps.length > 1 ? "first" : k === steps.length - 1 ? "now" : "lap " + k)));
  return box;
}
function figureFace(t) {
  const c = claimOf(t), ci = t.claims.indexOf(c), { steps, disagree } = stepsOf(t);
  const step = Math.min(S.step === "" ? steps.length - 1 : +S.step, steps.length - 1), cat = steps[step].cats[ci], last = step === steps.length - 1;
  const ctl = steps.length > 1 ? h("div", { class: "seg", role: "group", "aria-label": "Step through the laps", style: "margin:0 0 12px;display:flex" }, steps.map((s, k) => h("button", { class: "btn", type: "button", "aria-pressed": String(k === step), onclick: () => { S.step = String(k); render(); } }, s.label))) : null;
  const T = testsOf(c), na = T.filter((x) => x[1] === "na");
  const card = h("div", { class: "card" },
    h("p", { class: "sent", style: "margin:0 0 6px" }, c.s, h("span", { class: "tm" }, mark(STAND[cat][0], 15))),
    h("p", { style: "margin:0;font-weight:600" }, mark(STAND[cat][0], 15), " ", CAT_WORD[cat].replace(/^./, (x) => x.toUpperCase()), last ? "" : ` (${steps[step].label.toLowerCase()})`),
    last && cat === "differs" ? h("p", { class: "k", style: "margin:4px 0 0" }, "Not a finding that it is false. Two readings of the pages differ, so the sentence stays as written and is marked in the answer.") : null,
    last && cat === "nothing" ? h("p", { class: "k", style: "margin:4px 0 0" }, "No page it read states this. It stays in the answer, marked.") : null,
    !last && steps[step].why.length ? h("p", { class: "k", style: "margin:4px 0 0" }, `The record's reason for going back: “${(steps[step].why.find((f) => f.i === c.i) || steps[step].why[0]).why}”`) : null);
  const rec = h("div", null, h("h2", { class: "sec" }, "Attempts to break it" + (last ? "" : " (as of now)")),
    h("ul", { class: "rcp" }, T.filter((x) => x[1] !== "na").map(([k, o, txt]) => h("li", null, mark(R_OUT[o][0], 15), h("div", null, h("b", null, k), " · ", R_OUT[o][1], h("p", null, txt))))),
    t.loop && t.loop.passes.length ? h("ul", { class: "rcp" }, t.loop.passes.map((p, j) => { const f = p.failing.find((x) => x.i === c.i), b = steps[j].cats[ci], a = steps[j + 1].cats[ci];
      const [m, word, extra] = f ? (f.afterIns === "holds" && a === "stands" ? ["states", "re-read, then held", "The pages already read were enough."] : a === "stands" ? ["states", "went back, then held", `Searched \u201c${f.query}\u201d.`] : ["differs", "went back, still failing", `Searched \u201c${f.query}\u201d.`])
        : b === "stands" && a !== "stands" ? ["differs", "stood, then the lap read it differently", p.added ? `The lap read ${plural(p.added, "more source")}; with it, a page reads this sentence differently.` : "After the lap, a page reads this sentence differently."] : ["states", "stood throughout", null];
      return h("li", null, mark(m, 15), h("div", null, h("b", null, `lap ${p.lap}`), " \u00b7 ", word, extra ? h("p", null, extra) : null)); })) : null,
    na.length ? h("div", { class: "gap" }, h("b", null, "Did not apply here: "), na.map((x) => `${x[0]} (${x[2].replace(/\.$/, "").toLowerCase()})`).join("; "), ". Never counted as a failure.") : null);
  return h("div", { class: "two" }, h("div", null, claimPicker(t), ctl, card, rec, disagree ? disagreeNote(t) : null),
    h("div", null, h("h2", { class: "sec" }, "What going back changed"), steps.length > 1 ? slope(t, steps, ci) : h("p", { class: "k" }, "It did not go back, so there is one point: where it stands."), steps.length === 1 ? slope(t, steps, ci) : null,
      h("p", { class: "k", style: "margin-top:26px" }, steps.length > 1 ? "Solid line: this sentence. Dashed: the others." : "")));
}

function patternFace() {
  const rows = D.thread.lapRows.filter((r) => r.laps), none = D.thread.lapRows.filter((r) => !r.laps).length;
  const cells = (o) => CAT_ORDER.flatMap((c, k) => Array(o ? [o.corroborated + o.held, o.weak, o.contested, o.unsupported][k] : 0).fill(c));
  const delta = (r) => { const b = r.before, a = r.after; return a.cleared && !b.cleared ? "cleared" : (a.backed === b.backed && a.contested === b.contested && a.unsupported === b.unsupported) ? "no change" : a.backed < b.backed ? "fewer stand" : "more stand"; };
  window.__lap = rows;
  const cellRow = (list) => h("span", { class: "cells" }, list.map((c) => mark(STAND[c][0], 15)));
  return h("div", null, h("h2", { class: "sec" }, `${rows.length} turns went back; ${none} did not need to`),
    h("ul", { class: "lps" }, h("li", { class: "lp-h", "aria-hidden": "true" }, h("span"), h("span", null, "first reading"), h("span"), h("span", null, "after going back"), h("span")),
      rows.map((r, i) => h("li", null, h("button", { class: "lp", type: "button", "data-id": String(i), "aria-pressed": "false", onclick: () => pick(String(i)) }, h("span", { class: "lbl" }, r.ask, h("small", null, plural(r.laps, "lap"))), cellRow(cells(r.before)), h("span", { class: "ar", "aria-hidden": "true" }, "→"), cellRow(cells(r.after)), h("b", { class: "dl " + delta(r).replace(" ", "-") }, delta(r)))))),
    h("p", { class: "k", style: "margin-top:10px" }, "Each shape is one claim. These are 21 separate recorded turns, not one conversation; they stand in for what a thread would show."));
}
function selectPattern(t, id) {
  const r = (window.__lap || [])[+id]; if (!r) return setRail(null); pressed(id);
  const w = (o) => CAT_ORDER.map((c, k) => [c, [o.corroborated + o.held, o.weak, o.contested, o.unsupported][k]]).filter((x) => x[1]).map(([c, n]) => `${n} ${CAT_SHORT[c]}`).join(", ") || "none";
  const here = D.turns.find((x) => x.id === r.id);
  setRail(h("div", null, h("p", { style: "margin:0 0 6px;font-weight:600" }, r.ask), h("p", { class: "k", style: "margin:0" }, "First reading"), h("p", { style: "margin:0 0 6px" }, w(r.before)), h("p", { class: "k", style: "margin:0" }, `After ${plural(r.laps, "lap")}`), h("p", { style: "margin:0 0 8px" }, w(r.after)),
    here ? h("a", { href: `rec.html#face=ground&turn=${encodeURIComponent(r.id)}` }, "see its laps") : h("p", { class: "k" }, "Its laps are not in this mock's turn list.")), "Before and after");
}
const rLegend = () => CAT_ORDER.map((c) => h("span", null, mark(STAND[c][0], 12), CAT_SHORT[c]));
boot({
  k: "rec", title: "Settle", railHint: "Tap a turn to see its counts before and after going back.",
  faces: [
    { k: "ground", label: "Going back", solo: true, caption: (t) => { const s = stepsOf(t); return s.laps ? `${t.label}: it went back ${plural(s.laps, "time")}. Here is what it went back for and what came of it.` : `${t.label}: it did not need to go back.`; }, sub: "Cultivating: the ground is rebuilt by re-reading and searching again. Each card is what the record kept of one lap.", render: groundFace, legend: rLegend },
    { k: "figure", label: "This claim", caption: (t) => { const c = claimOf(t), s = stepsOf(t), cat = s.steps[s.steps.length - 1].cats[t.claims.indexOf(c)]; return `s${c.i + 1}: ${CAT_WORD[cat]}.`; }, sub: "Making: a standing is made of attempts to break the claim. It is not “true”, it is what survived these.", render: figureFace, legend: rLegend },
    { k: "pattern", label: "Did going back help", solo: false, caption: () => { const r = D.thread.lapRows.filter((x) => x.laps), n = (k) => r.filter((x) => { const b = x.before, a = x.after; return k === "c" ? a.cleared && !b.cleared : k === "n" ? !(a.cleared && !b.cleared) && a.backed === b.backed && a.contested === b.contested && a.unsupported === b.unsupported : !(a.cleared && !b.cleared) && a.backed < b.backed; }).length; return `${r.length} of ${D.thread.turns} recorded turns went back. It cleared ${n("c")}, changed nothing in ${n("n")}, and left fewer claims standing in ${n("w")}.`; }, sub: "Composing: put the turns side by side. Going back reads more pages, and more pages give more chances to read a sentence differently.", render: patternFace, select: selectPattern, legend: rLegend },
  ],
});
