/* shared by def.html, eva.html, rec.html: DOM helper, shapes, favicon tile, the breadcrumb + 3x3 cell jump, the three grain tabs, the reader rail. */
const D = JSON.parse(document.getElementById("data").textContent);
const NS = "http://www.w3.org/2000/svg";
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) { if (v == null || v === false) continue; if (k === "class") e.className = v; else if (k.startsWith("on")) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? "" : v); }
  for (const c of kids.flat(9)) { if (c == null || c === false) continue; e.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return e;
}
function sv(tag, attrs, ...kids) { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); for (const c of kids.flat()) if (c) e.append(c); return e; }
const plural = (n, w, ws) => `${n} ${n === 1 ? w : ws || w + "s"}`;
const clip = (s, n) => (String(s).length <= n ? String(s) : String(s).slice(0, n).replace(/\s\S*$/, "") + "…");
const fmtN = (v) => (Math.abs(v) >= 1000 || Number.isInteger(v) ? v.toLocaleString("en") : String(+v.toFixed(2)));

/* SHAPES: the verdict is in the shape and the word; colour only echoes it. */
function mark(kind, size = 14) {
  const s = sv("svg", { viewBox: "0 0 14 14", width: size, height: size, class: "mk m-" + kind, "aria-hidden": "true", focusable: "false" });
  const C = { fill: "currentColor" }, R = { fill: "none", stroke: "currentColor", "stroke-width": "1.8" };
  if (kind === "states") s.append(sv("circle", { cx: 7, cy: 7, r: 5.2, ...C }));
  else if (kind === "near") { s.append(sv("circle", { cx: 7, cy: 7, r: 5.2, ...R })); s.append(sv("path", { d: "M7 1.8a5.2 5.2 0 0 0 0 10.4z", ...C })); }
  else if (kind === "differs") s.append(sv("path", { d: "M7 1 13 7 7 13 1 7z", ...C }));
  else if (kind === "silent") s.append(sv("circle", { cx: 7, cy: 7, r: 4.8, ...R }));
  else if (kind === "nothing") s.append(sv("circle", { cx: 7, cy: 7, r: 4.8, fill: "none", stroke: "currentColor", "stroke-width": "2.6" }));
  else if (kind === "none") s.append(sv("circle", { cx: 7, cy: 7, r: 4.8, ...R, "stroke-dasharray": "2.2 2.2" }));
  else if (kind === "told") { s.append(sv("circle", { cx: 7, cy: 7, r: 5.4, ...R })); s.append(sv("path", { d: "M4.3 7.2 6.3 9.2 9.9 5", ...R })); }
  return s;
}
const READ = { states: "says it", near: "close, not the same", contradicts: "reads differently", silent: "silent" };
const SHAPE_OF = { states: "states", near: "near", contradicts: "differs", silent: "silent" };
const STAND = { stands: ["states", "stands"], close: ["near", "close, not exact"], differs: ["differs", "pages read it differently"], nothing: ["nothing", "nothing it read says this"], none: ["none", "could not be tested"] };
const CATOF = { corroborated: "stands", held: "stands", weak: "close", contested: "differs", unsupported: "nothing" };

/* the site's own body face for borrowed text (subset of SITE_TYPE in fold-chat-present.js) and a letter tile */
const FAV = { "wikipedia.org": ["W", "#ffffff", "#202122"], "britannica.com": ["B", "#0f4c81", "#ffffff"], "history.com": ["H", "#111111", "#ffffff"], "sparknotes.com": ["S", "#0b2a4a", "#ffffff"], "nationalgeographic.com": ["N", "#ffce00", "#000000"], "ncbi.nlm.nih.gov": ["N", "#20558a", "#ffffff"] };
function favOf(domain) { for (const k of Object.keys(FAV)) if (domain === k || domain.endsWith("." + k)) return FAV[k]; return [(domain[0] || "?").toUpperCase(), "var(--card)", "var(--ink)"]; }
function fav(domain) { const [l, bg, fg] = favOf(domain); const e = h("span", { class: "fav", "aria-hidden": "true" }, l); e.style.background = bg; e.style.color = fg; return e; }
const isWiki = (d) => /wikipedia\.org$/.test(d);
function quote(text, cls, ...kids) { return h("div", { class: "q" + (cls ? " " + cls : "") }, text, kids); }

/* STATE lives in the hash so a view can be linked and screenshotted: #face=figure&turn=real-a:1&claim=0 */
const S = (() => { const o = { face: "figure", turn: D.turns[0].id, claim: "0", sel: "", step: "" }; for (const p of location.hash.slice(1).split("&")) { const [k, v] = p.split("="); if (k) o[k] = decodeURIComponent(v || ""); } return o; })();
function save() { try { history.replaceState(null, "", "#" + Object.entries(S).filter(([, v]) => v !== "" && v != null).map(([k, v]) => k + "=" + encodeURIComponent(v)).join("&")); } catch {} }
const turnOf = () => D.turns.find((t) => t.id === S.turn) || D.turns[0];

const STAGES = [
  { k: "def", file: "def.html", row: "Pin down", op: "DEF", mode: "Differentiate", plain: "What is claimed" },
  { k: "eva", file: "eva.html", row: "Compare", op: "EVA", mode: "Relate", plain: "What it was compared with" },
  { k: "rec", file: "rec.html", row: "Settle", op: "REC", mode: "Generate", plain: "Where it stands" },
];
const GRAINS = [
  { k: "ground", grain: "Ground", terrain: "Atmosphere", stance: { def: "Clearing", eva: "Tending", rec: "Cultivating" } },
  { k: "figure", grain: "Figure", terrain: "Lens", stance: { def: "Dissecting", eva: "Binding", rec: "Making" } },
  { k: "pattern", grain: "Pattern", terrain: "Paradigm", stance: { def: "Unraveling", eva: "Tracing", rec: "Composing" } },
];

let railEl, mainEl, capEl, subEl, tabsEl, crumbEl, layoutEl, legEl, CFG;
function setRail(node, title) {
  railEl.replaceChildren();
  if (!node) { railEl.classList.remove("open"); railEl.classList.toggle("empty", !CFG.railHint); if (CFG.railHint) railEl.append(h("h3", null, "Reader"), h("p", { class: "none" }, CFG.railHint)); return; }
  railEl.classList.remove("empty");
  railEl.append(h("button", { class: "x", type: "button", onclick: () => { S.sel = ""; save(); setRail(null); mainEl.querySelectorAll("[aria-pressed=true]").forEach((b) => b.setAttribute("aria-pressed", "false")); } }, "Close"), h("h3", null, title || "Reader"), node);
  railEl.classList.add("open");
}
function render() {
  const f = CFG.faces.find((x) => x.k === S.face) || CFG.faces[1];
  const t = turnOf();
  tabsEl.querySelectorAll("[role=tab]").forEach((b) => { const on = b.dataset.k === f.k; b.setAttribute("aria-selected", on); b.tabIndex = on ? 0 : -1; });
  crumbEl.querySelector("[aria-current]").textContent = f.label;
  capEl.textContent = f.caption(t);
  subEl.textContent = f.sub || "";
  mainEl.replaceChildren(f.render(t));
  if (S.sel && f.select) f.select(t, S.sel); else setRail(null);
  layoutEl.classList.toggle("solo", !!f.solo); railEl.hidden = !!f.solo;
  legEl.replaceChildren(...(f.legend ? f.legend(t) : []));
  document.title = `${CFG.title} · ${f.label} · ${t.label}`;
  save();
}
function boot(cfg) {
  CFG = cfg;
  const st = STAGES.find((x) => x.k === cfg.k);
  const mock = h("div", { class: "mock" },
    h("span", null, "Mock · real recorded turns"),
    h("label", null, "Turn ", h("select", { id: "turn", "aria-label": "Recorded turn" }, D.turns.map((t) => h("option", { value: t.id }, t.label)))),
    h("span", { class: "sp" }),
    h("button", { type: "button", id: "theme", "aria-label": "Colour scheme" }, "Theme: auto"));
  crumbEl = h("nav", { class: "crumbs", "aria-label": "Breadcrumb" }, h("ol", null, h("li", null, "Answer"), h("li", null, "Checks"), h("li", null, st.plain), h("li", { "aria-current": "page" }, "")));
  const jump = h("details", { class: "jump" }, h("summary", null, "Jump ▾"), h("div", { class: "pan" },
    h("table", null, h("thead", null, h("tr", null, h("th"), GRAINS.map((g) => h("th", null, g.grain, h("small", null, g.terrain))))),
      h("tbody", null, STAGES.map((s) => h("tr", null, h("th", null, s.row, h("small", null, `${s.op} · ${s.mode}`)),
        GRAINS.map((g) => { const f = (window.ALLFACES || {})[s.k + "." + g.k]; const cur = s.k === cfg.k; return h("td", null, h("a", { href: `${s.file}#face=${g.k}&turn=${encodeURIComponent(S.turn)}`, "aria-current": cur && g.k === S.face ? "page" : null, "data-cell": s.k + "." + g.k }, f || g.grain)); }))))),
    h("p", null, "Interpretation is one face of the cube. Existence (steps 1 to 3) and Structure (steps 4 to 6) have the same three grains.")));
  const top = h("div", { class: "top" }, crumbEl, jump);
  tabsEl = h("div", { class: "tabs", role: "tablist", "aria-label": `${st.plain}: three faces` }, cfg.faces.map((f) => {
    const g = GRAINS.find((x) => x.k === f.k);
    return h("button", { class: "tab", role: "tab", type: "button", "data-k": f.k, id: "tab-" + f.k, "aria-controls": "panel", onclick: () => { S.face = f.k; S.sel = ""; setRail(null); render(); } }, h("b", null, f.label), h("small", null, `${g.terrain} · ${g.stance[cfg.k]}`));
  }));
  tabsEl.addEventListener("keydown", (e) => { const ks = cfg.faces.map((f) => f.k); let i = ks.indexOf(S.face); if (e.key === "ArrowRight") i = (i + 1) % 3; else if (e.key === "ArrowLeft") i = (i + 2) % 3; else if (e.key === "Home") i = 0; else if (e.key === "End") i = 2; else return; e.preventDefault(); S.face = ks[i]; S.sel = ""; setRail(null); render(); tabsEl.querySelector(`[data-k=${ks[i]}]`).focus(); });
  capEl = h("p", { class: "caption", "aria-live": "polite" });
  subEl = h("p", { class: "sub" });
  mainEl = h("div", { class: "main", role: "tabpanel", id: "panel", tabindex: "-1" });
  railEl = h("aside", { class: "rail", "aria-label": "Reader" });
  layoutEl = h("div", { class: "layout" }, mainEl, railEl);
  legEl = h("div", { class: "lg", "aria-label": "Key" });
  const wrap = h("div", { class: "wrap" }, top, tabsEl, capEl, subEl, layoutEl, legEl);
  document.body.append(mock, wrap);
  const sel = document.getElementById("turn"); sel.value = S.turn;
  sel.onchange = () => { S.turn = sel.value; S.claim = "0"; S.sel = ""; S.step = ""; setRail(null); render(); };
  const th = document.getElementById("theme"); const modes = ["auto", "light", "dark"]; let mi = 0;
  const applyTheme = () => { const m = modes[mi]; if (m === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", m); th.textContent = "Theme: " + m; };
  th.onclick = () => { mi = (mi + 1) % 3; applyTheme(); };
  const q = new URLSearchParams(location.search).get("theme"); if (q && modes.includes(q)) { mi = modes.indexOf(q); applyTheme(); }
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && railEl.classList.contains("open") && matchMedia("(max-width:899px)").matches) { S.sel = ""; setRail(null); } });
  window.addEventListener("hashchange", () => { for (const p of location.hash.slice(1).split("&")) { const [k, v] = p.split("="); if (k) S[k] = decodeURIComponent(v || ""); } sel.value = S.turn; render(); });
  setRail(null); render();
}
/* every face's label, shared so the jump grid names each cell the same way on all three pages */
window.ALLFACES = { "def.ground": "Setting", "def.figure": "This claim", "def.pattern": "Whose words", "eva.ground": "The ground", "eva.figure": "This claim", "eva.pattern": "Which tests ran", "rec.ground": "Going back", "rec.figure": "This claim", "rec.pattern": "Did going back help" };
const claimOf = (t) => t.claims[Math.min(+S.claim || 0, t.claims.length - 1)];
function pressed(id) { mainEl.querySelectorAll("[data-id]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id))); }
function pick(id) { S.sel = id; save(); const f = CFG.faces.find((x) => x.k === S.face); f.select(turnOf(), id); }
function claimPicker(t) {
  if (t.claims.length < 2) return null;
  return h("div", { class: "seg", role: "group", "aria-label": "Sentence of the answer", style: "margin:0 0 10px" }, t.claims.map((c, i) => h("button", { class: "btn", type: "button", "aria-pressed": String(+S.claim === i), onclick: () => { S.claim = String(i); S.sel = ""; setRail(null); render(); } }, "s" + (i + 1))));
}
function srcOf(t, key) { return t.sources.find((s) => s.key === key) || { key, domain: key, title: key, url: "" }; }
function openLink(url) { return url ? h("a", { href: url, target: "_blank", rel: "noopener", style: "font-size:13px" }, "open the page ↗") : null; }
