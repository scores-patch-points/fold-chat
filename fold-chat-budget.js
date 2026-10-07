// fold-chat-budget.js — THE PER-ASK REQUEST BUDGET. One chat ask used to fan out to ~30 wire requests (measured, eval/ants/C4-RESULTS.md): two searches, every
// page read = 1 direct fetch + 6 CORS-proxy hedges, the encyclopedia article fetched once per claim, then a second and third model call. The user: "it never should
// have fanned out to all that". This module is the ONE object an ask carries so every step can ask "may I?" before it goes out, and the answer is typed.
//
// PURE: no DOM, no fetch, no timers, no storage. The clock is injected (`now`); the network is whatever `guardFetch` is handed. Nothing here makes a request.
//
//   makeBudget({ preset | config, now })  → budget
//   budget.spend(kind, tier, key?, n?)    → { ok:true, free? } | { ok:false, why }       kinds: web | pages | models      tiers: answer > corroborate > origin
//   budget.exhausted(kind[, tier])        → boolean   exactly "the next spend of that kind (for that tier) would be refused"; kind "ms" asks about the clock
//   budget.done(tier)                     → release that tier's unspent allowance to the tiers below it (a step that has finished says so)
//   budget.readPlan(url, tier)            → { ok, hedge, why? }   one logical page read: charges `pages` once per URL, returns how many CORS proxies may be raced with it
//   budget.hedge()                        → proxies per read the budget allows
//   budget.count(kind) / remaining(kind[, tier]) / elapsed() / snapshot()
//   guardFetch(budget, fetchImpl, { tier, classify }) → a fetchImpl that spends before it sends and rejects with a typed BudgetRefused when refused
//   classifyUrl(url, method?)             → { kind, key } | null    a wire URL as the unit the budget counts (a proxy-wrapped page is its TARGET; the same API call is one key)
//
// PRIORITIES (the user's order, 2026-10-06): the answer's own needs first; corroboration second; following an encyclopedia's footnotes to the original third.
//   * a lower tier can never spend what a higher tier that is NOT yet done() still holds in reserve;
//   * a higher tier may spend any lower tier's unspent allowance (the answer takes what it needs);
//   * done(tier) frees that tier's unspent allowance downward (the answer step ended with a spare search: corroboration may use it);
//   * the clock stops corroborate and origin at `ms`; the answer tier may run to 2 x `ms`;
//   * the same key charges ONCE (one page's proxy hedges, the article fetched per claim): the second ask for it is free.
// The numbers are DECLARED, not measured (Constitution II.11). Giver: the user's brief of 2026-10-06; tested by eval/ants/C4-RESULTS.md.

export const KINDS = Object.freeze(["web", "pages", "models"]);
export const TIERS = Object.freeze(["answer", "corroborate", "origin"]);   // priority order, highest first

/** Declared allowances (kind → tier → n). `ms` is the wall clock of the ask; `hedge` is how many CORS proxies may be raced with one page read's direct fetch. */
export const PRESETS = Object.freeze({
  chat:     Object.freeze({ web: { answer: 0, corroborate: 0, origin: 0 }, pages: { answer: 0, corroborate: 0, origin: 0 }, models: { answer: 1, corroborate: 0, origin: 0 }, ms: 15000, hedge: 0 }),
  fast:     Object.freeze({ web: { answer: 1, corroborate: 0, origin: 0 }, pages: { answer: 2, corroborate: 0, origin: 0 }, models: { answer: 1, corroborate: 0, origin: 0 }, ms: 8000, hedge: 1 }),
  balanced: Object.freeze({ web: { answer: 2, corroborate: 1, origin: 0 }, pages: { answer: 2, corroborate: 1, origin: 1 }, models: { answer: 1, corroborate: 1, origin: 0 }, ms: 20000, hedge: 2 }),
  deep:     Object.freeze({ web: { answer: 3, corroborate: 2, origin: 1 }, pages: { answer: 4, corroborate: 2, origin: 2 }, models: { answer: 1, corroborate: 1, origin: 1 }, ms: 45000, hedge: 3 }),
});

/** The preset an ask gets: no lookup → "chat" (the model alone has nothing to fetch for); otherwise the effort the composer set (fast | balanced | deep). */
export function presetFor({ effort = "balanced", wantWeb = true } = {}) {
  if (!wantWeb) return "chat";
  return Object.prototype.hasOwnProperty.call(PRESETS, effort) && effort !== "chat" ? effort : "balanced";
}

const nn = (v, d = 0) => (Number.isFinite(+v) && +v >= 0 ? Math.floor(+v) : d);

/** A normalised plain-JSON config from a preset name or a (possibly partial / junk) object. Never throws. */
export function configOf(spec = "balanced") {
  const base = typeof spec === "string" ? (PRESETS[spec] || PRESETS.balanced) : PRESETS.balanced;
  const given = spec && typeof spec === "object" ? spec : {};
  // timeModels: does `ms` also stop MODEL calls? true = yes (the pre-registered behaviour); false = `ms` is the clock of the network kinds only (web, pages), because a small local
  // model's own latency is not fan-out (measured, C4-RESULTS.md: ms 20000 cut the provenance call in 4 of 6 asks on gemma2:2b)
  const out = { ms: nn(given.ms, base.ms), hedge: nn(given.hedge, base.hedge), timeModels: given.timeModels === false ? false : true };
  for (const k of KINDS) {
    out[k] = {};
    for (const t of TIERS) out[k][t] = nn(given[k] && given[k][t], base[k][t]);
  }
  return out;
}

export class BudgetRefused extends Error {
  constructor(info) { super(`budget refused ${info.kind}/${info.tier}: ${info.why}`); this.name = "BudgetRefused"; this.kind = info.kind; this.tier = info.tier; this.why = info.why; this.key = info.key ?? null; }
}

export function makeBudget({ preset = "balanced", config = null, now = () => 0 } = {}) {
  const cfg = configOf(config ? { ...(PRESETS[preset] || PRESETS.balanced), ...config } : preset);   // a partial `config` overrides the named preset (e.g. { timeModels: false })
  const t0 = Number(now());
  const spent = {}; const doneTiers = new Set(); const seen = new Set(); const refused = []; const proxies = new Map();
  for (const k of KINDS) { spent[k] = {}; for (const t of TIERS) spent[k][t] = 0; }
  const cap = (k) => TIERS.reduce((n, t) => n + cfg[k][t], 0);
  const total = (k) => TIERS.reduce((n, t) => n + spent[k][t], 0);
  const elapsed = () => Math.max(0, Number(now()) - t0);
  const timeUp = (tier, kind = null) => (kind === "models" && !cfg.timeModels ? false : elapsed() >= (tier === "answer" ? cfg.ms * 2 : cfg.ms));
  // what the tiers ABOVE `tier` that are still working still hold: their allowance less what they have spent
  const reserve = (k, tier) => TIERS.slice(0, TIERS.indexOf(tier)).reduce((n, t) => n + (doneTiers.has(t) ? 0 : Math.max(0, cfg[k][t] - spent[k][t])), 0);
  const room = (k, tier) => Math.max(0, cap(k) - total(k) - reserve(k, tier));
  const valid = (kind, tier) => KINDS.includes(kind) && TIERS.includes(tier);
  const why = (kind, tier) => (timeUp(tier, kind) ? "time" : cap(kind) === 0 ? "none-allowed" : total(kind) >= cap(kind) ? "spent" : "reserved-for-higher-priority");
  const refuse = (kind, tier, key, w) => { if (refused.length < 60) refused.push({ kind, tier, key: key ?? null, why: w, at: elapsed() }); return { ok: false, why: w }; };

  const api = {
    config: cfg,
    elapsed,
    count: (kind) => (KINDS.includes(kind) ? total(kind) : 0),
    hedge: () => cfg.hedge,
    remaining(kind, tier = "answer") { return valid(kind, tier) && !timeUp(tier, kind) ? room(kind, tier) : 0; },
    spend(kind, tier, key = null, n = 1) {
      if (!valid(kind, tier)) return { ok: false, why: "unknown" };
      const w = Math.max(1, nn(n, 1));
      const id = key == null ? null : kind + "\u0000" + String(key);
      if (id && seen.has(id)) return { ok: true, free: true };
      if (timeUp(tier, kind)) return refuse(kind, tier, key, "time");
      if (room(kind, tier) < w) return refuse(kind, tier, key, why(kind, tier));
      spent[kind][tier] += w; if (id) seen.add(id);
      return { ok: true };
    },
    exhausted(kind, tier = "answer") {
      if (kind === "ms") return TIERS.includes(tier) ? timeUp(tier) : true;
      if (!valid(kind, tier)) return true;
      return timeUp(tier, kind) || room(kind, tier) < 1;
    },
    done(tier) { if (TIERS.includes(tier)) doneTiers.add(tier); return api; },
    /** May one more PROXY be raced for this page's read? At most `hedge` per key (the direct fetch is not a proxy and is never counted here). */
    hedgeSlot(key) { const id = String(key); const n = proxies.get(id) || 0; if (n >= cfg.hedge) return false; proxies.set(id, n + 1); return true; },
    readPlan(url, tier) {
      const r = api.spend("pages", tier, url);
      return r.ok ? { ok: true, hedge: cfg.hedge, ...(r.free ? { free: true } : {}) } : { ok: false, hedge: 0, why: r.why };
    },
    snapshot() { return JSON.parse(JSON.stringify({ schema: "AskBudget@1", config: cfg, spent, done: [...doneTiers], refused, elapsedMs: elapsed() })); },
  };
  return api;
}

// ── the wire, as the budget counts it ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A page behind a CORS proxy is the TARGET page, not the proxy (all hedges of one read are one key); an encyclopedia's own API is `web` for a search/extract and
// `pages` for an article read (action=parse); a model call is `models`; the page's own housekeeping (loopback, /heimdall/api/*) is not counted at all.
const PROXY_WRAPS = [
  /^https?:\/\/[^/]+\/raw\?url=(.+)$/i,                // the fold's relay /raw and allorigins' /raw
  /^https?:\/\/api\.codetabs\.com\/v1\/proxy\?quest=(.+)$/i,
  /^https?:\/\/corsproxy\.io\/\?url=(.+)$/i,
  /^https?:\/\/cors\.eu\.org\/(.+)$/i,
  /^https?:\/\/thingproxy\.freeboard\.io\/fetch\/(.+)$/i,
  /^https?:\/\/r\.jina\.ai\/(.+)$/i,
  /^https?:\/\/api\.microlink\.io\/\?[^#]*?url=([^&]+)/i,
];
const safeDecode = (s) => { try { return decodeURIComponent(s); } catch { return s; } };
const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[::1\])(:\d+)?$/i;

export function classifyUrl(url, method = "GET") {
  const raw = String(url ?? "");
  let u; try { u = new URL(raw); } catch { return null; }
  if (LOOPBACK.test(u.host)) return /\/v1\/chat\/completions$/.test(u.pathname) && String(method).toUpperCase() === "POST" ? { kind: "models", key: null } : null;
  if (/\/search$/.test(u.pathname) && /(^|[?&])scope=/.test(u.search) && /holodeck-proxy/i.test(u.host)) return { kind: "web", key: "search:" + u.searchParams.get("scope") + ":" + u.searchParams.get("q") };
  if (/(^|\.)wikipedia\.org$/i.test(u.host) && /\/w\/api\.php$/.test(u.pathname)) {
    const a = u.searchParams.get("action"), list = u.searchParams.get("list"), prop = u.searchParams.get("prop") || "";
    if (a === "parse") return { kind: "pages", key: "page:" + (u.searchParams.get("page") || u.search) };   // the article, once per page however many claims ask
    if (a === "query" && list === "search") return { kind: "web", key: "search:wikipedia:" + u.searchParams.get("srsearch") };
    if (a === "query" && /extracts/.test(prop)) return { kind: "pages", key: "page:" + (u.searchParams.get("titles") || u.search) };
    return { kind: "web", key: "api:" + u.search };
  }
  if (/(^|\.)(github\.com|archive\.org|openalex\.org|crossref\.org|duckduckgo\.com|bing\.com|search\.brave\.com)$/i.test(u.host) && /(search|query|works|advancedsearch|\/html)/i.test(u.pathname + u.search)) return { kind: "web", key: "search:" + u.host + ":" + u.search };
  for (const re of PROXY_WRAPS) { const m = re.exec(raw); if (m) return { kind: "pages", key: "page:" + safeDecode(m[1]).replace(/#.*$/, ""), proxy: true }; }
  return { kind: "pages", key: "page:" + raw.replace(/#.*$/, "") };
}

/** A fetchImpl that asks the budget first. `tier` is a name or a function (info, budget) → name, so the call site can say "the first two pages are the answer's,
 *  the third is corroboration"; a function may return null to refuse without asking ("the ladder is full"). A refused call REJECTS with BudgetRefused (a typed
 *  error the step reports in its trace; it never looks like a network failure), and nothing is sent. `models` are not fetches here: the model door spends its
 *  own. A URL the budget does not count (loopback housekeeping) passes through. `dedupe` (default on): a GET of the SAME url already sent by this ask shares that
 *  one request (each caller gets its own clone of the response) — the encyclopedia article that originatePassages used to fetch once per claim goes out once. */
export function guardFetch(budget, fetchImpl, { tier = "answer", classify = classifyUrl, dedupe = true } = {}) {
  const flights = new Map();
  return (url, opts = {}) => {
    const u = typeof url === "string" ? url : url && url.url ? url.url : String(url);
    const method = String((opts && opts.method) || "GET").toUpperCase();
    const info = classify(u, method);
    if (!info || info.kind === "models") return fetchImpl(url, opts);
    const t = typeof tier === "function" ? tier(info, budget) : tier;
    if (t == null) return Promise.reject(new BudgetRefused({ kind: info.kind, tier: "none", why: "ladder", key: info.key }));
    const r = budget.spend(info.kind, t, info.key);
    if (!r.ok) return Promise.reject(new BudgetRefused({ kind: info.kind, tier: t, why: r.why, key: info.key }));
    if (info.proxy && !budget.hedgeSlot(info.key)) return Promise.reject(new BudgetRefused({ kind: info.kind, tier: t, why: "hedge", key: info.key }));
    if (dedupe && method === "GET") {
      if (flights.has(u)) return flights.get(u).then((res) => (res && typeof res.clone === "function" ? res.clone() : res));
      const p = Promise.resolve(fetchImpl(url, opts));
      flights.set(u, p); p.catch(() => flights.delete(u));
      return p.then((res) => (res && typeof res.clone === "function" ? res.clone() : res));
    }
    return fetchImpl(url, opts);
  };
}
