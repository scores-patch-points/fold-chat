// F4 harness library — drives the REAL pure module (fold-chat-provenance.js, unmodified unless F4_MODULE points at a mutated copy) with injected pointer models.
// Pre-registered in eval/ants/F4-PREREG.md. No model or network inside the module under test; the pointer is injected exactly as fold-chat.js injects it.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../../..");
export const MODULE_PATH = process.env.F4_MODULE ? path.resolve(process.env.F4_MODULE) : path.join(REPO, "fold-chat-provenance.js");
const prov = await import(pathToFileURL(MODULE_PATH).href);
const { functionWordsOf } = await import(pathToFileURL(path.join(REPO, "fold-chat-snippets.js")).href);
export const { provenanceFor, TEMPLATES } = prov;
export const FW = functionWordsOf("en");
export const CASES = JSON.parse(fs.readFileSync(path.join(HERE, "cases.json"), "utf8"));
export const WIKI = JSON.parse(fs.readFileSync(path.join(HERE, "data/wiki-intros.json"), "utf8"));

const hostOf = (u) => new URL(u).hostname.replace(/^www\./, "");
export function passagesOf(pages) {
  return pages.map((p) => {
    const key = typeof p === "string" ? p : p.key; const w = WIKI[key];
    const url = typeof p === "string" ? w.url : p.host;
    return { ref: `${hostOf(url)} — ${w.title}`, title: w.title, url, text: w.text };
  });
}

const norm = (s) => String(s).replace(/\s+/g, " ").trim();
const candidatesOf = (msgs) => String(msgs[1].content).split("\n\nANSWER")[0].split("\n").filter((l) => /^\[\d+\]/.test(l)).map((l) => { const m = /^\[(\d+)\]\s*([^]*)$/.exec(l); return { n: Number(m[1]), text: m[2] }; });
const answerOf = (msgs) => String(msgs[1].content).split("\n\nANSWER\n")[1] || "";

/** A pointer that returns the candidate containing `needle` (the oracle for gold, or the adversary for `near`); else NONE. `.log` records what it was offered. */
export function needlePointer(needle) {
  let i = 0; const f = async (msgs) => { i++; const cs = candidatesOf(msgs); f.log.push({ call: i, offered: cs.length, goldOffered: cs.some((c) => norm(c.text).includes(norm(needle))) }); const hit = cs.find((c) => norm(c.text).includes(norm(needle))); return hit ? String(hit.n) : "NONE"; };
  f.log = []; return f;
}
/** A pointer that stumbles once: the first call names the candidate AFTER the gold one (or before, if gold is last); every later call names the gold. */
export function stumblePointer(needle) {
  let i = 0; const f = async (msgs) => { i++; const cs = candidatesOf(msgs); const k = cs.findIndex((c) => norm(c.text).includes(norm(needle))); f.log.push({ call: i, offered: cs.length, goldOffered: k >= 0 }); if (k < 0) return "NONE"; if (i === 1) return String(cs[k + 1] ? cs[k + 1].n : cs[k - 1] ? cs[k - 1].n : cs[k].n); return String(cs[k].n); };
  f.log = []; return f;
}
export const nonePointer = () => { const f = async (msgs) => { f.log.push({ offered: candidatesOf(msgs).length }); return "NONE"; }; f.log = []; return f; };
const STOP = new Set("the and for are was were has have had with that this from which who what when where how not but its their his her you can may all any one also into than then there these those been being does did said says about over such only some more most other very will would could should".split(" "));
const toks = (s) => (String(s).toLowerCase().match(/[a-z0-9][a-z0-9.,]*[a-z0-9]|[a-z0-9]/g) || []).filter((t) => t.length > 2 && !STOP.has(t)).map((t) => t.replace(/(ing|ed|es|s)$/, ""));
/** A lazy keyword pointer: the candidate sharing the most word stems with the answer (never NONE unless nothing shares a word). */
export const lexicalPointer = () => { const f = async (msgs) => { const cs = candidatesOf(msgs); const a = new Set(toks(answerOf(msgs))); let best = null, bs = 0; for (const c of cs) { const sc = [...new Set(toks(c.text))].filter((t) => a.has(t)).length; if (sc > bs) { bs = sc; best = c; } } f.log.push({ offered: cs.length, picked: best?.n ?? null, score: bs }); return best ? String(best.n) : "NONE"; }; f.log = []; return f; };

/** Real gemma2:2b through Ollama's OpenAI-compatible endpoint, with the same messages, temperature and token limit the app uses. */
export function gemmaPointer({ model = process.env.F4_MODEL || "gemma2:2b", base = "http://127.0.0.1:11434" } = {}) {
  const f = async (msgs) => {
    const r = await fetch(base + "/v1/chat/completions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, messages: msgs, temperature: 0, max_tokens: 220, stream: false }) });
    const j = await r.json(); const text = j.choices?.[0]?.message?.content ?? ""; f.log.push({ raw: text.slice(0, 120), offered: candidatesOf(msgs).length }); return text;
  };
  f.log = []; return f;
}

export async function run({ answer, pages, point }) {
  const passages = passagesOf(pages);
  const r = await provenanceFor({ answer, passages, point, fw: FW });
  const none = r.narr.text === TEMPLATES.none();
  const lead = r.pointers.find((p) => p && p.ok);
  return { none, verified: r.stored ? r.stored.verified : 0, why: r.stored?.why ?? null, calls: r.calls, quote: lead ? lead.quote : null, host: lead ? lead.host : null, tier: lead ? lead.tier : null, narr: r.narr.text, log: point.log };
}
export const rate = (xs, f) => ({ n: xs.length, k: xs.filter(f).length, rate: xs.length ? xs.filter(f).length / xs.length : 0 });
