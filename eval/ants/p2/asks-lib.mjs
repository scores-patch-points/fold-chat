// asks-lib.mjs — assembles the passages for an ask from the REAL page pool and checks the hand-written gold against them.
//   ask = { id, type, lang, q, page, others:[…], key, min, answerable }
//   page / others are a pool id ("A:<hash>") or a Wikipedia title ("wiki:<Title>") or "html:<cache-file-prefix>" (an HTML page read by regionOfHtml + declaredBlocksFromHtml, as the app does).
//   key = the shortest verbatim string that IS the answer (a figure, a name, a date…); min = the shortest verbatim clause that carries it WITH the subject it needs.
import fs from "node:fs"; import path from "node:path";
import { loadPool } from "./pool.mjs";
import { regionOfHtml, titleOfHtml } from "../../../fold-chat-region.js";
import { declaredBlocksFromHtml } from "../../../fold-chat-strand.js";
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");
const CAP = 24000;   // the app reads at most this much of a page
let POOL = null; const pool = () => (POOL ||= loadPool());
const htmlCache = new Map();
function htmlPassage(prefix) {
  if (htmlCache.has(prefix)) return htmlCache.get(prefix);
  const d = path.join(ROOT, "eval/snips/cache"); const f = fs.readdirSync(d).find((x) => x.startsWith(prefix) && x.endsWith(".body"));
  if (!f) throw new Error("no html " + prefix);
  const raw = fs.readFileSync(path.join(d, f), "utf8"); const meta = JSON.parse(fs.readFileSync(path.join(d, f.replace(".body", ".json")), "utf8"));
  const text = regionOfHtml(raw).text.slice(0, CAP);
  const url = (meta.url.match(/[?&]url=([^&]+)/) ? decodeURIComponent(RegExp.$1) : meta.url);
  const p = { id: "H:" + prefix, text, url, ref: new URL(url).hostname.replace(/^www\./, "") + " — " + (titleOfHtml(raw) || prefix), declared: declaredBlocksFromHtml(raw).filter((b) => b.kind === "faq" || b.kind === "qa" || b.kind === "howto") };
  htmlCache.set(prefix, p); return p;
}
export function passageOf(spec) {
  if (spec.startsWith("html:")) return htmlPassage(spec.slice(5));
  let p;
  if (spec.startsWith("wiki:")) { const t = spec.slice(5).toLowerCase(); p = pool().find((x) => x.kind === "wiki" && x.title.toLowerCase() === t); }
  else p = pool().find((x) => x.id === spec);
  if (!p) throw new Error("no page " + spec);
  return { id: p.id, text: p.text.slice(0, CAP), url: p.url || (p.kind === "wiki" ? p.url : null), ref: (p.title || p.id) };
}
export const passagesOf = (ask) => [ask.page, ...(ask.others || [])].map(passageOf);
const sq = (s) => String(s).replace(/\s+/g, " ").trim();
export function validate(ask) {
  const errs = [];
  const ps = passagesOf(ask); const hay = sq(ps[0].text) + " " + (ps[0].declared || []).flatMap((b) => b.items).map(sq).join(" ");
  if (ask.answerable !== false) {
    if (!hay.includes(sq(ask.key))) errs.push("key not in page");
    if (!hay.includes(sq(ask.min))) errs.push("min not in page");
    if (!sq(ask.min).includes(sq(ask.key))) errs.push("key not in min");
  }
  return errs;
}
