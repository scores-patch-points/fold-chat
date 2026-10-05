// verify-gold.mjs — checks every ask's GOLD against its canonical source(s). Reads ONLY canon URLs (never the pipeline's output).
//   node eval/snips/verify-gold.mjs [--ids ...]      -> gold-verify.json (+ stdout table)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { get, closeNet } from "./lib/net.mjs";
import { recipeDataFromHtml } from "./app/fold-chat-web.js";
import { gnorm, visibleNorm, decodeEntities } from "./lib/text.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const { asks } = JSON.parse(fs.readFileSync(path.join(here, "asks.json"), "utf8"));
const argv = process.argv.slice(2); const ids = (argv.includes("--ids") ? argv[argv.indexOf("--ids") + 1] : "").split(",").filter(Boolean);
const re = (s) => new RegExp(s, "iu");
const wikiExtract = async (lang, title) => {
  const r = await get(`https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exlimit=1&redirects=1&format=json&titles=${encodeURIComponent(title)}`, { transport: "node" });
  if (r.status !== 200) return { ok: false, why: "HTTP " + r.status };
  try { const j = JSON.parse(r.body.toString("utf8")); const p = Object.values(j.query.pages)[0]; return p.extract ? { ok: true, text: p.extract, title: p.title } : { ok: false, why: "no extract" }; } catch (e) { return { ok: false, why: "bad json" }; }
};
const langlinks = new Map();
async function xlTitle(enTitle, lang) {
  if (lang === "en") return enTitle;
  if (!langlinks.has(enTitle)) { const r = await get(`https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(enTitle)}&prop=langlinks&lllimit=500&redirects=1&format=json`, { transport: "node" }); let m = {}; try { const j = JSON.parse(r.body.toString("utf8")); for (const l of Object.values(j.query.pages)[0].langlinks || []) m[l.lang] = l["*"]; } catch {} langlinks.set(enTitle, m); }
  return langlinks.get(enTitle)[lang] || null;
}
async function canonText(spec, ask) {
  if (spec.startsWith("wiki:")) { const w = await wikiExtract("en", decodeURIComponent(spec.slice(5)).replace(/_/g, " ")); return { spec, ...w }; }
  if (spec.startsWith("xl:")) { const en = spec.slice(3).replace(/_/g, " "); const t = await xlTitle(en, ask.language); if (!t) return { spec, ok: false, why: "no langlink for " + ask.language }; const w = await wikiExtract(ask.language, t); return { spec: `${ask.language}.wikipedia:${t}`, ...w }; }
  const r = await get(spec, { transport: "chromium" });
  if (r.status < 200 || r.status >= 300) return { spec, ok: false, why: r.error || "HTTP " + r.status };
  const raw = r.body.toString("utf8");
  const ldStrings = [...raw.matchAll(/<script[^>]*ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1]).join(" ");
  const rec = recipeDataFromHtml(raw);
  return { spec, ok: true, text: visibleNorm(raw) + " " + decodeEntities(ldStrings), recipe: rec, title: (/<title[^>]*>([^<]*)/i.exec(raw) || [])[1] || "" };
}
const out = [];
for (const a of asks) {
  if (ids.length && !ids.includes(a.id)) continue;
  const g = a.gold;
  if (g.expect === "gap" && !(a.canon || []).length) { out.push({ id: a.id, status: "n/a-gap", note: "no canonical answer exists (typed gap is correct)" }); continue; }
  const per = []; let all = "";
  for (const c of a.canon || []) {
    const t = await canonText(c, a);
    const text = t.ok ? gnorm(t.text) : "";
    all += " " + text;
    const miss = t.ok ? (g.all || []).filter((x) => !re(x).test(text)) : null;
    per.push({ spec: t.spec, ok: t.ok, why: t.why || null, chars: text.length, missing: miss, recipe: t.recipe ? { ing: t.recipe.ingredients.length, steps: t.recipe.steps.length } : null });
  }
  let status;
  if (g.expect === "correction") status = re(g.correction).test(all) ? "pass" : "fail";
  else {
    const anyOk = per.some((p) => p.ok);
    const miss = (g.all || []).filter((x) => !re(x).test(gnorm(all)));
    const anyRe = (g.any || []).length ? (g.any || []).some((x) => re(x).test(gnorm(all))) : true;
    status = !anyOk ? "unreadable" : miss.length || !anyRe ? "fail" : "pass";
    if (g.struct === "recipe" && status === "pass" && !per.some((p) => p.recipe && p.recipe.ing >= 3 && p.recipe.steps >= 2)) status = "pass-no-recipe-block";
  }
  out.push({ id: a.id, class: a.class, status, per });
  console.log(a.id.padEnd(12), status.padEnd(20), per.map((p) => `${p.ok ? "ok" : "X:" + p.why}${p.missing && p.missing.length ? " miss:" + p.missing.join("|").slice(0, 30) : ""}${p.recipe ? ` r${p.recipe.ing}/${p.recipe.steps}` : ""}`).join("  ;  "));
}
fs.writeFileSync(path.join(here, "gold-verify.json"), JSON.stringify({ at: new Date().toISOString(), results: out }, null, 1));
const by = {}; for (const o of out) by[o.status] = (by[o.status] || 0) + 1; console.log(by);
await closeNet();
