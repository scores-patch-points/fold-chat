/* DEF (Differentiate x Interpretation): what, exactly, is claimed, and whose words give it its sense.
   Ground / Atmosphere / Clearing : the setting the claim lives in, with what your question already supplied cleared away.
   Figure / Lens / Dissecting     : this claim, with the same words laid side by side in each page's own mouth (a concordance). No verdicts.
   Pattern / Paradigm / Unraveling: across the recorded turns, whose voice the words came from, pulled apart by site. */
const WORDS = /[\p{L}\p{N}]+/gu;
function splitGiven(sentence, ask) {
  const askW = new Set((ask.toLowerCase().match(WORDS) || []));
  const parts = sentence.split(/([\p{L}\p{N}]+)/u);
  let nNew = 0, nGiv = 0; const cls = parts.map((p) => (/^[\p{L}\p{N}]+$/u.test(p) ? (askW.has(p.toLowerCase()) ? (nGiv++, "given") : (nNew++, "new")) : null));
  const kids = parts.map((p, i) => { let c = cls[i]; if (c == null) { const a = cls.slice(0, i).reverse().find((x) => x), b = cls.slice(i + 1).find((x) => x); c = a && a === b ? a : null; } return c ? h("span", { class: c }, p) : p; });
  return { kids, nNew, nGiv };
}
function groundFace(t) {
  const facts = [
    ["Language", t.lang ? `asked in ${t.lang.question}, answered in ${t.lang.reply}${t.lang.same ? " (the same)" : ""}` : null],
    ["Kind of ask", [t.kind, t.answerMode].filter(Boolean).join(" · ")],
    ["Looked in", t.found.length ? t.found.map((f) => `${f.n} from ${f.scope}`).join(", ") : null],
    ["Set aside", t.demoted ? plural(t.demoted, "off-topic result") : "nothing recorded"],
    ["Opened", plural(t.opened, "site")],
    ["Attached to the answer", t.facingSources ? plural(t.facingSources, "page") : "no page when it was written (checked against the pages afterwards)"],
  ];
  const dl = h("dl", { class: "facts" }, facts.filter((f) => f[1]).map(([k, v]) => [h("dt", null, k), h("dd", null, v)]));
  const left = h("div", null,
    h("h2", { class: "sec" }, "You asked"), h("p", { class: "sent" }, t.ask),
    h("h2", { class: "sec" }, `The answer, ${t.claims.length === 1 ? "its one sentence" : "sentence by sentence"}`),
    t.claims.map((c) => { const sp = splitGiven(c.s, t.ask); return h("div", { class: "card", style: "margin-bottom:10px" },
      h("p", { class: "k" }, "s" + (c.i + 1)),
      h("p", { class: "sent", style: "margin:0 0 6px" }, sp.kids),
      h("p", { class: "k", style: "margin:0" }, sp.nGiv ? `${sp.nGiv} of ${sp.nGiv + sp.nNew} words came from your question (set quiet). ${sp.nNew} are new. The new words are what the sentence stakes.` : `None of its ${sp.nNew} words came from your question. All of it is stake.`)); }));
  const right = h("div", null, h("h2", { class: "sec" }, "The setting"), dl,
    h("div", { class: "gap", style: "margin-top:10px" }, h("b", null, "Carried from earlier turns: not recorded. "), "The start entry on the tape has no field for what the conversation was already about, so this row cannot be drawn yet."));
  return h("div", { class: "two" }, left, right);
}

function locate(w) { // the shared run inside the full sentence, for the reader
  const i = w.kw ? w.sentence.indexOf(w.kw.mid) : -1;
  return i < 0 ? [w.sentence] : [w.sentence.slice(0, i), h("b", null, w.kw.mid), w.sentence.slice(i + w.kw.mid.length)];
}
function figureFace(t) {
  const c = claimOf(t);
  const list = h("ul", { class: "kwic" }, h("li", { class: "kwh", "aria-hidden": "true" }, h("span", null, "page"), h("span", { style: "text-align:right" }, "before"), h("span", { style: "text-align:center" }, "shared words"), h("span", null, "after")));
  c.witnesses.forEach((w, i) => {
    const s = srcOf(t, w.src), id = "w" + i;
    const btn = h("button", { class: "kw" + (w.kw ? "" : " no"), type: "button", "data-id": id, "aria-pressed": "false", onclick: () => pick(id) },
      h("span", { class: "who" }, fav(s.domain), h("span", { class: "t" }, s.domain)),
      w.kw ? [h("span", { class: "l" }, h("span", null, w.kw.left)), h("span", { class: "m" }, w.kw.mid), h("span", { class: "r" }, w.kw.right)] : h("span", { class: "nm" }, "shares no run of words with the claim"));
    list.append(h("li", null, btn));
  });
  return h("div", null, claimPicker(t), h("h2", { class: "sec" }, "The answer's sentence"), h("p", { class: "sent" }, c.s),
    h("h2", { class: "sec" }, `The same words in ${plural(c.witnesses.length, "page")}, as each page wrote them`), list);
}
function selectFigure(t, id) {
  const c = claimOf(t), w = c.witnesses[+id.slice(1)]; if (!w) return setRail(null);
  const s = srcOf(t, w.src); pressed(id);
  setRail(h("div", null, h("div", { class: "site" }, fav(s.domain), h("span", null, s.domain)), h("p", { class: "k", style: "margin:4px 0" }, s.title),
    quote(null, isWiki(s.domain) ? "s-wiki" : "", ...locate(w)),
    w.kw ? h("p", { class: "k" }, `Words in common with the claim: \u201c${w.kw.mid}\u201d (${plural(w.runN, "word")} in a row).`) : h("p", { class: "k" }, "This sentence shares no run of words with the claim."),
    openLink(s.url)), "In the page's own words");
}

function patternFace() {
  const G = D.thread.givers, top = G.slice(0, 12), max = Math.max(...top.map((g) => g.states + g.differs + g.near + g.silent));
  const list = h("ul", { class: "bars" }, top.map((g) => {
    const other = g.differs + g.near, w = (n) => (n / max * 100).toFixed(1) + "%";
    const b = h("button", { class: "bar", type: "button", "data-id": g.site, "aria-pressed": "false", onclick: () => pick(g.site) },
      h("span", { class: "who" }, fav(g.site), h("span", { class: "t" }, g.site)),
      h("span", { class: "trk", "aria-hidden": "true" }, h("i", { class: "s1", style: "width:" + w(g.states) }), h("i", { class: "s2", style: "width:" + w(other) }), h("i", { class: "s3", style: "width:" + w(g.silent) })),
      h("span", { class: "cn" }, h("span", null, mark("states", 11), g.states), h("span", null, mark("differs", 11), other), h("span", null, mark("silent", 11), g.silent)));
    return h("li", null, b);
  }));
  const once = G.filter((g) => g.states + g.differs + g.near + g.silent === 1).length, rows = D.thread.claimRows;
  return h("div", null, h("h2", { class: "sec" }, `Sites, by how many of the ${rows.length} claims they were read for`), list,
    h("p", { class: "k", style: "margin-top:10px" }, `${G.length} sites in all; ${once} appear for one claim only. Sites are counted by domain, so en.wikipedia.org and simple.wikipedia.org are two.`));
}
function selectPattern(t, site) {
  const g = D.thread.givers.find((x) => x.site === site), rows = D.thread.claimRows; if (!g) return setRail(null);
  pressed(site);
  setRail(h("div", null, h("div", { class: "site" }, fav(g.site), h("span", null, g.site)), h("p", { class: "k", style: "margin:6px 0" }, `Read for ${plural(g.claims.length, "claim")}.`),
    h("ul", { class: "plain" }, g.claims.map((cl) => { const r = rows.find((x) => x.turn === cl.turn && x.i === cl.i); return h("li", null, mark(SHAPE_OF[cl.v] || "silent"), " ", h("b", null, cl.ask), h("br"), h("span", { class: "k" }, `${READ[cl.v] || cl.v} \u00b7 the claim as a whole: ${(STAND[CATOF[r?.verdict]] || ["", ""])[1]}`)); }))), "Where this site was read");
}
const dLegend = (...items) => items.map(([k, label]) => h("span", null, k === "q" ? h("b", null, "Aa") : mark(k, 12), label));
boot({
  k: "def", title: "Pin down", railHint: "Tap a line to read the page's own sentence, with the words it shares with the claim in bold.",
  faces: [
    { k: "ground", label: "Setting", solo: true, caption: (t) => `${t.label}: the question supplied some of the answer's words. The rest is what the answer stakes.`, sub: "Cleared first: whatever you already said. What is left is what could be wrong.", render: groundFace, legend: () => [h("span", null, h("b", null, "bold"), " new in the answer"), h("span", { style: "color:var(--ink2)" }, "regular grey: came from your question")] },
    { k: "figure", label: "This claim", caption: (t) => { const c = claimOf(t), n = c.witnesses.filter((w) => w.kw).length; return `${plural(n, "page")} of ${c.witnesses.length} share a run of words with s${c.i + 1}. Here is how each one finishes the sentence.`; }, sub: "Nothing on this face is marked right or wrong. It only sets the words side by side so a different sense of the same words can be seen before anyone judges.", render: figureFace, select: selectFigure, legend: () => [h("span", null, h("b", null, "bold"), " the words the page shares with the claim"), h("span", null, "left and right: the page's own words around them")] },
    { k: "pattern", label: "Whose words", caption: () => { const G = D.thread.givers, r = D.thread.claimRows, one = r.filter((x) => x.n === 1).length; return `${r.length} claims in ${D.thread.turns} recorded turns. ${one} were read from one site only. ${G[0].site} was read for ${G[0].states + G[0].differs + G[0].near + G[0].silent} of them.`; }, sub: "Unraveling: the same answer can stand on one voice repeated or on several. Each bar keeps the sites apart.", render: patternFace, select: selectPattern, legend: () => dLegend(["states", "says it in the claim's words"], ["differs", "words differ or are close"], ["silent", "no shared words"]) },
  ],
});
