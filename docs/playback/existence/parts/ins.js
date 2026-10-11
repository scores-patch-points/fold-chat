/* Stage 3 · INS ● — Generate × Existence (birth: a figure is made against its ground).
   FORM: THE PAGE AND ITS CLIPPINGS. Figure is a page-by-page contact sheet: each page's header in the margin, its kept passages pulled out as
   paper in that site's own type. Ground is the page itself, as rulers (how much of each page was kept) and, on a tap, the page's stored
   text with the cited sentence located. Pattern is a concordance: the runs of words and the figures that stand on more than one page. */
const OPENG = new Set();
const STAGE = {
  n: 3, code: "INS", glyph: "●",
  faces: {
    ground: { terrain: "Void", stance: "Cultivating" },
    figure: { terrain: "Entity", stance: "Making" },
    pattern: { terrain: "Kind", stance: "Composing" },
  },
  render(D, t, api) {
    const done = t >= D.dur - 1e-6;
    const typeOf = (d) => D.types[d] || {};
    const paper = (d, extra) => { const ty = typeOf(d); return `background:${ty.bg || "#fff"};color:${ty.ink || "#202122"};border-color:${ty.edge || "#e4e4e9"};font-family:${ty.body || "Georgia,serif"};${extra || ""}`; };
    // distinct pages that were read, in the order first read; the last read of each wins for sizes
    const pageList = []; const byUrl = new Map();
    for (const p of D.pages) { if (p.t1 == null || p.t1 > t) continue; if (!byUrl.has(p.url)) { const o = { url: p.url, domain: p.domain, site: p.site, title: p.title, reads: [] }; byUrl.set(p.url, o); pageList.push(o); } byUrl.get(p.url).reads.push(p); }
    for (const pg of pageList) { const ok = pg.reads.filter((r) => r.state === "read"); pg.read = ok[ok.length - 1] || null; pg.failed = !pg.read; }
    const quick = D.quick.map((q, i) => ({ ...q, full: (D.handed[i] && String(D.handed[i].text || "").slice(0, 40) === String(q.text || "").slice(0, 40)) ? D.handed[i].text : q.text })).filter((q) => q.at <= t);
    const citedAll = done ? D.cited : [];
    const readPages = pageList.filter((p) => p.read);
    const usedPages = new Set(quick.map((q) => q.url));

    /* ---------------- FIGURE ---------------- */
    const groups = readPages.filter((p) => usedPages.has(p.url) || citedAll.some((c) => c.url === p.url)).map((pg) => {
      const qs = quick.filter((q) => q.url === pg.url);
      const cs = citedAll.filter((c) => c.url === pg.url);
      const clip = (txt, tagText, key, full) => {
        const open = OPENG.has(key);
        return h("figure", { class: "clip", style: paper(pg.domain) },
          h("figcaption", { class: "ct" }, tagText),
          h("button", { type: "button", class: "cb", "aria-expanded": String(open), onclick: () => { open ? OPENG.delete(key) : OPENG.add(key); api.go("figure", true); }, style: `font-size:${typeOf(pg.domain).bodySize || "15px"}` },
            h("span", { class: open ? "" : "clamp" }, open ? full : txt)));
      };
      const items = [
        ...cs.map((c) => h("figure", { class: "clip cited", style: paper(pg.domain) }, h("figcaption", { class: "ct" }, `the sentence the answer rests on · ${c.n}`), h("p", { class: "cb2", style: `font-size:${typeOf(pg.domain).bodySize || "15px"}` }, c.before ? c.before + " " : "", h("strong", null, c.mark), c.after ? " " + c.after : ""))),
        ...qs.map((q, i) => clip(q.text, `lap ${q.lap} · passage ${q.n} of ${q.of}`, pg.url + "#" + q.at, q.full)),
      ];
      return h("section", { class: "pg" },
        h("header", { class: "ph" }, h("span", { class: "who" }, fav(D, pg.domain, pg.site), h("b", null, pg.domain)), h("span", { class: "pt" }, pageTitle(pg.title)), h("span", { class: "pm mono" }, `kept ${fmt(pg.read.kept)} of ${fmt(pg.read.chars)} characters`)),
        h("div", { class: "clips" }, items));
    });
    const quiet = pageList.filter((p) => !groups.length || !(usedPages.has(p.url) || citedAll.some((c) => c.url === p.url)));
    const quietRows = quiet.map((p) => h("li", null, fav(D, p.domain, p.site), h("span", null, h("b", null, p.domain), " ", p.failed ? (p.reads[p.reads.length - 1].note || "no text came back") : `kept ${fmt(p.read.kept)} characters; none handed on`)));
    const figure = h("div", { class: "ins" },
      h("p", { class: "ftitle" }, h("b", null, "What it kept, in each page’s own words and type."), " Tap a passage to see the rest of what the record holds of it."),
      groups.length ? groups : h("p", { class: "gap" }, "No passage has been chosen yet at this moment of the tape."),
      quiet.length ? h("div", { class: "quiet" }, h("p", { class: "kick" }, "Pages that gave nothing to the writer"), h("ul", null, quietRows)) : null);

    /* ---------------- GROUND ---------------- */
    const maxChars = Math.max(1, ...readPages.map((p) => p.read.chars || 0));
    if (!OPENG.size && !OPENG.has("init")) { OPENG.add("init"); const c0 = D.cited[0]; if (c0) OPENG.add("g:" + c0.url); else if (readPages[0]) OPENG.add("g:" + readPages[0].url); }
    const rows = readPages.map((pg) => {
      const r = pg.read; const key = "g:" + pg.url; const open = OPENG.has(key);
      const c = citedAll.find((x) => x.url === pg.url) || (D.cited.find((x) => x.url === pg.url) && done ? D.cited.find((x) => x.url === pg.url) : null);
      const pct = r.chars ? Math.round((r.kept / r.chars) * 100) : 0;
      const ty = typeOf(pg.domain);
      let more = null;
      if (open) {
        const stored = (r.text || "");
        more = h("div", { class: "gmore" },
          c && c.keptLen ? h("div", { class: "loupe" },
            h("div", { class: "lp", "aria-hidden": "true", style: `clip-path:polygon(0 0,${Math.max((r.kept / maxChars) * 100, 0.5)}% 0,100% 100%,0 100%)` }),
            h("div", { class: "ktrack" }, h("i", { class: "ktick", style: `left:${(c.span.start / c.keptLen) * 100}%;width:${Math.max(((c.span.end - c.span.start) / c.keptLen) * 100, 0.8)}%` })),
            h("p", { class: "mono cap2" }, `kept text: ${fmt(c.keptLen)} characters. The cited sentence sits at ${fmt(c.span.start)}–${fmt(c.span.end)} of it. Where the kept text sits in the page is not recorded.`)) : null,
          h("div", { class: "pap", style: paper(pg.domain) },
            h("p", { class: "pt2", style: `font-family:${ty.title || "inherit"};font-weight:${ty.titleWeight || 400};text-transform:${ty.titleCase || "none"};letter-spacing:${ty.titleTrack || 0}` }, pageTitle(pg.title)),
            h("div", { class: "scroll", tabindex: "0", role: "region", "aria-label": "Stored text of the page" }, h("p", { style: `font-size:${ty.bodySize || "15px"}` }, stored || "(nothing stored)")),
            h("p", { class: "torn" }, `… ${fmt(Math.max((r.chars || 0) - stored.length, 0))} more characters of this page are not stored on the tape (it keeps the first ${fmt(stored.length)}).`)));
      }
      return h("li", { class: "grow" },
        h("button", { type: "button", class: "gh", "aria-expanded": String(open), onclick: () => { open ? OPENG.delete(key) : OPENG.add(key); api.go("ground", true); } },
          h("span", { class: "who" }, fav(D, pg.domain, pg.site), h("b", null, pg.domain), h("span", { class: "ttl" }, pageTitle(pg.title))),
          h("span", { class: "out" }, `kept ${fmt(r.kept)} of ${fmt(r.chars)} · ${pct}%`)),
        h("div", { class: "rul", "aria-hidden": "true" }, h("i", { class: "pagebar", style: `width:${(r.chars / maxChars) * 100}%` }, h("i", { class: "keptbar", style: `width:${r.chars ? (r.kept / r.chars) * 100 : 0}%` }))),
        more);
    });
    const pcts = readPages.map((p) => (p.read.chars ? p.read.kept / p.read.chars : 0)).sort((a, b) => a - b);
    const med = pcts.length ? Math.round(pcts[Math.floor(pcts.length / 2)] * 100) : 0;
    const failedPages = pageList.filter((p) => p.failed);
    const ground = h("div", { class: "ins" },
      h("p", { class: "ftitle" }, h("b", null, `${plural(readPages.length, "page")} read; most of each was left behind.`), " Each bar is a whole page; the filled part is how much was kept. Sizes only: where in the page is not recorded. Tap a page to open it."),
      h("ul", { class: "grows" }, rows),
      failedPages.length ? h("p", { class: "mut tl" }, `${plural(failedPages.length, "page")} could not be opened and are not drawn: ${failedPages.map((p) => p.domain).join(", ")}.`) : null);

    /* ---------------- PATTERN ---------------- */
    const RC = D.recur;
    const cols = RC.pages;
    const dot = (inn, u) => h("span", { class: "dot " + (inn.includes(u) ? "y" : "n"), "aria-label": inn.includes(u) ? "present" : "absent" }, inn.includes(u) ? "●" : "·");
    const row = (txt, inn, mono) => h("li", { class: "crow" }, h("span", { class: "ctx" + (mono ? " mono" : "") }, mono ? txt : "“" + txt + "”", h("em", { class: "cn" }, ` ${inn.length} of ${cols.length} pages`)), h("span", { class: "dcols" }, cols.map((c) => dot(inn, c.url))));
    const head = h("div", { class: "chead" }, h("span"), h("span", { class: "dcols" }, cols.map((c) => fav(D, c.domain, c.domain, "sm"))));
    const legend = h("p", { class: "legend2" }, cols.map((c) => h("span", null, fav(D, c.domain, c.domain, "sm"), c.domain)));
    const pattern = h("div", { class: "ins" },
      h("p", { class: "ftitle" }, h("b", null, RC.runs.length || RC.figures.length ? "What more than one page says in the same words." : "No wording recurs between these pages."), " Found by comparing the passages the record keeps. Each dot is a page that has it."),
      RC.runs.length ? [h("p", { class: "kick" }, "Runs of words"), head, h("ul", { class: "crows" }, RC.runs.map((r) => row(r.text, r.in)))] : null,
      RC.figures.length ? [h("p", { class: "kick", style: "margin-top:18px" }, "Figures"), h("ul", { class: "crows" }, RC.figures.map((r) => row(r.text, r.in, true)))] : null,
      legend);
    return {
      caption: `Kept ${plural(quick.length, "passage")} from ${plural(new Set(quick.map((q) => q.url)).size, "page")}${citedAll.length ? ` · ${plural(citedAll.length, "sentence")} cited` : ""}`,
      ground, figure, pattern,
      hints: {
        figure: `${plural(D.quick.length, "passage")} from ${plural(new Set(D.quick.map((q) => q.url)).size, "page")}${D.cited.length ? ", " + D.cited.length + " cited" : ", none cited"}`,
        ground: `${plural(readPages.length, "page")} read; a median ${med}% of each was kept`,
        pattern: `${plural(RC.runs.length, "phrase")} and ${plural(RC.figures.length, "figure")} on more than one page`,
      },
    };
  },
};
