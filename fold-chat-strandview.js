// fold-chat-strandview.js — draw a SOURCES-ONLY answer (see fold-chat-strand.js). DOM only; textContent only,
// so a page's own words can never become markup. One continuous reading column: the sources' passages,
// verbatim, thin rules between them, and on a quiet line under each the S# chip, who it is from, and the way
// back to the page. The only words that are not the sources' are those labels ("from <site>").
import { renderSnips } from "./fold-chat-snipview.js";
import { creditText } from "./fold-chat-strand.js";

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/** Draw the strand under `body`. Draws nothing when there are no snips. */
export function renderStrand(body, snips, { toast = null } = {}) {
  const list = (Array.isArray(snips) ? snips : []).filter((s) => s && String(s.text || "").trim());
  if (!list.length) return;
  const col = el("section", "strand");
  col.setAttribute("aria-label", "Answer from the sources, unchanged");
  col.append(el("div", "strand-k", "from the sources, unchanged · no model wrote this"));
  list.forEach((s, i) => {
    const one = el("article", "strand-snip" + (s.kind === "recipe" ? " strand-recipe" : ""));
    if (s.kind === "recipe" && s.card) {
      // the structured card is the source's own recipe; draw it with the shared card
      const holder = el("div", "strand-card");
      renderSnips(holder, [s.card], { toast });
      one.append(holder);
    } else {
      const p = el("div", "strand-text");
      if (s.ellipsisBefore) p.append(el("span", "strand-el", "… "));
      p.append(document.createTextNode(String(s.text)));
      if (s.ellipsisAfter) p.append(el("span", "strand-el", " …"));
      one.append(p);
    }
    const meta = el("div", "strand-meta");
    meta.append(el("span", "src-n", s.n || "S" + (i + 1)));
    meta.append(el("span", "strand-credit", creditText(s)));
    if (s.source && /^https?:\/\//i.test(s.source)) {
      const a = el("a", "strand-open", "open ↗");
      a.href = s.source; a.target = "_blank"; a.rel = "noopener noreferrer";
      a.setAttribute("aria-label", "Open " + (s.title || s.site || "the source") + " in a new tab");
      meta.append(a);
    }
    if (s.kind && s.kind !== "passage") meta.append(el("span", "strand-kind", s.kind === "lead" ? "lead" : s.kind === "recipe" ? "recipe" : s.kind === "howto" ? "how-to" : s.kind === "faq" ? "FAQ" : s.kind === "qa" ? "accepted answer" : s.kind));
    one.append(meta);
    col.append(one);
  });
  body.append(col);
}
