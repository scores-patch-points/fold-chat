// fold-chat-snipview.js — draw the snips (see fold-chat-snip.js). DOM only; textContent only, so a page's own
// words can never become markup. The card is the source's: its title links to the original, the creator is
// credited, and the tip line says plainly that tipping is still being built.
import { TIP, creditLine, metaLine } from "./fold-chat-snip.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

function link(url, text, cls) {
  const a = el("a", cls, text);
  if (/^https?:\/\//i.test(url || "")) { a.href = url; a.target = "_blank"; a.rel = "noopener noreferrer"; }
  return a;
}

function card(s, toast) {
  const c = el("article", "snip");
  c.append(el("div", "snip-k", "from the source, unchanged"));
  const t = el("h3", "snip-title"); t.append(link(s.url, s.title || "Recipe", "snip-link")); c.append(t);
  c.append(el("div", "snip-credit", creditLine(s)));
  const meta = metaLine(s); if (meta) c.append(el("div", "snip-meta", meta));
  const cols = el("div", "snip-cols");
  if (s.ingredients.length) {
    const col = el("div", "snip-col"); col.append(el("h4", "snip-h", "Ingredients"));
    const ul = el("ul", "snip-ing"); for (const x of s.ingredients) ul.append(el("li", "", x)); col.append(ul); cols.append(col);
  }
  if (s.steps.length) {
    const col = el("div", "snip-col"); col.append(el("h4", "snip-h", "Instructions"));
    const ol = el("ol", "snip-steps"); for (const x of s.steps) ol.append(el("li", "", x)); col.append(ol); cols.append(col);
  }
  c.append(cols);
  if (s.truncated) c.append(el("div", "snip-cut", "This recipe is long; the card shows the first part. The rest is on the original page."));
  const foot = el("div", "snip-foot");
  const open = link(s.url, "Read the original ↗", "snip-open");
  const tip = el("button", "snip-tip", "Tip the creator"); tip.type = "button";
  tip.onclick = () => { if (typeof toast === "function") toast(TIP.clicked); };
  const ask = el("span", "snip-ask", TIP.prompt);
  foot.append(open, el("span", "snip-sp"), ask, tip);
  c.append(foot, el("div", "snip-dev", TIP.status));
  return c;
}

/** Draw every recipe snip of a turn under `body`. Draws nothing when there are none. */
export function renderSnips(body, snips, { toast = null } = {}) {
  const list = (snips || []).filter((s) => s && s.kind === "recipe");
  if (!list.length) return;
  const wrap = el("section", "snips"); wrap.setAttribute("aria-label", "Recipes found");
  for (const s of list) wrap.append(card(s, toast));
  body.append(wrap);
}
