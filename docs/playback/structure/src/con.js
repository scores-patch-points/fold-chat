/* CON ⋈  Relate x Structure.  Three faces:
   Ground  (Field   · Tending) every kept sentence of every page: which name a thing two or more pages share, which stand alone
   Figure  (Link    · Binding) one shared thing: the pages that name it come in, what each says about it goes out
   Pattern (Network · Tracing) the pages as a network, joined by the things they share; tap a line to trace it */
(() => {
const bindOf = (d, st) => d.binds[Math.min(st.bind, d.binds.length - 1)] || null;
function thingChips(d, st, A) {
  const { el } = A; const row = el("div", "things"); row.setAttribute("role", "group"); row.setAttribute("aria-label", "Things two or more pages name");
  if (!d.binds.length) return row;
  row.append(el("span", "lab", "A thing named by 2+ pages:"));
  d.binds.forEach((b, i) => { const x = el("button"); x.type = "button"; x.setAttribute("aria-pressed", String(i === st.bind)); x.append(el("b", "", b.label), el("span", "", String(b.pages.length))); x.setAttribute("aria-label", `${b.label}, named by ${b.pages.length} pages`); x.addEventListener("click", () => { st.bind = i; A.rerender(); }); row.append(x); });
  return row;
}
function renderFigure(d, st, A) {
  const { el, svgEl, fav, typeOf, clip, plural } = A; const wrap = el("div", "bind"); const b = bindOf(d, st);
  wrap.append(thingChips(d, st, A));
  if (!b) { wrap.append(el("p", "mut", "No thing is named by two pages, so nothing was bound.")); return wrap; }
  const bt = el("div", "bt"); const hub = el("div", "hub"); hub.append(el("h2", "", b.label), el("div", "hn", `named by ${b.pages.length} of ${d.sources.length} pages`));
  const rel = d.binds.map((x, i) => ({ x, i })).filter(({ x, i }) => i !== st.bind && (x.key.includes(b.key) || b.key.includes(x.key)));
  if (rel.length) { const al = el("div", "also"); al.append("also"); rel.forEach(({ x, i }) => { const k = el("button", "", `${x.label} · ${plural(x.pages.length, "page")}`); k.type = "button"; k.addEventListener("click", () => { st.bind = i; A.rerender(); }); al.append(k); }); hub.append(al); }
  hub.style.gridRow = `1 / span ${b.rows.length}`;
  const wires = svgEl("svg", { class: "wires", "aria-hidden": "true" }); bt.append(wires, hub);
  const lcs = [], rcs = [];
  b.rows.forEach((r, ri) => {
    const s = d.sources[r.src]; const ty = typeOf(s.domain); const focus = st.focus && st.focus.src === r.src;
    const row = el("div", "brow" + (focus ? " focus" : ""));
    const left = r.toks.slice(0, r.ref[0]).join(" "), right = r.toks.slice(r.ref[1] + 1);
    const lc = el("button", "lc"); lc.type = "button"; lc.setAttribute("aria-label", `${s.domain}, line ${r.line + 1}`);
    const who = el("div", "who"); who.append(fav(s.domain), el("span", "dom", A.nm(s)), el("span", "pos", `line ${r.line + 1}`));
    lc.append(who); if (left) { const bf = el("div", "before", "…" + left); bf.style.fontFamily = ty.body; lc.append(bf); }
    const rc = el("button", "rc"); rc.type = "button"; rc.style.fontFamily = ty.body; rc.setAttribute("aria-label", `${s.domain} says: ${right.join(" ")}`);
    const th = el("span", "thing", r.toks.slice(r.ref[0], r.ref[1] + 1).join(" ")); const says = el("span", "says");
    right.forEach((w, i) => { if (r.shared[i]) says.append(el("b", "", w), " "); else says.append(w + " "); }); if (!right.length) says.append(el("span", "mut", "(the sentence ends here)"));
    rc.append(th, says);
    const open = () => A.openSheet({ src: r.src, line: r.line, bold: [r.toks.slice(r.ref[0]).join(" ").slice(0, 200)], label: "names “" + b.label + "”" });
    lc.addEventListener("click", open); rc.addEventListener("click", open);
    row.append(lc, rc); bt.append(row); lcs.push(lc); rcs.push(rc);
  });
  wrap.append(bt);
  const apart = d.sources.filter((s) => !b.pages.includes(s.id));
  if (apart.length) {
    const ap = el("div", "apart"); ap.append(el("h3", "", `Not joined — ${plural(apart.length, "page")} never use${apart.length === 1 ? "s" : ""} the words “${b.label}”`));
    apart.forEach((s) => { const c = d.cuts.find((x) => x.src === s.id); const x = el("button"); x.type = "button"; x.append(fav(s.domain)); const t = el("span", "t"); t.append(el("b", "dom", A.nm(s))); const q = el("i", "", c ? "“" + clip(c.sentence, 96) + "”" : "no sentence was kept from this page"); q.style.fontFamily = typeOf(s.domain).body; t.append(q); x.append(t); x.addEventListener("click", () => A.openSheet({ src: s.id, line: c ? c.line : 0, lines: c ? [c.line, c.lineEnd] : undefined, bold: [] })); ap.append(x); });
    wrap.append(ap);
  }
  // wires (wide layout): each page's card runs into the one thing, and out to what that page says
  const draw = () => {
    wires.replaceChildren(); if (getComputedStyle(wires).display === "none") return; const bb = bt.getBoundingClientRect(); const hb = hub.getBoundingClientRect();
    const hy = hb.top - bb.top + hb.height / 2, hl = hb.left - bb.left, hr = hb.right - bb.left;
    lcs.forEach((lc, i) => { const l = lc.getBoundingClientRect(), r = rcs[i].getBoundingClientRect();
      const y1 = l.top - bb.top + l.height / 2, x1 = l.right - bb.left, y2 = r.top - bb.top + r.height / 2, x2 = r.left - bb.left;
      const m1 = (x1 + hl) / 2, m2 = (hr + x2) / 2;
      wires.append(svgEl("path", { class: "wire", d: `M${x1},${y1} C${m1},${y1} ${m1},${hy} ${hl},${hy}` }), svgEl("path", { class: "wire", d: `M${hr},${hy} C${m2},${hy} ${m2},${y2} ${x2},${y2}` })); });
  };
  requestAnimationFrame(draw); setTimeout(draw, 250);
  if (window.ResizeObserver) { const ro = new ResizeObserver(draw); ro.observe(bt); }
  return wrap;
}
function renderGround(d, st, A) {
  const { el, fav, clip, plural } = A; const wrap = el("div"); const b = bindOf(d, st);
  wrap.append(thingChips(d, st, A));
  const total = d.field.length, onb = b ? d.field.filter((f) => f.names.includes(st.bind)).length : 0, alone = d.field.filter((f) => !f.names.length).length;
  wrap.append(el("p", "fsum", b ? `${onb} of ${total} kept sentences name “${b.label}”. ${alone} name no shared thing at all.` : `${total} kept sentences; none names a thing two pages share.`));
  const grid = el("div", "field");
  d.sources.forEach((s) => {
    const fp = el("section", "fp"); const sents = d.field.map((f, i) => ({ f, i })).filter(({ f }) => f.src === s.id);
    const fh = el("div", "fh"); fh.append(fav(s.domain), el("span", "dom", A.nm(s)), el("span", "cnt", plural(sents.length, "sentence")));
    const cells = el("div", "cells"); cells.setAttribute("role", "group"); cells.setAttribute("aria-label", `${s.domain}: ${sents.length} kept sentences`);
    sents.forEach(({ f }) => {
      const state = b && f.names.includes(st.bind) ? "on" : f.names.length ? "some" : "none"; const c = el("button", "cell " + state); c.type = "button";
      c.setAttribute("aria-label", `line ${f.line + 1}: ${state === "on" ? "names " + b.label : state === "some" ? "names another shared thing" : "stands alone"}`);
      if (st.focus && st.focus.src === s.id && (st.focus.lines || []).includes(f.line)) c.classList.add("focus");
      c.addEventListener("click", () => A.openSheet({ src: s.id, line: f.line, bold: state === "on" ? [b.label] : [] })); cells.append(c);
    });
    fp.append(fh, cells); grid.append(fp);
  });
  wrap.append(grid);
  const lg = el("p", "flegend"); const mk = (cls, t) => { const x = el("span"); const c = el("span", "cell " + cls); x.append(c, t); return x; };
  lg.append(mk("on", b ? `names “${b.label}”` : "names the selected thing"), mk("some", "names another shared thing"), mk("none", "stands alone")); wrap.append(lg);
  return wrap;
}
function renderPattern(d, st, A) {
  const { el, svgEl, fav, typeOf, clip, plural } = A; const wrap = el("div"); wrap.append(thingChips(d, st, A));
  const b = bindOf(d, st); const net = el("div", "net"); wrap.append(net);
  const n = d.sources.length, W = 340, C = W / 2, R = n <= 3 ? 70 : 88, P = (i) => { const a = (2 * Math.PI * i) / n - Math.PI / 2; return [C + R * Math.cos(a), C + R * Math.sin(a), a]; };
  const svg = svgEl("svg", { class: "netsvg", viewBox: `0 0 ${W} ${W}`, role: "group", "aria-label": "Pages joined by the things they share" }); net.append(svg);
  const gE = svgEl("g"), gN = svgEl("g"); svg.append(gE, gN);
  d.edges.forEach((e, ei) => {
    const [x1, y1] = P(e.a), [x2, y2] = P(e.b); const qx = C + (x1 + x2 - 2 * C) * 0.25, qy = C + (y1 + y2 - 2 * C) * 0.25;
    const dd = `M${x1},${y1} Q${qx},${qy} ${x2},${y2}`; const on = b && b.pages.includes(e.a) && b.pages.includes(e.b); const sel = st.edge === ei;
    gE.append(svgEl("path", { class: "e" + (on ? " on" : "") + (sel ? " sel" : ""), d: dd, "stroke-width": sel ? 4 : on ? 2.5 : 0.8 + 0.5 * e.keys.length, opacity: on || sel ? 0.95 : 0.5 }));
    const hit = svgEl("path", { class: "hit", d: dd, tabindex: "0", role: "button", "aria-label": `${d.sources[e.a].domain} and ${d.sources[e.b].domain} share ${e.keys.join(", ")}` });
    const pick = () => { st.edge = sel ? null : ei; A.rerender(); }; hit.addEventListener("click", pick); hit.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); pick(); } }); gE.append(hit);
    if (sel) { const mx = 0.25 * x1 + 0.5 * qx + 0.25 * x2, my = 0.25 * y1 + 0.5 * qy + 0.25 * y2; const g = svgEl("g", { class: "cn", "pointer-events": "none" }); g.append(svgEl("circle", { cx: mx, cy: my, r: 8 })); const t = svgEl("text", { x: mx, y: my + 3.5, "text-anchor": "middle" }); t.textContent = e.keys.length; g.append(t); gE.append(g); }
  });
  d.sources.forEach((s) => {
    const [x, y, a] = P(s.id); const ty = typeOf(s.domain); const inb = b && b.pages.includes(s.id);
    const g = svgEl("g", { class: "nd" + (inb ? " in" : ""), tabindex: "0", role: "button", "aria-label": `${s.domain}${inb ? ", names " + b.label : ""}` });
    g.append(svgEl("circle", { cx: x, cy: y, r: 16 })); const lt = svgEl("text", { x, y: y + 4.5, "text-anchor": "middle", "font-size": 13, "font-weight": 700 }); lt.style.fill = "var(--ink)"; lt.textContent = ty.fav; g.append(lt);
    const side = Math.cos(a) > 0.3 ? "start" : Math.cos(a) < -0.3 ? "end" : "middle"; const lx = x + (side === "start" ? 22 : side === "end" ? -22 : 0), ly = side === "middle" ? (Math.sin(a) < 0 ? y - 24 : y + 32) : y + 4;
    const tx = svgEl("text", { class: "l", x: lx, y: ly, "text-anchor": side }); tx.textContent = clip(A.nm(s, 40).replace(/^www\./, "").replace(/\.(com|org|co\.uk)$/, ""), 13); g.append(tx);
    const go = () => A.openSheet({ src: s.id, line: (d.cuts.find((c) => c.src === s.id) || { line: 0 }).line, bold: inb ? [b.label] : [] });
    g.addEventListener("click", go); g.addEventListener("keydown", (ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); go(); } }); gN.append(g);
  });
  const tr = el("div", "trace"); net.append(tr);
  if (b) {
    tr.append(el("h3", "", `“${b.label}” runs through ${plural(b.pages.length, "page")}`));
    const route = el("div", "route"); b.rows.forEach((r, i) => { if (i) route.append(el("span", "arr", "›")); const s = d.sources[r.src]; const x = el("button"); x.type = "button"; x.append(fav(s.domain, "sm"), A.nm(s).replace(/^www\./, "")); x.addEventListener("click", () => A.openSheet({ src: r.src, line: r.line, bold: [r.toks.slice(r.ref[0], r.ref[1] + 1).join(" ")] })); route.append(x); });
    tr.append(route);
  }
  const e = st.edge != null ? d.edges[st.edge] : null;
  if (e) {
    tr.append(el("h3", "", `${A.nm(d.sources[e.a])} and ${A.nm(d.sources[e.b])} share`));
    const sh = el("div", "shared"); e.keys.forEach((k) => { const i = d.binds.findIndex((x) => x.label === k); const x = el("button", "", k); x.type = "button"; x.addEventListener("click", () => { st.bind = Math.max(0, i); A.go(1, null); }); sh.append(x); }); tr.append(sh);
    tr.append(el("p", "mut", "Tap one to see what each page says about it."));
  } else tr.append(el("p", "mut", "Tap a line between two pages to see what they share. Thin grey lines are what the pages share besides the selected thing; thicker means more."));
  const lone = d.sources.filter((s) => !d.edges.some((x) => x.a === s.id || x.b === s.id));
  if (lone.length) tr.append(el("p", "", `${lone.map((s) => A.nm(s)).join(", ")} share${lone.length === 1 ? "s" : ""} no named thing with any other page.`));
  return wrap;
}
window.__STAGE__ = {
  id: "CON", n: 5, glyph: "⋈", defaultFace: 1, state: { edge: null },
  caption: (d, st) => { const b = d.binds[Math.min(st.bind, d.binds.length - 1)]; return b ? { title: `${b.pages.length} of ${d.sources.length} pages name “${b.label}”`, sub: "what each page says about it, side by side" } : { title: "No two pages name the same thing", sub: "so each page stands alone" }; },
  faces: [
    { name: "What was on offer", cell: "Field · Tending", blurb: "Every kept sentence, one square each. Filled squares name a thing that two or more pages share; dashed ones stand alone." },
    { name: "The bind", cell: "Link · Binding", blurb: "Pages that name the same thing run into it; out the other side comes what each says about it, word for word." },
    { name: "The network", cell: "Network · Tracing", blurb: "The pages as a network, joined by what they share. Follow a line to see the words behind it." },
  ],
  crumb: (d, st) => { const out = []; const b = d.binds[Math.min(st.bind, d.binds.length - 1)]; if (b) out.push("“" + b.label + "”"); if (st.focus) out.push(d.sources[st.focus.src].domain); return out; },
  lineMarks: (d, src) => { const s = new Set(); d.field.forEach((f) => { if (f.src === src && f.names.length) s.add(f.line); }); return s; },
  render: [renderGround, renderFigure, renderPattern],
  foot: "Recorded turn, no model. A “thing” is a capitalised name that appears word for word in sentences of two or more pages; a shared name is a join, a shared word alone is not. English capitals decide it, so other scripts are not bound.",
};
})();
