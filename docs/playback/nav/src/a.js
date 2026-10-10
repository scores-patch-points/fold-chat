/* A — bottom-sheet stack with detents (full / half). Strips above the top sheet are the ancestors: tap one to jump there.
   Swipe down on the top sheet's header: full -> half -> back one layer. Tap the header: full <-> half. */
(() => {
const Nav = window.Nav, { el } = Nav;
const STRIP = 32, CHAT = 40, EASE = "cubic-bezier(.2,.8,.2,1)", DUR = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 340);
let rail = null, scrim = null, sig = "";
const frame = () => { const w = innerWidth; if (w >= 700) { const fw = Math.min(720, w - 48); return { left: (w - fw) / 2, width: fw }; } return { left: 0, width: w }; };
function stripsOf(stack) {
  const anc = stack.slice(0, -1).map((L, i) => ({ L, i }));
  if (anc.length > 3) return { more: anc.length - 2, show: anc.slice(-2) };
  return { more: 0, show: anc };
}
function railHeight(stack) { if (!stack.length) return 0; const s = stripsOf(stack); return CHAT + (s.show.length + (s.more ? 1 : 0)) * STRIP + 6; }
function paintRail(stack) {
  const s = `${stack.map((L) => L.id).join(",")}|${Nav.theme()}|${innerWidth}`; if (s === sig) return; sig = s;
  rail.replaceChildren(); if (!stack.length) return;
  const f = frame(); rail.style.left = f.left + "px"; rail.style.width = f.width + "px"; rail.style.right = "auto";
  const { more, show } = stripsOf(stack); const topI = stack.length - 1;
  const chat = el("button", "st chat"); chat.type = "button"; chat.dataset.chrome = "strip"; chat.setAttribute("aria-label", `Back to chat, closing ${Nav.plural(stack.length, "layer")}`);
  chat.append(el("b", "", "◉"), el("span", "l", "Chat"), el("span", "cv", "⌃")); chat.addEventListener("click", () => Nav.home()); rail.append(chat);
  if (more) { const b = el("button", "st more"); b.type = "button"; b.dataset.chrome = "strip"; b.style.width = `calc(100% - ${(show.length + 1) * 8}px)`; b.style.marginLeft = (show.length + 1) * 4 + "px"; b.append(el("span", "k", "…"), el("span", "l", `${more} earlier layers`)); b.setAttribute("aria-label", `${more} earlier layers: open the list`); b.addEventListener("click", () => Nav.popover(b)); rail.append(b); }
  show.forEach(({ L, i }) => {
    const b = el("button", "st"); b.type = "button"; b.dataset.chrome = "strip"; const d = topI - i;       // older = narrower: the stack recedes
    b.style.width = `calc(100% - ${d * 8}px)`; b.style.marginLeft = d * 4 + "px";
    if (["p", "g", "s"].includes(L.k)) { b.classList.add("wear"); b.style.background = ""; Nav.applyLook(b, Nav.srcOfL(L)); b.style.fontFamily = "var(--s-title)"; b.style.fontWeight = "var(--s-tw)"; b.style.textTransform = "var(--s-tcase)"; b.style.borderBottomColor = "var(--s-rule)"; }
    const kind = { c: "evidence", p: "passage", g: "page", e: "elsewhere", s: "site" }[L.k];
    b.append(el("span", "k", kind), el("span", "l", Nav.labelOf(L)), el("span", "cv", "⌃")); b.setAttribute("aria-label", `Back to ${Nav.labelOf(L)}, layer ${i + 1}`);
    b.addEventListener("click", () => Nav.to(i + 1)); rail.append(b);
  });
}
function topPx(L, rh) { return L.detent === "half" ? Math.max(rh, Math.round(innerHeight * 0.5)) : rh; }
function ensureGrab(n, L) {
  if (n._grab) return; const g = el("div", "grab"); g.setAttribute("aria-hidden", "true"); n._head.append(g); n._grab = g;
  const head = n._head; let y0 = null, id = null, moved = false;
  head.addEventListener("pointerdown", (e) => { if (e.target.closest("button,a")) return; y0 = e.clientY; id = e.pointerId; moved = false; head.setPointerCapture(id); });
  head.addEventListener("pointermove", (e) => { if (y0 == null) return; const dy = e.clientY - y0; if (Math.abs(dy) > 6) moved = true; if (dy > 0) { n.style.transition = "none"; n.style.transform = `translateY(${dy}px)`; } });
  const end = (e) => {
    if (y0 == null) return; const dy = e.clientY - y0; y0 = null; n.style.transition = ""; n.style.transform = "";
    const idx = Nav.stack.indexOf(L); if (idx < 0) return;
    if (!moved) { L.detent = L.detent === "half" ? "full" : "half"; A.layout(Nav.stack, { instant: false }); return; }
    if (dy > 220 || (dy > 90 && L.detent === "half")) Nav.back(); else if (dy > 70) { L.detent = "half"; A.layout(Nav.stack, { instant: false }); } else if (dy < -60) { L.detent = "full"; A.layout(Nav.stack, { instant: false }); }
  };
  head.addEventListener("pointerup", end); head.addEventListener("pointercancel", end);
}
const A = {
  id: "a",
  mount() {
    rail = el("nav"); rail.id = "rail"; rail.setAttribute("aria-label", "Where you are: chat and the layers under this one"); Object.assign(rail.style, { position: "fixed", top: "0", zIndex: "800", pointerEvents: "none" }); document.body.append(rail);
    scrim = el("div"); scrim.id = "scrim"; scrim.addEventListener("click", () => { const L = Nav.stack[Nav.stack.length - 1]; if (L && L.detent === "half") Nav.back(); }); document.body.append(scrim); sig = "";
    this._rs = () => A.layout(Nav.stack, { instant: true }); addEventListener("resize", this._rs);
  },
  dispose() { rail && rail.remove(); scrim && scrim.remove(); removeEventListener("resize", this._rs); sig = ""; },
  layout(stack, o = {}) {
    const n = stack.length, rh = railHeight(stack), f = frame();
    paintRail(stack); rail.style.height = rh + "px";
    scrim.classList.toggle("on", n > 0);
    stack.forEach((L, i) => {
      const e = Nav.layerEl(L); if (!e) return; ensureGrab(e, L); const isTop = i === n - 1;
      L.detent = L.detent || "full";
      Object.assign(e.style, { left: f.left + "px", width: f.width + "px", top: (isTop ? topPx(L, rh) : rh) + "px", bottom: "0", zIndex: String(700 + i) });
      e.style.visibility = isTop || (n > 1 && i === n - 2 && stack[n - 1].detent === "half") || o.phase === "pre" ? "visible" : "hidden";
    });
    scrim.style.zIndex = "650";
  },
  enter(L, n) { return n.animate([{ transform: "translateY(100%)" }, { transform: "translateY(0)" }], { duration: DUR(), easing: EASE }).finished; },
  leave(L, n) { return n.animate([{ transform: "translateY(0)" }, { transform: "translateY(100%)" }], { duration: DUR(), easing: EASE, fill: "forwards" }).finished; },
};
Nav.register(A);
})();
