// fold-chat-strandview.js — draw a SOURCES-ONLY answer (see fold-chat-strand.js). DOM only; textContent only,
// so a page's own words can never become markup. One continuous reading column: the sources' passages,
// verbatim, thin rules between them, and on a quiet line under each the S# chip, who it is from, and the way
// back to the page. The only words that are not the sources' are those labels ("from <site>").
import { renderSnips } from "./fold-chat-snipview.js";
import { creditText } from "./fold-chat-strand.js";
import { tipControl } from "./fold-chat-tipview.js";
import { mountPager } from "./fold-chat-pagerview.js";
import { pagesOf } from "./fold-chat-pager.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const KIND = { lead: "lead", recipe: "recipe", howto: "how-to", faq: "FAQ", qa: "accepted answer" };

/** One page: ONE source's passages, verbatim, then the quiet line (S# chip, credit, open, tip). */
function pageOf(group, i, toast) {
  const first = group.snips[0];
  const recipe = group.snips.find((s) => s.kind === "recipe" && s.card);
  const one = el("article", "strand-snip" + (recipe ? " strand-recipe" : ""));
  if (recipe) {
    // the structured card is the source's own recipe; draw it with the shared card
    const holder = el("div", "strand-card");
    renderSnips(holder, [recipe.card], { toast });
    one.append(holder);
  } else {
    for (const s of group.snips) {
      const p = el("div", "strand-text");
      if (s.ellipsisBefore) p.append(el("span", "strand-el", "\u2026 "));
      p.append(document.createTextNode(String(s.text)));
      if (s.ellipsisAfter) p.append(el("span", "strand-el", " \u2026"));
      one.append(p);
    }
  }
  const meta = el("div", "strand-meta");
  const chip = el("span", "src-n", first.n || "S" + (i + 1));
  chip.title = (first.n || "S" + (i + 1)) + " \u00b7 " + (first.title || first.site || "source");
  meta.append(chip);
  meta.append(el("span", "strand-credit", creditText(first)));
  const src = first.source;
  if (src && /^https?:\/\//i.test(src)) {
    const a = el("a", "strand-open", "open \u2197");
    a.href = src; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.setAttribute("aria-label", "Open " + (first.title || first.site || "the source") + " in a new tab");
    meta.append(a);
  }
  const kinds = [...new Set(group.snips.map((s) => s.kind).filter((k) => k && k !== "passage"))];
  for (const k of kinds) meta.append(el("span", "strand-kind", KIND[k] || k));
  // a creator can be tipped from here (the recipe card carries its own control; an encyclopedia has no one to tip)
  if (!recipe && src && /^https?:\/\//i.test(src) && !/(^|\.)wikipedia\.org$/i.test(first.site || "")) {
    const contact = (group.snips.find((s) => s.contact) || {}).contact;
    const creator = first.credit && first.credit !== first.site ? first.credit : "";
    meta.append(tipControl({ url: src, title: first.title || "", creator, site: first.site || "", contact }, { toast, quiet: true }));
  }
  one.append(meta);
  return one;
}

/** Draw the strand under `body`. Draws nothing when there are no snips. Several sources are paged, one at a time. */
export function renderStrand(body, snips, { toast = null } = {}) {
  const list = (Array.isArray(snips) ? snips : []).filter((s) => s && String(s.text || "").trim());
  if (!list.length) return;
  const col = el("section", "strand");
  col.setAttribute("aria-label", "Answer from the sources, unchanged");
  col.append(el("div", "strand-k", "from the sources, unchanged \u00b7 no model wrote this"));
  const pages = pagesOf(list).map((g, i) => ({ key: g.key, n: g.n, url: g.url, label: (g.n || "S" + (i + 1)) + " \u00b7 " + (g.snips[0].title || g.snips[0].site || "source"), node: pageOf(g, i, toast) }));
  col.append(mountPager(pages, { label: "Sources" }));
  body.append(col);
}
