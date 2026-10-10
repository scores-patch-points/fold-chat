/* kernel.js — everything the four stacking models share: the recorded turns, the chat, the five layer kinds, the stack, the
   History API contract, focus / inert / announcements, the return pill. A model only decides WHERE a layer sits and HOW it arrives.
   Every string from a page or a record goes in as textContent. Site looks are the twelve validated tokens (sitestyle.mjs), nothing else. */
(() => {
const DATA = window.__DATA__, CFG = window.__CFG__ || {};
const SC = Object.fromEntries(DATA.scenarios.map((s) => [s.id, s]));
const ORDER = ["t0", "wall", "nose", "curie"].filter((id) => SC[id]);
const MAXDEPTH = 8;
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const num = (n) => (n == null ? "?" : Number(n).toLocaleString("en"));
const act = (node, fn) => { node.addEventListener("click", (e) => { e.preventDefault(); fn(node, e); }); node.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fn(node, e); } }); };

// ---------------------------------------------------------------- theme + site looks
const root = document.documentElement;
const qs = new URLSearchParams(location.search);
let theme = qs.get("theme") === "dark" || (!qs.get("theme") && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
root.dataset.theme = theme;
const COL = /^#[0-9a-f]{6}$/, FONT = /^(?:"[A-Za-z ]{3,24}", )?[-A-Za-z0-9 ",]{10,170}$/;
const srcOfL = (L) => SC[L.turn].sources[L.src];
function applyLook(node, look) {
  const t = look && look[theme] && look[theme].tokens; if (!t) return;
  const ok = ["paper", "ink", "muted", "link", "rule", "accent"].every((k) => COL.test(t[k])) && FONT.test(t.bodyFont) && FONT.test(t.titleFont) && /^(300|400|500|600|700|800)$/.test(String(t.titleWeight)) && /^(none|uppercase|capitalize)$/.test(t.titleCase) && Number.isInteger(t.measure) && Number.isInteger(t.radius);
  if (!ok) return;                                          // an unvalidated token never reaches a style
  const s = node.style;
  s.setProperty("--s-paper", t.paper); s.setProperty("--s-ink", t.ink); s.setProperty("--s-muted", t.muted); s.setProperty("--s-link", t.link); s.setProperty("--s-rule", t.rule); s.setProperty("--s-accent", t.accent);
  s.setProperty("--s-body", t.bodyFont); s.setProperty("--s-title", t.titleFont); s.setProperty("--s-tw", String(t.titleWeight)); s.setProperty("--s-tcase", t.titleCase);
  s.setProperty("--s-measure", t.measure + "ch"); s.setProperty("--s-radius", t.radius + "px");
}
function wear(node, src) { node.classList.add("wear"); node.dataset.look = ""; node._look = src.look; applyLook(node, src.look); return node; }
function relook() { document.querySelectorAll("[data-look]").forEach((n) => applyLook(n, n._look)); }
const shortOf = (src) => String(src.site || src.domain).replace(/^www\./, "");
function fav(src) { const f = el("span", "fav", src.look.fav.ch); f.style.background = src.look.fav.bg; f.style.color = src.look.fav.fg; f.setAttribute("aria-hidden", "true"); return f; }

// ---------------------------------------------------------------- layer descriptors, labels, hash
const KIND = { c: "Evidence", p: "Passage", g: "Page as kept", e: "Elsewhere", s: "Source site" };
const srcOfDesc = (L) => (L.src != null ? SC[L.turn].sources[L.src] : null);
function labelOf(L) {
  switch (L.k) {
    case "c": return `Claim ${L.claim + 1}`;
    case "p": return shortOf(srcOfDesc(L));
    case "g": return shortOf(srcOfDesc(L)) + " page";
    case "e": return L.name;
    case "s": return srcOfDesc(L).domain;
  }
}
function titleOf(L) {
  switch (L.k) {
    case "c": return `Claim ${L.claim + 1}: what states it`;
    case "p": return `${shortOf(srcOfDesc(L))}: the passage`;
    case "g": return `${shortOf(srcOfDesc(L))}: the page, as the fold kept it`;
    case "e": return `“${L.name}” in the other places`;
    case "s": return srcOfDesc(L).domain;
  }
}
const ser = (L) => ({ k: L.k, turn: L.turn, claim: L.claim, src: L.src, line: L.line, name: L.name, hl: L.hl, id: L.id });
const encL = (L) => [L.k, L.turn, L.k === "c" ? L.claim : L.k === "e" ? encodeURIComponent(L.name) : L.src, L.line ?? ""].join("~").replace(/~$/, "");
function decL(s) {
  const [k, turn, a, line] = s.split("~"); if (!SC[turn] || !KIND[k]) return null;
  if (k === "c") { const claim = +a; return SC[turn].claims[claim] ? { k, turn, claim } : null; }
  if (k === "e") { const name = decodeURIComponent(a); return SC[turn].entities.some((e) => e.label === name) ? { k, turn, name } : null; }
  const src = +a; return SC[turn].sources[src] ? { k, turn, src, line: line === "" ? undefined : +line } : null;
}
const hashOf = (stack) => (stack.length ? "#/" + stack.map(encL).join("/") : "#/");
const parseHash = () => (location.hash.startsWith("#/") ? location.hash.slice(2).split("/").filter(Boolean).map(decL).filter(Boolean) : []);

// ---------------------------------------------------------------- renderers (content of each layer kind)
function quote(sentence, phrases, cls = "q") {
  const q = el("div", cls); const low = sentence.toLowerCase(); const rs = [];
  for (const p of phrases || []) { const i = low.indexOf(String(p).toLowerCase()); if (i >= 0 && p.length < sentence.length * 0.9) rs.push([i, i + p.length]); }
  rs.sort((a, b) => a[0] - b[0]); const m = [];
  for (const r of rs) { const last = m[m.length - 1]; if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]); else m.push([...r]); }
  let at = 0; for (const [a, b] of m) { if (a > at) q.append(sentence.slice(at, a)); q.append(el("b", "ph", sentence.slice(a, b))); at = b; }
  q.append(sentence.slice(at)); return q;
}
function withEntity(text, name, tag = "span") {
  const out = el(tag); if (!name) { out.textContent = text; return out; }
  let at = 0, i; while ((i = text.indexOf(name, at)) >= 0) { out.append(text.slice(at, i)); out.append(el("b", "en", name)); at = i + name.length; }
  out.append(text.slice(at)); return out;
}
function atomsEl(a) {
  if (!a) return el("div", "noatoms", "atoms: not cut for this sentence");
  const w = el("div", "atoms"); w.setAttribute("aria-label", "Subject, verb, object as cut from the sentence");
  for (const [key, lab] of [["s", "subject"], ["v", "verb"], ["o", "object"]]) {
    const txt = (a[key] || []).slice(0, 2).join(" · "); if (!txt) continue;
    const at = el("span", "atom"); at.append(el("i", "", lab), el("span", "", clip(txt, 60))); w.append(at);
  }
  if (!w.children.length) return el("div", "noatoms", "atoms: none found in this sentence");
  return w;
}
function evRow(srcId, turnId, sentence, phrases, atoms, onOpen, goLabel = "Passage ›") {
  const sc = SC[turnId], src = sc.sources[srcId];
  const row = el("div", "ev"); row.setAttribute("role", "button"); row.tabIndex = 0; wear(row, src);
  row.setAttribute("aria-label", `${shortOf(src)}: ${clip(sentence, 90)}. Open the passage.`);
  const top = el("div", "ev-top"); top.append(fav(src), el("span", "", shortOf(src))); if (src.domain !== shortOf(src)) top.append(el("span", "dom", src.domain)); top.append(el("span", "go", goLabel)); row.append(top);
  row.append(quote(sentence, phrases));
  if (atoms !== undefined) row.append(atomsEl(atoms));
  act(row, () => onOpen(row)); return row;
}
function namesRail(L, src, hl) {
  const sc = SC[L.turn]; const ents = sc.entities.filter((e) => e.srcs.includes(src.id)).slice(0, 5);
  if (!ents.length) return null;
  const w = el("div", "names"); w.append(el("span", "nk", "Names here that appear elsewhere"));
  const l = el("div", "nl"); w.append(l);
  for (const e of ents) { const b = el("button", "nm" + (hl === e.label ? " on" : "")); b.type = "button"; b.append(e.label, el("small", "", plural(e.srcs.length, "source"))); b.setAttribute("aria-label", `${e.label}: appears in ${plural(e.srcs.length, "source")}. Open the other places.`); b.addEventListener("click", () => Nav.open({ k: "e", turn: L.turn, name: e.label }, b)); l.append(b); }
  return w;
}
function rCard(L, into) {
  const sc = SC[L.turn], c = sc.claims[L.claim];
  into.append(el("div", "c-kicker", `Claim ${L.claim + 1} of ${sc.claims.length} · ${plural(c.rows.length, "sentence")} in ${plural(new Set(c.rows.map((r) => r.src)).size, "source")}`));
  into.append(el("p", "c-claim", c.text));
  const st = el("p", "c-state" + (c.grounded ? "" : " warn"), c.grounded ? "A sentence in the pages states this." : "No single sentence states this. The pieces below match in parts: a partial reading.");
  into.append(st);
  for (const r of c.rows) into.append(evRow(r.src, L.turn, r.sentence, r.phrases, r.atoms, (row) => Nav.open({ k: "p", turn: L.turn, src: r.src, line: r.line }, row)));
}
function rPassage(L, into) {
  const sc = SC[L.turn], src = sc.sources[L.src];
  const site = el("div", "p-site"); site.append(fav(src), el("b", "", shortOf(src)), el("span", "dom", src.domain)); into.append(site);
  into.append(el("h1", "p-title w-title", src.title));
  const from = Math.max(0, L.line - 1), to = Math.min(src.lines.length - 1, L.line + 1);
  if (from > 0) into.append(el("div", "p-gap", "…"));
  for (let i = from; i <= to; i++) { const p = el("p", "p-line" + (i === L.line ? " anchor" : "")); p.append(withEntity(src.lines[i].t, L.hl)); if (i === L.line) p.id = "anchor"; into.append(p); }
  if (to < src.lines.length - 1) into.append(el("div", "p-gap", "…"));
  const a = el("div", "p-actions");
  const pg = el("button", "btn go", "The whole page ›"); pg.type = "button"; pg.addEventListener("click", () => Nav.open({ k: "g", turn: L.turn, src: L.src, line: L.line, hl: L.hl }, pg));
  const st = el("button", "btn", "The site ›"); st.type = "button"; st.addEventListener("click", () => Nav.open({ k: "s", turn: L.turn, src: L.src, line: L.line }, st));
  a.append(pg, st); into.append(a);
  const nr = namesRail(L, src, L.hl); if (nr) into.append(nr);
}
function rPage(L, into) {
  const sc = SC[L.turn], src = sc.sources[L.src];
  const site = el("div", "p-site"); site.append(fav(src), el("b", "", shortOf(src)), el("span", "dom", src.domain)); into.append(site);
  into.append(el("h1", "p-title w-title", src.title));
  const pct = src.chars ? Math.max(1, Math.round((src.kept / src.chars) * 100)) : null;
  const m = el("div", "meter"); m.append(el("span", "", `A partial reading: the fold kept ${num(src.kept)} of ${num(src.chars)} characters${pct ? ` (${pct}%)` : ""}, ${plural(src.lines.length, "line")}, ${src.via ? "via " + src.via : "as read"}. This is what we have of the page, not the page.`));
  if (pct) { const b = el("span", "bar"); b.append(Object.assign(el("i"), { style: `width:${Math.min(100, pct)}%` })); m.append(b); }
  into.append(m);
  const nr = namesRail(L, src, L.hl); if (nr) { nr.style.margin = "0 0 18px"; into.append(nr); }
  src.lines.forEach((l, i) => { const p = el("p", "p-line" + (i === L.line ? " anchor" : "")); p.append(withEntity(l.t, L.hl)); if (i === L.line) p.id = "anchor"; into.append(p); });
  const a = el("div", "p-actions"); const st = el("button", "btn go", "The site ›"); st.type = "button"; st.addEventListener("click", () => Nav.open({ k: "s", turn: L.turn, src: L.src, line: L.line }, st)); a.append(st); into.append(a);
}
function rEntity(L, into) {
  const sc = SC[L.turn], e = sc.entities.find((x) => x.label === L.name);
  into.append(el("div", "c-kicker", "Where else this appears"));
  into.append(el("h1", "e-h", e.label));
  into.append(el("p", "e-sub", `${plural(e.occ.length, "sentence")} in ${plural(e.srcs.length, "source")} of this answer. Other chat turns that name it: the fold keeps those by address (not modelled here).`));
  for (const sid of e.srcs) {
    const src = sc.sources[sid], occ = e.occ.filter((o) => o.src === sid);
    const g = el("div", "e-grp"); const gh = el("div", "e-gh"); gh.append(fav(src), el("b", "", shortOf(src)), el("span", "dom", src.domain)); g.append(gh);
    const rows = []; occ.forEach((o, i) => {
      const row = el("div", "ev row"); row.setAttribute("role", "button"); row.tabIndex = 0; wear(row, src); row.setAttribute("aria-label", `${shortOf(src)}: ${clip(o.sentence, 90)}. Open the passage.`);
      const top = el("div", "ev-top"); top.append(el("span", "go", "Passage ›")); row.append(top);
      const q = el("div", "q"); q.style.paddingBottom = "12px"; q.append(withEntity(o.sentence, e.label)); row.append(q);
      act(row, () => Nav.open({ k: "p", turn: L.turn, src: o.src, line: o.line, hl: e.label }, row));
      if (i >= 2) row.hidden = true; rows.push(row); g.append(row);
    });
    if (occ.length > 3) { const more = el("button", "e-more", `${occ.length - 2} more in ${shortOf(src)}`); more.type = "button"; more.addEventListener("click", () => { rows.forEach((r) => (r.hidden = false)); more.remove(); }); g.append(more); }
    into.append(g);
  }
}
function rSite(L, into) {
  const sc = SC[L.turn], src = sc.sources[L.src]; const t = src.look[theme];
  const site = el("div", "p-site"); site.append(fav(src), el("span", "", "Source site")); into.append(site);
  into.append(el("h1", "s-dom w-title", src.domain));
  into.append(el("p", "s-sub", src.title));
  const have = el("div", "s-have"); const mine = sc.claims.flatMap((c) => c.rows).filter((r) => r.src === L.src).length;
  have.append("What the fold has of this site: ", el("b", "", `${num(src.kept)} of ${num(src.chars)} characters`), ` of one page, ${plural(src.lines.length, "line")}${mine ? `, ${plural(mine, "sentence")} cited here` : ""}. Read ${src.via ? "via " + src.via : "directly"}.`);
  into.append(have);
  into.append(el("p", "s-no", "Not shown, and not frameable: the live page. Sites refuse to be embedded (X-Frame-Options, frame-ancestors) and the browser will not let us read them across origins. So the layers above are the clipped reading, never the site live."));
  const a = el("div", "p-actions");
  const line = L.line != null ? src.lines[L.line]?.t : null;
  const frag = line ? (SC[L.turn].claims.flatMap((c) => c.rows).find((r) => r.src === L.src && r.line === L.line) || SC[L.turn].entities.flatMap((e) => e.occ).find((o) => o.src === L.src && o.line === L.line) || {}).frag : null;
  const link = (href, text, cls) => { const x = el("a", "btn " + cls, text); x.href = href; x.target = "_blank"; x.rel = "noopener noreferrer"; return x; };
  if (frag) a.append(link(frag, "Open the live page at this sentence ↗", "go"));
  a.append(link(src.url, frag ? "Open the top of the page ↗" : "Open the live page ↗", frag ? "" : "go"));
  into.append(a);
  const own = src.look.basis;
  into.append(el("p", "s-basis", `Typeset after: ${own}. ${t.found} of 12 tokens read from the site (${t.scheme}); the rest from our reading style.`));
  const sw = el("div", "sw"); for (const [n, c] of [["paper", t.tokens.paper], ["ink", t.tokens.ink], ["accent", t.tokens.accent], ["link", t.tokens.link]]) { const s = el("span"); const i = el("i"); i.style.background = c; s.append(i, n); sw.append(s); }
  into.append(sw);
}
const RENDER = { c: rCard, p: rPassage, g: rPage, e: rEntity, s: rSite };
const WEARS = new Set(["p", "g", "s"]);
function buildLayer(L) {
  const r = el("section", "layer " + (WEARS.has(L.k) ? "" : "app")); r.dataset.k = L.k; r.dataset.id = L.id; r.setAttribute("role", "dialog"); r.setAttribute("aria-modal", "true"); r.setAttribute("aria-labelledby", "t" + L.id);
  if (WEARS.has(L.k)) wear(r, srcOfDesc(L));
  const head = el("header", "l-head"); head.dataset.chrome = "head";
  const hm = el("div", "hm"); hm.append(el("span", "hk", `${KIND[L.k]} · layer ${Nav.stack.indexOf(L) + 1}`));
  const h2 = el("h2", "", titleOf(L)); h2.id = "t" + L.id; h2.tabIndex = -1; hm.append(h2); head.append(hm);
  const body = el("div", "l-body"); body.dataset.content = ""; const inn = el("div", "l-in"); body.append(inn); RENDER[L.k](L, inn);
  r.append(head, body); r._body = body; r._h2 = h2; r._head = head; return r;
}

// ---------------------------------------------------------------- the app shell + chat
const app = el("div"); app.id = "app";
const top = el("div", "topbar"); top.dataset.chrome = "app";
const brand = el("span", "brand"); brand.append(el("b", "", "◉"), "the fold");
const themeBtn = el("button", "themebtn", "◐"); themeBtn.type = "button"; themeBtn.setAttribute("aria-label", "Switch colour theme");
top.append(brand, el("span", "sp"), el("span", "mname", CFG.name || ""), themeBtn);
const chat = el("main"); chat.id = "chat"; chat.tabIndex = -1; chat.setAttribute("aria-label", "Chat");
const chatIn = el("div", "chat-in"); chat.append(chatIn);
const composer = el("div", "composer"); composer.dataset.chrome = "app"; const cin = el("div", "in", "Ask the fold…"); composer.append(cin);
app.append(top, chat, composer);
const layersRoot = el("div"); layersRoot.id = "layers";
const live = el("div", "sr"); live.setAttribute("aria-live", "polite"); live.setAttribute("role", "status"); live.id = "live";
const ret = el("nav"); ret.id = "ret"; ret.setAttribute("aria-label", "Return"); ret.hidden = true; ret.dataset.chrome = "ret";
const rb = el("button", "rb"); rb.type = "button"; const rbs = el("span"); rb.append(el("span", "", "‹"), rbs);
const rc = el("button", "rc"); rc.type = "button"; rc.append("Chat", el("span", "rn", "")); rc.hidden = true;
ret.append(rb, rc);
document.body.append(app, layersRoot, ret, live);
themeBtn.addEventListener("click", () => { theme = theme === "dark" ? "light" : "dark"; root.dataset.theme = theme; relook(); Nav.model && Nav.model.layout && Nav.model.layout(Nav.stack, { instant: true }); });

ORDER.forEach((id) => {
  const sc = SC[id]; const t = el("article", "turn"); t.id = "turn-" + id; t.dataset.turn = id;
  t.append(el("div", "ask", sc.ask));
  const ans = el("div", "ans");
  sc.answer.forEach((text, i) => {
    const s = el("div", "sent"); s.append(text + " ");
    const n = sc.claims[i] ? sc.claims[i].rows.length : 0;
    if (n) { const b = el("button", "mark"); b.type = "button"; b.dataset.turn = id; b.dataset.claim = i; b.append(el("i", "", "◉"), String(n)); b.setAttribute("aria-label", `Sentence ${i + 1}: what states it, ${plural(n, "source sentence")}`); b.addEventListener("click", () => Nav.open({ k: "c", turn: id, claim: i }, b)); s.append(b); }
    ans.append(s);
  });
  t.append(ans);
  const srcs = el("div", "srcs");
  sc.sources.forEach((s) => { const c = el("button", "chip"); c.type = "button"; c.dataset.src = s.id; c.append(fav(s), shortOf(s)); c.setAttribute("aria-label", `${shortOf(s)}: open the page as the fold kept it`); c.addEventListener("click", () => Nav.open({ k: "g", turn: id, src: s.id }, c)); srcs.append(c); });
  t.append(srcs);
  if (sc.composed) t.append(el("p", "tag", "COMPOSED DEMO · not a recorded turn: answer = verbatim snips of cached pages"));
  chatIn.append(t);
});

// ---------------------------------------------------------------- the stack
const Nav = {
  stack: [], model: null, models: {}, seq: 0, cache: new Map(), root, layersRoot, app, chat, ret, theme: () => theme, $, el, clip, plural, labelOf, titleOf, SC, ORDER,
  register(m) { this.models[m.id] = m; },
  use(id) {
    if (this.model && this.model.id === id) return;
    const prev = this.model; if (prev && prev.dispose) prev.dispose();
    for (const n of layersRoot.children) { n.removeAttribute("style"); if (n._look) applyLook(n, n._look); }
    this.model = this.models[id]; root.dataset.model = id;
    if (this.model.mount) this.model.mount({ layersRoot, app, ret, Nav: this });
    this.model.layout(this.stack, { instant: true }); this.after();
  },
  layerEl(L) { return layersRoot.querySelector(`[data-id="${L.id}"]`); },
  open(L, trigger) {
    L.id = ++this.seq; L.trigger = trigger || null;
    // a tap in a chat that is still live beside the layers (model D, wide) starts a NEW stack: one history entry, Back restores the old one
    if (this.stack.length && trigger && app.contains(trigger)) { history.pushState({ fold: 1, stack: [ser(L)] }, "", hashOf([L])); this.sync([L]); return; }
    if (this.stack.length >= MAXDEPTH) return;
    this.stack.push(L);
    history.pushState({ fold: 1, stack: this.stack.map(ser) }, "", hashOf(this.stack));
    this.commit({ added: [L], removed: [] });
  },
  back() { if (this.stack.length) history.back(); },
  home() { if (this.stack.length > 1) history.go(-this.stack.length); else if (this.stack.length) history.back(); },
  to(i) { const d = this.stack.length - i; if (d > 0) history.go(-d); },        // i: 0 = chat, 1..n = a layer
  sync(target, opts = {}) {
    let i = 0; while (i < this.stack.length && i < target.length && this.stack[i].id === target[i].id) i++;
    const removed = this.stack.splice(i);
    const added = target.slice(i).map((d) => { const keep = d.id && this.byId && this.byId.get(d.id); const L = keep || { ...d }; if (!L.id) L.id = ++this.seq; this.seq = Math.max(this.seq, L.id); const c = this.cache.get(L.id); if (c) L._scroll = c._scroll; return L; });
    this.stack.push(...added); this.commit({ added, removed, ...opts });
  },
  commit({ added, removed, instant = false }) {
    document.getAnimations().forEach((a) => { try { a.finish(); } catch {} });
    const popped = removed[0] || null;           // the lowest layer that left: its trigger lives in the layer (or chat) that is now on top
    const m = this.model;
    this.byId = this.byId || new Map(); for (const L of added) this.byId.set(L.id, L);
    for (const L of removed) { const n = this.layerEl(L); if (n) L._scroll = n._body.scrollTop; this.cache.set(L.id, L); this.byId.set(L.id, L); }
    const gone = removed.map((L) => this.layerEl(L)).filter(Boolean);
    const made = added.map((L) => { const n = buildLayer(L); n.hidden = false; layersRoot.append(n); if (L._scroll) n._body.scrollTop = L._scroll; return [L, n]; });
    requestAnimationFrame(() => made.forEach(([L, n]) => { if (L.k === "g" && L.line != null && !L._scroll) { const a = n.querySelector("#anchor"); if (a) n._body.scrollTop = Math.max(0, a.offsetTop - n._body.clientHeight * 0.3); } }));
    m.layout(this.stack, { instant, added, removed, entering: made.map(([, n]) => n), leaving: gone, phase: "pre" });
    const ps = [];
    if (!instant) {
      for (const [L, n] of made) ps.push(m.enter ? m.enter(L, n, { stack: this.stack, trigger: L.trigger, index: this.stack.indexOf(L) }) : null);
      for (const L of removed) { const n = this.layerEl(L); if (n) ps.push(m.leave ? m.leave(L, n, { stack: this.stack, trigger: L.trigger }) : null); }
    }
    const finish = () => { for (const n of gone) n.remove(); m.layout(this.stack, { instant: true, phase: "post" }); };
    this.after(popped, added.length ? "push" : "pop", instant);
    if (instant) finish(); else Promise.allSettled(ps).then(finish);
    this.pending = Promise.allSettled(ps);
  },
  after(popped, kind, instant) {
    const d = this.stack.length;
    app.inert = d > 0; app.toggleAttribute("aria-hidden", d > 0);
    [...layersRoot.children].forEach((n) => { const L = this.stack.find((x) => String(x.id) === n.dataset.id); const idx = L ? this.stack.indexOf(L) : -1; const isTop = idx === d - 1; n.inert = !isTop; n.setAttribute("aria-hidden", isTop ? "false" : "true"); });
    // return pill: same corner on every layer, hidden at the chat
    ret.hidden = d === 0;
    if (d) { const prev = d > 1 ? labelOf(this.stack[d - 2]) : "Chat"; rbs.textContent = prev; rb.setAttribute("aria-label", `Back to ${prev}`); rc.hidden = d < 2; rc.setAttribute("aria-label", `Back to chat, closing ${plural(d, "layer")}`); rc.querySelector(".rn").textContent = String(d); }
    // focus + announce
    const topL = this.stack[d - 1];
    if (kind === "push" && topL) { const n = this.layerEl(topL); if (n) setTimeout(() => n._h2.focus({ preventScroll: true }), 0); }
    else if (kind === "pop") {
      const trig = popped && popped.trigger && popped.trigger.isConnected && !popped.trigger.closest("[inert]") ? popped.trigger : null;
      const target = trig || (topL ? this.layerEl(topL)._h2 : chat);
      setTimeout(() => { target.focus({ preventScroll: true }); if (trig) { trig.classList.remove("here", "pop"); void trig.offsetWidth; trig.classList.add(trig.classList.contains("mark") ? "pop" : "here"); } }, 0);
    }
    if (topL) live.textContent = `Layer ${d}: ${titleOf(topL)}. Escape goes back to ${d > 1 ? labelOf(this.stack[d - 2]) : "the chat"}.`;
    else if (kind === "pop") live.textContent = "Back in the chat.";
    root.dataset.depth = String(d);
    if (this.model && this.model.a11y) this.model.a11y(this.stack);
  },
  popover(anchor) {
    let p = $("#crumbpop"); if (!p) { p = el("div", "popover"); p.id = "crumbpop"; p.hidden = true; document.body.append(p); }
    if (!p.hidden) { p.hidden = true; return; }
    p.replaceChildren(); p.setAttribute("role", "menu");
    const items = [{ label: "Chat", i: 0 }, ...this.stack.map((L, i) => ({ label: labelOf(L), i: i + 1, kind: KIND[L.k] }))];
    items.forEach((it) => { const b = el("button"); b.type = "button"; b.setAttribute("role", "menuitem"); b.append(el("span", "n", String(it.i)), it.label + (it.kind ? " · " + it.kind.toLowerCase() : "")); if (it.i === this.stack.length) b.setAttribute("aria-current", "location"); b.addEventListener("click", () => { p.hidden = true; if (it.i !== this.stack.length) this.to(it.i); }); p.append(b); });
    const r = anchor.getBoundingClientRect(); p.hidden = false;
    const pw = p.offsetWidth, ph = p.offsetHeight; p.style.left = Math.max(8, Math.min(innerWidth - pw - 8, r.left)) + "px"; p.style.top = Math.max(8, Math.min(innerHeight - ph - 8, r.bottom + 6)) + "px";
    p.querySelector("[aria-current]")?.focus();
    const off = (e) => { if (!p.contains(e.target) && e.target !== anchor) { p.hidden = true; document.removeEventListener("pointerdown", off, true); } };
    document.addEventListener("pointerdown", off, true);
    p.addEventListener("keydown", (e) => { if (e.key === "Escape") { e.stopPropagation(); p.hidden = true; anchor.focus(); } }, { once: true });
  },
  applyLook, relook, shortOf, fav, srcOfL,
};
const top1 = () => (Nav.stack.length ? Nav.stack[Nav.stack.length - 1] : null);
window.Nav = Nav;

// ---------------------------------------------------------------- History API contract
addEventListener("popstate", (e) => {
  const p = $("#crumbpop"); if (p) p.hidden = true;
  const target = e.state && e.state.fold ? e.state.stack : parseHash();
  Nav.sync(target);
});
addEventListener("keydown", (e) => { if (e.key === "Escape" && Nav.stack.length && !e.defaultPrevented) { const p = $("#crumbpop"); if (p && !p.hidden) return; e.preventDefault(); Nav.back(); } });
rb.addEventListener("click", () => Nav.back());
rc.addEventListener("click", () => Nav.home());

// cold start: a deep link (#/c~nose~1/p~nose~0~6) seeds one history entry per layer, so the phone's Back walks them one by one
requestAnimationFrame(() => {
  Nav.use(CFG.model || "a");
  const target = parseHash();
  history.replaceState({ fold: 1, stack: [] }, "", "#/");
  const seeded = [];
  for (const d of target.slice(0, MAXDEPTH)) { const L = { ...d, id: ++Nav.seq }; seeded.push(L); Nav.stack.push(L); history.pushState({ fold: 1, stack: Nav.stack.map(ser) }, "", hashOf(Nav.stack)); }
  if (seeded.length) { const t = document.getElementById("turn-" + seeded[0].turn); if (t) chat.scrollTop = Math.max(0, t.offsetTop - 70); Nav.commit({ added: seeded, removed: [], instant: true }); }
  window.__ready = true;
});
})();
