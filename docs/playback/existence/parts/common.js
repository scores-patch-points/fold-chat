/* Shared runtime for the three Existence mocks: dataset, theme, recorded-time scrubber, and the three grain faces
   (Ground / Figure / Pattern). A stage supplies STAGE = { code, glyph, domain, faces:{ground,figure,pattern}:{name,terrain,stance}, render(D,t,api) }. */
const DATA = JSON.parse(document.getElementById("data").textContent);
const FACES = ["ground", "figure", "pattern"];
const WHEEL = { ground: "Void · the hub", figure: "Beings · the spokes", pattern: "Fold · the rim" };
function h(tag, a, ...kids) {
  const e = document.createElement(tag);
  if (a) for (const [k, v] of Object.entries(a)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v; else if (k === "style") e.style.cssText = v;
    else if (k.slice(0, 2) === "on") e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of kids.flat(Infinity)) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const fmt = (n) => (n == null ? "" : Number(n).toLocaleString("en"));
const secs = (s) => (s < 0.05 ? "<0.1" : s < 10 ? s.toFixed(1) : String(Math.round(s))) + " s";
const plural = (n, w, ws) => `${fmt(n)} ${n === 1 ? w : ws || w + "s"}`;
function fav(D, domain, site, cls) {
  const ty = D.types[domain] || {};
  return h("span", { class: "fav " + (cls || ""), "aria-hidden": "true", style: `background:${ty.favBg || "#f1f1f4"};color:${ty.favFg || "#44444e"}` }, ty.fav || String(site || domain || "?").charAt(0).toUpperCase());
}
const hollowFav = (cls) => h("span", { class: "fav hollow " + (cls || ""), "aria-hidden": "true" }, "?");
const pageTitle = (t) => String(t || "").replace(/ - (Wikipedia|National Geographic Society)$/, "");
const siteName = (p) => p.domain || p.site || "";

const S = { d: 0, face: "figure", t: null, theme: "auto", prevFace: null };
(function readHash() {
  const q = new URLSearchParams(location.hash.slice(1));
  const di = DATA.findIndex((x) => x.id === q.get("d"));
  if (di >= 0) S.d = di;
  if (FACES.includes(q.get("f"))) S.face = q.get("f");
  if (q.get("t") != null && q.get("t") !== "") S.t = Number(q.get("t"));
  if (["light", "dark", "auto"].includes(q.get("theme"))) S.theme = q.get("theme");
})();
function writeHash() {
  const q = new URLSearchParams();
  q.set("d", DATA[S.d].id); q.set("f", S.face); if (S.t != null) q.set("t", String(S.t)); if (S.theme !== "auto") q.set("theme", S.theme);
  history.replaceState(null, "", "#" + q.toString());
}
function applyTheme() { if (S.theme === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", S.theme); }

const $faces = document.getElementById("faces");
const $cap = document.getElementById("cap");
const $crumbs = document.getElementById("crumbs");
const $hl = document.getElementById("hl");
const $hr = document.getElementById("hr");
let lastRender = null;

function go(face, instant) {
  if (!FACES.includes(face) || face === S.face && !instant) return;
  S.prevFace = S.face; S.face = face; writeHash(); paint(true);
  const f = document.getElementById("f-" + face); if (f) { f.setAttribute("tabindex", "-1"); f.focus({ preventScroll: true }); }
}
function step(dir) { const i = FACES.indexOf(S.face) + dir; if (i >= 0 && i < FACES.length) go(FACES[i]); }

function paint(animate) {
  const D = DATA[S.d];
  const t = S.t == null ? D.dur : Math.min(S.t, D.dur);
  const api = { go, S, t };
  const R = STAGE.render(D, t, api);
  lastRender = R;
  $cap.textContent = R.caption;
  const F = STAGE.faces;
  $crumbs.replaceChildren(
    h("span", null, "Reading"), h("span", { class: "sep" }, "›"),
    h("button", { type: "button", onclick: () => go("figure"), "aria-label": `Stage ${STAGE.n}, ${STAGE.code}: back to the figure face` }, `${STAGE.n} · ${STAGE.code} ${STAGE.glyph}`),
    h("span", { class: "sep" }, "›"), h("b", { "aria-current": "page" }, `${cap(S.face)}: ${F[S.face].terrain} · ${F[S.face].stance}`),
    h("span", { class: "dots", "aria-hidden": "true", style: "margin-left:auto;padding:0" }, FACES.flatMap((f, i) => [i ? h("span") : null, h("i", { class: f === S.face ? "on" : "" })]))
  );
  $faces.setAttribute("aria-label", `${STAGE.code}, ${cap(S.face)} face: ${F[S.face].terrain} ${F[S.face].stance}`);
  for (const f of FACES) {
    let node = document.getElementById("f-" + f);
    if (!node) { node = h("section", { class: "face", id: "f-" + f, "aria-label": `${cap(f)}: ${F[f].terrain} · ${F[f].stance}` }); $faces.append(node); }
    const active = f === S.face;
    node.hidden = !active; if (!active) { node.setAttribute("inert", ""); } else node.removeAttribute("inert");
    if (active) {
      node.replaceChildren(R[f]);
      node.classList.remove("in-zoomin", "in-zoomout", "in-pan");
      if (animate && S.prevFace) {
        const from = FACES.indexOf(S.prevFace), to = FACES.indexOf(f);
        void node.offsetWidth;
        node.classList.add(f === "figure" ? (from === 0 ? "in-zoomin" : "in-pan") : f === "ground" ? "in-zoomout" : "in-pan");
      }
    }
  }
  const i = FACES.indexOf(S.face);
  const L = FACES[i - 1], Rr = FACES[i + 1];
  fillHint($hl, L, R.hints && R.hints[L], "◂");
  fillHint($hr, Rr, R.hints && R.hints[Rr], "▸");
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function fillHint(btn, face, say, arrow) {
  btn.replaceChildren();
  if (!face) { btn.disabled = true; btn.setAttribute("aria-hidden", "true"); btn.style.visibility = "hidden"; return; }
  btn.disabled = false; btn.removeAttribute("aria-hidden"); btn.style.visibility = "";
  const F = STAGE.faces[face];
  btn.append(
    h("span", { class: "kick" }, arrow === "◂" ? `◂ ${cap(face)} · ${F.terrain}` : `${cap(face)} · ${F.terrain} ▸`),
    h("span", { class: "say" }, say || "")
  );
  btn.setAttribute("aria-label", `${cap(face)} face, ${F.terrain} ${F.stance}. ${say || ""}`);
  btn.onclick = () => go(face);
}

// the mock-only strip
(function mockBar() {
  const row = document.getElementById("mockrow");
  const dset = h("span", { class: "seg", role: "group", "aria-label": "Real turn" }, DATA.map((x, i) => h("button", { type: "button", "aria-pressed": String(i === S.d), onclick: () => { S.d = i; writeHash(); syncBar(); paint(); } }, x.label)));
  const themes = h("span", { class: "seg", role: "group", "aria-label": "Theme" }, ["auto", "light", "dark"].map((k) => h("button", { type: "button", "data-th": k, "aria-pressed": String(S.theme === k), onclick: () => { S.theme = k; applyTheme(); writeHash(); syncBar(); } }, k)));
  const scrub = h("input", { type: "range", min: "0", max: "100", step: "0.1", id: "scrub", "aria-label": "Recorded time" });
  const out = h("output", { id: "tout" }, "");
  const play = h("button", { type: "button", class: "seg", style: "padding:4px 10px", onclick: () => playIt() }, "▶ play");
  scrub.addEventListener("input", () => { S.t = Number(scrub.value); writeHash(); syncBar(); paint(); });
  row.append(h("span", null, "Real turn: ", dset), h("span", null, "Theme: ", themes), h("label", null, "Recorded time ", scrub, out), play);
  window.syncBar = function () {
    const D = DATA[S.d]; scrub.max = String(Math.ceil(D.dur)); scrub.value = String(S.t == null ? Math.ceil(D.dur) : S.t);
    out.textContent = (S.t == null ? D.dur : Math.min(S.t, D.dur)).toFixed(1) + " s of " + D.dur.toFixed(1) + " s";
    [...dset.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === S.d)));
    [...themes.children].forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.th === S.theme)));
  };
  let timer = null;
  function playIt() {
    if (timer) { clearInterval(timer); timer = null; return; }
    const D = DATA[S.d]; S.t = 0; const k = D.dur / 14;
    timer = setInterval(() => { S.t = Math.min(D.dur, (S.t || 0) + 0.1 * k); syncBar(); paint(); if (S.t >= D.dur) { clearInterval(timer); timer = null; } }, 100);
  }
})();

// travel: arrow keys and swipes (the hints and the dots are the visible way)
document.addEventListener("keydown", (e) => {
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  if (e.key === "ArrowLeft") { step(-1); e.preventDefault(); } else if (e.key === "ArrowRight") { step(1); e.preventDefault(); } else if (e.key === "Escape" && S.face !== "figure") { go("figure"); }
});
(function swipe() {
  let x0 = null, y0 = 0;
  $faces.addEventListener("pointerdown", (e) => { if (e.pointerType === "mouse") return; x0 = e.clientX; y0 = e.clientY; });
  $faces.addEventListener("pointerup", (e) => { if (x0 == null) return; const dx = e.clientX - x0, dy = e.clientY - y0; x0 = null; if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) step(dx < 0 ? 1 : -1); });
})();
applyTheme(); syncBar(); paint(false);
