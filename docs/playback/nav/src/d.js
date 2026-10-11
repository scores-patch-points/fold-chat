/* D — split on wide, sheet stack (model A) on narrow. The same stack, the same History contract; only the geometry differs. */
(() => {
const Nav = window.Nav, { el } = Nav, A = Nav.models.a;
const mq = matchMedia("(min-width: 900px)"); const SP = 40, MINCUR = 440, EASE = "cubic-bezier(.2,.8,.2,1)", DUR = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 340);
let dsp = null, veil = null, sig = "";
const root = document.documentElement;
function geo(stack) {
  const n = stack.length, vw = innerWidth; const CH = 340;                    // constant: the chat does not move, so neither does the return pill
  const out = { CH, spines: [], ctx: null, cur: null, spW: 0 };
  if (!n) return out;
  let x = CH; const anc = stack.slice(0, -1);
  let spN = Math.max(0, anc.length - 1), ctxW = anc.length ? Math.min(280, vw - CH - spN * SP - MINCUR) : 0;
  if (anc.length && ctxW < 200) { ctxW = 0; spN = anc.length; }                // no room to keep the previous layer readable: it folds into a spine too
  for (let i = 0; i < spN; i++) { out.spines.push({ i, x }); x += SP; }
  if (ctxW) { out.ctx = { i: anc.length - 1, x, w: ctxW }; x += ctxW; }
  out.cur = { i: n - 1, x, w: Math.min(vw - x, 820) }; out.spW = spN * SP;
  return out;
}
const SPLIT = {
  id: "d-split",
  mount() {
    root.dataset.mode = "split";
    dsp = el("nav"); dsp.id = "dsp"; dsp.setAttribute("aria-label", "Where you are: earlier layers"); dsp.dataset.chrome = "spines"; document.body.append(dsp);
    veil = el("button", "veil"); veil.type = "button"; veil.hidden = true; document.body.append(veil); sig = "";
  },
  dispose() { dsp && dsp.remove(); veil && veil.remove(); root.style.removeProperty("--chat-w"); root.style.removeProperty("--ret-left"); delete root.dataset.mode; Nav.app.inert = false; Nav.app.removeAttribute("aria-hidden"); },
  layout(stack, o = {}) {
    const g = geo(stack), n = stack.length; root.style.setProperty("--chat-w", g.CH + "px"); root.style.setProperty("--ret-left", n ? g.CH + 12 + "px" : "12px");
    const s = `${stack.map((L) => L.id).join(",")}|${Nav.theme()}|${innerWidth}`;
    if (s !== sig) {
      sig = s; dsp.replaceChildren(); dsp.style.left = g.CH + "px"; dsp.style.width = (g.spW || 0) + "px";
      g.spines.forEach((sp) => { const L = stack[sp.i]; const b = el("button"); b.type = "button"; b.dataset.chrome = "spine"; if (["p", "g", "s"].includes(L.k)) { b.classList.add("wear"); Nav.applyLook(b, Nav.srcOfL(L)); b.style.fontFamily = "var(--s-title)"; b.style.fontWeight = "var(--s-tw)"; b.style.textTransform = "var(--s-tcase)"; }
        const d = el("span", "dot"); if (["p", "g", "s"].includes(L.k)) d.style.background = Nav.srcOfL(L).look[Nav.theme()].tokens.accent; b.append(d, el("span", "", Nav.labelOf(L)), el("span", "n", String(sp.i + 1))); b.setAttribute("aria-label", `Back to ${Nav.labelOf(L)}, layer ${sp.i + 1}`); b.addEventListener("click", () => Nav.to(sp.i + 1)); dsp.append(b); });
    }
    stack.forEach((L, i) => {
      const e = Nav.layerEl(L); if (!e) return; e.style.zIndex = String(700 + i); e.style.top = "0"; e.style.bottom = "0"; e.style.right = "auto";
      const isCur = g.cur && g.cur.i === i, isCtx = g.ctx && g.ctx.i === i;
      if (isCur) { e.style.left = g.cur.x + "px"; e.style.width = g.cur.w + "px"; e.style.visibility = "visible"; e.style.opacity = ""; }
      else if (isCtx) { e.style.left = g.ctx.x + "px"; e.style.width = g.ctx.w + "px"; e.style.visibility = "visible"; e.style.opacity = "0.9"; }
      else { const sp = g.spines.find((x) => x.i === i); e.style.left = (sp ? sp.x : g.CH) + "px"; e.style.width = g.cur ? g.cur.w + "px" : "0"; e.style.visibility = o.phase === "pre" ? "visible" : "hidden"; }
    });
    if (g.ctx) { veil.hidden = false; Object.assign(veil.style, { left: g.ctx.x + "px", top: "0", bottom: "0", width: g.ctx.w + "px" }); veil.setAttribute("aria-label", `Back to ${Nav.labelOf(stack[g.ctx.i])}, layer ${g.ctx.i + 1}`); veil.onclick = () => Nav.to(g.ctx.i + 1); } else veil.hidden = true;
    Nav.app.style.visibility = "visible";
  },
  a11y() { Nav.app.inert = false; Nav.app.removeAttribute("aria-hidden"); Nav.layersRoot.querySelectorAll(".layer").forEach((n) => n.setAttribute("aria-modal", "false")); },
  enter(L, n) { return n.animate([{ transform: "translateX(48px)", opacity: 0 }, { transform: "translateX(0)", opacity: 1 }], { duration: DUR(), easing: EASE }).finished; },
  leave(L, n) { return n.animate([{ transform: "translateX(0)", opacity: 1 }, { transform: "translateX(48px)", opacity: 0 }], { duration: DUR(), easing: EASE, fill: "forwards" }).finished; },
};
let cur = null;
const pick = () => (mq.matches ? SPLIT : A);
const D = {
  id: "d",
  mount(ctx) { cur = pick(); root.dataset.dmode = cur === SPLIT ? "split" : "sheets"; if (cur.mount) cur.mount(ctx); mq.addEventListener("change", D._chg = () => { const next = pick(); if (next === cur) return; cur.dispose && cur.dispose(); [...Nav.layersRoot.children].forEach((n) => n.removeAttribute("style")); [...Nav.layersRoot.children].forEach((n) => n._look && Nav.applyLook(n, n._look)); cur = next; root.dataset.dmode = cur === SPLIT ? "split" : "sheets"; if (cur.mount) cur.mount({}); cur.layout(Nav.stack, { instant: true }); Nav.after(); }); },
  dispose() { cur && cur.dispose && cur.dispose(); mq.removeEventListener("change", D._chg); },
  layout(stack, o) { return cur.layout(stack, o); },
  enter(L, n, o) { return cur.enter(L, n, o); },
  leave(L, n, o) { return cur.leave(L, n, o); },
  a11y(stack) { if (cur.a11y) cur.a11y(stack); },
};
Nav.register(D);
})();
