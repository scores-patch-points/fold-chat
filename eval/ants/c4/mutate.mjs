// mutation check for fold-chat-budget.js: each gate deleted/altered must make fold-chat-budget.test.mjs fail. Works on a COPY (scratch dir), never edits the module.
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { spawnSync } from "node:child_process";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const src = fs.readFileSync(path.join(ROOT, "fold-chat-budget.js"), "utf8");
const test = fs.readFileSync(path.join(ROOT, "fold-chat-budget.test.mjs"), "utf8");
const M = [
  ["cap not enforced", "if (room(kind, tier) < w) return refuse(kind, tier, key, why(kind, tier));", ""],
  ["reserve of higher tiers ignored", "const reserve = (k, tier) => TIERS.slice(0, TIERS.indexOf(tier))", "const reserve = (k, tier) => [].slice(0, TIERS.indexOf(tier))"],
  ["done() releases nothing", "done(tier) { if (TIERS.includes(tier)) doneTiers.add(tier); return api; }", "done(tier) { return api; }"],
  ["done tiers still reserved", "(doneTiers.has(t) ? 0 : Math.max(0, cfg[k][t] - spent[k][t]))", "Math.max(0, cfg[k][t] - spent[k][t])"],
  ["key dedupe off", "if (id && seen.has(id)) return { ok: true, free: true };", ""],
  ["key not remembered", "spent[kind][tier] += w; if (id) seen.add(id);", "spent[kind][tier] += w;"],
  ["key shared across kinds", 'const id = key == null ? null : kind + "\\u0000" + String(key);', "const id = key == null ? null : String(key);"],
  ["time never up", "const timeUp = (tier, kind = null) => (kind === \"models\" && !cfg.timeModels ? false : elapsed() >= (tier === \"answer\" ? cfg.ms * 2 : cfg.ms));", "const timeUp = (tier, kind = null) => false;"],
  ["answer tier gets no time grace", "(tier === \"answer\" ? cfg.ms * 2 : cfg.ms)", "cfg.ms"],
  ["answer tier gets too much grace", "(tier === \"answer\" ? cfg.ms * 2 : cfg.ms)", "(tier === \"answer\" ? cfg.ms * 3 : cfg.ms)"],
  ["exhausted ignores time", "return timeUp(tier, kind) || room(kind, tier) < 1;", "return room(kind, tier) < 1;"],
  ["exhausted off by one", "return timeUp(tier, kind) || room(kind, tier) < 1;", "return timeUp(tier, kind) || room(kind, tier) < 2;"],
  ["exhausted ms always false", 'if (kind === "ms") return TIERS.includes(tier) ? timeUp(tier) : true;', 'if (kind === "ms") return false;'],
  ["unknown kind throws/accepted", "if (!valid(kind, tier)) return { ok: false, why: \"unknown\" };\n      const w", "const w"],
  ["hedge cap off", "if (n >= cfg.hedge) return false;", ""],
  ["hedge counted for direct too", 'if (info.proxy && !budget.hedgeSlot(info.key))', 'if (!budget.hedgeSlot(info.key))'],
  ["refused read still hedges", 'r.ok ? { ok: true, hedge: cfg.hedge, ...(r.free ? { free: true } : {}) } : { ok: false, hedge: 0, why: r.why }', 'r.ok ? { ok: true, hedge: cfg.hedge, ...(r.free ? { free: true } : {}) } : { ok: false, hedge: cfg.hedge, why: r.why }'],
  ["guardFetch sends when refused", "if (!r.ok) return Promise.reject(new BudgetRefused({ kind: info.kind, tier: t, why: r.why, key: info.key }));", ""],
  ["guardFetch counts housekeeping", "if (!info || info.kind === \"models\") return fetchImpl(url, opts);", "if (info && info.kind === \"models\") return fetchImpl(url, opts);"],
  ["proxy unwrap off (codetabs)", "/^https?:\\/\\/api\\.codetabs\\.com\\/v1\\/proxy\\?quest=(.+)$/i,", ""],
  ["proxy unwrap off (corsproxy)", "/^https?:\\/\\/corsproxy\\.io\\/\\?url=(.+)$/i,", ""],
  ["proxy unwrap off (cors.eu.org)", "/^https?:\\/\\/cors\\.eu\\.org\\/(.+)$/i,", ""],
  ["proxy unwrap off (thingproxy)", "/^https?:\\/\\/thingproxy\\.freeboard\\.io\\/fetch\\/(.+)$/i,", ""],
  ["proxy unwrap off (relay raw)", "/^https?:\\/\\/[^/]+\\/raw\\?url=(.+)$/i,", ""],
  ["parse key per request not per page", 'key: "page:" + (u.searchParams.get("page") || u.search) };', 'key: "page:" + u.search };'],
  ["loopback counted", "if (LOOPBACK.test(u.host)) return /\\/v1\\/chat\\/completions$/.test(u.pathname) && String(method).toUpperCase() === \"POST\" ? { kind: \"models\", key: null } : null;", ""],
  ["dedupe off by default", "dedupe = true } = {}) {\n  const flights", "dedupe = false } = {}) {\n  const flights"],
  ["dedupe shares non-GET", 'if (dedupe && method === "GET") {', "if (dedupe) {"],
  ["dedupe hands out the original (body consumed twice)", "return flights.get(u).then((res) => (res && typeof res.clone === \"function\" ? res.clone() : res));", "return flights.get(u);"],
  ["dedupe caches failures", "p.catch(() => flights.delete(u));", ""],
  ["ladder null ignored", "if (t == null) return Promise.reject(new BudgetRefused({ kind: info.kind, tier: \"none\", why: \"ladder\", key: info.key }));", ""],
  ["timeModels ignored (models always timed)", 'kind === "models" && !cfg.timeModels ? false :', "false ? false :"],
  ["timeModels ignored (models never timed)", 'kind === "models" && !cfg.timeModels ? false :', 'kind === "models" ? false :'],
  ["timeModels exhausted ignores kind", "return timeUp(tier, kind) || room(kind, tier) < 1;", "return timeUp(tier) || room(kind, tier) < 1;"],
  ["timeModels remaining ignores kind", "!timeUp(tier, kind) ? room(kind, tier) : 0;", "!timeUp(tier) ? room(kind, tier) : 0;"],
  ["timeModels why ignores kind", "(timeUp(tier, kind) ? \"time\"", "(timeUp(tier) ? \"time\""],
  ["partial config ignores the named preset", "{ ...(PRESETS[preset] || PRESETS.balanced), ...config }", "{ ...PRESETS.balanced, ...config }"],
  ["config junk not normalised", "const nn = (v, d = 0) => (Number.isFinite(+v) && +v >= 0 ? Math.floor(+v) : d);", "const nn = (v, d = 0) => v;"],
  ["chat preset allows web", "chat:     Object.freeze({ web: { answer: 0,", "chat:     Object.freeze({ web: { answer: 1,"],
  ["balanced pages cap changed", "pages: { answer: 2, corroborate: 1, origin: 1 }, models: { answer: 1, corroborate: 1, origin: 0 }, ms: 20000, hedge: 2", "pages: { answer: 2, corroborate: 1, origin: 2 }, models: { answer: 1, corroborate: 1, origin: 0 }, ms: 20000, hedge: 2"],
  ["presetFor ignores wantWeb", 'if (!wantWeb) return "chat";', ""],
  ["refusal not recorded", "if (refused.length < 60) refused.push(", "if (false) refused.push("],
  ["snapshot not plain", "return JSON.parse(JSON.stringify({ schema", "return ({ schema"],
  ["impure: setTimeout", "const elapsed = () =>", "setTimeout(() => {}, 0); const elapsed = () =>"],
  ["why wrong (spent vs reserved)", ': total(kind) >= cap(kind) ? "spent" : "reserved-for-higher-priority"', ': "spent"'],
];
let killed = 0; const survivors = [];
for (const [name, from, to] of M) {
  if (!src.includes(from)) { console.log("MUTANT SITE NOT FOUND:", name); survivors.push(name + " (site missing)"); continue; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c4mut-"));
  fs.writeFileSync(path.join(dir, "fold-chat-budget.js"), src.replace(from, to));
  fs.writeFileSync(path.join(dir, "fold-chat-budget.test.mjs"), test);
  const r = spawnSync("node", ["--test", "fold-chat-budget.test.mjs"], { cwd: dir, encoding: "utf8" });
  const dead = r.status !== 0; if (dead) killed++; else survivors.push(name);
  console.log((dead ? "killed   " : "SURVIVED ") + name);
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(`\n${killed}/${M.length} mutants killed` + (survivors.length ? "; survivors: " + survivors.join(" | ") : ""));
