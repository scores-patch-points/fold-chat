/* C — spatial zoom. Enter: the layer's window opens from the tapped element's rectangle to the screen while the parent zooms toward
   that point and fades. Leave: the reverse, to the trigger's CURRENT rectangle (the parent's scroll was never touched).
   Out: Back, Esc, the pill, pinch-in on touch, ctrl+wheel (trackpad pinch). The ring legend (top right) lists where you are. */
(() => {
const Nav = window.Nav, { el } = Nav;
const EASE = "cubic-bezier(.22,.8,.2,1)", DUR = () => (matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 420), RING = 3;
let rings = null, zl = null, zlN = null, sig = "", pts = new Map(), base = 0, lastWheel = 0;
const svg = '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="15" rx="2"/><rect x="5" y="5" width="8" height="8" rx="1.5"/><rect x="8" y="8" width="2" height="2" rx=".5"/></svg>';
const accOf = (L) => (["p", "g", "s"].includes(L.k) ? Nav.srcOfL(L).look[Nav.theme()].tokens.accent : getComputedStyle(document.documentElement).getPropertyValue("--ag").trim() || "#0d7a70");
function rectOf(trigger) {
  if (trigger && trigger.isConnected) { const r = trigger.getBoundingClientRect(); if (r.width > 0 && r.height > 0) return r; }
  return { left: innerWidth / 2 - 40, top: innerHeight / 2 - 20, right: innerWidth / 2 + 40, bottom: innerHeight / 2 + 20, width: 80, height: 40 };
}
const insetOf = (index) => index * RING;                                     // layer i (0-based) sits inside i rings
function clipFrom(r, ins) { const t = Math.max(0, r.top - ins), l = Math.max(0, r.left - ins), b = Math.max(0, innerHeight - ins - r.bottom), rt = Math.max(0, innerWidth - ins - r.right); return `inset(${t}px ${rt}px ${b}px ${l}px round 12px)`; }
function paint(stack) {
  const s = `${stack.map((L) => L.id).join(",")}|${Nav.theme()}`; if (s === sig) return; sig = s;
  rings.replaceChildren(); zl.hidden = stack.length === 0; if (!stack.length) return;
  for (let i = 0; i < stack.length - 1; i++) { const r = el("i"); r.style.inset = i * RING + "px"; r.style.setProperty("--rc", accOf(stack[i])); rings.append(r); }
  zlN.textContent = `${stack.length}`; zl.setAttribute("aria-label", `Zoom level ${stack.length}. Open the list of where you are.`);
}
function pinchSetup() {
  const root = Nav.layersRoot;
  root.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2) base = dist(); });
  root.addEventListener("pointermove", (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, [e.clientX, e.clientY]); if (pts.size === 2 && base > 20) { const d = dist(); if (d / base < 0.72) { base = 0; Nav.back(); } } });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) base = 0; };
  root.addEventListener("pointerup", up); root.addEventListener("pointercancel", up);
  addEventListener("wheel", (e) => { if (!e.ctrlKey || !Nav.stack.length) return; e.preventDefault(); const now = performance.now(); if (e.deltaY > 0 && now - lastWheel > 500) { lastWheel = now; Nav.back(); } }, { passive: false });
}
const dist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
const C = {
  id: "c",
  mount() {
    rings = el("div"); rings.id = "rings"; rings.setAttribute("aria-hidden", "true"); document.body.append(rings);
    zl = el("button"); zl.id = "zl"; zl.type = "button"; zl.dataset.chrome = "legend"; zl.innerHTML = svg; zlN = el("span"); zl.append(zlN); zl.addEventListener("click", () => Nav.popover(zl)); document.body.append(zl);
    if (!C._p) { pinchSetup(); C._p = true; } sig = "";
  },
  dispose() { rings && rings.remove(); zl && zl.remove(); sig = ""; },
  layout(stack, o = {}) {
    paint(stack); const n = stack.length;
    stack.forEach((L, i) => { const e = Nav.layerEl(L); if (!e) return; const ins = insetOf(i); Object.assign(e.style, { left: ins + "px", right: ins + "px", top: ins + "px", bottom: ins + "px", zIndex: String(700 + i) }); e.style.visibility = i === n - 1 || o.phase === "pre" ? "visible" : "hidden"; });
    Nav.app.style.visibility = n === 0 || o.phase === "pre" ? "visible" : "hidden";
  },
  enter(L, n, { stack, trigger, index }) {
    const d = DUR(), r = rectOf(trigger), ins = insetOf(index), parent = index > 0 ? Nav.layerEl(stack[index - 1]) : Nav.app;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (parent) { const pr = parent.getBoundingClientRect(); parent.animate([{ transformOrigin: `${cx - pr.left}px ${cy - pr.top}px`, transform: "scale(1)", opacity: 1 }, { transformOrigin: `${cx - pr.left}px ${cy - pr.top}px`, transform: "scale(1.5)", opacity: 0.0 }], { duration: d, easing: EASE }); }
    n._body.animate([{ transform: "scale(.9)", opacity: 0.2 }, { transform: "scale(1)", opacity: 1 }], { duration: d, easing: EASE });
    return n.animate([{ clipPath: clipFrom(r, ins) }, { clipPath: "inset(0px 0px 0px 0px round 0px)" }], { duration: d, easing: EASE }).finished;
  },
  leave(L, n, { stack, trigger }) {
    const d = DUR(), parent = stack.length ? Nav.layerEl(stack[stack.length - 1]) : Nav.app;
    const r = rectOf(trigger), ins = parseFloat(n.style.left) || 0; const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (parent) { const pr = parent.getBoundingClientRect(); parent.animate([{ transformOrigin: `${cx - pr.left}px ${cy - pr.top}px`, transform: "scale(1.5)", opacity: 0 }, { transformOrigin: `${cx - pr.left}px ${cy - pr.top}px`, transform: "scale(1)", opacity: 1 }], { duration: d, easing: EASE }); }
    n._body.animate([{ transform: "scale(1)", opacity: 1 }, { transform: "scale(.9)", opacity: 0 }], { duration: d, easing: EASE, fill: "forwards" });
    return n.animate([{ clipPath: "inset(0px 0px 0px 0px round 0px)" }, { clipPath: clipFrom(r, ins) }], { duration: d, easing: EASE, fill: "forwards" }).finished;
  },
};
Nav.register(C);
})();
