/* EVA (Relate x Interpretation): the claim bound to the pages, and to a null.
   Ground / Atmosphere / Tending : what the test had to stand on (independent pages, something to compare, a rival to swap in).
   Figure / Lens / Binding       : this claim against each page, on a scale, paired with the same pages read against a wrong version (the null).
   Pattern / Paradigm / Tracing  : which tests ran, held, differed or did not apply, claim by claim, across the recorded turns. */
const nameOf = (w) => w.src;
function ground1(t, c) {
  const n = c.witnesses.length, states = c.witnesses.filter((w) => w.verdict === "states");
  const dots = h("span", { class: "dots", "aria-hidden": "true" }, c.witnesses.map((w) => mark(SHAPE_OF[w.verdict], 13)));
  const rows = [
    ["Independent pages", c.chains >= 2 ? "states" : "none", dots,
      c.chains >= 2 ? `${c.chains} independent pages state it, out of ${plural(n, "page")} read.` : c.chains === 1 ? `One page states it, out of ${plural(n, "page")} read. There is no second page to set it against, so this test did not apply.` : `No page states it, out of ${plural(n, "page")} read.`],
    ["Something to compare", c.figures.length || c.names.length ? "states" : "none", null,
      c.figures.length ? `A figure in the claim: ${c.figures.join(", ")}.` : c.names.length ? `A name in the claim: ${c.names.join(", ")}.` : "No figure and no name in the claim, so only its wording could be compared."],
    ["A rival to swap in", c.swap.armed ? "states" : "none", null,
      c.swap.armed ? `“${c.swap.from}” can be swapped for “${c.swap.to}”, a ${c.swap.kind} from the pages, to see whether the pages tell the two apart.` : "No rival figure or name of the same kind was found in the pages, so the wrong-version test did not apply. That is not a pass and not a failure."],
  ];
  return h("div", { class: "card", style: "margin-bottom:12px" }, h("p", { class: "k" }, "s" + (c.i + 1)), h("p", { class: "sent", style: "margin:0 0 10px" }, c.s),
    h("div", { class: "prereq" }, rows.map(([k, m, extra, txt]) => h("div", { class: "pr" }, h("div", { class: "pk" }, mark(m, 15), h("b", null, k)), extra, h("p", null, txt)))));
}
function groundFace(t) {
  return h("div", { style: "max-width:820px" },
    h("h2", { class: "sec" }, `Looked in ${t.found.length} searches, opened ${plural(t.opened, "site")}${t.demoted ? `, set aside ${t.demoted}` : ""}`),
    t.claims.map((c) => ground1(t, c)));
}

/* THE SCALE: one row per page; a numeric axis when the claim has a figure, four reading columns when it does not */
const READCOLS = [["states", "says it"], ["near", "close"], ["contradicts", "reads differently"], ["silent", "silent"]];
function axisFmt(ax, v) { return ax.kind === "year" ? String(Math.round(v)) : ax.kind === "mag" ? fmtN(v) + " million" : fmtN(v) + " " + ax.unit; }
function figureFace(t) {
  const c = claimOf(t), ax = c.ax && c.witnesses.some((w) => w.fig) ? c.ax : null;
  const vals = ax ? [ax.value, ...c.witnesses.filter((w) => w.fig).map((w) => w.fig.value)] : [];
  let lo = Math.min(...vals), hi = Math.max(...vals); const span = hi - lo || Math.max(1, Math.abs(lo) * 0.02), pad = span * 0.12;
  const X = (v) => (((v - (lo - pad)) / (span + 2 * pad)) * 100).toFixed(2) + "%";
  const hasNull = !!c.nullW;
  const head = h("div", { class: "dp-h", "aria-hidden": "true" }, h("span"), ax ? h("span", { class: "trk-h" }, "where each page puts it") : h("span", { class: "cols-h" }, READCOLS.map(([, l]) => h("span", null, l))), h("span", { class: "nl-h" }, hasNull ? "wrong version" : "wrong version: n/a"));
  const rows = c.witnesses.map((w, i) => {
    const s = srcOf(t, w.src), id = "w" + i, nw = c.nullW?.per.find((x) => x.src === w.src);
    let plot;
    if (ax) {
      const track = h("span", { class: "track" }, h("i", { class: "rule", style: "left:" + X(ax.value) }));
      if (w.fig) { const x = (w.fig.value - (lo - pad)) / (span + 2 * pad); const m = h("span", { class: "pt " + (x > 0.45 ? "L" : "R"), style: "left:" + (x * 100).toFixed(2) + "%" }, mark(SHAPE_OF[w.verdict], 15), h("em", null, w.fig.raw)); track.append(m); }
      else track.append(h("span", { class: "pt R", style: "left:0%" }, mark("silent", 15), h("em", null, "no figure in its sentence")));
      plot = track;
    } else {
      const ci = READCOLS.findIndex(([k]) => k === w.verdict);
      plot = h("span", { class: "track cat" }, READCOLS.map((_, k) => h("span", { class: "cc" }, k === ci ? mark(SHAPE_OF[w.verdict], 16) : null)));
    }
    const nl = h("span", { class: "nl" }, hasNull ? (nw && nw.verdict !== "states" ? [mark("told", 16), h("em", null, "told apart")] : [mark("differs", 16), h("em", null, "still matches")]) : mark("none", 16));
    return h("li", null, h("button", { class: "dp", type: "button", "data-id": id, "aria-pressed": "false", onclick: () => pick(id) },
      h("span", { class: "who" }, fav(s.domain), h("span", { class: "t" }, s.domain), h("span", { class: "rd" }, READ[w.verdict])), plot, nl));
  });
  const axis = ax ? h("div", { class: "dp-ax", "aria-hidden": "true" }, h("span"), h("span", { class: "axis" }, [lo, ax.value, hi].filter((v, i, a) => a.indexOf(v) === i && (v === ax.value || Math.abs(v - ax.value) > span * 0.3)).map((v) => h("em", { style: "left:" + X(v) }, axisFmt(ax, v)))), h("span")) : null;
  // the honest reading, templated from the numbers
  const n = c.witnesses.length, cnt = (v) => c.witnesses.filter((w) => w.verdict === v).length;
  const lines = [`${cnt("states")} of ${n} pages say it${cnt("contradicts") ? `, ${cnt("contradicts")} read it differently` : ""}${cnt("near") ? `, ${cnt("near")} come close` : ""}${cnt("silent") ? `, ${cnt("silent")} are silent` : ""}.`];
  if (ax) { const g = c.witnesses.filter((w) => w.verdict === "contradicts" && w.fig); if (g.length) lines.push(`The ${plural(g.length, "page")} flagged as different ${g.length === 1 ? "sits" : "sit"} ${g.map((w) => { const d = Math.abs(w.fig.value - ax.value); return `${fmtN(+d.toFixed(2))} ${ax.kind === "year" ? "years" : ax.kind === "mag" ? "million" : ax.unit} away (${(d / ax.value * 100).toFixed(2)}%)`; }).join(" and ")}. The size of the gap is drawn so a person can judge it.`); }
  if (c.nullW) { const told = c.nullW.per.filter((x) => x.verdict !== "states").length, still = c.nullW.per.filter((x) => x.verdict === "states").map((x) => x.src);
    lines.push(`With “${c.swap.from}” changed to “${c.swap.to}”, ${told} of ${n} pages told the two apart.${still.length ? ` ${still.join(" and ")} still matched, so on ${still.length === 1 ? "that page" : "those pages"} this test cannot tell a wrong version from the claim.` : ""}`); }
  else lines.push("No wrong version could be built from these pages, so the null column is empty. That is a test that did not apply, not a pass.");
  return h("div", null, claimPicker(t), h("p", { class: "sent", style: "margin:0 0 10px" }, c.s),
    h("div", { class: "dpw" + (ax ? " num" : " catg") }, head, h("ul", { class: "dps" }, rows), axis),
    h("div", { style: "margin-top:12px;max-width:68ch" }, lines.map((l) => h("p", { style: "margin:0 0 4px" }, l))));
}
function selectFigure(t, id) {
  const c = claimOf(t), w = c.witnesses[+id.slice(1)]; if (!w) return setRail(null);
  const s = srcOf(t, w.src), nw = c.nullW?.per.find((x) => x.src === w.src); pressed(id);
  let body = [w.sentence];
  if (w.fig) { const i = w.sentence.indexOf(w.fig.raw); if (i >= 0) body = [w.sentence.slice(0, i), h("b", null, w.fig.raw), w.sentence.slice(i + w.fig.raw.length)]; }
  setRail(h("div", null, h("div", { class: "site" }, fav(s.domain), h("span", null, s.domain)), h("p", { class: "k", style: "margin:4px 0" }, s.title), quote(null, isWiki(s.domain) ? "s-wiki" : "", ...body),
    h("p", { class: "k", style: "margin:6px 0 0" }, "The app's reading, in its own words"), h("p", { style: "margin:0 0 6px" }, w.why ? (w.why.includes("“") ? w.why : `“${w.why}”`) : "no shared words or figure"),
    c.nullW ? h("p", { class: "k", style: "margin:0" }, `On the wrong version: ${nw ? (nw.verdict !== "states" ? "this page tells it apart from the claim." : "this page still matches it.") : "not read."}`) : null,
    openLink(s.url)), "In the page's own words");
}

/* the pattern grid */
const TESTS = [["words", "exact words", "A page shares four or more words in a row with the claim."], ["figure", "figure", "Every figure in the claim is in the sentence a page gives. Did not apply when the claim has none."], ["against", "pages differ", "No page reads against the claim. A mark means at least one page does, which is for a person to read."], ["second", "2nd page", "A second, independent page states it. Did not apply when only one page does."], ["wrong", "wrong version", "A wrong version (figure or name swapped) no longer matches. Did not apply when nothing could be swapped."]];
const OUT = { held: ["states", "held"], differs: ["differs", "came out differently"], na: ["none", "did not apply"] };
const ORDER = ["corroborated", "held", "weak", "contested", "unsupported"];
const multi = (r) => D.thread.claimRows.filter((x) => x.turn === r.turn).length > 1;
function patternFace() {
  const rows = D.thread.claimRows.slice().sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const head = h("li", { class: "pg-h", "aria-hidden": "true" }, h("span"), TESTS.map(([, l]) => h("span", { class: "vh" }, l)));
  const body = rows.map((r, i) => h("li", null, h("button", { class: "pg", type: "button", "data-id": String(i), "aria-pressed": "false", onclick: () => pick(String(i)) },
    h("span", { class: "lbl" }, h("b", null, mark(STAND[CATOF[r.verdict]][0], 12), " "), r.ask, multi(r) ? " \u00b7 s" + (r.i + 1) : ""), TESTS.map(([k]) => h("span", { class: "c" }, mark(OUT[r.tests[k]][0], 15))))));
  const sum = h("li", { class: "pg-s", "aria-hidden": "true" }, h("span", { class: "lbl k" }, "all claims"), TESTS.map(([k]) => { const n = (x) => rows.filter((r) => r.tests[k] === x).length; return h("span", { class: "c" }, h("span", null, mark("states", 10), n("held")), h("span", null, mark("differs", 10), n("differs")), h("span", null, mark("none", 10), n("na"))); }));
  window.__rows = rows;
  return h("div", null, h("ul", { class: "pgrid" }, head, body, sum),
    h("dl", { class: "tdef" }, TESTS.map(([, l, d]) => [h("dt", null, l), h("dd", null, d)])));
}
function selectPattern(t, id) {
  const r = (window.__rows || [])[+id]; if (!r) return setRail(null); pressed(id);
  setRail(h("div", null, h("p", { class: "k", style: "margin:0" }, r.ask), h("p", { class: "sent", style: "font-size:15px;margin:4px 0 8px" }, r.s),
    h("p", { style: "margin:0 0 8px" }, mark(STAND[CATOF[r.verdict]][0], 14), " ", STAND[CATOF[r.verdict]][1], ` · ${plural(r.n, "page")} read`),
    h("ul", { class: "plain" }, TESTS.map(([k, l]) => h("li", null, mark(OUT[r.tests[k]][0], 14), " ", h("b", null, l), ": ", OUT[r.tests[k]][1])))), "This claim's tests");
}
const eLegend = () => [h("span", null, mark("states", 12), "says it"), h("span", null, mark("near", 12), "close"), h("span", null, mark("differs", 12), "reads differently"), h("span", null, mark("silent", 12), "silent"), h("span", null, mark("told", 12), "wrong version told apart"), h("span", null, mark("none", 12), "did not apply")];
const pLegend = () => [h("span", null, mark("states", 12), "held"), h("span", null, mark("differs", 12), "came out differently"), h("span", null, mark("none", 12), "did not apply (never counted as a failure)")];
boot({
  k: "eva", title: "Compare", railHint: "Tap a page to read its own sentence beside the app's reading of it.",
  faces: [
    { k: "ground", label: "The ground", solo: true, caption: (t) => `${t.label}: before any verdict, what the test had to work with.`, sub: "No null, no verdict. A test is only run when there are independent pages, something to compare and a rival to swap in. When one is missing the test did not apply, which says nothing against the claim.", render: groundFace, legend: () => [h("span", null, mark("states", 12), "available"), h("span", null, mark("none", 12), "not available: the test did not apply")] },
    { k: "figure", label: "This claim", caption: (t) => { const c = claimOf(t); return `s${c.i + 1} set against ${plural(c.witnesses.length, "page")}, and against a wrong version of itself.`; }, sub: "The wrong version is the null: the same test run on the claim with its figure or name swapped. If the pages cannot tell the two apart, a pass means little.", render: figureFace, select: selectFigure, legend: eLegend },
    { k: "pattern", label: "Which tests ran", caption: () => { const r = D.thread.claimRows, n = (k, x) => r.filter((q) => q.tests[k] === x).length; return `${r.length} claims in ${D.thread.turns} recorded turns. A second independent page existed for ${n("second", "held")}. The wrong-version test could run on ${r.length - n("wrong", "na")}.`; }, sub: "Tracing: which tests tend to run, and which tend not to apply, across the turns. A test that did not apply is a dashed ring, never a flag.", render: patternFace, select: selectPattern, legend: pLegend },
  ],
});
