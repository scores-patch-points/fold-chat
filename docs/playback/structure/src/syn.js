/* SYN △  Generate x Structure.  Three faces:
   Ground  (Field   · Cultivating) the pool of kept lines the answer could grow from, and the ones it drew on
   Figure  (Link    · Making)      one answer sentence, typeset from the pages' own words (upright) and the model's own (italic)
   Pattern (Network · Composing)   the flow from pages to sentences: how many words each page gave each sentence */
(() => {
const copiedOf = (s) => s.runs.reduce((a, r) => a + (r.i1 - r.i0 + 1), 0);
function appendBold(p, text, bold) { const k = bold ? text.toLowerCase().indexOf(bold.toLowerCase()) : -1; if (k < 0) { p.append(text); return; } p.append(text.slice(0, k)); const b = document.createElement("b"); b.textContent = text.slice(k, k + bold.length); p.append(b, text.slice(k + bold.length)); }
function renderFigure(d, st, A) {
  const { el, fav, typeOf, clip, plural } = A; const wrap = el("div");
  d.syn.forEach((sn) => {
    const total = sn.toks.length, cp = copiedOf(sn);
    const art = el("article", "sn snwide" + (st.focus && sn.runs.some((r) => r.src === st.focus.src && r.line === st.focus.line) ? " focusrow" : ""));
    const places = new Set(sn.runs.map((r) => r.src + ":" + r.line)).size;
    const h = el("div", "sn-h"); h.append(el("span", "idx", "s" + (sn.i + 1)));
    const bar = el("div", "bar"); bar.setAttribute("role", "img");
    // segments in the order of the sentence: each run, and each stretch of the model's own words
    const segs = []; let k = 0; const byStart = new Map(sn.runs.map((r) => [r.i0, r]));
    while (k < total) { const r = byStart.get(k); if (r) { segs.push({ n: r.i1 - r.i0 + 1, own: false }); k = r.i1 + 1; } else { let j = k; while (j < total && !byStart.has(j)) j++; segs.push({ n: j - k, own: true }); k = j; } }
    segs.forEach((g) => { const i = el("i", g.own ? "own" : ""); i.style.flex = g.n + " 1 0"; bar.append(i); });
    bar.setAttribute("aria-label", `${cp} of ${total} words copied word for word from ${places} ${places === 1 ? "place" : "places"}`);
    h.append(bar, el("span", "num", `${cp} of ${total} words copied word for word` + (cp ? ` · ${plural(places, "place")}` : "")));
    art.append(h);
    const p = el("p", "patch"); const own = [];
    for (let i = 0; i < total;) {
      const r = byStart.get(i);
      if (r) { const s = d.sources[r.src]; const ty = typeOf(s.domain); const b = el("span", "run"); b.setAttribute("role", "button"); b.tabIndex = 0; b.style.fontFamily = ty.body; b.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); b.click(); } });
        const mk = el("span", "mk"); mk.append(fav(s.domain)); b.append(mk, sn.toks.slice(r.i0, r.i1 + 1).join(" ")); b.setAttribute("aria-label", `copied from ${s.domain}, line ${r.line + 1}: ${sn.toks.slice(r.i0, r.i1 + 1).join(" ")}`);
        b.addEventListener("click", () => A.openSheet({ src: r.src, line: r.line, bold: [r.srcText.replace(/[.,;:]+$/, "")], label: "copied run" })); p.append(b, " "); i = r.i1 + 1; }
      else { let j = i; while (j < total && !byStart.has(j)) j++; const t = sn.toks.slice(i, j).join(" "); p.append(el("i", "own", t), " "); own.push(t); i = j; }
    }
    art.append(p);
    const side = el("div", "side");
    if (sn.runs.length) {
      const ul = el("ul", "stitch"); sn.runs.forEach((r) => { const s = d.sources[r.src]; const ty = typeOf(s.domain); const li = el("li"); const b = el("button"); b.type = "button"; if (st.focus && st.focus.src === r.src && st.focus.line === r.line) b.classList.add("focus");
        const meta = el("span", "meta"); meta.append(el("b", "", s.domain), `line ${r.line + 1} · ${plural(r.i1 - r.i0 + 1, "word")}`); if (r.also.length) meta.append(` · also on ${r.also.map((x) => A.nm(d.sources[x])).join(", ")}`);
        const ln = el("span", "ln"); ln.style.fontFamily = ty.body; appendBold(ln, s.lines[r.line].t, r.srcText.replace(/[.,;:]+$/, "")); b.append(fav(s.domain), meta, ln);
        b.addEventListener("click", () => A.openSheet({ src: r.src, line: r.line, bold: [r.srcText.replace(/[.,;:]+$/, "")], label: "copied run" })); li.append(b); ul.append(li); }); side.append(ul);
    }
    // what the record itself said about this sentence
    const rec = el("p", "rec");
    if (sn.cite) { const s = d.sources[sn.cite.src]; const same = sn.runs.some((r) => r.src === sn.cite.src && r.line === sn.cite.line);
      rec.append("The record cites ", el("b", "", `${A.nm(s)}, line ${sn.cite.line + 1}`), `: “${clip(sn.cite.text.trim(), 60)}” (${plural(A.words(sn.cite.text).length, "word")} of ${total}).`); if (!same && sn.runs.length) rec.append(" The longest copied run is on another page."); }
    else { rec.classList.add("none"); rec.append(el("b", "", "The record found no page that states this sentence"), sn.coverage && sn.coverage.detail ? ` (it matched on: ${sn.coverage.detail}).` : "."); if (cp) rec.append(` Yet ${plural(cp, "word")} here are copied word for word.`); }
    side.append(rec); art.append(side); wrap.append(art);
  });
  const kl = el("p", "keyl"); kl.append("Upright, in the page’s own type, with its icon: copied word for word. ", el("i", "", "Italic: the model’s own words."), " Tap a run to read its page."); wrap.append(kl);
  return wrap;
}
function usage(d) { const u = new Map(); d.syn.forEach((sn) => sn.runs.forEach((r) => { const k = r.src + ":" + r.line; if (!u.has(k)) u.set(k, new Set()); u.get(k).add(sn.i + 1); })); const c = new Set(d.syn.filter((s) => s.cite).map((s) => s.cite.src + ":" + s.cite.line)); return { u, c }; }
function renderGround(d, st, A) {
  const { el, fav, plural } = A; const wrap = el("div"); const { u, c } = usage(d);
  const nLines = d.sources.reduce((a, s) => a + s.lines.length, 0); const usedSrc = new Set([...u.keys()].map((k) => +k.split(":")[0]));
  wrap.append(el("p", "psum", `${nLines} kept lines from ${d.sources.length} pages. The answer copies from ${plural(u.size, "line")} on ${plural(usedSrc.size, "page")}.`));
  const grid = el("div", "pool");
  d.sources.forEach((s) => {
    const pl = el("section", "pl" + (usedSrc.has(s.id) ? "" : " unused")); const fh = el("div", "fh"); fh.append(fav(s.domain), el("span", "dom", A.nm(s)), el("span", "cnt", plural(s.lines.length, "line")));
    const cells = el("div", "pcells"); cells.setAttribute("role", "group"); cells.setAttribute("aria-label", `${s.domain}: ${s.lines.length} kept lines`);
    s.lines.forEach((_, i) => { const k = s.id + ":" + i; const us = u.get(k); const b = el("button", "pc" + (us ? " used" : "") + (c.has(k) ? " cite" : "")); b.type = "button"; if (us) b.textContent = [...us].join(",");
      if (st.focus && st.focus.src === s.id && (st.focus.lines || []).includes(i)) b.classList.add("focus");
      b.setAttribute("aria-label", `line ${i + 1}${us ? ", copied by sentence " + [...us].join(" and ") : ", not used"}${c.has(k) ? ", the record’s citation" : ""}`);
      b.addEventListener("click", () => { const run = d.syn.flatMap((sn) => sn.runs).find((r) => r.src === s.id && r.line === i); A.openSheet({ src: s.id, line: i, bold: run ? [run.srcText.replace(/[.,;:]+$/, "")] : [] }); }); cells.append(b); });
    pl.append(fh, cells); grid.append(pl);
  });
  wrap.append(grid);
  const lg = el("p", "plegend"); const mk = (cls, t, txt) => { const x = el("span"); const b = el("span", "pc " + cls, txt || ""); x.append(b, t); return x; };
  lg.append(mk("used", "a sentence copies from this line (its number)", "1"), mk("cite", "the record’s citation", ""), mk("", "kept, not used")); wrap.append(lg);
  return wrap;
}
function renderPattern(d, st, A) {
  const { el, svgEl, fav, clip, plural } = A; const wrap = el("div"); const sk = el("div", "sk"); wrap.append(sk);
  const flow = d.syn.map((sn) => d.sources.map((s) => sn.runs.filter((r) => r.src === s.id).reduce((a, r) => a + r.i1 - r.i0 + 1, 0)));
  const srcTot = d.sources.map((_, i) => flow.reduce((a, f) => a + f[i], 0));
  const draw = () => {
    sk.replaceChildren(); const W = Math.max(300, sk.clientWidth || 340); const narrow = W < 620; const Lz = narrow ? 128 : 250, Rz = narrow ? 56 : 250, NW = 14, GAP = 14;
    const sentTot = d.syn.map((s) => s.toks.length); const total = sentTot.reduce((a, b) => a + b, 0);
    const k = Math.min(narrow ? 12 : 16, (narrow ? 320 : 400) / total); const MINZ = 18;
    const lh = d.sources.map((_, i) => (srcTot[i] ? srcTot[i] * k : MINZ)); const rh = sentTot.map((n) => n * k);
    const Hl = lh.reduce((a, b) => a + b, 0) + GAP * (lh.length - 1), Hr = rh.reduce((a, b) => a + b, 0) + GAP * (rh.length - 1); const H = Math.max(Hl, Hr) + 8;
    sk.style.height = H + "px";
    const svg = svgEl("svg", { width: W, height: H, viewBox: `0 0 ${W} ${H}`, "aria-hidden": "true" }); sk.append(svg);
    const defs = svgEl("defs"); const pat = svgEl("pattern", { id: "hatch", width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" }); pat.append(svgEl("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke: "var(--field-line)", "stroke-width": 2 })); defs.append(pat); svg.append(defs);
    const xl = Lz, xr = W - Rz - NW; let yl = (H - Hl) / 2; const ly = [], ry = []; let yr = (H - Hr) / 2;
    lh.forEach((h) => { ly.push(yl); yl += h + GAP; }); rh.forEach((h) => { ry.push(yr); yr += h + GAP; });
    const offL = d.sources.map(() => 0), offR = d.syn.map(() => 0);
    d.syn.forEach((sn, j) => d.sources.forEach((s, i) => { const f = flow[j][i]; if (!f) return; const t = f * k; const y0 = ly[i] + offL[i], y1 = ry[j] + offR[j]; offL[i] += t; offR[j] += t; const mx = (xl + NW + xr) / 2;
      svg.append(svgEl("path", { class: "rib", d: `M${xl + NW},${y0} C${mx},${y0} ${mx},${y1} ${xr},${y1} L${xr},${y1 + t} C${mx},${y1 + t} ${mx},${y0 + t} ${xl + NW},${y0 + t} Z` })); }));
    d.syn.forEach((sn, j) => { // the record's citation, where the ribbons do not already end at it
      if (!sn.cite || flow[j][sn.cite.src]) return; const i = sn.cite.src; const y0 = ly[i] + lh[i] / 2, y1 = ry[j] + 4; const mx = (xl + NW + xr) / 2;
      svg.append(svgEl("path", { class: "cited", d: `M${xl + NW},${y0} C${mx},${y0} ${mx},${y1} ${xr},${y1}` })); });
    d.sources.forEach((s, i) => { svg.append(svgEl("rect", { class: srcTot[i] ? "nodeb" : "nodez", x: xl, y: ly[i], width: NW, height: lh[i], rx: 3 })); });
    d.syn.forEach((sn, j) => { const cpw = flow[j].reduce((a, b) => a + b, 0); const ch = cpw * k; svg.append(svgEl("rect", { class: "nodeb", x: xr, y: ry[j], width: NW, height: Math.max(0, ch), rx: 3 })); if (sn.toks.length > cpw) svg.append(svgEl("rect", { class: "own", x: xr, y: ry[j] + ch, width: NW, height: (sn.toks.length - cpw) * k, rx: 3 })); });
    d.sources.forEach((s, i) => { const b = el("button", "lbl l"); b.type = "button"; b.style.left = "0px"; b.style.width = Lz - 10 + "px"; b.style.top = ly[i] + lh[i] / 2 - 18 + "px"; b.style.height = "36px";
      const t = el("span"); t.append(el("span", "dom", clip(A.nm(s, 40), narrow ? 17 : 30))); t.firstChild.style.display = "block"; const sm = el("small", "", srcTot[i] ? plural(srcTot[i], "word") + " copied" : "nothing copied"); t.append(sm); b.append(t, fav(s.domain, "sm"));
      b.setAttribute("aria-label", `${s.domain}: ${srcTot[i] ? srcTot[i] + " words copied" : "nothing copied"}`);
      b.addEventListener("click", () => { const r = d.syn.flatMap((x) => x.runs).find((x) => x.src === s.id); A.openSheet({ src: s.id, line: r ? r.line : 0, bold: r ? [r.srcText.replace(/[.,;:]+$/, "")] : [] }); }); sk.append(b); });
    d.syn.forEach((sn, j) => { const b = el("button", "lbl r"); b.type = "button"; b.style.left = xr + NW + 10 + "px"; b.style.width = Rz - NW - 10 + "px"; b.style.top = ry[j] + "px"; b.style.height = Math.max(36, rh[j]) + "px";
      const t = el("span"); t.append(el("b", "", "s" + (sn.i + 1))); if (!narrow) t.append(clip(sn.text, 78)); b.append(t); b.setAttribute("aria-label", `sentence ${sn.i + 1}: ${sn.text}`); b.addEventListener("click", () => A.go(1, null)); sk.append(b); });
  };
  requestAnimationFrame(draw); if (window.ResizeObserver) new ResizeObserver(() => { if (sk.isConnected) draw(); }).observe(sk);
  const key = el("p", "skkey"); key.append("Ribbon width = words copied word for word. Hatched = the model’s own words. Dashed line = where the record’s citation points, when no ribbon ends there."); wrap.append(key);
  const nz = d.sources.filter((_, i) => !srcTot[i]).length; wrap.append(el("p", "psum", `${plural(d.sources.length - nz, "page")} of ${d.sources.length} gave words to the answer; ${plural(nz, "page")} read, nothing copied.`)); wrap.lastChild.style.marginTop = "10px";
  return wrap;
}
window.__STAGE__ = {
  id: "SYN", n: 6, glyph: "△", defaultFace: 1,
  caption: (d) => { const cp = d.syn.reduce((a, s) => a + copiedOf(s), 0), tot = d.syn.reduce((a, s) => a + s.toks.length, 0); return { title: `${plural0(d.syn.length, "sentence")} written: ${cp} of ${tot} words are copied from the pages`, sub: `from “${d.ask}” · ${d.sources.length} pages read` }; },
  faces: [
    { name: "The pool", cell: "Field · Cultivating", blurb: "Every kept line the answer could grow from, one square each. Numbers mark the lines it copied from." },
    { name: "The sentence", cell: "Link · Making", blurb: "Each sentence of the answer, typeset from the pages’ own words. Where it was joined from separate places, you can see the seams." },
    { name: "The flow", cell: "Network · Composing", blurb: "How many words each page gave each sentence. Pages read but not used stand at the side, empty." },
  ],
  crumb: (d, st) => (st.focus ? [d.sources[st.focus.src].domain, st.focus.label || `line ${st.focus.line + 1}`] : []),
  lineMarks: (d, src) => { const s = new Set(); d.syn.forEach((sn) => sn.runs.forEach((r) => { if (r.src === src) s.add(r.line); })); return s; },
  render: [renderGround, renderFigure, renderPattern],
  foot: "Recorded turn, no model. A copied run is two or more words that appear in the same order in a kept line (small words alone do not count). The answer’s own wording was not changed. The tape holds no per-sentence draft entries for this turn, so nothing here is replayed in time.",
};
function plural0(n, w) { return `${n} ${w}${n === 1 ? "" : "s"}`; }
})();
