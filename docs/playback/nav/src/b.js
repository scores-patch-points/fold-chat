/* B — push navigation with a persistent spine. Swipe back from the left edge; the spine is the breadcrumb; the pill returns. */
(() => {
const Nav = window.Nav, { el } = Nav;
const EASE = "cubic-bezier(.2,.8,.2,1)", DUR = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 340);
let spine = null, ol = null, edge = null, sig = "", drag = null;
const KINDS = { c: "evidence", p: "passage", g: "page", e: "elsewhere", s: "site" };
function chip(label, dot, onClick, cur, kind) {
  const b = cur ? el("span", "cur") : el("button"); if (!cur) b.type = "button";
  if (dot !== null) { const d = el("i", "dot"); if (dot) d.style.background = dot; b.append(d); }
  b.append(el("span", "lb", label)); if (kind) b.append(el("span", "k", kind));
  if (cur) b.setAttribute("aria-current", "location"); else b.addEventListener("click", onClick); return b;
}
function paint(stack) {
  const s = `${stack.map((L) => L.id).join(",")}|${Nav.theme()}|${innerWidth}`; if (s === sig) return; sig = s;
  spine.hidden = stack.length === 0; ol.replaceChildren(); if (!stack.length) return;
  const d = stack.length, narrow = innerWidth < 600, items = [];
  items.push({ t: "chat" });
  const visCount = narrow ? (d <= 2 ? d : 2) : (d <= 4 ? d : 3);       // layers shown after the chat chip
  const hidden = d - visCount;
  if (hidden > 0) items.push({ t: "more", n: hidden });
  for (let i = d - visCount; i < d; i++) items.push({ t: "layer", i });
  items.forEach((it) => {
    const li = el("li");
    if (it.t === "chat") li.append(chip("Chat", null, () => Nav.home(), false, ""));
    else if (it.t === "more") { const b = chip("+" + it.n, null, () => Nav.popover(b), false); b.classList.add("more"); b.setAttribute("aria-label", `${it.n} earlier layers: open the list`); b.querySelector(".lb").style.overflow = "visible"; li.append(b); }
    else { const L = stack[it.i], cur = it.i === d - 1; const acc = ["p", "g", "s"].includes(L.k) ? Nav.srcOfL(L).look[Nav.theme()].tokens.accent : null; const b = chip(Nav.labelOf(L), acc, () => Nav.to(it.i + 1), cur, KINDS[L.k]); if (!cur) b.setAttribute("aria-label", `Back to ${Nav.labelOf(L)}, layer ${it.i + 1}`); li.append(b); }
    ol.append(li);
  });
  const top = stack[d - 1];
  for (const k of ["--s-accent"]) spine.style.removeProperty(k);
  if (["p", "g", "s"].includes(top.k)) spine.style.setProperty("--s-accent", Nav.srcOfL(top).look[Nav.theme()].tokens.accent);
}
function pointerSetup() {
  edge.addEventListener("pointerdown", (e) => { const L = Nav.stack[Nav.stack.length - 1]; if (!L) return; const n = Nav.layerEl(L); drag = { x0: e.clientX, id: e.pointerId, n, prev: Nav.stack.length > 1 ? Nav.layerEl(Nav.stack[Nav.stack.length - 2]) : Nav.app, t0: performance.now(), dx: 0 }; edge.setPointerCapture(e.pointerId); if (drag.prev) { drag.prev.style.visibility = "visible"; } });
  edge.addEventListener("pointermove", (e) => { if (!drag) return; const dx = Math.max(0, e.clientX - drag.x0); drag.dx = dx; drag.n.style.transition = "none"; drag.n.style.transform = `translateX(${dx}px)`; const p = Math.min(1, dx / innerWidth); if (drag.prev) { drag.prev.style.transform = `translateX(${-22 * (1 - p)}%)`; drag.prev.style.opacity = String(0.6 + 0.4 * p); } });
  const end = () => {
    if (!drag) return; const { n, prev, dx, t0 } = drag; drag = null; const v = dx / Math.max(1, performance.now() - t0);
    const back = dx > innerWidth * 0.38 || (v > 0.6 && dx > 40);
    if (prev) { prev.style.transform = ""; prev.style.opacity = ""; }
    if (back) { n._fromDx = dx; n.style.transition = ""; Nav.back(); }
    else { n.style.transition = "transform 220ms " + EASE; n.style.transform = ""; if (prev && prev !== Nav.app) setTimeout(() => B.layout(Nav.stack, { instant: true }), 230); if (prev === Nav.app) prev.style.visibility = ""; }
  };
  edge.addEventListener("pointerup", end); edge.addEventListener("pointercancel", end);
}
const B = {
  id: "b",
  mount() {
    spine = el("nav"); spine.id = "spine"; spine.hidden = true; spine.setAttribute("aria-label", "Where you are"); spine.dataset.chrome = "spine"; ol = el("ol"); spine.append(ol); document.body.append(spine);
    edge = el("div", "edge"); edge.setAttribute("aria-hidden", "true"); document.body.append(edge); pointerSetup(); sig = "";
    this._rs = () => B.layout(Nav.stack, { instant: true }); addEventListener("resize", this._rs);
  },
  dispose() { spine && spine.remove(); edge && edge.remove(); removeEventListener("resize", this._rs); Nav.app.style.transform = ""; Nav.app.style.opacity = ""; sig = ""; },
  layout(stack, o = {}) {
    paint(stack); edge.style.display = stack.length ? "block" : "none"; const n = stack.length;
    stack.forEach((L, i) => { const e = Nav.layerEl(L); if (!e) return; e.style.zIndex = String(700 + i); const isTop = i === n - 1; e.style.visibility = isTop || o.phase === "pre" ? "visible" : "hidden"; });
    Nav.app.style.visibility = n === 0 || o.phase === "pre" ? "visible" : "hidden";
  },
  enter(L, n, { stack, index }) {
    const prev = index > 0 ? Nav.layerEl(stack[index - 1]) : Nav.app, d = DUR();
    if (prev) prev.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(-22%)", opacity: 0.6 }], { duration: d, easing: EASE });
    return n.animate([{ transform: "translateX(100%)" }, { transform: "translateX(0)" }], { duration: d, easing: EASE }).finished;
  },
  leave(L, n, { stack }) {
    const prev = stack.length ? Nav.layerEl(stack[stack.length - 1]) : Nav.app, d = DUR(); const from = n._fromDx || 0;
    if (prev) prev.animate([{ transform: "translateX(-22%)", opacity: 0.6 }, { transform: "translateX(0)", opacity: 1 }], { duration: d, easing: EASE });
    return n.animate([{ transform: `translateX(${from}px)` }, { transform: "translateX(100%)" }], { duration: d, easing: EASE, fill: "forwards" }).finished;
  },
};
Nav.register(B);
})();
