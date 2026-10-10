/* SEG ｜  Differentiate x Structure.  Three faces of one operator:
   Ground  (Field   · Clearing)   the page the sentence sits in: its kept lines, what was set aside
   Figure  (Link    · Dissecting) the sentence itself, cut into who | does | what, boxes drawn on the verbatim line
   Pattern (Network · Unraveling) every page's cut lined up on its verb */
(() => {
const ROLE = { s: "SUBJ", v: "VERB", o: "OBJ" };
const tokensOf = (c) => { const all = c.sentence.split(/\s+/).filter(Boolean); return all; };
function renderFigure(d, st, A) {
  const { el, fav, typeOf, clip } = A; const wrap = el("div", "gridbg"); const list = el("div", "cuts"); wrap.append(list);
  d.cuts.forEach((c, ri) => {
    const s = d.sources[c.src]; const ty = typeOf(s.domain);
    const row = el("article", "cut-row" + (st.anim ? " plain" : "") + (st.focus && st.focus.src === c.src ? " focus" : "")); row.dataset.src = c.src;
    const h = el("div", "cut-h"); const b = el("button", "src"); b.type = "button"; b.append(fav(s.domain), el("span", "dom", A.nm(s))); b.setAttribute("aria-label", `Open ${s.domain}, the sentence's page`);
    const lines = [c.line, c.lineEnd];
    b.addEventListener("click", () => A.openSheet({ src: c.src, lines, line: c.line, bold: [c.sentence], label: "sentence" }));
    h.append(b, el("span", "pos", `line ${c.line + 1}${c.lineEnd > c.line ? `–${c.lineEnd + 1}` : ""} of ${c.nLines}`));
    const notes = [];
    if (c.flags.glued) notes.push(`joined ${c.lineEnd - c.line + 1} lines of the page`);
    if (c.flags.q) notes.push("ends in a question mark — the cut is a guess");
    if (c.flags.verbGuess) notes.push("no verb found — the cut is a guess");
    const hasS = c.groups.some((g) => g.role === "s"), hasO = c.groups.some((g) => g.role === "o");
    if (!hasS) notes.push("no subject found"); if (!hasO) notes.push("nothing after the verb");
    if (notes.length) h.append(el("span", "fl", notes.join(" · ")));
    const p = el("p", "sent"); p.style.fontFamily = ty.body;
    const all = tokensOf(c); const n = c.toks.length; const gAt = new Map(c.groups.map((g, gi) => [g.i0, { g, gi }]));
    let order = 0; const guess = c.flags.q || c.flags.verbGuess;
    const mkBox = (role, text, extra = "") => { const x = el("button", "g g-" + role + extra, text); x.type = "button"; x.dataset.role = ROLE[role]; x.style.setProperty("--d", order++ * 150 + "ms"); return x; };
    // a missing subject is drawn as an empty box, not left out
    const vg = c.groups.find((g) => g.role === "v");
    if (!hasS && vg && vg.i0 <= 1) { const m = el("span", "g g-s g-miss", "—"); m.dataset.role = "SUBJ"; m.style.setProperty("--d", order++ * 150 + "ms"); p.append(m, " "); }
    for (let i = 0; i < n;) {
      const hit = gAt.get(i);
      if (hit) { const { g } = hit; const txt = c.toks.slice(g.i0, g.i1 + 1).join(" "); const bx = mkBox(g.role, txt, g.role === "v" && guess ? " guess" : "");
        bx.addEventListener("click", () => A.openSheet({ src: c.src, lines, line: c.line, bold: [txt], label: ROLE[g.role] + " “" + clip(txt, 24) + "”" })); p.append(bx, " "); i = g.i1 + 1; }
      else { p.append(c.toks[i] + " "); i++; }
    }
    const rest = all.slice(n); if (rest.length) { const rr = el("span", "rest", clip(rest.slice(0, 7).join(" "), 60) + (rest.length > 7 ? ` … +${rest.length - 7} more words` : "")); p.append(rr); }
    const why = el("p", "why"); if (c.hits.length) { why.append("matches your words: "); why.append(el("b", "", c.hits.join(", "))); } else why.append("none of your words are in this sentence");
    row.append(h, p, why); list.append(row);
  });
  return wrap;
}
function renderGround(d, st, A) {
  const { el, fav, typeOf, clip, num } = A; const wrap = el("div"); const grid = el("div", "strips"); wrap.append(grid);
  const cutBy = new Map(d.cuts.map((c) => [c.src, c]));
  d.sources.forEach((s) => {
    const c = cutBy.get(s.id); const ty = typeOf(s.domain); const sec = el("section", "strip");
    const sh = el("button", "sh"); sh.type = "button"; sh.append(fav(s.domain), el("span", "dom", A.nm(s))); sh.addEventListener("click", () => A.openSheet({ src: s.id, line: c ? c.line : 0, lines: c ? [c.line, c.lineEnd] : undefined, bold: c ? [c.sentence] : [] }));
    const meter = el("div", "meter"); const fill = el("i"); fill.style.width = (s.kept != null && s.chars ? Math.max(3, 100 * s.kept / s.chars) : 100) + "%"; meter.append(fill); meter.setAttribute("role", "img");
    meter.setAttribute("aria-label", s.chars ? `kept ${num(s.kept)} of ${num(s.chars)} characters` : "size not recorded");
    const kn = el("div", "keptn", s.chars != null ? `${num(s.kept)} of ${num(s.chars)} kept${s.clipped ? " (tape: first 900)" : ""}` : "size not recorded");
    const maxLen = Math.max(...s.lines.map((l) => l.t.length), 1);
    const ol = el("ol", "bars");
    const cutRange = c ? [c.line, c.lineEnd] : [-1, -2]; let jn = null;
    s.lines.forEach((l, i) => {
      const li = el("li"); const b = el("button"); b.type = "button"; b.style.width = Math.max(8, Math.round(100 * Math.sqrt(l.t.length / maxLen))) + "%";
      const inCut = i >= cutRange[0] && i <= cutRange[1]; b.setAttribute("aria-label", `line ${i + 1} of ${s.lines.length}, ${l.t.length} characters${inCut ? ", the sentence that was cut" : ""}`);
      b.addEventListener("click", () => A.openSheet({ src: s.id, line: i, bold: inCut ? [c.sentence] : [] }));
      if (st.focus && st.focus.src === s.id && (st.focus.lines || []).includes(i)) li.classList.add("focus");
      li.append(b);
      if (inCut) { li.classList.add("cutl"); if (c.lineEnd > c.line) { if (!jn) { jn = el("li"); const dv = el("div", "joined"); jn.append(dv); ol.append(jn); } jn.firstChild.append(li); return; } }
      ol.append(li);
    });
    const cap = el("p", "cap"); cap.style.fontFamily = ty.body;
    if (c) { cap.append(el("b", "", `CUT FROM LINE ${c.line + 1}${c.lineEnd > c.line ? `–${c.lineEnd + 1}` : ""}`), el("span", "", "“" + clip(c.sentence, 70) + "”")); } else { cap.append(el("span", "mut", "no sentence was cut from this page")); cap.style.fontFamily = "var(--sans)"; }
    sec.append(sh, meter, kn, ol, cap); grid.append(sec);
  });
  const lg = el("p", "legend"); const a = el("span"); a.append(el("i"), "one line of the kept text, as long as the line is"); const b = el("span"); const ci = el("i", "c"); b.append(ci, "the sentence that was cut"); const m = el("span", "", "hatched = the part of the page that was set aside");
  lg.append(a, b, m); wrap.append(lg);
  return wrap;
}
function renderPattern(d, st, A) {
  const { el, fav, typeOf, clip } = A; const wrap = el("div");
  const rows = d.cuts.map((c) => { const all = c.sentence.split(/\s+/).filter(Boolean); const vg = c.groups.find((g) => g.role === "v"); const v = vg ? vg : { i0: Math.min(1, c.toks.length - 1), i1: Math.min(1, c.toks.length - 1) };
    return { c, left: all.slice(0, v.i0).join(" "), verb: all.slice(v.i0, v.i1 + 1).join(" "), right: all.slice(v.i1 + 1).join(" "), key: norm(all.slice(v.i0, v.i1 + 1).join(" ")), guess: c.flags.q || c.flags.verbGuess }; });
  const by = new Map(); rows.forEach((r) => { if (!by.has(r.key)) by.set(r.key, []); by.get(r.key).push(r); });
  const groups = [...by.entries()].sort((a, b) => b[1].length - a[1].length);
  const top = groups[0]; const sum = el("p", "sum");
  sum.textContent = top && top[1].length > 1 ? `${top[1].length} of ${rows.length} cuts land on the same verb, “${top[1][0].verb}”. Lined up on it, what comes before and after sits side by side.` : `${rows.length} cuts, no verb in common.`;
  wrap.append(sum); const conc = el("div", "conc"); wrap.append(conc);
  groups.forEach(([k, rs]) => {
    const h = el("div", "ch"); h.append(el("b", "", rs[0].verb), plural(rs.length, "page")); conc.append(h);
    rs.forEach((r) => { const s = d.sources[r.c.src]; const ty = typeOf(s.domain);
      const b = el("button", "crow" + (st.focus && st.focus.src === r.c.src ? " focus" : "")); b.type = "button"; b.style.fontFamily = ty.body; b.setAttribute("aria-label", `${s.domain}: ${r.c.sentence}`);
      const l = el("span", "l"); l.append(el("span", "", r.left || "—")); const v = el("span", "v" + (r.guess ? " guess" : ""), r.verb + (r.guess ? " ?" : "")); const rr = el("span", "r", r.right || "—");
      b.append(fav(s.domain), l, v, rr); b.addEventListener("click", () => A.openSheet({ src: r.c.src, lines: [r.c.line, r.c.lineEnd], line: r.c.line, bold: [r.verb], label: "verb “" + r.verb + "”" }));
      conc.append(b); });
  });
  function plural(n, w) { return `${n} ${w}${n === 1 ? "" : "s"}`; }
  function norm(w) { return String(w).toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, "").trim(); }
  return wrap;
}
window.__STAGE__ = {
  id: "SEG", n: 4, glyph: "｜", defaultFace: 1,
  caption: (d) => ({ title: `Cut ${d.cuts.length} sentences, one per page, into who · does · what`, sub: `from “${d.ask}” · ${d.sources.length} pages read` }),
  faces: [
    { name: "The page", cell: "Field · Clearing", blurb: "Where each sentence sat: the lines kept from its page, and how much of the page was set aside." },
    { name: "The cut", cell: "Link · Dissecting", blurb: "The sentence as the page wrote it, with its parts boxed. Tap a box to read it in its page." },
    { name: "Across pages", cell: "Network · Unraveling", blurb: "Every page’s sentence lined up on its verb, so what each says before and after it sits side by side." },
  ],
  crumb: (d, st) => (st.focus ? [d.sources[st.focus.src].domain, st.focus.label || `line ${st.focus.line + 1}`] : []),
  lineMarks: (d, src) => { const c = d.cuts.find((x) => x.src === src); const s = new Set(); if (c) for (let i = c.line; i <= c.lineEnd; i++) s.add(i); return s; },
  after: () => { document.querySelectorAll(".cut-row.plain").forEach((r) => setTimeout(() => r.classList.remove("plain"), 420)); },
  render: [renderGround, renderFigure, renderPattern],
  foot: "Recorded turn, no model: the cut is the app’s own deriveGraph run on the kept text. Words in boxes and plain words are the page’s, in the page’s order. Dashed means a guess.",
};
})();
