#!/usr/bin/env node
// eval/ants/A2-mutate.mjs — mutation check for fold-chat-primary.js: delete one gate at a time in a COPY, run the test file against it (PRIMARY_MODULE), and require a failure.
// A mutant that survives is reported (an untested gate, or an equivalent mutant) — never hidden. Usage: node eval/ants/A2-mutate.mjs
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const src = fs.readFileSync(path.join(root, "fold-chat-primary.js"), "utf8");
const nth = (s, needle, n, rep) => { let at = -1; for (let i = 0; i <= n; i++) at = s.indexOf(needle, at + 1); if (at < 0) throw new Error("no occurrence " + n + " of " + needle); return s.slice(0, at) + rep + s.slice(at + needle.length); };
const sub = (a, b) => (s) => { if (!s.includes(a)) throw new Error("mutation target missing: " + a); return s.replace(a, b); };
const ABORT = "if (isAbort(e)) throw e;";
const M = [
  ["mirror by sentence overlap", sub("return fraction >= overlap ?", "return false ?")],
  ["mirror by host list", sub("if (MIRROR_HOSTS.some((re) => re.test(host)))", "if (false)")],
  ["mirror by attribution marker", sub("const mark = COPY_MARKERS.find((re) => re.test(text));", "const mark = null;")],
  ["tertiary host drop (isTertiary)", sub("if (isTertiary(url))", "if (false)")],
  ["other encyclopedias drop", sub("if (ENCYCLOPEDIAS.some((re) => re.test(host)))", "if (false)")],
  ["content farm / Q&A / social drop", sub("if (k.drop)", "if (false)")],
  ["the index host itself dropped", sub("if (indexHost && host ===", "if (false && host ===")],
  ["assertion gate: denial", sub("if (s.deny !== c.deny)", "if (false)")],
  ["assertion gate: hedge", sub("if (s.hedge !== c.hedge)", "if (false)")],
  ["assertion gate: question", sub("if (s.question)", "if (false)")],
  ["assertion gate: polarity", sub("if (s.neg !== c.neg)", "if (false)")],
  ["strict gate: every content stem", sub("if (lacking.length)", "if (false)")],
  ["strict gate not applied at all", sub("if (gate.ok) return", "if (true) return")],
  ["gate: the answer's 'according to' stripped", sub("replace(/,?\\s*according to [^,.;]*[,]?/gi, \" \")", "replace(/zzz/g, \" \")")],
  ["gate: the index host's name dropped from the stems", sub(".filter((s) => !drop.has(s))", "")],
  ["verifier call (provenance's verifyNumber)", sub("const v = verifyNumber({ reply, claim, candidates, passages: [passage], fw });", "const v = (() => { const a = parsePointerNumber(reply); const c = candidates.find((x) => x.n === a?.n); return c ? { ok: true, start: c.start, end: c.end, quote: c.text, index: 0, url: passage.url, host: '', ref: passage.ref, title: passage.title } : { ok: false, why: 'none' }; })();")],
  ["abort rethrow: indexUrl read", (s) => nth(s, ABORT, 0, "")],
  ["abort rethrow: pointAt (model)", (s) => nth(s, ABORT, 1, "")],
  ["abort rethrow: search", (s) => nth(s, ABORT, 2, "")],
  ["abort rethrow: readPage", (s) => nth(s, ABORT, 3, "")],
  ["unreadable typing: empty page", sub("if (!text.trim()) {", "if (false) {")],
  ["unreadable typing: too short", sub("if (text.trim().length < L.minPageChars)", "if (false)")],
  ["unreadable typing: a throwing read is fatal", sub("why: \"read_failed:\" + String(e?.message || e).slice(0, 60) }); continue; }", "why: 'x' }); throw e; }")],
  ["unreadable typing: a throwing search is fatal", sub("why: \"search_failed:\" + String(e?.message || e).slice(0, 60) }); continue; }", "why: 'x' }); throw e; }")],
  ["model failure typed (call_failed)", sub("return { ok: false, why: \"call_failed:\" + String(e?.message || e).slice(0, 60), calls };", "throw e;")],
  ["maxPages cap", sub("if (tried >= L.maxPages || passages.length >= L.maxVerified) break;", "if (passages.length >= L.maxVerified) break;")],
  ["maxVerified stop", sub("if (tried >= L.maxPages || passages.length >= L.maxVerified) break;", "if (tried >= L.maxPages) break;")],
  ["maxQueries cap", sub("max: L.maxQueries })", "max: 99 })")],
  ["rank order by host kind", sub("cands.sort((a, b) => b.rank - a.rank || a.order - b.order);", "cands.sort((a, b) => a.order - b.order);")],
  ["one page per host", sub("(hostsSeen.has(c.host) ? false : (hostsSeen.add(c.host), true))", "true")],
  ["passage origin flag", sub("text, origin: true, foundVia", "text, origin: false, foundVia")],
  ["passage foundVia", sub("foundVia: { host: indexHost } };", "foundVia: null };")],
  ["query 1 is a quoted phrase", sub("qs.push(`\"${phrase.replace(/\"/g, \"\")}\"`);", "qs.push(phrase);")],
  ["withdraw-and-ask-again on a rejected real number", sub("if (attempt === 0 && rest.length) {", "if (false) {")],
  ["mergeProvenance: nothing found returns pr unchanged", sub("if (!prim.length) return pr;", "")],
];
const tmp = path.join(root, ".a2-mutant.js");
let survived = 0;
try {
  for (const [name, f] of M) {
    let mutated;
    try { mutated = f(src); } catch (e) { console.log("ERROR  ", name, "—", e.message); survived++; continue; }
    fs.writeFileSync(tmp, mutated);
    const r = spawnSync(process.execPath, ["--test", "fold-chat-primary.test.mjs"], { cwd: root, env: { ...process.env, PRIMARY_MODULE: "./.a2-mutant.js" }, encoding: "utf8", timeout: 120000 });
    const failed = (/ℹ fail (\d+)/.exec(r.stdout) || [])[1];
    const killed = r.status !== 0;
    if (!killed) survived++;
    console.log((killed ? "killed  " : "SURVIVED") + " " + name + (killed ? `  (${failed} failing)` : ""));
  }
} finally { try { fs.unlinkSync(tmp); } catch {} }
console.log(`\n${M.length - survived}/${M.length} mutants killed` + (survived ? `, ${survived} SURVIVED` : ""));
process.exit(survived ? 1 : 0);
