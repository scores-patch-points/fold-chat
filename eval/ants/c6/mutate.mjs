// mutate.mjs — delete / invert each gate of fold-chat-fetchedvoice.js in a scratch copy; the test file must then FAIL (a survivor = an untested gate). node eval/ants/c6/mutate.mjs
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SRC = fs.readFileSync(path.join(ROOT, "fold-chat-fetchedvoice.js"), "utf8");
const MUT = [
  ["host drop (primary dropReason)", 'const dropReason = (url) => (ARCHIVE_ALLOW', 'const dropReason = (url) => null; const _x = (url) => (ARCHIVE_ALLOW'],
  ["wikisource allow-list", "ARCHIVE_ALLOW.some((re) => re.test(hostOf(url))) ? null : primaryDrop(url)", "primaryDrop(url)"],
  ["quote-farm host list (classify)", 'if (QUOTE_FARMS.some((re) => re.test(host))) return out("refuse", "host:quote_farm");', ""],
  ["quote-farm host list (fetchVoice pre-read)", 'if (!hostless && QUOTE_FARMS.some', 'if (false && QUOTE_FARMS.some'],
  ["pre-read host skip", 'if (pre && !PLATFORMS.some((re) => re.test(hostOf(url)))) return', 'if (false) return'],
  ["title cues", "for (const [re, why] of TITLE_CUES) if (re.test(ttl) || re.test(meta.h1)) return", "for (const [re, why] of []) if (re.test(ttl) || re.test(meta.h1)) return"],
  ["author_is_other", "if (!matched.length && others.length && arm !== \"features_blind\") return", "if (false) return"],
  ["org words (an org is a person)", "const looksLikePerson = (author) => {", "const looksLikePerson = (author) => true; const _l = (author) => {"],
  ["author given-name requirement", "if (!p.given.length) return true;\n  return p.given.some", "return true;\n  return p.given.some"],
  ["line-anchored byline", "(?:^|\\n)[ \\t]*(?:[Ww]ritten", "(?:^|\\n|\\s)[ \\t]*(?:[Ww]ritten"],
  ["quote share", "if (f.quoteShare >= cfg.quoteShare) return", "if (false) return"],
  ["attribution lines", "if (f.attrLines >= cfg.attrLines) return", "if (false) return"],
  ["biography", "if (f.bio >= cfg.bioRate && f.tp > f.fp) return", "if (false) return"],
  ["third_person_about", "if (f.tp > 0 && f.tp >= 2 * f.fp && f.nm >= cfg.nmThird) return", "if (false) return"],
  ["third_person zero guard", "if (f.tp > 0 && f.tp >= 2 * f.fp", "if (f.tp >= 0 && f.tp >= 2 * f.fp"],
  ["no_attribution", 'if (tier === "none") return out("refuse", "no_attribution", attribution, f);', ""],
  ["first-person threshold", "if (f.fp >= cfg.fpOwn) return out(\"own\"", "if (true) return out(\"own\""],
  ["unsure tier", 'if (tier === "strong") return out("unsure"', 'if (tier === "strong") return out("own"'],
  ["heading-only impersonal refused", 'return out("refuse", `no_first_person:', 'return out("own", `no_first_person:'],
  ["platform gate", 'if (standing.platform && tier !== "strong") return', "if (false) return"],
  ["host_is_person tier", "if (p.surname && (lab === p.surname ||", "if (false && (lab === p.surname ||"],
  ["genre_heading tier", "else if (p.surname && GENRE.test(", "else if (false && GENRE.test("],
  ["heading tier needs a given name", "(!p.given.length || p.given.some((g) => open.includes(g)))) { tier = \"heading\"", "true) { tier = \"heading\""],
  ["too_short", 'if (body.replace(/\\s/g, "").length < 200) return', "if (false) return"],
  ["sha256 of the stored text", "const sha256 = await hash(text);", "const sha256 = await hash(classified.body + ' ');"],
  ["bank.admit verdict check", 'if (!entry || entry.standing?.verdict !== "own" || entry.grade !== "fetched") return false;', 'if (!entry) return false;'],
  ["bank.admit grade check", ' || entry.grade !== "fetched") return false;', ") return false;"],
  ["verify compares sha", "return s === e.source.sha256 ? { ok: true }", "return true ? { ok: true }"],
  ["sentenceBank letters ratio", "if (((s.text.match(/\\p{L}/gu) || []).length) / len < 0.7) continue;", ""],
  ["sentenceBank sentence end", 'if (!/[.!?。！？]["\')\\]”’」』]*$/u.test(s.text)) continue;', ""],
  ["rankHits dropped filter", "if (!platform && (dropReason(h.url) || QUOTE_FARMS.some((re) => re.test(host)))) continue;", ""],
  ["rankHits archive bonus", "const archiveBonus = (host) => (", "const archiveBonus = (host) => (false && "],
  ["voicesFor maxPages", "if (read_n >= lim.maxPages) break;", ""],
  ["AbortError rethrow", 'if (e && (e.name === "AbortError")) throw e;', ""],
  ["gutenberg boilerplate strip", "const body = t.slice(s ? s.index + s[0].length : 0, e ? e.index : t.length)", "const body = t"],
  ["alias match", "person.aliases.some((al) => authorMatches(author, al))", "false"],
];
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "c6mut-"));
for (const f of fs.readdirSync(ROOT)) if (/\.(m?js)$/.test(f) && !f.startsWith("fold-chat-fetchedvoice")) { try { fs.symlinkSync(path.join(ROOT, f), path.join(dir, f)); } catch {} }
fs.copyFileSync(path.join(ROOT, "fold-chat-fetchedvoice.test.mjs"), path.join(dir, "fold-chat-fetchedvoice.test.mjs"));
const run = () => spawnSync("node", ["--test", path.join(dir, "fold-chat-fetchedvoice.test.mjs")], { encoding: "utf8", timeout: 120000 });
fs.writeFileSync(path.join(dir, "fold-chat-fetchedvoice.js"), SRC);
const base = run(); if (base.status !== 0) { console.log("BASELINE FAILS", base.stdout.slice(-800)); process.exit(1); }
let killed = 0, survivors = [], bad = [];
for (const [name, from, to] of MUT) {
  if (!SRC.includes(from)) { bad.push(name); continue; }
  fs.writeFileSync(path.join(dir, "fold-chat-fetchedvoice.js"), SRC.replace(from, to));
  const r = run();
  if (r.status !== 0) { killed++; console.log("killed  ", name); } else { survivors.push(name); console.log("SURVIVED", name); }
}
console.log(`\n${killed}/${MUT.length - bad.length} mutants killed; survivors: ${survivors.join("; ") || "none"}; mutation text not found (fix the runner): ${bad.join("; ") || "none"}`);
fs.rmSync(dir, { recursive: true, force: true });
