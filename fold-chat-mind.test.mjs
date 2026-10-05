import test from "node:test";
import assert from "node:assert/strict";
import {
  DECLARED, scriptOf, capitalisationIsSignificant, isUnspaced, segments, fold, entityFromTitle, casedRuns, mentions,
  emptyReferents, admitReferents, activated, resolveQuestion, searchQueries, titleAgreement, personLike, longestCommonStretch,
} from "./fold-chat-mind.js";

const EN_HINTS = { personalPronouns: ["he", "him", "his", "she", "her", "hers"], titles: ["judge", "dr", "mr", "mrs", "ms", "sir"] };

test("scriptOf names the script of any language, and Japanese is Kana-bearing", () => {
  const cases = { Latin: "Who founded Nashville?", Cyrillic: "Кто основал город?", Han: "谁创立了这座城市", Japanese: "ナッシュビルの街は誰が設立しましたか", Hangul: "내슈빌 시는 누가 세웠나요", Arabic: "من أسس المدينة", Hebrew: "מי ייסד את העיר", Devanagari: "शहर की स्थापना किसने की", Thai: "ใครเป็นผู้ก่อตั้งเมือง", Greek: "Ποιος ίδρυσε την πόλη", Other: "1779 !!" };
  for (const [want, text] of Object.entries(cases)) assert.equal(scriptOf(text), want, text);
});

test("case is significant only where the script says so", () => {
  for (const s of ["Latin", "Cyrillic", "Greek"]) assert.equal(capitalisationIsSignificant(s), true, s);
  for (const s of ["Han", "Japanese", "Hangul", "Arabic", "Hebrew", "Devanagari", "Thai"]) assert.equal(capitalisationIsSignificant(s), false, s);
  assert.equal(isUnspaced("Han"), true);
  assert.equal(isUnspaced("Latin"), false);
});

test("segments come from the script, not from spaces", () => {
  assert.ok(segments("谁创立了纳什维尔市").length >= 3, "Han is segmented without spaces");
  assert.ok(segments("ใครเป็นผู้ก่อตั้งเมืองแนชวิลล์").length >= 2, "Thai is segmented without spaces");
  assert.deepEqual(segments("Who founded it?").map((s) => s.text), ["Who", "founded", "it"]);
});

test("entityFromTitle takes the name out of a source title, in any language's wrapper", () => {
  assert.equal(entityFromTitle("Wikipedia — Nashville, Tennessee"), "Nashville, Tennessee");
  assert.equal(entityFromTitle("Eiffel Tower - Wikipedia"), "Eiffel Tower");
  assert.equal(entityFromTitle("Википедия — Нашвилл"), "Нашвилл");
  assert.equal(entityFromTitle("维基百科 — 纳什维尔"), "纳什维尔");
  assert.equal(entityFromTitle("Mercury (planet)"), "Mercury");
});

test("casedRuns finds names only where case marks names, and skips a sentence opener", () => {
  const runs = (t) => casedRuns(t).map((r) => r.surface);
  assert.deepEqual(runs("Nashville was founded by Judge Richard Henderson."), ["Judge Richard Henderson"]);
  assert.deepEqual(runs("Who founded Memphis, and when?"), ["Memphis"]);
  assert.deepEqual(runs("Ludwig van Beethoven wrote it."), ["Ludwig van Beethoven"]);
  assert.deepEqual(runs("谁创立了纳什维尔"), [], "no case → no case-based entities, and no refusal either");
  assert.deepEqual(runs("من أسس مدينة ناشفيل"), []);
});

test("mentions respects word boundaries where the script has them, and not where it does not", () => {
  assert.equal(mentions("Nashville SC won", "Nash"), false);
  assert.equal(mentions("Nash won", "nash"), true);
  assert.equal(mentions("纳什维尔由亨德森创立", "纳什维尔"), true);
  assert.equal(mentions("Café menu", "cafe"), true, "diacritics fold");
});

function nashvilleRecord() {
  return admitReferents(emptyReferents(), {
    question: "Who founded the city of Nashville, and when?",
    answer: "Nashville was founded in 1779 by Judge Richard Henderson, led by James Robertson and John Donelson.",
    sources: [{ title: "Wikipedia — Nashville, Tennessee" }],
  });
}

test("admitReferents keeps what a turn established: titles first, then the answer's names", () => {
  const rec = nashvilleRecord();
  const names = rec.entities.map((e) => e.surface);
  assert.ok(names.includes("Nashville, Tennessee"), "the title is an entity");
  assert.ok(names.includes("Judge Richard Henderson"));
  assert.ok(names.includes("James Robertson"));
  assert.equal(rec.turn, 1);
  assert.ok(rec.entities[0].weight >= rec.entities.at(-1).weight, "most active first");
});

test("THE 'HIM' FAILURE: a follow-up that names nothing carries the last answer's referent — and says so", () => {
  const rec = nashvilleRecord();
  const r = resolveQuestion("what happened to him later in life?", rec, { hints: EN_HINTS });
  assert.equal(r.reason, "carried");
  assert.equal(r.said, "what happened to him later in life?", "the person's words are never rewritten");
  assert.ok(r.carried.some((c) => c.surface === "Judge Richard Henderson"), JSON.stringify(r.carried));
  assert.ok(!r.carried.some((c) => /Tennessee/.test(c.surface)), "a personal pronoun narrows to person-like referents");
  assert.match(r.resolved, /Judge Richard Henderson/);
  assert.match(searchQueries(r)[0], /^Judge Richard Henderson/);
  assert.equal(searchQueries(r)[1], r.said, "the raw question is kept as a second query");
});

test("without a trigger nothing carries — a typed reason, not a guess (the false-carry fix: 85% of new-topic questions used to inherit the last topic)", () => {
  const r = resolveQuestion("what happened later?", nashvilleRecord());
  assert.equal(r.reason, "no-trigger");
  assert.deepEqual(r.carried, []);
  assert.equal(r.resolved, r.said);
});

test("FALSE-CARRY CONTROL: new-topic questions with a language's pronoun forms available still carry nothing unless one of those forms is in the question", () => {
  const rec = nashvilleRecord();
  for (const q of ["How do I boil an egg?", "what is the weather like in spring", "Is it safe to eat eggs after the date?".replace("it ", "eggs "), "tips to fall asleep faster", "best pizza dough recipe", "how many calories in an avocado"]) {
    const r = resolveQuestion(q, rec, { hints: EN_HINTS });
    assert.equal(r.reason === "carried", false, q + " → " + r.reason);
    assert.deepEqual(r.carried, [], q);
  }
});

test("a question with its OWN entity is never given another one (the false-carry control)", () => {
  const rec = nashvilleRecord();
  for (const q of ["Who founded Memphis, and when?", "When did Napoleon die?", "How tall is the Eiffel Tower?"]) {
    const r = resolveQuestion(q, rec, { hints: EN_HINTS });
    assert.deepEqual(r.carried, [], q);
    assert.equal(r.reason, "has-own-entity", q);
    assert.equal(r.resolved, q);
  }
  const named = resolveQuestion("tell me more about nashville, tennessee", rec);
  assert.equal(named.reason, "names-its-own");
  const long = resolveQuestion("can you explain in a lot more detail what exactly the typical weather looks like across the whole year there", rec);
  assert.equal(long.reason, "self-sufficient");
});

test("an empty record carries nothing", () => {
  assert.equal(resolveQuestion("what happened to him?", emptyReferents()).reason, "no-record");
  assert.equal(resolveQuestion("", nashvilleRecord()).reason, "no-record");
});

test("Cyrillic: a follow-up with no name carries the record's referent", () => {
  const rec = admitReferents(emptyReferents(), {
    question: "Кто основал город Нэшвилл и когда?",
    answer: "Нэшвилл был основан в 1779 году судьёй Ричардом Хендерсоном.",
    sources: [{ title: "Википедия — Нэшвилл" }],
  });
  assert.ok(rec.entities.some((e) => fold(e.surface) === fold("Нэшвилл")));
  const r = resolveQuestion("Что с ним стало потом?", rec, { hints: { carryTriggers: ["ним", "него", "нём", "ему", "его"] } });
  assert.equal(r.reason, "carried");
  assert.ok(r.carried.length >= 1);
});

test("Chinese (no case, no spaces): entities come from the source title and what the text repeats of it", () => {
  const rec = admitReferents(emptyReferents(), {
    question: "谁创立了纳什维尔？",
    answer: "纳什维尔由理查德·亨德森法官于1779年创立。",
    sources: [{ title: "维基百科 — 纳什维尔" }],
  });
  assert.ok(rec.entities.some((e) => e.surface === "纳什维尔"), JSON.stringify(rec.entities.map((e) => e.surface)));
  assert.deepEqual(casedRuns("谁创立了纳什维尔？"), [], "the old case-based finder would see no beings here");
  // the question itself names a known referent → nothing carried
  assert.equal(resolveQuestion("纳什维尔有多大？", rec).reason, "names-its-own");
  // a short follow-up with no name carries
  const r = resolveQuestion("他后来怎么样了？", rec, { hints: { personalPronouns: ["他", "她"] } });
  assert.equal(r.reason, "carried");
  assert.ok(r.carried.some((c) => c.surface === "纳什维尔"));
});

test("Arabic and Hebrew work the same way (title authority, no case)", () => {
  for (const [title, name, q, follow] of [
    ["ويكيبيديا — ناشفيل", "ناشفيل", "من أسس مدينة ناشفيل؟", "ماذا حدث له بعد ذلك؟"],
    ["ויקיפדיה — נאשוויל", "נאשוויל", "מי ייסד את העיר נאשוויל?", "מה קרה לו אחר כך?"],
  ]) {
    const rec = admitReferents(emptyReferents(), { question: q, answer: q.replace("?", "") + " הוא", sources: [{ title }] });
    assert.ok(rec.entities.some((e) => e.surface === name), title);
    assert.equal(resolveQuestion(follow, rec, { hints: { carryTriggers: ["له", "לו"] } }).reason, "carried", follow);
  }
});

test("activation decays: the latest turn's referents outrank an older one's", () => {
  let rec = nashvilleRecord();
  rec = admitReferents(rec, { question: "How tall is the Eiffel Tower?", answer: "The Eiffel Tower is 330 metres tall.", sources: [{ title: "Eiffel Tower - Wikipedia" }] });
  const top = rec.entities[0].surface;
  assert.match(top, /Eiffel/);
  const r = resolveQuestion("and when was it built?", rec, { hints: { carryTriggers: ["it"] } });
  assert.ok(r.carried.some((c) => /Eiffel/.test(c.surface)));
});

test("titleAgreement: the failure case reads as 0, the right retrieval as high", () => {
  const bad = ["What Was O.J. Simpson's Life Like After the Nicole Brown Simpson Trial?", "Gypsy Rose Blanchard's Partner Ken Urker Has Died", "What happened to Jonathan Taylor Thomas?"];
  const good = ["Richard Henderson (judge) - Wikipedia", "Transylvania Company - Wikipedia", "History of Nashville, Tennessee - Wikipedia", "Fort Nashborough", "Cherokee"];
  assert.equal(titleAgreement(bad, ["Judge Richard Henderson", "Richard Henderson"]), 0);
  assert.ok(titleAgreement(good, ["Richard Henderson"]) >= 0.2);
  assert.equal(titleAgreement([], ["x"]), 0);
  assert.equal(titleAgreement(good, []), 0, "no expected referent → no agreement to claim");
});

test("personLike needs a multi-word cased run, or a hinted title; places with commas are not people", () => {
  assert.equal(personLike("Judge Richard Henderson"), true);
  assert.equal(personLike("Richard Henderson"), true);
  assert.equal(personLike("Nashville, Tennessee"), false);
  assert.equal(personLike("Nashville"), false);
  assert.equal(personLike("纳什维尔"), false);
});

test("longestCommonStretch finds the shared name in unspaced text", () => {
  assert.equal(longestCommonStretch("纳什维尔由亨德森创立", "纳什维尔"), "纳什维尔");
  assert.equal(longestCommonStretch("completely different", "纳什维尔"), null);
});

test("the record is plain JSON and round-trips", () => {
  const rec = nashvilleRecord();
  const again = JSON.parse(JSON.stringify(rec));
  assert.deepEqual(again, rec);
  assert.equal(activated("Where is Nashville, Tennessee?", again).length > 0, true);
});

test("a language with no pronoun prior has no trigger, so it never carries (a typed gap, not a guess)", () => {
  const rec = nashvilleRecord();
  const r = resolveQuestion("¿y cuándo murió?", rec, { hints: { carryTriggers: [] } });
  assert.equal(r.reason, "no-trigger");
  assert.equal(resolveQuestion("¿y cuándo murió?", rec).reason, "no-trigger");
});

test("Russian: gendered forms as TRIGGERS only (not as the person filter): the place can still carry when it is the only referent", () => {
  const rec = admitReferents(emptyReferents(), { question: "Где находится Нэшвилл?", answer: "Нэшвилл находится в Теннесси.", sources: [{ title: "Википедия — Нэшвилл" }] });
  const r = resolveQuestion("Сколько в нём жителей?", rec, { hints: { carryTriggers: ["нём", "ним", "он", "его"] } });
  assert.equal(r.reason, "carried");
  assert.ok(r.carried.some((c) => fold(c.surface) === fold("Нэшвилл")));
});

test("casedRuns: a particle is only a whole word, and a run ends at a sentence boundary (measured 2026-10-05: 'Napoleon Bonaparte al', 'The French e')", () => {
  const runs = (t) => casedRuns(t).map((r) => r.surface);
  const FW = new Set(["then", "the", "and", "but", "what", "who", "when"]);
  const runsFw = (x) => casedRuns(x, undefined, { functionWords: FW }).map((r) => r.surface);
  assert.deepEqual(runsFw("Then Napoleon Bonaparte also won at Austerlitz."), ["Napoleon Bonaparte", "Austerlitz"], "an injected function-word list sheds the opener");
  assert.deepEqual(runs("Then Napoleon Bonaparte also won at Austerlitz."), ["Then Napoleon Bonaparte", "Austerlitz"], "without the list nothing is hand-typed: the opener stays (known limit)");
  assert.deepEqual(runsFw("The French emperor was exiled."), ["French"]);
  assert.ok(!runs("The French emperor was exiled.").some((x) => /\be$/.test(x)), "no particle fragment: " + JSON.stringify(runs("The French emperor was exiled.")));
  assert.deepEqual(runs("Nashville was founded by Henderson. Robertson led the party."), ["Henderson", "Robertson"].filter((x) => runs("Nashville was founded by Henderson. Robertson led the party.").includes(x)));
  for (const x of runs("Nashville was founded by Henderson. The French arrived later and Robertson left.")) assert.doesNotMatch(x, /\.\s/, "a run never crosses a sentence boundary: " + x);
  assert.deepEqual(runs("music by Ludwig van Beethoven and J. R. R. Tolkien's books"), ["Ludwig van Beethoven", "J. R. R. Tolkien"]);
  assert.deepEqual(runs("she met Ibn Sina and Maria de la Cruz"), ["Ibn Sina", "Maria de la Cruz"]);
});
