/* Stage 2 · SIG ○ — Relate × Existence ("mark": put something beside something).
   FORM: A SWIMLANE TIMELINE ON THE TAPE'S OWN CLOCK. One lane per search and per page, the bar as long as it really took, ending in a
   glyph that says how it ended. Ground is the wheel of places it could have asked; Pattern is the title gate (who got read first, who
   was read last) and which pages came back in the next lap. */
const OPEN = new Set();
const STAGE = {
  n: 2, code: "SIG", glyph: "○",
  faces: {
    ground: { terrain: "Void", stance: "Tending" },
    figure: { terrain: "Entity", stance: "Binding" },
    pattern: { terrain: "Kind", stance: "Tracing" },
  },
  render(D, t, api) {
    const done = t >= D.dur - 1e-6;
    const lapsActive = D.laps.map((l) => {
      const lanes = [
        ...D.engines.filter((e) => e.lap === l.n).map((e) => ({ kind: "search", t0: e.t0, t1: e.t1, e })),
        ...D.pages.filter((p) => p.lap === l.n).map((p) => ({ kind: "page", t0: p.t0, t1: p.t1, p })),
      ].sort((a, b) => a.t0 - b.t0);
      const s0 = lanes.length ? Math.min(...lanes.map((x) => x.t0)) : l.t0;
      const s1 = lanes.length ? Math.max(...lanes.map((x) => x.t1 ?? x.t0)) : l.t0;
      return { l, lanes, s0, s1, span: Math.max(s1 - s0, 1) };
    });
    const maxSpan = Math.max(...lapsActive.map((x) => x.span));
    const searchesDone = D.engines.filter((e) => e.t1 != null && e.t1 <= t);
    const results = searchesDone.reduce((a, e) => a + (e.n || 0), 0);
    const tried = new Set(D.pages.filter((p) => p.t0 <= t).map((p) => p.url));
    const failed = new Set(D.pages.filter((p) => p.state === "unread" && p.t1 <= t).map((p) => p.url));
    const places = new Set(D.engines.filter((e) => e.t0 <= t).map((e) => e.scope));

    /* ---------------- FIGURE ---------------- */
    function laneEl(x, lap) {
      const id = x.kind + ":" + (x.e ? x.e.scope + x.e.t0 : x.p.url + x.p.lap);
      const started = x.t0 <= t, ended = x.t1 != null && x.t1 <= t;
      const end = ended ? x.t1 : t;
      const left = ((x.t0 - lap.s0) / lap.span) * 100;
      const w = Math.max(((end - x.t0) / lap.span) * 100, 0.8);
      let head, bars, outcome, capg = "…", more;
      if (x.kind === "search") {
        const e = x.e;
        head = [h("span", { class: "tag" }, "search"), h("b", null, e.name), e.engine && e.engine !== e.name ? h("span", { class: "ttl" }, e.engine) : null];
        const waitAt = e.waited != null && e.waited <= end ? e.waited : null;
        const failedS = e.ok === false;
        const parts = waitAt != null ? [[x.t0, waitAt, "b-search"], [waitAt, end, "b-wait"]] : [[x.t0, end, failedS ? "b-fail" : "b-search"]];
        bars = parts.map(([a, b, c]) => h("i", { class: "bar " + c, style: `left:${((a - lap.s0) / lap.span) * 100}%;width:${Math.max(((b - a) / lap.span) * 100, 0.8)}%` }));
        outcome = !ended ? "asking…" : failedS ? e.why : `${plural(e.n, "result")} · ${secs(x.t1 - x.t0)}`;
        capg = ended ? (failedS ? "✕" : "●") : "…";
        more = h("div", { class: "more" }, h("p", null, h("b", null, e.name), e.engine ? " via " + e.engine : "", " was asked: "), h("p", { class: "mono q" }, e.q), h("p", { class: "mut" }, e.waited != null ? `Nothing else had answered after ${secs(e.waited)}, so it waited on this one alone (the hatched part) until ${secs(e.t1)}.` : `Answered after ${secs(e.t1 - e.t0)}.`), h("p", { class: "mut" }, "The tape holds the count of results, not the results themselves."));
      } else {
        const p = x.p;
        const bad = p.state === "unread";
        head = [fav(D, p.domain, p.site), h("b", null, p.domain), h("span", { class: "ttl" }, pageTitle(p.title))];
        bars = [h("i", { class: "bar " + (!ended ? "b-read" : bad ? "b-fail" : p.notUsed ? "b-notused" : "b-read"), style: `left:${left}%;width:${w}%` })];
        outcome = !ended ? "opening…" : bad ? `${p.note || "no text came back"} · ${secs(p.t1 - p.t0)}` : `kept ${fmt(p.kept)} of ${fmt(p.chars)} characters${p.notUsed ? " · not handed on" : ""} · ${secs(p.t1 - p.t0)}`;
        capg = !ended ? "…" : bad ? "✕" : p.notUsed ? "○" : "●";
        const ty = D.types[p.domain] || {};
        more = h("div", { class: "more" },
          h("p", null, h("b", null, pageTitle(p.title))),
          h("p", { class: "mono q" }, p.url),
          h("p", { class: "mut" }, ended ? (bad ? "Could not be opened: " + (p.note || "no text came back") + "." : `Opened ${p.via ? "via " + p.via : ""}. ${fmt(p.chars)} characters on the page; ${fmt(p.kept)} kept${p.notUsed ? "; read, but not handed to the writer" : ""}.`) : "Still opening."),
          !bad && ended && p.text ? h("div", { class: "paper", style: `background:${ty.bg};color:${ty.ink};border-color:${ty.edge};font-family:${ty.body}` }, h("p", null, p.text.slice(0, 360) + (p.text.length > 360 ? "…" : "")), h("p", { class: "gapnote" }, "The tape stores the first 1,400 characters of what was kept.")) : null
        );
      }
      const open = OPEN.has(id);
      const li = h("li", { class: "lane " + (started ? "" : "future") },
        h("button", { type: "button", class: "lh", "aria-expanded": String(open), onclick: () => { open ? OPEN.delete(id) : OPEN.add(id); api.go("figure", true); } },
          h("span", { class: "who" }, head),
          h("span", { class: "out" }, outcome)),
        h("div", { class: "lt", style: `width:${(lap.span / maxSpan) * 100}%` }, bars, ended ? h("span", { class: "capg", style: `left:${((end - lap.s0) / lap.span) * 100}%` }, capg) : null),
        open ? more : null
      );
      return li;
    }
    const panels = lapsActive.map((lap) => {
      const q = D.queries.find((x) => x.lap === lap.l.n) || {};
      const step = lap.span > 40 ? 10 : lap.span > 11 ? 5 : lap.span > 5 ? 2 : 1;
      const ticks = []; for (let s = 0; s <= lap.span; s += step) ticks.push(s);
      const visible = lap.lanes.filter((x) => x.t0 <= t);
      if (!visible.length && lap.l.n > 1) return null;
      return h("section", { class: "lap", "aria-label": `Lap ${lap.l.n}` },
        h("div", { class: "laph" },
          h("span", { class: "tag" }, `lap ${lap.l.n}${lap.l.n > 1 ? " · starts at " + secs(lap.s0) : ""}`),
          h("span", { class: "qs mono" }, q.q || D.ask),
          lap.l.n > 1 && q.why ? h("span", { class: "why" }, "Went back because: " + q.why) : null),
        h("div", { class: "axis", style: `width:${(lap.span / maxSpan) * 100}%`, "aria-hidden": "true" }, ticks.map((s) => h("span", { style: `left:${(s / lap.span) * 100}%` }, s + " s"))),
        h("ol", { class: "lanes", style: `--grid:${100 / (lap.span / step)}%` }, visible.map((x) => laneEl(x, lap)))
      );
    });
    const legend = h("p", { class: "legend" }, [["b-search", "● searched"], ["b-wait", "waiting on one source"], ["b-read", "● read"], ["b-notused", "○ read, not handed on"], ["b-fail", "✕ could not open"]].map(([c, k]) => h("span", null, h("i", { class: "bar sw " + c }), k)));
    const figure = h("div", { class: "sig" }, h("p", { class: "ftitle" }, h("b", null, "Where the time went."), " Each bar is as long as that search or page really took. Tap a lane for what the record holds about it."), panels, legend);

    /* ---------------- GROUND: the places it could ask ---------------- */
    const R = D.route;
    const POS = { web: [50, 11], wikipedia: [81, 33], github: [81, 69], archive: [50, 90], openalex: [19, 69], crossref: [19, 33] };
    const asked = new Set(D.engines.map((e) => e.scope));
    const nOf = (sc) => D.engines.filter((e) => e.scope === sc && e.ok).map((e) => e.n || 0);
    const failOf = (sc) => D.engines.find((e) => e.scope === sc && e.ok === false);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100"); svg.setAttribute("preserveAspectRatio", "none"); svg.setAttribute("aria-hidden", "true");
    for (const s of R.scopes) {
      const [x, y] = POS[s.scope]; const ln = document.createElementNS("http://www.w3.org/2000/svg", "line");
      ln.setAttribute("x1", 50); ln.setAttribute("y1", 50); ln.setAttribute("x2", x); ln.setAttribute("y2", y);
      ln.setAttribute("class", "sp " + (failOf(s.scope) ? "fail" : asked.has(s.scope) ? "on" : "off"));
      svg.append(ln);
    }
    const wheel = h("div", { class: "wheel", role: "img", "aria-label": `Asked ${places.size || asked.size} of ${R.scopes.length} places` },
      svg,
      h("div", { class: "hub" }, h("span", { class: "tag" }, "your question")),
      R.scopes.map((s) => {
        const [x, y] = POS[s.scope]; const f = failOf(s.scope);
        const st = f ? "fail" : asked.has(s.scope) ? "on" : "off";
        return h("div", { class: "node " + st, style: `left:${x}%;top:${y}%` }, h("b", null, s.name), h("span", null, f ? "✕ no answer" : st === "on" ? nOf(s.scope).join(" + ") + (nOf(s.scope).length > 1 ? " results" : nOf(s.scope)[0] === 1 ? " result" : " results") : "not asked"));
      })
    );
    const why = h("ul", { class: "whys" },
      R.picked.map((sc) => { const s = R.scopes.find((x) => x.scope === sc); const f = failOf(sc); return h("li", null, h("b", null, s ? s.name : sc), h("span", null, (R.why[sc] || "") + (f ? " — and then: " + f.why : ""))); }),
      R.skipped.length ? h("li", null, h("b", null, R.skipped.map((sc) => R.scopes.find((x) => x.scope === sc).name).join(", ")), h("span", null, "not asked. Unsearched, not empty: the tape records the choice, not a reason for each, and not what those places hold.")) : null
    );
    const ground = h("div", { class: "sig" },
      h("p", { class: "ftitle" }, h("b", null, `Asked ${asked.size} of ${R.scopes.length} places.`), " The question sits at the hub; each spoke is a place it could look. Solid means it asked, dashed means it did not."),
      h("div", { class: "gcols" }, wheel, why));

    /* ---------------- PATTERN: the gate, and the same pages across laps ---------------- */
    const seenU = new Set(); const first = [];
    for (const p of D.pages) if (!seenU.has(p.url)) { seenU.add(p.url); first.push(p); }
    const tally = {}; for (const d of D.demoted) tally[d.reason] = (tally[d.reason] || 0) + 1;
    const gate = h("div", { class: "gate" },
      h("div", { class: "gcol" }, h("p", { class: "kick" }, `Read first · ${first.length}`),
        h("ul", null, first.map((p) => h("li", null, fav(D, p.domain, p.site), h("span", null, pageTitle(p.title)))))),
      h("div", { class: "spine", "aria-hidden": "true" }, h("span", { class: "tag" }, "title gate")),
      h("div", { class: "gcol" }, h("p", { class: "kick" }, `Read last · ${D.demoted.length}`),
        D.demoted.length ? h("ul", null, D.demoted.map((d) => h("li", null, hollowFav(), h("span", null, d.title, h("em", { class: "rs mono" }, d.reason))))) : h("p", { class: "mut" }, "No result was set to the back of the line."),
        D.demoted.length ? h("p", { class: "mut tl" }, "Reasons, as recorded: ", Object.entries(tally).map(([k, n]) => `${k} ×${n}`).join(" · ")) : null,
        h("p", { class: "mut tl" }, "The tape keeps these titles but not their addresses."))
    );
    const hasLaps = D.laps.length > 1;
    const byUrl = new Map(); for (const p of D.pages) { const a = byUrl.get(p.url) || []; a.push(p); byUrl.set(p.url, a); }
    const lapRows = hasLaps ? h("div", { class: "laprows" },
      h("p", { class: "kick" }, "The same pages, lap by lap"),
      h("ul", null, [...byUrl.entries()].map(([u, ps]) => {
        const p = ps[0];
        return h("li", null, h("span", { class: "who" }, fav(D, p.domain, p.site), h("span", { class: "ttl" }, pageTitle(p.title))),
          D.laps.map((l) => { const q = ps.find((x) => x.lap === l.n); return h("span", { class: "cell " + (q ? (q.state === "unread" ? "bad" : "ok") : "none") }, q ? (q.state === "unread" ? "✕ " : "● ") + secs(q.t1 - q.t0) : "—"); }));
      })), h("p", { class: "mut tl" }, "A failed page can fail again in a fraction of a second: the second ✕ is not a second try at the same speed.")) : h("p", { class: "mut tl", style: "margin-top:14px" }, "One lap: no page was tried twice.");
    const pattern = h("div", { class: "sig" },
      h("p", { class: "ftitle" }, h("b", null, "Who got read first, and who got read last."), " A result whose title the gate distrusts goes to the back of the line, with a reason. The reasons are the record’s own words."),
      gate, lapRows);
    return {
      caption: `Searched ${plural(searchesDone.length, "time")} · ${plural(results, "result")} · tried ${plural(tried.size, "page")}${failed.size ? `, ${failed.size} would not open` : ""}`,
      ground, figure, pattern,
      hints: {
        figure: `${plural(D.engines.length, "search", "searches")} and ${plural(new Set(D.pages.map((p) => p.url)).size, "page")}, on the clock`,
        ground: `Asked ${asked.size} of ${R.scopes.length} places${R.webDown || D.engines.some((e) => e.ok === false) ? "; one gave no answer" : ""}`,
        pattern: D.demoted.length ? `${plural(D.demoted.length, "result")} read last: ${Object.keys(tally).join(", ")}` : "No result read last",
      },
    };
  },
};
