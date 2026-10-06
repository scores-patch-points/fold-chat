// The answer card (fold-chat-answercard.js): the PURE model and the DOM view for AnswerTurn@1 (docs/ANSWER-PIPELINE.md).
// No DOM library in this repo: a tiny createElement / textContent / append / setAttribute / classList stub lives below.
// Falsifiers are marked FALSIFIER: they fail if the claim they guard is wrong.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { answerCardModel, renderAnswerCard, mountAnswerCard, cleanSpans, segmentsOf, citeOf, GAP_LABELS, UNWITNESSED_BY_SLOT } from "./fold-chat-answercard.js";
import { ANSWERCARD_CSS, ANSWERCARD_STYLE_ID } from "./fold-chat-answercard.css.js";

const TURNS = JSON.parse(fs.readFileSync(new URL("./eval/falsify/fixtures/tierA/turns.json", import.meta.url), "utf8"));
const SRC = fs.readFileSync(new URL("./fold-chat-answercard.js", import.meta.url), "utf8");
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------- a tiny DOM: only what the view uses, and NO markup parsing anywhere (so innerHTML-style bugs cannot hide) ----------
class TextNode { constructor(t) { this.nodeType = 3; this.data = String(t); } get textContent() { return this.data; } }
class El {
  constructor(tag) { this.tag = tag; this.nodeType = 1; this.kids = []; this.className = ""; this.attrs = {}; this.id = ""; this.parent = null; this.ownerDocument = null; }
  get classList() { const o = this; return { contains: (c) => o.className.split(/\s+/).includes(c) }; }
  get children() { return this.kids.filter((k) => k.nodeType === 1); }
  set textContent(t) { this.kids = String(t) === "" ? [] : [new TextNode(t)]; }
  get textContent() { return this.kids.map((k) => k.textContent).join(""); }
  append(...ns) { for (const n of ns) { if (typeof n === "string") this.kids.push(new TextNode(n)); else { n.parent = this; this.kids.push(n); } } }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return this.attrs[k] ?? null; }
  remove() { if (this.parent) this.parent.kids = this.parent.kids.filter((k) => k !== this); }
  find(pred, out = []) { for (const k of this.kids) if (k.nodeType === 1) { if (pred(k)) out.push(k); k.find(pred, out); } return out; }
  all(cls) { return this.find((e) => e.classList.contains(cls)); }
  tags(tag) { return this.find((e) => e.tag === tag); }
}
function makeDoc() {
  const head = new El("head");
  const doc = { head, createElement: (t) => { const e = new El(t); e.ownerDocument = doc; return e; }, getElementById: (id) => head.find((e) => e.id === id)[0] || null };
  head.ownerDocument = doc;
  return doc;
}
const draw = (turn, doc = makeDoc()) => renderAnswerCard(turn, { doc });
const allText = (e) => e.textContent.replace(/\s+/g, " ");
const occurrences = (hay, needle) => hay.split(needle).length - 1;
/** The text of everything a card says, including what sits in the closed disclosure. */
const FIXTURE_IDS = Object.keys(TURNS);

// ---------- the fixtures themselves are well-formed (a fixture that lies would make every test below lie) ----------
test("fixtures: AnswerTurn@1, offsets really slice the words they claim, A1-A7 and a contest are present", () => {
  assert.deepEqual(FIXTURE_IDS, ["A1", "A2", "A3", "A4", "A5", "A6", "A7", "X1"]);
  for (const id of FIXTURE_IDS) {
    const t = TURNS[id];
    assert.equal(t.schema, "AnswerTurn@1", id);
    const rows = [t.answer?.row, t.gap?.closest, ...(t.contest || [])].filter(Boolean);
    for (const r of rows) {
      if (r.filler) assert.equal(r.sentence.slice(...r.filler.span), r.filler.text, id + " filler span");
      for (const [a, b] of r.emphasis) assert.ok(r.sentence.slice(a, b).length > 0, id + " emphasis span");
    }
  }
  assert.equal(TURNS.A1.answer.standing, "survived");
  assert.equal(TURNS.A2.answer, null); assert.equal(TURNS.A2.gap.kind, "unwitnessed");
  assert.equal(TURNS.A3.gap.kind, "no_present_holder");
  assert.equal(TURNS.A5.gap.kind, "refuted");
  assert.equal(TURNS.X1.contest.length, 2);
});

// ---------- the model ----------
test("model A1: one answer line with the filler as the bold range, the source sentence, the citation, what survived, the trace", () => {
  const m = answerCardModel(TURNS.A1);
  assert.equal(m.kind, "answer");
  assert.equal(m.headline.text, "Charles III is the king of the United Kingdom.");
  assert.equal(m.headline.bold.length, 1);
  assert.equal(m.headline.text.slice(...m.headline.bold[0]), "Charles III");
  // an encyclopedia is never the citation (fold-chat-origin.js): this turn followed no reference, so it is a POINTER, naming no page as its source
  assert.equal(m.cite.kind, "pointer"); assert.match(m.cite.label, /not cited/); assert.equal(m.cite.url, null);
  assert.doesNotMatch(JSON.stringify(m.cite), /wikipedia/i);
  assert.equal(m.quote.text, TURNS.A1.answer.row.sentence);
  assert.equal(m.quote.shownAsHeadline, false);
  assert.ok(m.quote.emphasis.some(([a, b]) => m.quote.text.slice(a, b) === "Charles III"));
  assert.deepEqual(m.checked, ["no later holder in 3 sources", "Charles III’s page: no death date"]);
  assert.equal(m.trace.length, 6);
  assert.deepEqual(m.contest, []); assert.equal(m.gap, null);
  assert.ok(m.searched.includes("Charles III"), "the search that names the claim is carried");
});

test("model: A4 Burnham answered, and the one thing that could not be checked is listed as such", () => {
  const m = answerCardModel(TURNS.A4);
  assert.equal(m.kind, "answer"); assert.match(m.headline.text, /Andy Burnham/); assert.doesNotMatch(JSON.stringify(m), /Sunak/);
  assert.deepEqual(m.unmeasured, ["whether a newer page names someone else"]);
  assert.ok(m.trace.some((l) => l.unmeasured));
});

test("model: A6 control (Canberra) and A7 (a quantity) ship as answers; A7's headline IS the source sentence", () => {
  assert.equal(answerCardModel(TURNS.A6).kind, "answer");
  assert.match(answerCardModel(TURNS.A6).headline.text, /Canberra/);
  const m = answerCardModel(TURNS.A7);
  assert.equal(m.kind, "answer");
  assert.equal(m.headline.text.slice(...m.headline.bold[0]), "eight");
  assert.equal(m.quote.shownAsHeadline, true);
});

test("model: gaps map to FIXED app-authored labels (the four the brief names, verbatim)", () => {
  assert.equal(GAP_LABELS.unwitnessed, "No source I read says who holds this.");
  assert.equal(GAP_LABELS.no_present_holder, "The closest source speaks of the past, not the present.");
  assert.equal(GAP_LABELS.refuted, "A source I checked says otherwise.");
  assert.equal(GAP_LABELS.no_grammar_for_language, "I can’t read questions in this language yet.");
  for (const k of ["unwitnessed", "no_present_holder", "refuted", "unreached", "frame_unread", "no_grammar_for_language"]) {
    const t = clone(TURNS.A2); t.gap.kind = k;
    const m = answerCardModel(t);
    assert.equal(m.kind, "gap"); assert.equal(m.gap.kind, k); assert.equal(m.gap.label, GAP_LABELS[k]); assert.equal(m.headline, null);
  }
  // a kind this build has never heard of is drawn as a gap with the generic words, never as nothing and never with the kind's raw text
  const t = clone(TURNS.A2); t.gap.kind = "<b>weird</b>";
  const m = answerCardModel(t);
  assert.equal(m.gap.known, false); assert.doesNotMatch(m.gap.label, /weird|</);
  assert.equal(draw(t).all("gap")[0].className, "gap gap-unknown", "a data-supplied kind never becomes a class name");
});

test("model: the wording of 'unwitnessed' follows the slot only when the turn names one; otherwise it is the brief's line", () => {
  assert.equal(answerCardModel(TURNS.A2).gap.label, "No source I read says who holds this.");
  const t = clone(TURNS.A2); t.slot = "place";
  assert.equal(answerCardModel(t).gap.label, UNWITNESSED_BY_SLOT.place);
  t.slot = "person"; assert.equal(answerCardModel(t).gap.label, GAP_LABELS.unwitnessed);
});

test("model A3 FALSIFIER: the past-tense sentence is drawn as the closest source and NO present holder is asserted", () => {
  const m = answerCardModel(TURNS.A3);
  assert.equal(m.kind, "gap"); assert.equal(m.gap.kind, "no_present_holder");
  assert.equal(m.headline, null); assert.equal(m.quote, null);
  assert.equal(m.gap.closest.quote.text, TURNS.A3.gap.closest.sentence);
  assert.match(m.gap.closest.quote.text, /was the last king/);
  const card = draw(TURNS.A3);
  assert.equal(card.all("answer-text").length, 0);
  assert.doesNotMatch(allText(card), /Louis XVI is the king|king of France is Louis/i);
});

test("model A5: the refuting passage is the closest source; Elizabeth II is not presented as the current monarch", () => {
  const m = answerCardModel(TURNS.A5);
  assert.equal(m.gap.kind, "refuted");
  assert.match(m.gap.closest.quote.text, /died on 8 September 2022/);
  assert.match(m.gap.closest.quote.text, /succeeded/);
  assert.equal(m.gap.closest.cite.kind, "pointer", "the refuting page is an encyclopedia: a pointer, not a citation");
  const card = draw(TURNS.A5);
  assert.equal(card.all("answer-text").length, 0);
  assert.match(allText(card.all("gap")[0]), /died on 8 September 2022/);
});

test("model A2 FALSIFIER: a gap names no one", () => {
  const m = answerCardModel(TURNS.A2);
  assert.equal(m.kind, "gap"); assert.equal(m.gap.kind, "unwitnessed");
  const card = draw(TURNS.A2);
  assert.equal(card.all("answer-text").length, 0); assert.equal(card.all("gap").length, 1);
  assert.doesNotMatch(allText(card), /Elizabeth|Charles|Biden|Macron|Trump/);
});

test("model contest: both rows, each with its own source, and the model carries no verdict", () => {
  const m = answerCardModel(TURNS.X1);
  assert.equal(m.kind, "contest"); assert.equal(m.headline, null); assert.equal(m.gap, null);
  assert.deepEqual(m.contest.map((c) => c.label), ["Elizabeth II", "Charles III"]);
  assert.equal(m.contest[0].quote.text, TURNS.X1.contest[0].sentence);
  assert.equal(m.contest[1].cite.kind, "pointer");
  assert.equal(m.contest[0].cite.host, "example.org");
  assert.doesNotMatch(JSON.stringify(m), /correct|incorrect|\bwrong\b|\bright\b|\bmore likely\b|\bwinner\b/i);
});

// ---------- falsifiers on what may ship as an answer ----------
test("FALSIFIER: an answer that cannot show its source sentence is never drawn as an answer", () => {
  const noRow = clone(TURNS.A1); delete noRow.answer.row;
  assert.equal(answerCardModel(noRow).kind, "gap");
  const blank = clone(TURNS.A1); blank.answer.row.sentence = "   ";
  assert.equal(answerCardModel(blank).kind, "gap");
  assert.equal(draw(noRow).all("answer-text").length, 0);
});

test("FALSIFIER: an answer that did not 'survive' is never drawn as an answer", () => {
  for (const standing of ["held", "true", "", undefined, null, "SURVIVED"]) {
    const t = clone(TURNS.A1); t.answer.standing = standing;
    assert.equal(answerCardModel(t).kind, "gap", String(standing));
  }
});

test("FALSIFIER: a turn that carries a gap is drawn as that gap, even when it also carries an answer", () => {
  const t = clone(TURNS.A1); t.gap = { kind: "refuted", closest: TURNS.A5.gap.closest };
  const m = answerCardModel(t);
  assert.equal(m.kind, "gap"); assert.equal(m.gap.kind, "refuted");
  assert.equal(draw(t).all("answer-text").length, 0);
});

test("a turn with answer:null and gap:null (or no turn at all) is a gap card, never an empty card", () => {
  for (const bad of [{ schema: "AnswerTurn@1", answer: null, gap: null }, {}, null, undefined, "text", 7, [], { answer: {}, gap: {} }]) {
    const card = draw(bad);
    assert.equal(card.tag, "section"); assert.equal(card.getAttribute("aria-label"), "Answer");
    const g = card.all("gap");
    assert.equal(g.length, 1, JSON.stringify(bad));
    assert.ok(allText(g[0]).trim().length > 10, "the gap says something");
    assert.equal(card.all("answer-text").length, 0);
    assert.equal(answerCardModel(bad).kind, "gap");
  }
  // a single contesting row is not a contest: it is the closest thing found, drawn under a gap
  const one = clone(TURNS.X1); one.contest = [one.contest[1]];
  const m = answerCardModel(one);
  assert.equal(m.kind, "gap"); assert.equal(m.gap.closest.quote.text, TURNS.X1.contest[1].sentence);
});

// ---------- the rendered tree ----------
test("render A1: the binding class names, one line + one quote + the citation + the disclosure", () => {
  const doc = makeDoc(); const card = draw(TURNS.A1, doc);
  assert.equal(card.tag, "section"); assert.ok(card.classList.contains("answer-card"));
  assert.equal(card.getAttribute("aria-label"), "Answer");
  const at = card.all("answer-text"); assert.equal(at.length, 1);
  assert.equal(at[0].textContent, "Charles III is the king of the United Kingdom.");
  assert.deepEqual(at[0].tags("strong").map((s) => s.textContent), ["Charles III"], "the filler is bold (not conveyed by colour alone)");
  const cite = card.all("answer-cite"); assert.equal(cite.length, 1);
  assert.match(cite[0].textContent, /not cited/); assert.doesNotMatch(cite[0].textContent, /open ↗/);
  assert.equal(cite[0].tags("a").length, 0, "no link to the encyclopedia: it is not the source");
  const q = card.all("answer-quote"); assert.equal(q.length, 1, "never more than one quote visible by default");
  assert.equal(q[0].textContent, TURNS.A1.answer.row.sentence);
  assert.ok(q[0].tags("mark").some((m) => m.textContent === "Charles III"));
  const checked = card.all("answer-checked"); assert.equal(checked.length, 1);
  assert.equal(checked[0].textContent, "Checked: no later holder in 3 sources · Charles III’s page: no death date");
  const tr = card.all("answer-trace"); assert.equal(tr.length, 1); assert.equal(tr[0].tag, "details");
  assert.equal(tr[0].tags("summary")[0].textContent, "how I reasoned");
  assert.equal(tr[0].all("trace-line").length, TURNS.A1.trace.length);
  assert.equal(tr[0].attrs.open, undefined, "closed by default");
  assert.equal(doc.head.find((e) => e.id === ANSWERCARD_STYLE_ID).length, 1, "the stylesheet is injected");
  draw(TURNS.A1, doc); assert.equal(doc.head.find((e) => e.id === ANSWERCARD_STYLE_ID).length, 1, "and only once");
});

test("render A1: the trace carries the search that names the claim (the C9 falsifier) and is the app's first person", () => {
  const lines = draw(TURNS.A1).all("trace-line").map((l) => l.textContent);
  assert.ok(lines.some((t) => /searched/i.test(t) && /Charles III/.test(t)));
  assert.match(lines[0], /^It looks like a question of fact/);
});

test("render: the source sentence appears EXACTLY ONCE in the card, for every answer and gap fixture", () => {
  for (const id of ["A1", "A3", "A4", "A5", "A6", "A7"]) {
    const t = TURNS[id]; const sentence = (t.answer?.row || t.gap?.closest).sentence;
    const card = draw(t);
    assert.equal(occurrences(card.textContent, sentence), 1, id);
  }
  const x = draw(TURNS.X1);
  for (const r of TURNS.X1.contest) assert.equal(occurrences(x.textContent, r.sentence), 1);
});

test("render A7: a headline that IS the source sentence is drawn once, not twice (and still bold on the filler)", () => {
  const card = draw(TURNS.A7);
  assert.equal(card.all("answer-text")[0].textContent, TURNS.A7.answer.row.sentence);
  assert.equal(card.all("answer-quote").length, 0);
  assert.deepEqual(card.all("answer-text")[0].tags("strong").map((s) => s.textContent), ["eight"]);
  assert.equal(card.all("answer-cite").length, 1);
});

test("render: contest draws both rows side by side with their sources, and no answer line", () => {
  const card = draw(TURNS.X1);
  const c = card.all("answer-contest"); assert.equal(c.length, 1);
  const cols = card.all("contest-col"); assert.equal(cols.length, 2);
  assert.match(cols[0].textContent, /Elizabeth II/); assert.match(cols[0].textContent, /example\.org|older copy/);
  assert.match(cols[1].textContent, /Charles III/); assert.match(cols[1].textContent, /not cited/);
  assert.equal(cols[0].all("answer-quote")[0].textContent, TURNS.X1.contest[0].sentence);
  assert.equal(cols[1].all("answer-quote")[0].textContent, TURNS.X1.contest[1].sentence);
  assert.equal(card.all("answer-text").length, 0); assert.equal(card.all("answer-checked").length, 0);
  assert.doesNotMatch(allText(card), /\b(correct|incorrect|wrong|right|actually|more likely|latest|newer)\b/i, "says nothing about which is right");
});

test("render: a gap reuses the app's .gap block (.gap-h .gap-mark .gap-kind) and shows the closest sentence under its caption", () => {
  const card = draw(TURNS.A3);
  const g = card.all("gap")[0];
  assert.equal(g.className, "gap gap-no_present_holder"); assert.equal(g.getAttribute("role"), "note");
  assert.equal(g.all("gap-kind")[0].textContent, GAP_LABELS.no_present_holder);
  assert.equal(g.all("gap-mark")[0].getAttribute("aria-hidden"), "true");
  assert.equal(g.all("gap-sub")[0].textContent, "The closest sentence I found:");
  assert.equal(draw(TURNS.A5).all("gap-sub")[0].textContent, "What that source says:");
  assert.equal(g.all("answer-quote")[0].textContent, TURNS.A3.gap.closest.sentence);
  assert.match(g.all("answer-cite")[0].textContent, /not cited/);
  const t = clone(TURNS.A2); const d = draw(t);
  assert.match(allText(d.all("gap")[0]), /tried: Who is the president of the UK\?, president of the UK/);
  assert.match(allText(d.all("gap")[0]), /to close it: name the country/);
});

test("render: what could not be checked is said in words, in the card and in the trace (not by colour alone)", () => {
  const card = draw(TURNS.A4);
  assert.equal(card.all("answer-unmeasured")[0].textContent, "Not checked: whether a newer page names someone else");
  const un = card.all("trace-line").filter((l) => l.classList.contains("is-unmeasured"));
  assert.equal(un.length, 1); assert.match(un[0].textContent, /I couldn’t check this/);
  assert.equal(draw(TURNS.A1).all("answer-unmeasured").length, 0);
});

test("render: an answer with nothing checked beyond the source says so instead of inventing a check", () => {
  const t = clone(TURNS.A6); t.answer.survived = [];
  assert.equal(draw(t).all("answer-checked")[0].textContent, "Checked: only the source itself.");
});

test("render: a trace line's probe query is shown when the line did not already say it", () => {
  const t = clone(TURNS.A1); t.trace = [{ n: 1, who: "app", say: "I checked another page.", probe: { query: "Charles III", why: "a person who died cannot be the current holder" }, result: "found nothing" }];
  const li = draw(t).all("trace-line")[0];
  assert.match(li.textContent, /I searched “Charles III”/); assert.match(li.textContent, /Found: found nothing/);
});

// ---------- data is never markup ----------
test("FALSIFIER: a quote with <script> and HTML renders as text, never as elements", () => {
  const evil = 'Mallory <script>alert("x")</script> is the <b>king</b> of <img src=x onerror=alert(1)> Atlantis & “co”.';
  const t = clone(TURNS.A1);
  t.answer.row.sentence = evil; t.answer.row.filler = { text: "Mallory", span: [0, 7] }; t.answer.row.emphasis = [[0, 7]];
  t.answer.text = "Mallory is the king of Atlantis."; t.answer.filler = t.answer.row.filler;
  t.answer.row.source = { title: '<i>Atlantis</i>', url: "javascript:alert(1)", host: "<x>", lang: "en" };
  const card = draw(t);
  const bad = card.find((e) => ["script", "b", "img", "i", "x"].includes(e.tag));
  assert.deepEqual(bad, [], "no element was made out of data");
  assert.equal(card.all("answer-quote")[0].textContent, evil, "verbatim, as text");
  assert.match(card.textContent, /<script>alert\("x"\)<\/script>/);
  assert.equal(card.tags("a").length, 0, "a javascript: url is never a link");
  assert.equal(card.tags("a").filter((a) => /javascript/i.test(a.getAttribute("href") || "")).length, 0);
  assert.match(card.all("answer-cite")[0].textContent, /<i>Atlantis<\/i>/);
});

test("FALSIFIER: HTML in a trace line, a gap's tried list or a contest filler is text too", () => {
  const t = clone(TURNS.X1);
  t.contest[0].filler = { text: "<b>Elizabeth II</b>", span: [0, 19] }; t.contest[0].sentence = "<b>Elizabeth II</b> is the queen.";
  t.trace = [{ n: 1, say: "I read <script>1</script>", detail: "<u>d</u>", result: "<em>r</em>" }];
  t.void = { text: "<h1>x</h1>", status: "unmeasured", children: [] };
  const card = draw(t);
  assert.deepEqual(card.find((e) => ["b", "script", "u", "em", "h1"].includes(e.tag)), []);
  const g = clone(TURNS.A2); g.gap.tried = ["<script>1</script>"]; g.gap.closeBy = ["<b>x</b>"];
  assert.deepEqual(draw(g).find((e) => ["b", "script"].includes(e.tag)), []);
});

test("no innerHTML / outerHTML / insertAdjacentHTML / document.write / DOMParser anywhere in the source", () => {
  assert.doesNotMatch(SRC, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|createContextualFragment|DOMParser|\.setHTML|srcdoc/);
});

test("no case logic and no apparatus words in the source's code or in what the card shows", () => {
  assert.doesNotMatch(SRC, /\[A-Z\]|\\p\{Lu\}|toUpperCase|toLowerCase|localeUpperCase|toLocaleUpperCase|toLocaleLowerCase/);
  const BAN = /\bvoid\b|\bEOT\b|\bkhora\b|\bjanus\b|\bpenelope\b|\bheimdall\b|\barchon|\bprobe\b|\bframe\b|\bT1\b|\bunmeasured\b|\bfalsif|\bpolarity\b|\bsentinel\b/i;
  for (const id of FIXTURE_IDS) assert.doesNotMatch(allText(draw(TURNS[id])), BAN, id);
  for (const l of Object.values(GAP_LABELS).concat(Object.values(UNWITNESSED_BY_SLOT))) assert.doesNotMatch(l, BAN);
});

// ---------- spans ----------
test("cleanSpans / segmentsOf: broken spans are dropped, overlaps merged, a surrogate pair is never split, and the text is never changed", () => {
  assert.deepEqual(cleanSpans("abcdef", [[4, 2], [-5, 1], [2, 99], ["a", 3], null, [1.9, 3.2], [2, 4]]), [[0, 6]]);
  assert.deepEqual(cleanSpans("abcdef", [[4, 2], ["a", 3], null, [NaN, 2], [Infinity, 3], [5, 5], [1, 2]]), [[1, 2]]);
  assert.deepEqual(cleanSpans("abcdef", [[1, 3], [3, 5]]), [[1, 5]]);
  const s = "a\u{1F600}b";   // the emoji is two UTF-16 units: offsets 1 and 2
  for (const sp of [[2, 3], [1, 2], [0, 2]]) {
    const segs = segmentsOf(s, [sp]);
    assert.equal(segs.map((x) => x.text).join(""), s);
    for (const x of segs) assert.doesNotMatch(x.text, /^[\udc00-\udfff]|[\ud800-\udbff]$/, "no lone surrogate at an edge: " + JSON.stringify(sp));
  }
  // property: whatever the spans, the segments concatenate to the original text
  let seed = 7; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const text = "The quick \u{1F600} brown föx 日本語 jumps.";
  for (let i = 0; i < 300; i++) {
    const spans = Array.from({ length: rnd(5) }, () => [rnd(text.length + 6) - 3, rnd(text.length + 6) - 3]);
    assert.equal(segmentsOf(text, spans).map((x) => x.text).join(""), text);
  }
});

test("citeOf (a bare source, no row): Wikipedia hosts read as 'Wikipedia', another host is shown as it is, a non-http url is not kept", () => {
  assert.equal(citeOf({ title: "Canberra", url: "https://de.wikipedia.org/wiki/Canberra", host: "de.wikipedia.org" }).label, "Canberra — Wikipedia");
  assert.equal(citeOf({ title: "T", url: "https://www.example.org/x", host: "www.example.org" }).label, "T — example.org");
  assert.equal(citeOf({ title: "T", url: "https://example.org/x" }).host, "example.org", "host from the url when not given");
  assert.equal(citeOf({ title: "T", url: "javascript:1" }).url, null);
  assert.equal(citeOf({}), null); assert.equal(citeOf(null), null);
});

// ---------- mounting ----------
test("mountAnswerCard: appends the card when msg.answerTurn exists, is a no-op otherwise, and re-mounting replaces", () => {
  const doc = makeDoc(); const msgEl = doc.createElement("div");
  msgEl.append(doc.createElement("p"));
  assert.equal(mountAnswerCard(msgEl, {}), null); assert.equal(mountAnswerCard(msgEl, { answerTurn: null }), null);
  assert.equal(mountAnswerCard(null, { answerTurn: TURNS.A1 }), null); assert.equal(mountAnswerCard(msgEl, null), null);
  assert.equal(msgEl.children.length, 1, "nothing was added");
  const c = mountAnswerCard(msgEl, { answerTurn: TURNS.A1 });
  assert.ok(c.classList.contains("answer-card")); assert.equal(msgEl.children.length, 2); assert.equal(msgEl.children[1], c);
  mountAnswerCard(msgEl, { answerTurn: TURNS.A6 });
  assert.equal(msgEl.all("answer-card").length, 1, "one card per message");
  assert.match(msgEl.all("answer-text")[0].textContent, /Canberra/);
});

// ---------- the look ----------
test("css: namespaced under .answer-card, uses the app's theme variables (light and dark follow the page), reuses .gap without redefining it", () => {
  assert.equal(ANSWERCARD_STYLE_ID, "fold-answercard-style");
  for (const v of ["--ink", "--ink2", "--mut", "--line2", "--side2", "--ag", "--warn"]) assert.ok(ANSWERCARD_CSS.includes("var(" + v), v);
  const sels = ANSWERCARD_CSS.split("}").map((r) => r.split("{")[0].trim()).filter(Boolean);
  for (const s of sels) for (const part of s.split(",")) assert.match(part.trim(), /^\.answer-card/, "unscoped selector: " + part);
  assert.doesNotMatch(ANSWERCARD_CSS, /(^|\})\s*\.gap\s*\{/, "the app's .gap is reused, not redefined");
  assert.doesNotMatch(ANSWERCARD_CSS, /background(-color)?:\s*#(fff|ffffff|000|000000)\b/i, "no hard-coded page colours");
  assert.match(ANSWERCARD_CSS, /minmax\(min\(100%, 240px\), 1fr\)/, "the contest columns stack on a phone");
});


// ---------- an encyclopedia is a pointer, never a citation (fold-chat-origin.js) ----------
const withOrigin = (origin) => { const t = clone(TURNS.A1); t.answer.row.origin = origin; return t; };
const ORIGIN_OK = {
  status: "origin", found: { kind: "wikipedia", title: "Monarchy of the United Kingdom", url: "https://en.wikipedia.org/wiki/Monarchy_of_the_United_Kingdom", edition: "en" },
  refs: [{ n: 12, id: "12", url: "https://www.royal.uk/the-monarchy", label: "The Monarchy", host: "royal.uk" }],
  path: [{ kind: "found-in", title: "Monarchy of the United Kingdom", url: "https://en.wikipedia.org/wiki/Monarchy_of_the_United_Kingdom", edition: "en" }, { kind: "reference", n: 12, id: "12", url: "https://www.royal.uk/the-monarchy" }, { kind: "read", url: "https://www.royal.uk/the-monarchy", via: "direct", title: "The Monarchy", copy: false, supports: true }],
  tried: [], origin: { url: "https://www.royal.uk/the-monarchy", title: "The Monarchy", host: "royal.uk", via: "direct", copy: false, sentence: "The current monarch is King Charles III, who came to the throne on 8 September 2022." },
};

test("origin: a row that reached an original page is CITED as that page, with the path there; the quote is the original's own sentence", () => {
  const m = answerCardModel(withOrigin(ORIGIN_OK));
  assert.equal(m.kind, "answer");
  assert.equal(m.cite.url, "https://www.royal.uk/the-monarchy"); assert.equal(m.cite.host, "royal.uk");
  assert.doesNotMatch(JSON.stringify(m.cite.label), /wikipedia/i, "the citation does not name the encyclopedia");
  assert.deepEqual(m.cite.path.map((h) => h.text), ["Wikipedia “Monarchy of the United Kingdom”", "reference 12", "royal.uk"], "the path is kept: where it was found → the reference → the page");
  assert.equal(m.quote.text, "The current monarch is King Charles III, who came to the throne on 8 September 2022.", "verbatim from the cited page, not the encyclopedia's sentence");
  assert.ok(m.quote.emphasis.some(([a, b]) => m.quote.text.slice(a, b) === "Charles III"), "the filler is still marked where the original says it");
  const card = draw(withOrigin(ORIGIN_OK));
  const cite = card.all("answer-cite")[0];
  assert.match(cite.textContent, /found via .*Wikipedia “Monarchy of the United Kingdom”.* → reference 12 → royal\.uk/);
  assert.equal(cite.tags("a").filter((a) => a.getAttribute("href") === "https://www.royal.uk/the-monarchy").length >= 1, true);
});

test("origin FALSIFIER: an origin that cannot show its own sentence is not a citation — it is drawn as a pointer", () => {
  const o = clone(ORIGIN_OK); o.origin.sentence = null;
  const m = answerCardModel(withOrigin(o));
  assert.equal(m.cite.kind, "pointer");
  assert.equal(m.quote.text, TURNS.A1.answer.row.sentence, "no origin words to show, so the row's own words are still what is quoted");
});

test("pointer: an encyclopedia row whose references could not be read lists them as links to fetch, and names the encyclopedia only as where it was found", () => {
  const o = { status: "unread", found: ORIGIN_OK.found, refs: [{ n: 4, id: "4", url: "https://www.example.org/a", label: "Report A", host: "example.org" }, { n: 5, id: "5", url: null, archived: "https://web.archive.org/web/2020/https://gone.example/b", label: "Report B", host: "" }], path: [], tried: [], origin: null };
  const m = answerCardModel(withOrigin(o));
  assert.equal(m.cite.kind, "pointer"); assert.equal(m.cite.url, null);
  assert.match(m.cite.label, /Found in Wikipedia “Monarchy of the United Kingdom” — not cited: its references could not be read\. It points to 2 original sources\./);
  assert.deepEqual(m.cite.pointers.map((p) => p.url), ["https://www.example.org/a", "https://web.archive.org/web/2020/https://gone.example/b"]);
  const card = draw(withOrigin(o));
  const hrefs = card.all("answer-cite")[0].tags("a").map((a) => a.getAttribute("href"));
  assert.deepEqual(hrefs, ["https://www.example.org/a", "https://web.archive.org/web/2020/https://gone.example/b"], "each pointer is a link; the encyclopedia itself is not one");
});
