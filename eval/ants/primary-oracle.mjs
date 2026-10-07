// eval/ants/primary-oracle.mjs — the scoring, INDEPENDENT of fold-chat-primary.js. Pure: looks only at the returned pages (url + text) and the labelled corpus.
//   classifyPage(page, claim, corpus) → { cls, host, why }
//     forbidden            host is Wikipedia/sister/mirror/other encyclopedia/content farm (corpus.forbid)
//     reach                host is one of the claim's hostsOk AND every `say` regex matches the page text
//     host_ok_text_fails   the right kind of site, but the page text does not carry the claim's say-regexes
//     unlisted_passes_text host not on either list, text carries every say-regex (NOT counted as reach: a person judges)
//     unlisted_fails_text  host not on either list and the text does not say it
//   scoreClaim(result, claim, corpus) → { reach, mirrorFA, wrongFA, abstained, pages[] }
//   scoreAll(rows) → totals
const hostOf = (u) => { try { return new URL(String(u)).hostname.toLowerCase().replace(/^www\./, ""); } catch { return ""; } };
const norm = (t) => String(t ?? "").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, " ").toLowerCase();
const anyRe = (list, h) => (list || []).some((s) => new RegExp(s, "i").test(h));

export function classifyPage(page, claim, corpus) {
  const host = hostOf(page?.url);
  if (!host) return { cls: "unlisted_fails_text", host, why: "no_host" };
  if (anyRe(corpus.forbid.hosts, host) || new RegExp(corpus.forbid.wikiLike, "i").test(host)) return { cls: "forbidden", host, why: "forbidden_host" };
  const text = norm(page.text);
  const says = (claim.say || []).every((s) => new RegExp(s, "i").test(text));
  const hostOk = anyRe(claim.hostsOk, host);
  if (hostOk) return says ? { cls: "reach", host, why: "ok_host_and_text" } : { cls: "host_ok_text_fails", host, why: "text_lacks:" + (claim.say || []).filter((s) => !new RegExp(s, "i").test(text)).join("|") };
  return says ? { cls: "unlisted_passes_text", host, why: "unlisted_host" } : { cls: "unlisted_fails_text", host, why: "unlisted_host_text_lacks" };
}

export function scoreClaim(result, claim, corpus) {
  const pages = (result?.passages || []).map((p) => ({ url: p.url, title: p.title || "", ...classifyPage(p, claim, corpus) }));
  const mirrorFA = pages.filter((p) => p.cls === "forbidden").length;
  const wrongFA = pages.filter((p) => p.cls === "host_ok_text_fails" || p.cls === "unlisted_fails_text").length;
  const hasReach = pages.some((p) => p.cls === "reach");
  return { id: claim.id, reach: hasReach && mirrorFA === 0, reachedButTainted: hasReach && mirrorFA > 0, mirrorFA, wrongFA, unlistedPass: pages.filter((p) => p.cls === "unlisted_passes_text").length, abstained: pages.length === 0, pages };
}

export function scoreAll(rows) {
  const n = rows.length, sum = (f) => rows.reduce((a, r) => a + f(r), 0);
  return {
    claims: n,
    reach: sum((r) => (r.reach ? 1 : 0)), reachRate: n ? sum((r) => (r.reach ? 1 : 0)) / n : 0,
    mirrorFA_pages: sum((r) => r.mirrorFA), mirrorFA_claims: sum((r) => (r.mirrorFA ? 1 : 0)),
    wrongFA_pages: sum((r) => r.wrongFA), wrongFA_claims: sum((r) => (r.wrongFA ? 1 : 0)),
    unlistedPass_pages: sum((r) => r.unlistedPass),
    abstained: sum((r) => (r.abstained ? 1 : 0)),
  };
}
