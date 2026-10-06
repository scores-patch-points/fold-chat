// fold-chat-ground.test.mjs — the grounding mechanisms, falsifiable:
//   stripSelfCitations  a model's own bracket address is neutralized
//   attribute/coverage  a sentence is addressed only to material it shares a
//                       PHRASE with, and never when it commits to a name the
//                       material lacks (the Bryan-TX-PD veto)
//   unsupportedClaims   figures and names the material does not say
//   turnRecord          the holodeck's one-line record
import test from "node:test";
import assert from "node:assert/strict";
import { splitSentences, tokenize, overlap, stripSelfCitations, namesIn, numbersIn, attribute, coverage, unsupportedClaims, turnRecord, facingPage, MIN_RUN } from "./fold-chat-ground.js";

test("splitSentences does not cut on abbreviations or initials", () => {
  const s = splitSentences("Washington, D.C. was founded in 1791. Its site was chosen by Congress.");
  assert.equal(s.length, 2, "D.C. is not a sentence boundary");
  assert.match(s[0], /D\.C\. was founded in 1791\.$/);
  const initials = splitSentences("The plan was drawn by J. R. R. Tolkien in 1937. It sold well.");
  assert.equal(initials.length, 2);
  assert.match(initials[0], /Tolkien in 1937\.$/);
});

test("splitSentences splits on sentence punctuation and newlines, not abbreviations", () => {
  assert.deepEqual(splitSentences("One claim. Two claims!\nA third."), ["One claim.", "Two claims!", "A third."]);
  assert.deepEqual(splitSentences("See Dr. Smith now. Done."), ["See Dr. Smith now.", "Done."]);
});

test("overlap finds the longest shared run in order; MIN_RUN is 2", () => {
  assert.equal(overlap(tokenize("missing contract funds"), tokenize("about the missing contract funds today")), 3);
  assert.equal(overlap(tokenize("alpha"), tokenize("beta")), 0);
  assert.equal(MIN_RUN, 2);
});

test("stripSelfCitations neutralizes a bracket address the model invented", () => {
  const r = stripSelfCitations("The funds are gone [audit#80-174]. See above.");
  assert.equal(r.removed, 1);
  assert.match(r.text, /citation removed — not issued by this instrument/);
  assert.doesNotMatch(r.text, /\[audit#80-174\]/);
});

test("namesIn reads a name whole across accents; a lone capital is not a name", () => {
  assert.deepEqual(namesIn("Anna Pávlovna greeted Éloise"), ["Anna Pávlovna", "Éloise"]);
  assert.ok(namesIn("the MNPD BOLO was issued").includes("MNPD BOLO"));
  // A sentence-initial capital is an opener, not a name.
  assert.deepEqual(namesIn("Today is fine."), []);
  // A LONE mid-sentence proper noun IS a name the sentence commits to — this is
  // what lets "founded in 1795" be checked against a passage lacking Washington.
  assert.deepEqual(namesIn("Washington was founded in 1795."), ["Washington"]);
});

test("a lone proper noun must appear in the material to warrant the claim", () => {
  // The Snowden-disclosures failure: an Ottawa sentence riding a shared phrase.
  const snowden = [{ ref: "Wikipedia — Snowden disclosures", source: "https://en.wikipedia.org/wiki/Snowden", text: "According to a secret NSA memo dated September 2010, the Italian embassy in Washington was targeted." }];
  const out = attribute("Ottawa was the first capital of Canada.", snowden);
  assert.equal(out[0].ref, null, "Ottawa is not in the Snowden passage — no grounding");
  // A true support still grounds.
  const real = [{ ref: "Wikipedia — Ottawa", source: "https://en.wikipedia.org/wiki/Ottawa", text: "Ottawa was founded in 1857 and became the capital of the Province of Canada." }];
  assert.ok(attribute("Ottawa was founded in 1857.", real)[0].ref, "the real Ottawa passage still grounds");
});

test("attribute: a shared phrase is addressed; a lone shared word is not", () => {
  const material = [{ ref: "you · message 1", source: "S1", text: "The audit found the contract funds are unaccounted for." }];
  const cov = coverage("The contract funds are unaccounted for, the report says. I cannot verify the rest.", material);
  assert.ok(cov.grounded >= 1, "the shared phrase is addressed");
  assert.match(cov.entries.find((e) => e.ref).address, /^you · message 1#\d+-\d+$/);
  // A single shared word is not a phrase: not addressed.
  const lone = attribute("Search happened.", [{ ref: "m", source: "S1", text: "The search records are attached." }]);
  assert.equal(lone[0].ref, null);
});

test("the veto: a shared phrase does NOT warrant a name the material lacks", () => {
  // The Bryan TX PD / MNPD BOLO incident: the phrase is real, the subject is not.
  const material = [{ ref: "S1", source: "S1", text: "Hendersonville TN PD: the reason was MNPD BOLO." }];
  const out = attribute("Bryan TX PD: the reason was MNPD BOLO.", material);
  assert.equal(out[0].ref, null, "the invented subject is not warranted by the shared phrase");
});

test("unsupportedClaims names the figures and names the material does not say", () => {
  const material = [{ ref: "S1", source: "S1", text: "The audit found the contract funds are unaccounted for." }];
  const u = unsupportedClaims("The contract funds total $4.2 million and were signed by Jane Doe.", material);
  assert.ok(u.numbers.includes("4.2"), "an invented figure is caught");
  assert.ok(u.names.some((n) => /Jane Doe/.test(n)), "an invented name is caught");
});

test("turnRecord is the holodeck's one-line record, with addresses checked", () => {
  const material = [{ ref: "you · message 1", source: "S1", text: "The audit found the contract funds are unaccounted for." }];
  const rec = turnRecord("The contract funds are unaccounted for. They total $4.2 million.", material, { turn: 2 });
  assert.match(rec.line, /^On record · turn 2 · /);
  assert.match(rec.line, /address.* checked/);
  assert.match(rec.line, /not in the material/);
  assert.ok(rec.sources.length >= 1);
  assert.ok(rec.unsupported.numbers.includes("4.2"));
  assert.equal(rec.facing.has, true, "the record carries the facing page when material was read");
});

test("turnRecord with no material says the answer stands on the model alone", () => {
  const rec = turnRecord("Hello there.", [], { turn: 1 });
  assert.match(rec.line, /no material carried/);
  assert.equal(rec.hasMaterial, false);
  assert.equal(rec.facing.has, false, "no material means no facing page");
});

test("facingPage: sources are numbered S# with address+verbatim snip; response tags [S#]/[M]", () => {
  const material = [
    { ref: "you · pasted 1", source: "S1", text: "The audit found the contract funds are unaccounted for." },
    { ref: "you · pasted 2", source: "S2", text: "The report was filed in March by the comptroller." },
  ];
  const face = facingPage(
    "The contract funds are unaccounted for. The report was filed in March by the comptroller. I cannot verify the rest.",
    material,
  );
  assert.equal(face.has, true);
  assert.equal(face.sources.length, 2, "two cited passages become two sources");
  assert.equal(face.sources[0].n, "S1");
  assert.match(face.sources[0].address, /^you · pasted 1#\d+-\d+$/);
  assert.match(face.sources[0].text, /contract funds are unaccounted/);
  // The first two sentences cite S1 and S2; the third is the mouth's own prose.
  assert.equal(face.response[0].tag, "S1");
  assert.equal(face.response[1].tag, "S2");
  assert.equal(face.response[2].tag, "M");
  assert.equal(face.response[2].grounded, false);
});

test("facingPage over no material has no sources, and every sentence is [M]", () => {
  const face = facingPage("A greeting is not a claim.", []);
  assert.equal(face.has, false);
  assert.equal(face.sources.length, 0);
  assert.ok(face.response.every((r) => r.tag === "M" && !r.grounded));
});

test("sourceDocs: passages of one document are listed under it, in first-seen order, each keeping its S# tag", async () => {
  const { sourceDocs } = await import("./fold-chat-ground.js");
  const wiki = { label: "Wikipedia — Nashville", url: "https://en.wikipedia.org/wiki/Nashville", domain: "en.wikipedia.org" };
  const docs = sourceDocs([
    { n: "S1", ...wiki, mark: "a" },
    { n: "S2", label: "Other", url: "https://example.org/x", domain: "example.org", mark: "b" },
    { n: "S3", ...wiki, mark: "c" },
  ]);
  assert.equal(docs.length, 2);
  assert.deepEqual(docs[0].passages.map((p) => p.n), ["S1", "S3"]);
  assert.equal(docs[0].title, "Wikipedia — Nashville");
  assert.equal(docs[0].domain, "en.wikipedia.org");
  assert.deepEqual(docs[1].passages.map((p) => p.n), ["S2"]);
  assert.deepEqual(sourceDocs(null), []);
  assert.deepEqual(sourceDocs([{ n: "S1", ref: "local file", mark: "x" }])[0].url, null, "a local source has no link");
});

// ===========================================================================================================
// The gate fix (docs/GATE-FIX-PREREG.md). Every fix has a test that passes and a falsifier that must fail:
// the material below is small and written for the test; the real-text measurement is eval/controls.mjs.
// ===========================================================================================================
import { claimOf, languageGapNote, excerpt, tokensWithOffsets } from "./fold-chat-ground.js";

const TOWER = [
  "The Eiffel Tower is a lattice tower on the Champ de Mars in Paris, France.",
  "It is named after the engineer Gustave Eiffel, whose company designed and built the tower from 1887 to 1889.",
  "A petition called Artists against the Eiffel Tower was sent to the Minister of Works on 14 February 1887.",
  "The tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris.",
  "Climbers usually begin from camps above 5,000 m (16,404 ft).",
  "The main structural work was completed at the end of March 1889.",
].join(" ");
const mat = (text, ref = "Wikipedia — Eiffel Tower") => [{ ref, source: "https://en.wikipedia.org/wiki/" + ref.replace(/^Wikipedia — /, "").replace(/ /g, "_"), text }];
const grounded = (s, text = TOWER, ref) => !!attribute(s, mat(text, ref))[0].ref;
const why = (s, text = TOWER) => attribute(s, mat(text))[0].why;

test("fix 1: a figure must sit in the SAME window as the words it is claimed with, and the citation must be the sentence that says it", () => {
  // the 1889 figure is on the page, but the matched words ("Eiffel Tower") sit beside 1887 only
  const farFigure = "The Eiffel Tower is a lattice tower in Paris. A petition against the Eiffel Tower was sent in February 1887. " + "Filler about unrelated matters. ".repeat(40) + "Separately, the world's fair opened in 1889.";
  assert.equal(grounded("The Eiffel Tower was completed in 1889.", farFigure), false, "1889 elsewhere on the page does not ground this sentence");
  // and when the page DOES say it, the cited quote is the sentence with the figure, not a neighbour
  const e = attribute("The Eiffel Tower was completed in 1889.", mat(TOWER))[0];
  assert.ok(e.ref, "the page says the main structural work was completed in 1889");
  assert.match(excerpt(e.sourceText, e.span).quote, /1889/);
  // falsifier: the same sentence with a year the page never gives
  assert.equal(grounded("The Eiffel Tower was completed in 1925."), false);
});

test("fix 1b: a figure is bound to its neighbouring words — 'landed … July 16' is not 'launched … July 16'", () => {
  const apollo = "Apollo 11 (July 16–24, 1969) was the American spaceflight that first landed humans on the Moon. Launched atop a Saturn V rocket on July 16, the spacecraft consisted of three parts. Armstrong and Aldrin landed in the Sea of Tranquility on July 20.";
  assert.equal(grounded("Apollo 11 landed on the Moon on July 16, 1969.", apollo, "Wikipedia — Apollo 11"), false);
  assert.equal(grounded("Apollo 11 landed in the Sea of Tranquility on July 20.", apollo, "Wikipedia — Apollo 11"), true);
  // two figures swapped relative to the page: 1961 began it, 1989 ended it
  const wall = "The Berlin Wall was a guarded concrete barrier that encircled West Berlin from 1961 to 1989. Construction began on 13 August 1961.";
  assert.equal(grounded("The Berlin Wall was built in 1989 and fell in 1961.", wall, "Wikipedia — Berlin Wall"), false);
  assert.equal(grounded("The Berlin Wall encircled West Berlin from 1961 to 1989.", wall, "Wikipedia — Berlin Wall"), true);
});

test("fix 2: a predicate no source says is rejected, not waved through on a shared subject", () => {
  for (const s of ["The Eiffel Tower is a type of pasta.", "The Eiffel Tower is 330 metres tall and made entirely of wood.", "The Eiffel Tower is the shortest structure in Paris."])
    assert.equal(grounded(s), false, s);
  assert.equal(why("The Eiffel Tower is a type of pasta."), "terms");
  // the same subject with a predicate the page does say
  assert.equal(grounded("The Eiffel Tower is the tallest structure in Paris."), true);
  assert.equal(grounded("The Eiffel Tower is named after the engineer Gustave Eiffel."), true);
});

test("fix 2b: a name that ENDS the sentence is still a name (the old regex dropped it before the full stop)", () => {
  assert.ok(namesIn("The Eiffel Tower is located in London.").includes("London"));
  assert.ok(namesIn("It lies in the Andes.").includes("Andes"));
  assert.equal(grounded("The Eiffel Tower is located in London."), false);
  assert.equal(why("The Eiffel Tower is located in London."), "name");
  assert.ok(namesIn("Washington, D.C. was founded in 1791.").includes("Washington"));
  assert.ok(!namesIn("It was founded in the U.S.A. long ago.").some((n) => /^U\.S\.A?$/.test(n) === false && n === "U"), "an abbreviation's dots are not a name's end");
  // a name that is not the page's subject must stand in the window, bound to the words it sits beside
  const canberra = "Canberra is the capital city of Australia. The site was a compromise between Sydney and Melbourne, Australia's two largest cities. Much later the area chosen for the capital was developed.";
  assert.equal(grounded("Sydney is the capital of Australia.", canberra, "Wikipedia — Canberra"), false);
  assert.equal(grounded("Canberra is the capital of Australia.", canberra, "Wikipedia — Canberra"), true);
});

test("fix 3: source tags, 'According to the … article', and source names are not part of the claim", () => {
  assert.equal(claimOf("According to the Wikipedia article on the Eiffel Tower [W1], the tower is 330 metres tall."), "the tower is 330 metres tall.");
  assert.equal(claimOf("According to Wikipedia [W1], the Eiffel Tower is 330 metres tall."), "the Eiffel Tower is 330 metres tall.");
  assert.equal(claimOf("The tower is **330 metres** tall [W2]."), "The tower is 330 metres tall .");
  assert.equal(claimOf("The sources indicate that the tower is 330 metres tall."), "the tower is 330 metres tall.");
  assert.deepEqual(namesIn("According to Wikipedia [W1], Gustave Eiffel built the tower."), ["Gustave Eiffel"]);
  assert.ok(grounded("According to Wikipedia [W1], the Eiffel Tower is 330 metres tall."));
  assert.ok(grounded("The Eiffel Tower is 330 metres tall, according to W2."));
  assert.ok(grounded("Based on the sources I have, the tower is 330 metres tall."));
  // falsifiers: packaging never rescues a false figure or a name the page lacks
  assert.equal(grounded("According to Wikipedia [W1], the Eiffel Tower is 450 metres tall."), false);
  assert.equal(grounded("According to Wikipedia [W1], the Eiffel Tower is located in London."), false);
  // a real source-name that is ALSO a claim's subject is not lost: only the site name is dropped, not the sentence
  assert.deepEqual(namesIn("Gustave Eiffel [W1] built it."), ["Gustave Eiffel"]);
});

test("fix 3b: declared unit conversion, to the precision the CLAIM states", () => {
  for (const s of ["The Eiffel Tower is 330 m tall.", "The Eiffel Tower stands 0.33 kilometres high.", "The Eiffel Tower is about 1,082.68 feet tall.", "The Eiffel Tower is 1,083 feet tall.", "The Eiffel Tower is 330 meters tall."])
    assert.equal(grounded(s), true, s);
  const everest = "Mount Everest is Earth's highest mountain above sea level. Its height was most recently measured in 2020 as 8,848.86 m (29,031 ft 8 in).";
  const everestMat = (t) => [{ ref: "Wikipedia — Mount Everest", source: "https://en.wikipedia.org/wiki/Mount_Everest", text: t }];
  const ev = (s, t = everest) => !!attribute(s, everestMat(t))[0].ref;
  assert.equal(ev("Mount Everest is roughly 8,849 metres high."), true, "a rounding of the decimal");
  assert.equal(ev("Mount Everest is about 29,032 feet tall."), true, "8,848.86 m is 29,031.7 ft");
  // falsifiers: a different quantity, or a precision the conversion does not reach
  for (const s of ["The Eiffel Tower is 33 m tall.", "The Eiffel Tower is 0.45 kilometres high.", "The Eiffel Tower is 1,090 feet tall.", "The Eiffel Tower is 1,000 feet tall."])
    assert.equal(grounded(s), false, s);
  assert.equal(ev("Mount Everest is roughly 8,950 metres high."), false);
  // tolerance is for units only: years are not within "rounding" of each other
  assert.equal(grounded("The Eiffel Tower was built between 1886 and 1889.", TOWER), false);
  // the answer-level check agrees
  assert.deepEqual(unsupportedClaims("The tower is 0.33 km and 1,083 feet tall.", mat(TOWER)).numbers, []);
  assert.deepEqual(unsupportedClaims("The tower is 0.45 km tall.", mat(TOWER)).numbers, ["0.45"]);
});

test("a measurement phrase needs a word of its family beside the figure: '5,000 m tall' is not 'camps above 5,000 m'", () => {
  assert.equal(grounded("The Eiffel Tower is 5,000 metres tall."), false);
  assert.equal(grounded("The tower reaches a height of 330 m."), true);
});

test("fix 4: tokens keep Devanagari / Arabic vowel signs whole, and CJK is cut into words", () => {
  assert.deepEqual(tokenize("कैनबरा ऑस्ट्रेलिया की राजधानी है।"), ["कैनबरा", "ऑस्ट्रेलिया", "की", "राजधानी", "है"]);
  assert.ok(tokenize("القَاهِرَة هي عاصمة").includes("القاهرة"), "Arabic tashkeel is folded, the word stays whole");
  const zh = tokenize("北京是一座全球城市，也是世界人口第三多的城市。");
  assert.ok(zh.length > 4, "a CJK clause is not one token: " + zh.join("|"));
  assert.ok(zh.every((t) => t.length <= 6));
  assert.deepEqual(tokenize("エッフェル塔の高さは330メートルです").includes("330"), true);
  assert.deepEqual(numbersIn("१९४७ में और ٢٠٢٤ में"), ["1947", "2024"], "native digits are figures");
  // offsets stay true to the SOURCE string (a decomposing character must not shift them)
  const src = "Ünïcode ñ — Ελλάδα 1999";
  const t = tokensWithOffsets(src).find((x) => x.t === "1999");
  assert.equal(src.slice(t.start, t.end), "1999");
});

test("fix 4b: splitSentences knows 。 ！ ？ । ؟ (no space after a CJK full stop)", () => {
  assert.deepEqual(splitSentences("北京是首都。上海是城市！天津呢？"), ["北京是首都。", "上海是城市！", "天津呢？"]);
  assert.deepEqual(splitSentences("भारत एक देश है। दिल्ली राजधानी है। यह बड़ा है।"), ["भारत एक देश है।", "दिल्ली राजधानी है।", "यह बड़ा है।"]);
  assert.deepEqual(splitSentences("ما عاصمة مصر؟ القاهرة هي العاصمة."), ["ما عاصمة مصر؟", "القاهرة هي العاصمة."]);
  assert.deepEqual(splitSentences("One. Two."), ["One.", "Two."], "English is unchanged");
});

const HI = "भारत (आधिकारिक नाम: भारत गणराज्य) दक्षिण एशिया में स्थित भारतीय उपमहाद्वीप का सबसे बड़ा देश है। यह 2600 ईसा पूर्व और 1900 ईसा पूर्व के मध्य अपने चरम पर थी। दिल्ली इसकी राजधानी है।";
const AR = "القاهرة هي عاصمة جمهورية مصر العربية وأكبر وأهم مدنها. يمثلون 20% من إجمالي تعداد سكان مصر أكثر من (107 مليون نسمة). تعد مدينة القاهرة من أكثر المدن تنوعاً ثقافياً وحضارياً.";
const ZH = "北京市，简称“京”，旧称“北平”，是中华人民共和国的首都及直辖市。北京荟萃了自元明清以来的中华文化，拥有众多历史名胜古迹，包括不可移动文物3840处，全国重点文物保护单位135处。北京是一座全球城市，也是世界人口第三多的城市和人口最多的首都。";
test("fix 4c: verbatim Hindi / Arabic / Chinese grounds to its own page; the same sentence with a false number does not", () => {
  const m = (t) => [{ ref: "src", source: "https://x.example/p", text: t }];
  for (const [text, sents] of [[HI, ["दिल्ली इसकी राजधानी है।", "यह 2600 ईसा पूर्व और 1900 ईसा पूर्व के मध्य अपने चरम पर थी।"]], [AR, ["يمثلون 20% من إجمالي تعداد سكان مصر أكثر من (107 مليون نسمة).", "تعد مدينة القاهرة من أكثر المدن تنوعاً ثقافياً وحضارياً."]], [ZH, ["北京是一座全球城市，也是世界人口第三多的城市和人口最多的首都。", "北京荟萃了自元明清以来的中华文化，拥有众多历史名胜古迹，包括不可移动文物3840处，全国重点文物保护单位135处。"]]])
    for (const s of sents) assert.ok(attribute(s, m(text))[0].ref, "verbatim accepted: " + s);
  assert.equal(attribute("यह 7777 ईसा पूर्व और 1900 ईसा पूर्व के मध्य अपने चरम पर थी।", m(HI))[0].ref, null);
  assert.equal(attribute("يمثلون 7777% من إجمالي تعداد سكان مصر أكثر من (107 مليون نسمة).", m(AR))[0].ref, null);
  assert.equal(attribute("北京荟萃了自元明清以来的中华文化，拥有众多历史名胜古迹，包括不可移动文物7777处，全国重点文物保护单位135处。", m(ZH))[0].ref, null);
  // a two-sentence Chinese answer is two checked sentences, not one
  assert.equal(attribute("北京是一座全球城市，也是世界人口第三多的城市和人口最多的首都。北京是一座岛屿。", m(ZH)).length, 2);
});

test("cross-language is a typed gap, not a silent miss and not faked", () => {
  const en = mat("The tower is 330 metres tall, about the same height as an 81-storey building, and the tallest structure in Paris.");
  const es = attribute("La Torre Eiffel mide 330 metros de altura.", en)[0];
  assert.equal(es.ref, null, "wording cannot cross a language; the figure alone is not a grounding");
  assert.equal(es.why, "cross-language");
  assert.deepEqual([es.gap.to], ["en"]);
  for (const s of ["Die Höhe des Eiffelturms beträgt 330 Meter.", "埃菲尔铁塔高330米。", "يبلغ ارتفاع برج إيفل 330 مترا.", "एफ़िल टॉवर की ऊँचाई 330 मीटर है।", "Высота Эйфелевой башни составляет 330 метров."])
    assert.equal(attribute(s, en)[0].why, "cross-language", s);
  const rec = turnRecord("La Torre Eiffel mide 330 metros de altura. The tower is 330 metres tall.", en);
  assert.equal(rec.gaps.length, 1);
  assert.equal(rec.gaps[0].kind, "cross-language");
  assert.match(rec.line, /another language than the sources/);
  assert.match(languageGapNote(rec.gaps), /cannot check it — that is a gap in the check, not a finding that it is wrong/);
  assert.equal(languageGapNote([]), "");
  // falsifiers: a same-language rejection is NOT typed as a language gap; a false foreign sentence stays rejected
  const sameLang = attribute("The tower is 450 metres tall.", en)[0];
  assert.equal(sameLang.ref, null);
  assert.notEqual(sameLang.why, "cross-language");
  assert.equal(attribute("La Torre Eiffel mide 450 metros de altura.", en)[0].ref, null);
  assert.equal(turnRecord("The tower is 450 metres tall.", en).gaps.length, 0);
});

test("excerpt: a decimal point or an abbreviation is not a sentence end", () => {
  const t = "Its height was measured in 2020 as 8,848.86 m (29,031 ft). The next sentence. Dr. Alexander Fleming, on duty at St. Mary's Hospital, found it.";
  const a = t.indexOf("measured"), b = a + "measured".length;
  assert.match(excerpt(t, { start: a, end: b }).quote, /8,848\.86 m \(29,031 ft\)\.$/);
  const f = t.indexOf("Fleming");
  assert.match(excerpt(t, { start: f, end: f + 7 }).quote, /^Dr\. Alexander Fleming ?, on duty at St\. Mary's Hospital, found it\.$/);
});

test("a multi-word name counts as evidence only where its words stand together; a heading is not a claim about a window", () => {
  const rydberg = "In 1913 Rydberg predicted that the next noble gas would have atomic number 118. The structure of the orbital approximation was described much later in the text.";
  assert.equal(attribute("Atomic Structure", mat(rydberg, "x"))[0].ref, null, "two capitalised words scattered over a window ground nothing");
  assert.ok(attribute("Steve Wozniak", mat("Apple was founded as a partnership by Steve Jobs, Steve Wozniak, and Ronald Wayne.", "Apple"))[0].ref);
});

test("the cited span stays inside the sentence that carries the evidence", () => {
  const e = attribute("Mount Everest is about 8,848.86 meters tall.", mat("Mount Everest attracts many climbers, including experienced mountaineers. Its height was most recently measured in 2020 as 8,848.86 m. Many routes exist.", "Wikipedia — Mount Everest"))[0];
  assert.ok(e.ref);
  assert.match(excerpt(e.sourceText, e.span).quote, /8,848\.86/);
});
