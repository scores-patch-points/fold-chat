/* shared shell: theme, turn switch, caption, the three-face dial, breadcrumbs, and the source reader sheet.
   Every string in a quoted position is read from the embedded recorded turn (textContent only, never HTML). */
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const svgEl = (tag, attrs = {}) => { const e = document.createElementNS("http://www.w3.org/2000/svg", tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const plural = (n, w, pl) => `${n} ${n === 1 ? w : (pl || w + "s")}`;
const norm = (w) => String(w).toLowerCase().replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "").replace(/[’]/g, "'");
const words = (s) => String(s).split(/\s+/).filter(Boolean);
const num = (n) => (n == null ? "?" : Number(n).toLocaleString("en"));

// the sites' own type (a copy of the three entries of fold-chat-present.js SITE_TYPE the recorded turns touch)
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Lato,'Helvetica Neue',Helvetica,Arial,sans-serif", SERIF = "Georgia,'Times New Roman',serif";
const NEUTRAL = { bg: "#ffffff", ink: "#202122", title: SERIF, titleWeight: "400", body: SERIF, bodySize: "16px", fav: "", favBg: "#f1f1f4", favFg: "#44444e" };
const SITE_TYPE = {
  "wikipedia.org": { ...NEUTRAL, title: "'Linux Libertine',Georgia,'Times',serif", body: SANS, fav: "W", favBg: "#ffffff", favFg: "#202122" },
  "britannica.com": { ...NEUTRAL, ink: "#1a1a1a", titleWeight: "700", fav: "B", favBg: "#0f4c81", favFg: "#ffffff" },
  "bbc.co.uk": { ...NEUTRAL, title: SANS, titleWeight: "700", body: SANS, fav: "B", favBg: "#000000", favFg: "#ffffff" },
  "sciencefocus.com": { ...NEUTRAL, title: SANS, titleWeight: "700", body: SANS, fav: "S", favBg: "#bb1919", favFg: "#ffffff" },
};
const typeOf = (domain) => { const d = String(domain || "").toLowerCase().replace(/^www\./, ""); for (const k of Object.keys(SITE_TYPE)) if (d === k || d.endsWith("." + k)) return SITE_TYPE[k]; return { ...NEUTRAL, fav: (d.charAt(0) || "?").toUpperCase() }; };
function fav(domain, cls = "") { const ty = typeOf(domain); const f = el("span", "fav " + cls, ty.fav); f.style.background = ty.favBg; f.style.color = ty.favFg; f.setAttribute("aria-hidden", "true"); return f; }

const DATA = window.__DATA__; const STAGE = window.__STAGE__;
const state = { t: 0, f: STAGE.defaultFace ?? 1, focus: null, sheet: null, bind: 0, anim: true, ...(STAGE.state || {}) };
const turn = () => DATA[state.t];
const nm = (s, max = 30) => { const dup = turn().sources.filter((x) => x.domain === s.domain).length > 1; if (!dup) return s.domain; const t = String(s.title || "").replace(/\s+[-\u2013|]\s+(Simple English )?Wikipedia.*$/i, "").trim(); return clip(`${s.domain.replace(/^en\./, "")} \u00b7 ${t}`, max); };
const api = { nm, el, svgEl, clip, plural, norm, words, num, fav, typeOf, state, turn, openSheet: (a) => openSheet(a), go: (f, focus) => go(f, focus), rerender: () => paint(false), focusRow: (sel) => requestAnimationFrame(() => { const n = $(sel); if (n) n.scrollIntoView({ block: "nearest", behavior: "auto" }); }) };

// ---------------------------------------------------------------- shell
const root = el("div", "wrap"); document.body.append(root);
const topbar = el("div", "top"); const stg = el("span", "stg"); stg.append(el("b", "", STAGE.glyph), `${STAGE.id} ${STAGE.n}/9`);
const turnsEl = el("div", "turns"); turnsEl.setAttribute("role", "group"); turnsEl.setAttribute("aria-label", "Recorded turn");
const themeBtn = el("button", "themebtn", "◐"); themeBtn.type = "button"; themeBtn.setAttribute("aria-label", "Switch colour theme");
topbar.append(stg, el("span", "spacer"), turnsEl, themeBtn);
const caption = el("h1", "caption"); caption.style.margin = "6px 0 14px";
const dial = el("div", "dial"); dial.setAttribute("role", "tablist"); dial.setAttribute("aria-label", "Face of this step");
const what = el("p", "what"); const crumbs = el("ol", "crumbs"); crumbs.setAttribute("aria-label", "Where you are");
const layout = el("div", "layout"); const stage = el("div", "stage"); stage.id = "panel"; stage.setAttribute("role", "tabpanel"); stage.tabIndex = -1;
const sheet = el("aside", "sheet"); sheet.setAttribute("role", "dialog"); sheet.setAttribute("aria-label", "Source text"); sheet.id = "sheet";
const scrim = el("div", "scrim"); scrim.addEventListener("click", () => closeSheet());
layout.append(stage, sheet);
const foot = el("p", "foot"); foot.textContent = STAGE.foot || "";
root.append(topbar, caption, dial, what, crumbs, layout, foot); document.body.append(scrim);

themeBtn.addEventListener("click", () => {
  const cur = document.documentElement.dataset.theme; const sys = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  const next = (cur || sys) === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = next; try { localStorage.setItem("pb-theme", next); } catch {}
});
try { const t = localStorage.getItem("pb-theme"); if (t) document.documentElement.dataset.theme = t; } catch {}

const TL = { wall: "Great Wall", t0: "Telephone", t1: "Eiffel", t2: "President" };
DATA.forEach((d, i) => { const b = el("button", "", TL[d.id] || d.label); b.type = "button"; b.addEventListener("click", () => { state.t = i; state.focus = null; state.bind = 0; closeSheet(true); paint(true); }); turnsEl.append(b); });
STAGE.faces.forEach((fc, i) => {
  const b = el("button"); b.type = "button"; b.setAttribute("role", "tab"); b.id = "tab" + i; b.setAttribute("aria-controls", "panel");
  b.append(el("span", "n", fc.name), el("span", "c", fc.cell));
  b.addEventListener("click", () => go(i));
  b.addEventListener("keydown", (e) => { if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const n = (state.f + (e.key === "ArrowRight" ? 1 : 2)) % 3; go(n); $("#tab" + n).focus(); } });
  dial.append(b);
});

function go(f, focus) { state.f = f; if (focus !== undefined) state.focus = focus; state.anim = true; paint(true); }
function paint(flip) {
  const d = turn();
  [...turnsEl.children].forEach((b, i) => b.setAttribute("aria-pressed", String(i === state.t)));
  [...dial.children].forEach((b, i) => { const on = i === state.f; b.setAttribute("aria-selected", String(on)); b.tabIndex = on ? 0 : -1; });
  stage.setAttribute("aria-labelledby", "tab" + state.f);
  const c = STAGE.caption(d, state); caption.textContent = c.title; if (c.sub) caption.append(el("small", "", c.sub));
  const fc = STAGE.faces[state.f]; what.textContent = fc.blurb;
  crumbs.replaceChildren();
  const add = (label, fn) => { const li = el("li"); const b = el("button", "", label); b.type = "button"; b.addEventListener("click", fn); li.append(b); crumbs.append(li); };
  add(clip(d.label, 40), () => { state.focus = null; closeSheet(true); go(STAGE.defaultFace ?? 1, null); });
  add(fc.name, () => { state.focus = null; paint(true); });
  const fl = STAGE.crumb ? STAGE.crumb(d, state) : []; fl.forEach((x) => add(x, () => { if (state.focus) openSheet(state.focus); }));
  stage.replaceChildren(STAGE.render[state.f](d, state, api));
  if (flip) { stage.classList.remove("flip"); void stage.offsetWidth; stage.classList.add("flip"); }
  state.anim = false;
  if (STAGE.after) STAGE.after(state, api);
  syncHash();
}

// ---------------------------------------------------------------- the reader sheet
let opener = null, openerIdx = -1; const FOC = "button, [role=button], [tabindex=\"0\"]";
function openSheet(atom) {
  const d = turn(); const s = d.sources[atom.src]; if (!s) return;
  opener = document.activeElement; openerIdx = [...stage.querySelectorAll(FOC)].indexOf(opener); state.sheet = { ...atom, cur: atom.lines ? atom.lines[0] : atom.line ?? 0 };
  state.focus = { src: atom.src, line: state.sheet.cur, lines: atom.lines || [state.sheet.cur], bold: atom.bold || [], label: atom.label };
  drawSheet(); document.body.classList.add("sheet-open");
  if (document.body.dataset.noscroll !== "1") sheet.querySelector(".sh-x").focus({ preventScroll: true });
  paintSoft(); syncHash();
}
function closeSheet(silent) {
  if (!document.body.classList.contains("sheet-open")) return;
  document.body.classList.remove("sheet-open"); state.sheet = null; syncHash();
  if (!silent) { paintSoft(); const f = [...stage.querySelectorAll(FOC)][openerIdx]; if (f) f.focus({ preventScroll: true }); else stage.focus({ preventScroll: true }); }
}
function paintSoft() { // re-render the face so a focused row shows its outline (no flip)
  const y = scrollY; stage.replaceChildren(STAGE.render[state.f](turn(), state, api)); crumbs.replaceChildren();
  const d = turn(); const fc = STAGE.faces[state.f];
  const add = (label, fn) => { const li = el("li"); const b = el("button", "", label); b.type = "button"; b.addEventListener("click", fn); li.append(b); crumbs.append(li); };
  add(clip(d.label, 40), () => { state.focus = null; closeSheet(true); go(STAGE.defaultFace ?? 1, null); });
  add(fc.name, () => { state.focus = null; closeSheet(true); paint(true); });
  (STAGE.crumb ? STAGE.crumb(d, state) : []).forEach((x) => add(x, () => { if (state.focus) openSheet(state.focus); }));
  scrollTo(0, y); if (STAGE.after) STAGE.after(state, api);
}
function drawSheet() {
  const d = turn(); const a = state.sheet; const s = d.sources[a.src]; const ty = typeOf(s.domain); const L = s.lines;
  sheet.replaceChildren();
  const grip = el("div", "grip"); const h = el("div", "sh-h"); const t = el("div", "t");
  t.append(el("b", "", s.domain), el("span", "", s.title || s.site));
  const x = el("button", "sh-x", "✕"); x.type = "button"; x.setAttribute("aria-label", "Close source"); x.addEventListener("click", () => closeSheet());
  h.append(fav(s.domain), t, x);
  const pos = el("div", "sh-pos");
  const keptTxt = s.kept != null && s.chars != null ? `kept ${num(s.kept)} of ${num(s.chars)} characters of this page` : "kept lines of this page";
  pos.textContent = `line ${a.cur + 1} of ${L.length} kept · ${keptTxt}${s.clipped ? " · the tape holds only its first 900 characters" : ""}`;
  const body = el("div", "sh-body"); const paper = el("div", "paper"); paper.style.background = ty.bg; paper.style.color = ty.ink; paper.style.fontFamily = ty.body;
  const para = (i, cls) => { const p = el("p", cls); p.textContent = L[i].t; return p; };
  const showLines = a.lines ? Array.from({ length: a.lines[1] - a.lines[0] + 1 }, (_, k) => a.lines[0] + k) : [a.cur];
  if (showLines[0] > 0) paper.append(para(showLines[0] - 1, "ctx")); else paper.append(el("p", "gapn", "\u2014 start of the kept text \u2014"));
  const cur = el("div", "cur");
  showLines.forEach((i, k) => { const p = el("p"); fillBold(p, L[i].t, a.bold || []); if (k) p.style.marginTop = "6px"; cur.append(p); });
  paper.append(cur);
  const last = showLines[showLines.length - 1];
  if (last < L.length - 1) paper.append(para(last + 1, "ctx")); else paper.append(el("p", "gapn", "\u2014 end of the kept text \u2014"));
  paper.append(el("p", "gapn", s.chars != null ? `the page is ${num(s.chars)} characters; these ${L.length} kept lines are what the turn kept of it` : ""));
  body.append(paper);
  const nav = el("div", "sh-nav");
  const prev = el("button", "pn", "◂"); prev.type = "button"; prev.setAttribute("aria-label", "Previous kept line"); prev.disabled = Math.min(...showLines) <= 0;
  const next = el("button", "pn", "▸"); next.type = "button"; next.setAttribute("aria-label", "Next kept line"); next.disabled = Math.max(...showLines) >= L.length - 1;
  const step = (dlt) => { const base = dlt < 0 ? Math.min(...showLines) : Math.max(...showLines); state.sheet = { ...a, cur: base + dlt, lines: undefined, bold: [] }; state.focus = { ...state.focus, line: state.sheet.cur, lines: [state.sheet.cur], bold: [] }; drawSheet(); sheet.querySelector(dlt < 0 ? ".pn:first-child" : ".pn:last-child").focus({ preventScroll: true }); };
  prev.addEventListener("click", () => step(-1)); next.addEventListener("click", () => step(1));
  const ticks = el("div", "ticks"); ticks.setAttribute("role", "group"); ticks.setAttribute("aria-label", "Kept lines of this page");
  const marks = STAGE.lineMarks ? STAGE.lineMarks(d, a.src) : new Set();
  L.forEach((_, i) => { const b = el("button"); b.type = "button"; b.setAttribute("aria-label", `line ${i + 1}${marks.has(i) ? ", used by this step" : ""}`); if (marks.has(i)) b.classList.add("mk"); if (showLines.includes(i)) b.classList.add("on"); b.addEventListener("click", () => { state.sheet = { ...a, cur: i, lines: undefined, bold: [] }; state.focus = { ...state.focus, line: i, lines: [i], bold: [] }; drawSheet(); }); ticks.append(b); });
  nav.append(prev, ticks, next);
  const f = el("div", "sh-f"); f.append(el("span", "", "See this as"));
  STAGE.faces.forEach((fc, i) => { const b = el("button", "", fc.name); b.type = "button"; if (i === state.f) { b.disabled = true; b.setAttribute("aria-current", "true"); } b.addEventListener("click", () => { go(i); }); f.append(b); });
  f.append(el("span", "sp"));
  const link = el("a", "", "open page ↗"); link.href = s.url + (a.bold && a.bold[0] ? "#:~:text=" + encodeURIComponent(words(a.bold[0]).slice(0, 6).join(" ")) : ""); link.target = "_blank"; link.rel = "noopener noreferrer"; f.append(link);
  sheet.append(grip, h, pos, body, nav, f);
}
function fillBold(p, text, bolds) {
  const spans = []; for (const b of bolds) { const k = text.toLowerCase().indexOf(String(b).toLowerCase()); if (k >= 0) spans.push([k, k + String(b).length]); }
  spans.sort((x, y) => x[0] - y[0]); let at = 0;
  for (const [a, b] of spans) { if (a < at) continue; if (a > at) p.append(text.slice(at, a)); p.append(el("b", "", text.slice(a, b))); at = b; }
  if (at < text.length) p.append(text.slice(at));
}
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeSheet(); });
sheet.addEventListener("keydown", (e) => { if (e.target.closest(".sh-nav") && (e.key === "ArrowLeft" || e.key === "ArrowRight")) { const b = sheet.querySelector(e.key === "ArrowLeft" ? ".pn:first-child" : ".pn:last-child"); if (b && !b.disabled) { e.preventDefault(); b.click(); } } });

// ---------------------------------------------------------------- hash <-> state (deep links; also used for the screenshots)
function syncHash() { const p = new URLSearchParams(); p.set("t", state.t); p.set("f", state.f); if (state.bind) p.set("b", state.bind); if (state.sheet) p.set("o", `${state.sheet.src}.${state.sheet.cur}`); try { history.replaceState(null, "", "#" + p); } catch {} }
(function readHash() {
  const p = new URLSearchParams(location.hash.slice(1)); if (p.has("t")) state.t = Math.min(DATA.length - 1, +p.get("t") || 0); if (p.has("f")) state.f = Math.min(2, +p.get("f") || 0); if (p.has("b")) state.bind = +p.get("b") || 0;
  paint(false);
  if (p.has("o")) { const [s, l] = p.get("o").split(".").map(Number); const first = STAGE.hashAtom ? STAGE.hashAtom(turn(), s, l) : { src: s, line: l }; document.body.dataset.noscroll = "1"; openSheet(first); delete document.body.dataset.noscroll; }
})();
window.__pb = { state, go, openSheet, closeSheet, paint: () => paint(false) };
