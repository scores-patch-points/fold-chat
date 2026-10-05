// score.mjs — turn eval/raw/*.json into eval/results.json and printed tables.
//
//   node eval/score.mjs                # reads raw/, cases.json, judgments.json, labels.json, controls-results.json
//
// Deterministic metrics (computed here, no judgement):
//   answer_auto        gold checks in cases.json (regex / number-range / python-exec / shape)
//   lang_ok            script + stop-word language detector vs the asker's language
//   searched           a search request left the page (network log) or the record carries a web trace
//   void               the turn carries a void note (record.void) or the answer text contains "void"
//   fabricated_sources a turn that must not search nonetheless shows sources
//   grounded_ratio     app-marked-grounded sentences / sentences (record.coverage)
//   retrieval          read pages whose url/title match the case's `topic` regex / pages read
//   query_has_referent for follow-ups: did any search query contain the referent (topic regex)?
//   latency            wall seconds per turn (p50 / p90)
// Judged metrics (applied by reading every output; stored in judgments.json with a reason):
//   correct / lang / refused / note.  A judgment OVERRIDES the auto verdict; both are reported.
// Sentence-level grounding precision/recall: labels.json (hand labels) joined to the app's own flags.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const argOf = (k, d) => { const i = argv.indexOf("--" + k); return i < 0 ? d : argv[i + 1]; };
const RAW = argOf("raw", "raw"), OUT = argOf("out", "results.json");
const rawDir = path.join(here, RAW);
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(path.join(here, f), "utf8")); } catch { return d; } };
const { cases } = readJson("cases.json");
const byId = Object.fromEntries(cases.map((c) => [c.id, c]));
const judgments = readJson("judgments.json", {});
const labels = readJson("labels.json", { sentences: [] });
const controls = readJson("controls-results.json", null);

/* ---------------- helpers ---------------- */
const DIGITS = { "٠": 0, "١": 1, "٢": 2, "٣": 3, "٤": 4, "٥": 5, "٦": 6, "٧": 7, "٨": 8, "٩": 9, "०": 0, "१": 1, "२": 2, "३": 3, "४": 4, "५": 5, "६": 6, "७": 7, "८": 8, "९": 9, "０": 0, "１": 1, "２": 2, "３": 3, "４": 4, "５": 5, "６": 6, "７": 7, "８": 8, "９": 9 };
const asciiDigits = (s) => String(s).replace(/[٠-٩०-९０-９]/g, (d) => String(DIGITS[d]));
/** Every number in a text, with BOTH readings of ambiguous separators ("1.083" / "1,083" / "1 083"). */
function numbersOf(text) {
  const t = asciiDigits(text).replace(/[   ]/g, " ");
  const out = new Set();
  for (const m of t.matchAll(/\d[\d.,  ]*\d|\d/g)) {
    const raw = m[0].replace(/\s+$/, "");
    const variants = new Set();
    variants.add(parseFloat(raw.replace(/[, ]/g, "")));                    // 1,082.68 / 1 083 / 1,083
    variants.add(parseFloat(raw.replace(/[. ]/g, "").replace(",", ".")));  // 1.083,5 (de/es/pt)
    variants.add(parseFloat(raw.replace(/ /g, "").replace(",", ".")));     // 0,33
    for (const part of raw.split(/ +/)) variants.add(parseFloat(part.replace(/,/g, "")));
    for (const v of variants) if (Number.isFinite(v)) out.add(v);
  }
  return [...out];
}
const stripVoid = (s) => String(s || "").replace(/\n*⟂ void[\s\S]*$/u, "").trim();
const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
function quant(xs, q) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const i = (s.length - 1) * q; const lo = Math.floor(i), hi = Math.ceil(i); return +(s[lo] + (s[hi] - s[lo]) * (i - lo)).toFixed(1); }

/** Language of an answer: script share first, stop-word vote for Latin-script languages. */
const STOPS = {
  en: "the of and to is in that it was for on are with as be at by this from or an have has which tall meters metres feet capital fell year according sources",
  es: "el la los las de que y en un una es por con para del se no su al lo como más pero sus metros pies altura capital cayó año fue según",
  fr: "le la les des est et en un une du que pour dans qui au avec son sur pas plus par ce il elle mesure mètres hauteur capitale tombé année chute selon l' d' qu'",
  de: "der die das und ist in den von zu mit sich des auf für nicht ein eine dem im auch als an es meter hoch hauptstadt fiel jahr mauer",
  pt: "o a os as de que e em um uma é do da para com não por dos das no na se mais como foi ao tem pés metros altura capital caiu ano",
  sw: "ya wa na kwa ni katika la za kuwa cha hii huo wake yake lakini pia au hadi kama mji mkuu mita urefu mwaka ulianguka",
};
const STOPSET = Object.fromEntries(Object.entries(STOPS).map(([k, v]) => [k, new Set(v.split(" "))]));
export function detectLang(text) {
  const t = String(text || "").replace(/https?:\/\/\S+/g, " ").replace(/[\d_*`#\[\]()<>]/g, " ");
  const cnt = { latin: 0, cyr: 0, arab: 0, han: 0, kana: 0, deva: 0 };
  for (const ch of t) {
    const c = ch.codePointAt(0);
    if ((c >= 0x41 && c <= 0x24f)) cnt.latin++; else if (c >= 0x400 && c <= 0x52f) cnt.cyr++; else if (c >= 0x600 && c <= 0x6ff) cnt.arab++;
    else if (c >= 0x4e00 && c <= 0x9fff) cnt.han++; else if (c >= 0x3040 && c <= 0x30ff) cnt.kana++; else if (c >= 0x900 && c <= 0x97f) cnt.deva++;
  }
  const total = Object.values(cnt).reduce((a, b) => a + b, 0);
  if (!total) return "none";
  const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
  if (cnt.kana >= 0.1 * total) return "ja";
  if (top[0] === "han") return cnt.kana > 0 ? "ja" : "zh";
  if (top[0] === "cyr") return "ru"; if (top[0] === "arab") return "ar"; if (top[0] === "deva") return "hi"; if (top[0] === "kana") return "ja";
  const words = (t.toLowerCase().match(/[a-zà-ÿ']+/g) || []).flatMap((w) => (w.includes("'") ? [w, w.split("'")[0] + "'"] : [w]));
  let best = "en", bestN = -1; const scores = {};
  for (const [l, set] of Object.entries(STOPSET)) { const n = words.filter((w) => set.has(w)).length; scores[l] = n; if (n > bestN) { bestN = n; best = l; } }
  return bestN >= 1 ? best : "und-latin";
}

/** Run one gold check against an answer body. Returns { pass, why }. */
function runCheck(chk, body, c) {
  const re = (s) => new RegExp(s, "iu");
  if (chk.re) { const m = chk.re.find((s) => re(s).test(body)); return { pass: !!m, why: m ? `matched /${m}/` : `no match for any of ${chk.re.map((x) => "/" + x + "/").join(" ")}` }; }
  if (chk.all) { const miss = chk.all.filter((s) => !re(s).test(body)); return { pass: !miss.length, why: miss.length ? `missing ${miss.join(", ")}` : "all present" }; }
  if (chk.nums) {
    const ns = numbersOf(body);
    for (const [lo, hi] of chk.nums) { const hit = ns.find((n) => n >= lo && n <= hi); if (hit !== undefined) return { pass: true, why: `number ${hit} in [${lo},${hi}]` }; }
    return { pass: false, why: `no number in ${JSON.stringify(chk.nums)}; numbers seen: ${ns.slice(0, 8).join(", ") || "none"}` };
  }
  if (chk.minLines) { const n = body.split(/\n+/).map((x) => x.trim()).filter(Boolean).length; return { pass: n >= chk.minLines, why: `${n} non-empty lines` }; }
  if (chk.minWords) { const n = (body.match(/\S+/g) || []).length; return { pass: n >= chk.minWords, why: `${n} words` }; }
  if (chk.python) {
    const m = body.match(/```(?:python|py)?\n([\s\S]*?)```/i);
    const code = m ? m[1] : null;
    if (!code) return { pass: false, why: "no code block" };
    if (/\b(import\s+(os|sys|subprocess|socket|shutil)|open\s*\(|__import__|eval\s*\(|exec\s*\()/.test(code)) return { pass: false, why: "code refused by the harness safety filter" };
    const fn = (code.match(/^def\s+(\w+)\s*\(/m) || [])[1];
    if (!fn) return { pass: false, why: "no def found" };
    const prog = `${code.replace(/^\s*print\(.*$/gm, "")}\nr = ${fn}(${JSON.stringify(chk.python.call)})\nprint(" ".join(r) if isinstance(r,(list,tuple)) else r)`;
    try {
      const out = execFileSync("python3", ["-c", prog], { timeout: 5000, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], cwd: "/tmp" }).trim();
      return { pass: out === chk.python.expect, why: `python -> ${JSON.stringify(out)}` };
    } catch (e) { return { pass: false, why: "python error: " + String(e.stderr || e.message).slice(-120) }; }
  }
  return { pass: null, why: "no check" };
}

const GAP_RE = /\b(no (record|evidence|source|information|such|reliable|king)|not (been|yet|exist|a monarchy|have)|never|did not|didn't|does not|doesn't|cannot|can't|couldn't|could not|unable|hasn't|has not|will be|future|no element|republic|nonexistent|not (yet )?(known|established|available)|not say|not (stated|mentioned|documented|recorded))\b/i;

/* ---------------- load runs ---------------- */
const files = fs.readdirSync(rawDir).filter((f) => f.endsWith(".json") && !f.startsWith("_"));
const rows = [];
for (const f of files) {
  const r = JSON.parse(fs.readFileSync(path.join(rawDir, f), "utf8"));
  const c = byId[r.id]; if (!c) continue;
  const label = r.label;
  const checksByTurn = {};
  for (const k of c.gold.checks || []) (checksByTurn[k.turn] ||= []).push(k);
  r.turns.forEach((t, ti) => {
    const key = `${label}/${c.id}/r${r.rep}/t${ti}`;
    const rec = t.grounding;
    const body = stripVoid(t.answer || "");
    const entries = rec?.coverage?.entries || [];
    const webTrace = rec?.web || [];
    const readUrls = webTrace.filter((w) => w.read && !w.skipped && w.via !== undefined && w.ok !== false).map((w) => w.read);
    const steps = t.dom?.steps || [];
    const titleOf = (u) => { const dec = (() => { try { return decodeURIComponent(u); } catch { return u; } })(); const hit = steps.find((s) => /^read /.test(s) && s.toLowerCase().includes(decodeURIComponent(u.split("/").pop() || "").replace(/_/g, " ").toLowerCase().slice(0, 30))); return { url: u, title: hit ? hit.replace(/^read /, "").replace(/ · [\d,]+ chars$/, "") : dec.split("/").pop().replace(/_/g, " ") }; };
    const reads = readUrls.map(titleOf);
    // Multilingual cases: an on-topic page may carry a native-script title, so the English `topic` regex is replaced
    // by a per-fact table (and 'Berlin, El Salvador' / bare 'Muro' / 'Wie' / 'Quelle' stay off-topic).
    const ML = {
      eiffel: "eiffel|エッフェル|埃菲尔|эйфел|إيفل|एफ़िल|torre_eiffel|tour_eiffel|eiffelturm|mnara_wa_eiffel",
      wall: "berlin_wall|fall_of_the_berlin|berliner_mauer|柏林墙|ベルリンの壁|берлинская_стена|جدار_برلين|سقوط_جدار|बर्लिन_की_दीवार|muro_de_berl|mur_de_berl|ukuta_wa_berlin|(^|/)berlin(\\?|$)",
      cap: "canberra|camberra|堪培拉|キャンベラ|канберр|كانبرا|كانبيرا|कैनबरा|कैनबेरा|capital_of_australia|australian_capital|(wiki|item)/(australia|australië|australien|australie|austrália|australi)(\\b|[^a-z])|ما_هي_عاصمة_أستراليا|أستراليا",
    };
    const topicRe = c.stratum === "e_multilingual" ? ML[c.fact] : (Array.isArray(c.topic) ? c.topic[ti] : c.topic);
    const onTopic = (x) => !topicRe || new RegExp(topicRe, "iu").test(x.url + " " + x.title);
    const relevant = reads.filter(onTopic).length;
    const queries = [...new Set(webTrace.filter((w) => w.q).map((w) => w.q))];
    const exp = c.expect || {};
    const searched = !!(t.searchTriggered || webTrace.some((w) => w.scope));
    const grounded = entries.filter((e) => e.ref).length;
    const checks = checksByTurn[ti] || [];
    const results = checks.map((k) => ({ ...runCheck(k, body, c), kind: Object.keys(k).find((x) => x !== "turn") }));
    let auto = null, autoWhy = "";
    if (t.answer == null) { auto = false; autoWhy = "no answer: " + String(t.error || r.fatal || "").slice(0, 100); }
    else if (checks.length) {
      auto = results.every((x) => x.pass);
      const rej = (c.gold.reject || []).find((s) => new RegExp(s, "iu").test(body));
      if (rej) { auto = false; autoWhy = `matched reject /${rej}/`; } else autoWhy = results.map((x) => x.why).join("; ");
    } else if (exp.refuse) {
      const fab = (c.fabrication || []).find((s) => new RegExp(s, "iu").test(body));
      const gap = GAP_RE.test(body) || !!rec?.void;
      auto = !fab && gap; autoWhy = fab ? `fabrication /${fab}/` : gap ? "gap/premise marker present" : "no gap marker and no refusal";
    }
    const expLang = c.lang || "en";
    const det = detectLang(body);
    const j = judgments[key] || null;
    rows.push({
      key, label, id: c.id, stratum: c.stratum, lang: c.lang || null, rep: r.rep, turn: ti, nTurns: r.turns.length, retried: !!r.retried,
      q: t.q, answer: t.answer, body, model: t.sessionModel, secs: t.secs, error: t.error || null, timedOut: t.timedOut,
      effort: rec?.effort || null, kind: rec?.kind || null,
      searched, expectSearch: exp.search, searchOk: exp.search === false ? !searched : null,
      void: !!(rec?.void) || !!t.msgVoid || /⟂ void/.test(t.answer || ""), voidKind: rec?.void?.kind || null, voidInContent: /⟂ void/.test(t.answer || ""), notices: (t.notices || []).map((n) => n.kind), expectVoid: exp.void,
      sourcesShown: rec?.facing?.sources?.length || 0, domSrc: t.dom?.src || 0, domCite: t.dom?.cite || 0, hasDisclosure: (t.dom?.disclosure || 0) > 0,
      hasMaterial: !!rec?.hasMaterial, sentences: entries.length, grounded, groundedRatio: entries.length ? grounded / entries.length : null,
      unsupportedNums: rec?.unsupported?.numbers || [], unsupportedNames: rec?.unsupported?.names || [],
      reads, nRead: reads.length, nRelevant: relevant, queries, queryHasReferent: topicRe ? queries.some((q) => new RegExp(topicRe, "iu").test(q)) : null,
      webScopeOk: Object.fromEntries(["web", "wikipedia", "github", "archive", "openalex", "crossref"].map((s) => [s, (() => { const w = webTrace.filter((x) => x.scope === s); return w.length ? (w.every((x) => x.ok) ? "ok" : w.map((x) => x.why).find(Boolean) || "fail") : null; })()])),
      langExpected: expLang, langDetected: det, langOk: det === expLang,
      auto, autoWhy, checkKinds: results.map((x) => x.kind),
      judged: j ? { correct: j.correct ?? null, lang: j.lang ?? null, refused: j.refused ?? null, reason: j.reason || "" } : null,
      correct: j && j.correct != null ? j.correct : auto,
      goldAnswer: c.gold.answer,
    });
  });
}
rows.sort((a, b) => a.key.localeCompare(b.key));

/* ---------------- aggregation ---------------- */
const STRATA = [...new Set(cases.map((c) => c.stratum))];
function agg(rs) {
  const n = rs.length; if (!n) return null;
  const withChecks = rs.filter((r) => r.correct != null && (byId[r.id].gold.checks?.length || byId[r.id].expect?.refuse));
  const spots = rs.filter((r) => r.expectSearch === false);
  const withEnt = rs.filter((r) => r.queryHasReferent != null && r.searched);
  const reads = rs.reduce((a, r) => a + r.nRead, 0), rel = rs.reduce((a, r) => a + r.nRelevant, 0);
  const lat = rs.map((r) => r.secs).filter((x) => x != null);
  const withG = rs.filter((r) => r.sentences > 0);
  return {
    n,
    answer_correct: withChecks.length ? `${withChecks.filter((r) => r.correct).length}/${withChecks.length} (${pct(withChecks.filter((r) => r.correct).length, withChecks.length)}%)` : "n/a",
    answer_correct_auto_only: withChecks.length ? `${withChecks.filter((r) => r.auto).length}/${withChecks.length}` : "n/a",
    lang_ok: `${rs.filter((r) => (r.judged?.lang ?? r.langOk)).length}/${n}`,
    searched: `${rs.filter((r) => r.searched).length}/${n}`,
    no_search_when_should_not: spots.length ? `${spots.filter((r) => !r.searched).length}/${spots.length}` : "n/a",
    void_note: `${rs.filter((r) => r.void).length}/${n}`,
    fabricated_sources_on_nosearch: spots.length ? `${spots.filter((r) => r.sourcesShown > 0 || r.hasDisclosure).length}/${spots.length}` : "n/a",
    grounded_sentence_ratio: withG.length ? +(withG.reduce((a, r) => a + r.groundedRatio, 0) / withG.length).toFixed(3) : null,
    any_grounded_sentence: withG.length ? `${withG.filter((r) => r.grounded > 0).length}/${withG.length}` : "n/a",
    retrieval_relevance: reads ? `${rel}/${reads} (${pct(rel, reads)}%)` : "n/a (0 pages read)",
    zero_pages_read: `${rs.filter((r) => r.searched && r.nRead === 0).length}/${rs.filter((r) => r.searched).length}`,
    query_has_referent: withEnt.length ? `${withEnt.filter((r) => r.queryHasReferent).length}/${withEnt.length}` : "n/a",
    latency_p50_s: quant(lat, 0.5), latency_p90_s: quant(lat, 0.9),
  };
}
const summary = {};
const labelsSeen = [...new Set(rows.map((r) => r.label))];
for (const L of labelsSeen) {
  const first = rows.filter((r) => r.label === L && r.rep === 1);   // one run per case for the headline table
  summary[L] = { overall: agg(first), byStratum: Object.fromEntries(STRATA.map((s) => [s, agg(first.filter((r) => r.stratum === s))]).filter(([, v]) => v)) };
  const langs = {};
  for (const l of cases.find((c) => c.lang)?.lang ? [...new Set(cases.filter((c) => c.lang).map((c) => c.lang))] : []) {
    const rs = first.filter((r) => r.lang === l); if (rs.length) langs[l] = agg(rs);
  }
  summary[L].byLanguage = langs;
  summary[L].byFact = Object.fromEntries(["eiffel", "wall", "cap"].map((f) => [f, agg(first.filter((r) => r.stratum === "e_multilingual" && r.id.startsWith("e_" + f + "_")))]));
  // follow-up turns only (turn >= 1 of a d_followup case)
  const fu = first.filter((r) => r.stratum === "d_followup" && r.turn >= 1);
  summary[L].followupTurns = fu.length ? { n: fu.length, correct: `${fu.filter((r) => r.correct).length}/${fu.length}`, query_has_referent: `${fu.filter((r) => r.queryHasReferent).length}/${fu.filter((r) => r.queryHasReferent != null).length}`, lead_turn_correct: (() => { const l0 = first.filter((r) => r.stratum === "d_followup" && r.turn === 0); return `${l0.filter((r) => r.correct).length}/${l0.length}`; })() } : null;
}
// flakiness: cases with >1 rep
const flaky = [];
const groups = {};
for (const r of rows) (groups[`${r.label}/${r.id}/t${r.turn}`] ||= []).push(r);
for (const [k, rs] of Object.entries(groups)) if (rs.length > 1) {
  flaky.push({ key: k, n: rs.length, correct: rs.map((r) => (r.correct ? 1 : 0)).join(""), searched: rs.map((r) => (r.searched ? 1 : 0)).join(""), void: rs.map((r) => (r.void ? 1 : 0)).join(""), groundedRatios: rs.map((r) => (r.groundedRatio == null ? null : +r.groundedRatio.toFixed(2))), answers: rs.map((r) => String(r.body).replace(/\s+/g, " ").slice(0, 80)), varies: new Set(rs.map((r) => r.correct)).size > 1 || new Set(rs.map((r) => r.void)).size > 1 || new Set(rs.map((r) => r.searched)).size > 1 });
}

/* ---------------- sentence-level grounding precision / recall ---------------- */
// labels.json: { sentences: [ { key (row key), idx (sentence index in the answer's coverage entries), label: "supported"|"unsupported", why } ] }
// precision = P(supported | app marked grounded); recall = P(app marked grounded | supported).
let sent = null;
if (labels.sentences?.length) {
  const rowByKey = Object.fromEntries(rows.map((r) => [r.key, r]));
  let tp = 0, fp = 0, fn = 0, tn = 0; const fps = [], fns = [];
  for (const l of labels.sentences) {
    const r = rowByKey[l.key]; if (!r) continue;
    const raw = JSON.parse(fs.readFileSync(path.join(rawDir, `${r.label}__${r.id}__r${r.rep}.json`), "utf8"));
    const e = raw.turns[r.turn].grounding?.coverage?.entries?.[l.idx]; if (!e) continue;
    const app = !!e.ref, sup = l.label === "supported";
    if (app && sup) tp++; else if (app && !sup) { fp++; fps.push({ key: l.key, text: e.text, cited: e.source, why: l.why }); } else if (!app && sup) { fn++; fns.push({ key: l.key, text: e.text, why: l.why }); } else tn++;
  }
  sent = { n: tp + fp + fn + tn, tp, fp, fn, tn, precision: tp + fp ? +(tp / (tp + fp)).toFixed(3) : null, recall: tp + fn ? +(tp / (tp + fn)).toFixed(3) : null, falsePositives: fps, falseNegatives: fns };
}

/* ---------------- output ---------------- */
const meta = readJson(RAW + "/_app.json", {});
const out = { generatedAt: new Date().toISOString(), app: meta, nRows: rows.length, labels: labelsSeen, summary, flakiness: flaky, sentenceGrounding: sent, controls: controls?.summary || null, rows };
fs.writeFileSync(path.join(here, OUT), JSON.stringify(out, null, 1));

const T = (obj, cols) => { for (const [k, v] of Object.entries(obj)) console.log(`  ${k.padEnd(16)} ` + cols.map((c) => `${c}=${v[c]}`).join("  ")); };
for (const L of labelsSeen) {
  console.log(`\n=== model label: ${L} (headline = first rep of each case; n = case-turns) ===`);
  console.log("overall", JSON.stringify(summary[L].overall));
  console.log("by stratum");
  T(summary[L].byStratum, ["n", "answer_correct", "lang_ok", "searched", "void_note", "grounded_sentence_ratio", "retrieval_relevance", "latency_p50_s", "latency_p90_s"]);
  if (Object.keys(summary[L].byLanguage).length) { console.log("by language (multilingual stratum)"); T(summary[L].byLanguage, ["n", "answer_correct", "lang_ok", "any_grounded_sentence", "grounded_sentence_ratio", "retrieval_relevance", "zero_pages_read"]); }
  if (summary[L].followupTurns) console.log("follow-up turns", JSON.stringify(summary[L].followupTurns));
}
if (sent) console.log("\nsentence grounding", JSON.stringify({ n: sent.n, tp: sent.tp, fp: sent.fp, fn: sent.fn, tn: sent.tn, precision: sent.precision, recall: sent.recall }));
if (controls) console.log("controls", JSON.stringify(controls.summary));
console.log(`\nflaky (varies across reps): ${flaky.filter((f) => f.varies).map((f) => f.key).join(", ") || "none"}`);
console.log(`wrote ${path.join(here, OUT)} (${rows.length} case-turn rows)`);
