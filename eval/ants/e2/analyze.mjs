// eval/ants/e2/analyze.mjs — the waterfall from a baseline/lever run: node eval/ants/e2/analyze.mjs out/baseline.json
// Stages are cut from the turn's own feed (`at` = ms since run() began) with the in-page fetch log for the model calls.
import fs from "node:fs";
import { median, pct } from "./lib.mjs";
const file = process.argv[2] || new URL("./out/baseline.json", import.meta.url).pathname;
const D = JSON.parse(fs.readFileSync(file, "utf8"));
const T = (D.turns || D).filter((t) => t.mark && t.msg);
const ev = (t) => t.msg.feed || [];
const firstAt = (t, re, op) => { const e = ev(t).find((x) => (!op || x.op === op) && re.test(`${x.id || ""} ${x.title || ""} ${x.note || ""}`)); return e ? e.at : null; };
const lastAt = (t, re, op) => { const a = ev(t).filter((x) => (!op || x.op === op) && re.test(`${x.id || ""} ${x.title || ""} ${x.note || ""}`)); return a.length ? a[a.length - 1].at : null; };
function stages(t) {
  const feed = ev(t);
  const done = feed.find((e) => e.op === "done");
  const total = done ? done.at : null;
  const w = feed.find((e) => e.op === "begin" && e.id === "write"), we = feed.find((e) => e.op === "end" && e.id === "write");
  const cut = w ? w.at : (done ? done.at : Infinity);   // search/reads BEFORE the write; later q:/r: events are the REC loop's laps
  const qBegin = feed.filter((e) => e.op === "begin" && /^q:/.test(e.id) && e.at <= cut), qEnd = feed.filter((e) => e.op === "end" && /^q:/.test(e.id) && e.at <= cut);
  const rBegin = feed.filter((e) => e.op === "begin" && /^r:/.test(e.id) && e.at <= cut), rEnd = feed.filter((e) => e.op === "end" && /^r:/.test(e.id) && e.at <= cut);
  const engineMs = Object.fromEntries(qEnd.map((e) => [e.id.split(":")[1], e.ms]));
  const readMs = rEnd.map((e) => e.ms);
  const s0 = qBegin.length ? Math.min(...qBegin.map((e) => e.at)) : null;
  const s1 = qEnd.length ? Math.max(...qEnd.map((e) => e.at)) : null;
  const r0 = rBegin.length ? Math.min(...rBegin.map((e) => e.at)) : null;
  const r1 = rEnd.length ? Math.max(...rEnd.map((e) => e.at)) : null;
  const holdAt = firstAt(t, /Holding the answer/, "line");
  const recEnd = lastAt(t, /Tried to break every sentence|Every sentence holds now|Stopped going back|Reframe, lap/, "line");
  const recLaps = feed.filter((e) => e.op === "line" && /Reframe, lap/.test(e.title || "")).length;
  const pivotAt = firstAt(t, /Read the draft before speaking|The reply was not read/, "line");
  const provStart = firstAt(t, /Asked the model where it got that/, "line");
  const provEnd = lastAt(t, /Verified where it came from|Could not verify a source sentence|The source check failed/, "line");
  const primEnd = lastAt(t, /Verified it on a primary page|No primary page said it/, "line");
  const originAt = lastAt(t, /encyclopedia/i, "line");
  const slotAt = lastAt(t, /Handling this the usual way/, "line");
  // a CONTIGUOUS partition of the turn (segments sum to `total`): plan | search | reads | prewrite (slot, origin, salience, prompt) | write | check (REC + pivot) | prov | tail
  const T0 = 0, sEnd = s1 ?? s0 ?? 0, retrEnd = Math.max(r1 ?? 0, s1 ?? 0);
  const wAt = w ? w.at : null, weAt = we ? we.at : null;
  const provS = provStart, provE = provEnd;
  const seg = {};
  if (total != null) {
    seg.plan = s0 ?? (wAt ?? total);
    seg.search = s0 != null ? (r0 != null ? r0 : (retrEnd)) - s0 : 0;
    seg.reads = r0 != null ? Math.max(0, retrEnd - r0) : 0;
    const afterRetr = s0 != null ? Math.max(retrEnd, 0) : seg.plan;
    seg.prewrite = wAt != null ? Math.max(0, wAt - afterRetr) : 0;
    seg.write = weAt != null && wAt != null ? weAt - wAt : 0;
    const checkEnd = provS != null ? provS : (provE != null ? provE : total);
    seg.check = weAt != null ? Math.max(0, checkEnd - weAt) : Math.max(0, (provS ?? total) - (wAt ?? afterRetr));
    seg.prov = provS != null && provE != null ? provE - provS : 0;
    seg.tail = total - (provE ?? checkEnd);
  }
  const models = (t.f || []).filter((f) => f.cls === "model" && f.t1 != null);
  const out = { engineMs, readMs, total, ...seg, ttfa: t.mark.ttfa, ttd: t.mark.ttd, recLaps, rec: recEnd != null && holdAt != null ? recEnd - holdAt : null, primary: primEnd != null && provS != null ? primEnd - provS : null,
    nModel: models.length, modelBusy: models.reduce((n, f) => n + (f.t1 - f.t0), 0), ttft: models.map((f) => (f.tFirst != null ? f.tFirst - f.t0 : null)), promptChars: models.map((f) => f.promptChars), maxTok: models.map((f) => f.maxTokens) };
  return out;
}
const rows = T.map((t) => ({ id: t.id || t.ask, group: t.group, ask: t.ask, ...stages(t), correct: t.correct, kind: t.msg.kind, nReads: (t.msg.feed || []).filter((e) => e.op === "end" && /^r:/.test(e.id)).length }));
const s = (v) => (v == null ? "   -" : (v / 1000).toFixed(1).padStart(5));
console.log("id".padEnd(14), "grp   ", "kind     ", "ttfa", "  ttd", "  plan", "  srch", " reads", " prewr", " write", " check", "  prov", "  tail", " lap", " nM", " rd");
for (const r of rows) console.log(String(r.id).slice(0, 14).padEnd(14), String(r.group).padEnd(6), String(r.kind).slice(0, 8).padEnd(9), s(r.ttfa), s(r.ttd), s(r.plan), s(r.search), s(r.reads), s(r.prewrite), s(r.write), s(r.check), s(r.prov), s(r.tail), String(r.recLaps).padStart(3), String(r.nModel).padStart(3), String(r.nReads).padStart(3));
const grp = (f) => rows.filter(f);
const research = grp((r) => r.kind === "research" || r.group === "facts" || r.group === "follow");
const rep = (name, rs) => { if (!rs.length) return; const m = (k) => median(rs.map((r) => r[k])); console.log(`\n${name} (n=${rs.length}): median ttfa ${s(m("ttfa"))} ttd ${s(m("ttd"))} | plan ${s(m("plan"))} search ${s(m("search"))} reads ${s(m("reads"))} prewrite ${s(m("prewrite"))} write ${s(m("write"))} check ${s(m("check"))} prov ${s(m("prov"))} tail ${s(m("tail"))}  | p90 ttd ${s(pct(rs.map((r) => r.ttd), 0.9))} max ${s(Math.max(...rs.map((r) => r.ttd)))}`); };
rep("ALL", rows); rep("facts", grp((r) => r.group === "facts")); rep("follow", grp((r) => r.group === "follow")); rep("write", grp((r) => r.group === "write")); rep("live", grp((r) => r.group === "live")); rep("src", grp((r) => r.group === "src"));
const gap = rows.map((r) => (r.ttd ?? 0) - (r.ttfa ?? 0)); console.log("\nTTD-TTFA median (s):", (median(gap) / 1000).toFixed(2), " turns with answer >=3 s before done:", gap.filter((g) => g >= 3000).length, "/", gap.length);
const ok = rows.filter((r) => r.correct != null); if (ok.length) console.log("ground truth:", ok.filter((r) => r.correct).length, "/", ok.length);
fs.writeFileSync(file.replace(/\.json$/, ".rows.json"), JSON.stringify(rows, null, 1));
