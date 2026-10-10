/* Stage 1 · NUL ∅ — Differentiate × Existence.
   FORM: THE OPEN SLOT. The one stage where the honest picture is an absence: a blank the shape of an answer, drawn dashed, with the
   question as its caption and the record's own counters (pages / passages / cited) as its cursor. The blank is the figure; what it
   stood on is the ground (a ruler of how long nothing had arrived); what it became across the laps is the pattern. */
const STAGE = {
  n: 1, code: "NUL", glyph: "∅",
  faces: {
    ground: { terrain: "Void", stance: "Clearing" },
    figure: { terrain: "Entity", stance: "Dissecting" },
    pattern: { terrain: "Kind", stance: "Unraveling" },
  },
  render(D, t, api) {
    const firstFound = Math.min(...D.engines.filter((e) => e.ok && e.t1 != null).map((e) => e.t1), Infinity);
    const firstPage = Math.min(...D.pages.filter((p) => p.state === "read" && p.t1 != null).map((p) => p.t1), Infinity);
    const firstPass = Math.min(...D.quick.map((q) => q.at), Infinity);
    const done = t >= D.dur - 1e-6;
    const kindNote = (D.process.find((x) => /^classified/.test(x)) || "").replace(/^classified · /, "") || D.kind || "";
    const effortNote = (D.process.find((x) => /^effort/.test(x)) || "").replace(/^effort · /, "");
    const pagesRead = new Set(D.pages.filter((p) => p.state === "read" && p.t1 <= t).map((p) => p.url)).size;
    const passN = D.quick.filter((q) => q.at <= t).length;
    const cited = done ? D.cited : [];
    const lang = D.language ? `asked in ${D.language.question}, answered in ${D.language.reply}` : "";

    /* ---------------- FIGURE: the open slot ---------------- */
    const slot = h("div", { class: "slot " + (cited.length ? "full" : "open"), role: "group", "aria-label": cited.length ? "The slot, filled" : "The slot, still empty" });
    if (cited.length) {
      const c = cited[0], cl = D.loop && D.loop.passes.length;
      slot.append(
        h("div", { class: "who" }, fav(D, c.domain, c.domain), h("span", null, c.domain), h("span", { class: "tag" }, "the one sentence a source states")),
        h("p", { class: "said", style: `font-family:${(D.types[c.domain] || {}).body || "inherit"}` }, c.text),
        h("p", { class: "stand mono" }, D.loop ? D.loop.processLine : "")
      );
      if (D.void) slot.append(h("p", { class: "stand mono" }, ""));
    } else if (done) {
      const v = D.void;
      slot.append(
        h("p", { class: "tag" }, "still open"),
        h("p", { class: "said2" }, v ? `Read ${plural(v.read.length, "page")}; none established it.` : "Nothing was cited."),
        v && v.closeBy ? h("p", { class: "stand" }, "To close it: ", v.closeBy.join(" · ")) : null
      );
    } else if (passN) {
      slot.append(h("p", { class: "tag" }, "empty"), h("p", { class: "said2" }, `${plural(passN, "passage")} in hand. That is material, not an answer.`));
    } else {
      slot.append(h("p", { class: "tag" }, "empty"), h("p", { class: "said2" }, pagesRead ? `${plural(pagesRead, "page")} read; nothing chosen yet.` : "Nothing is known yet. This fills when a page states it."));
    }
    const cur = h("dl", { class: "cursor" },
      [["pages read", pagesRead], ["passages in hand", passN], ["sentences cited", cited.length]].map(([k, v]) => h("div", null, h("dt", { class: "tag" }, k), h("dd", { class: "n" }, String(v))))
    );
    const figure = h("div", { class: "nul" },
      h("p", { class: "ftitle" }, h("b", null, "The question is held as a blank."), " Nothing below was written by a model: the counters are the record's, the sentence is a page’s."),
      h("p", { class: "ask" }, D.ask),
      h("p", { class: "meta" }, [kindNote, lang, effortNote && "effort: " + effortNote].filter(Boolean).join(" · ")),
      slot, cur
    );

    /* ---------------- GROUND: what it stood on, and how long it stayed empty ---------------- */
    const marks = [
      Number.isFinite(firstFound) && { t: firstFound, k: "first results came back", n: (() => { const e = D.engines.filter((x) => x.ok).sort((a, b) => a.t1 - b.t1)[0]; return e ? `${e.name}: ${plural(e.n, "result")}` : ""; })() },
      Number.isFinite(firstPage) && { t: firstPage, k: "first page text arrived", n: (() => { const p = D.pages.filter((x) => x.state === "read").sort((a, b) => a.t1 - b.t1)[0]; return p ? p.domain : ""; })() },
      Number.isFinite(firstPass) && { t: firstPass, k: "first passage was chosen", n: "" },
    ].filter(Boolean);
    const span = Math.max(...marks.map((m) => m.t), 1) * 1.12;
    const emptyUntil = marks.length ? marks[Math.min(1, marks.length - 1)].t : 0;
    const ruler = h("div", { class: "ruler", role: "img", "aria-label": `Nothing to read for ${emptyUntil.toFixed(1)} seconds` },
      h("i", { class: "void", style: `width:${(emptyUntil / span) * 100}%` }),
      h("i", { class: "rest", style: `left:${(emptyUntil / span) * 100}%;right:0` }),
      marks.map((m, i) => h("b", { class: "pin", style: `left:${(m.t / span) * 100}%` }, String(i + 1)))
    );
    const ledger = h("dl", { class: "ledger" },
      [
        ["kind of question", kindNote || h("span", { class: "gap" }, "not on the tape")],
        ["languages", lang || h("span", { class: "gap" }, "not on the tape")],
        ["effort", effortNote || h("span", { class: "gap" }, "not on the tape")],
        ["carried from earlier", h("span", { class: "gap" }, "not on the tape")],
        ["how it will answer", D.answerMode || ""],
      ].map(([k, v]) => h("div", null, h("dt", { class: "tag" }, k), h("dd", null, v)))
    );
    const ground = h("div", { class: "nul" },
      h("p", { class: "ftitle" }, h("b", null, `Nothing to read for ${emptyUntil.toFixed(1)} s.`), " The hatched stretch is the void: the time before any page text arrived, from the tape’s own clock."),
      ruler,
      h("ol", { class: "marks" }, [h("li", null, h("span", { class: "pinlab" }, "0"), h("span", null, h("b", null, "0.0 s"), " the question is asked; nothing is held"))].concat(marks.map((m, i) => h("li", null, h("span", { class: "pinlab" }, String(i + 1)), h("span", null, h("b", null, secs(m.t)), " " + m.k + (m.n ? " · " + m.n : "")))))),
      h("p", { class: "kick", style: "margin:18px 0 6px" }, "What it stood on"),
      ledger
    );

    /* ---------------- PATTERN: the same blank, asked again ---------------- */
    const lapsOf = D.laps.map((l, i) => {
      const q = D.queries.find((x) => x.lap === l.n) || {};
      const pass = D.loop && D.loop.passes.find((p) => p.lap === l.n);
      const eng = D.engines.filter((e) => e.lap === l.n);
      const results = eng.reduce((a, e) => a + (e.n || 0), 0);
      const pages = new Set(D.pages.filter((p) => p.lap === l.n && p.state === "read").map((p) => p.url)).size;
      const last = i === D.laps.length - 1;
      return { l, q, pass, results, pages, last };
    });
    const multiples = lapsOf.map(({ l, q, pass, results, pages, last }, i) => {
      const body = [];
      if (pass && pass.failing.length) body.push(h("p", { class: "brk" }, h("span", { class: "tag" }, "a sentence broke"), h("span", { class: "say mono" }, pass.failing[0].s), h("span", { class: "why" }, pass.failing[0].why)));
      if (last) body.push(h("p", { class: "end" }, h("span", { class: "tag" }, "the slot ends"), h("span", null, D.cited.length ? (D.loop && D.loop.passes.length ? D.loop.processLine : "filled by one cited sentence; every sentence held on the first try") : D.void ? `still open — ${D.void.kind}` : "no sentence cited")));
      return h("li", { class: "multi" },
        h("div", { class: "slot mini " + (last && D.cited.length ? "full" : "open") }, h("span", { class: "tag" }, `lap ${l.n}`), h("span", { class: "qs" }, q.q || D.ask)),
        h("p", { class: "mm mono" }, `${plural(results, "result")} · ${plural(pages, "page")} read`),
        body
      );
    });
    const pattern = h("div", { class: "nul" },
      h("p", { class: "ftitle" }, h("b", null, `This kind of question, asked ${D.laps.length === 1 ? "once" : D.laps.length + " times"}.`), " Each blank is the same slot with the words it was asked in, verbatim. The next lap exists only because the last one broke."),
      h("p", { class: "meta" }, `Kind: ${kindNote || D.kind}. A kind that needs a source. Sentences with one: ${D.coverage ? D.coverage.grounded + " of " + D.coverage.total : "not on the tape"}.`),
      h("ol", { class: "multis" }, multiples)
    );
    return {
      caption: done ? (cited.length ? `Held open, then filled by ${cited[0].domain}` : "Held open; still unfilled at the end") : passN ? `Held open · ${plural(passN, "passage")} in hand` : pagesRead ? `Held open · ${plural(pagesRead, "page")} read` : "Held open · nothing read yet",
      ground, figure, pattern,
      hints: {
        figure: done ? (cited.length ? `The blank, filled by ${cited[0].domain}` : "The blank, still open") : "The blank, as it is at this moment",
        ground: Number.isFinite(emptyUntil) ? `Nothing to read for ${emptyUntil.toFixed(1)} s` : "",
        pattern: D.laps.length > 1 ? `Asked ${D.laps.length} times; the second because a sentence broke` : D.cited.length ? "Asked once; held on the first try" : "Asked once; never filled",
      },
    };
  },
};
