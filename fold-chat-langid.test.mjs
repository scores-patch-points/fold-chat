// fold-chat-langid.test.mjs — the language detector, with falsifiers (docs/LANGID-PREREG.md).
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { identify, languagesOf } from "./fold-chat-langid.js";
import { detectLang, threadLanguage, languageInstruction, sameLanguage } from "./fold-chat-lang.js";

const lang = (t, o) => detectLang(t, o).lang;

test("REGRESSION: 'show me a cookie recipe' is English, not Portuguese (the bug that started this)", () => {
  for (const t of ["show me a cookie recipe", "show me a pancake recipe", "show me a recipe for oatmeal cookies", "find me a good podcast about space", "tell me a riddle", "help me write a birthday card", "shwo me a recipie for brownies", "recomend me a good novle", "show me a quick lunch idea", "i want a crispier cookie recipe"]) assert.equal(lang(t), "en", t);
});

test("English chat asks are never another language; keyword queries are English or unknown, never a wrong guess", () => {
  const en = ["what is the capital of canada", "how do i sort a list in python", "whats a good name for a dog", "can you help me fix my cv", "who was the first woman in space", "im looking for a gift for my dad", "do you have a recipe for a vegan cake", "How do I boil an egg?", "i cant focus help", "where can i stream the new marvel movie"];
  for (const t of en) assert.equal(lang(t), "en", t);
  for (const t of ["brownie recipe easy", "airpods price", "router login", "pizza near me open now", "seattle weather", "cheap hotels paris", "carbonara recipe", "more crunchy please", "ramen near me", "show me cookies"]) assert.ok(["en", "unknown"].includes(lang(t)), t + " -> " + lang(t));
});

test("CANNOT TELL: names, one token, numbers and symbols are unknown, never a guess", () => {
  for (const t of ["madrid", "keanu reeves", "k", "haha", "galaxy s24 ultra", "555", "!!", "emma stone", "fc bayern", "adidas", "amazon", "3*4", "tim cook", "oprah winfrey", "david beckham", "sophia loren", "chewy", "https://example.org/a/b", ""]) {
    const d = detectLang(t); assert.equal(d.confident, false, t + " -> " + d.lang); assert.equal(d.lang, "unknown");
  }
});

test("caseless and non-Latin scripts: CJK, Indic, Arabic-script, Hebrew, Thai, Greek, Cyrillic are named, never read as empty", () => {
  const cases = {
    zh: ["给我推荐一本好书", "上海天气怎么样", "怎么用java排序", "我想学钢琴", "我想學彈鋼琴"],
    ja: ["おすすめの映画を教えて", "大阪のホテルの値段は", "java で配列を並べ替える方法"],
    ko: ["추천 영화 알려줘", "아이폰 가격 얼마야"],
    th: ["แนะนำหนังสนุกๆ หน่อย"],
    hi: ["गूगल क्रोम कैसे इंस्टॉल करें"],
    bn: ["আমাকে একটি ভালো বই বলো"], ta: ["நல்ல புத்தகம் பரிந்துரைக்கவும்"], te: ["మంచి పుస్తకం చెప్పండి"],
    ar: ["اقترح علي كتابا جيدا", "كم سعر الايفون"], ur: ["مجھے ایک اچھی کتاب بتائیں", "لاہور کا موسم کیسا ہے"],
    he: ["תמליץ לי על ספר טוב", "מה מזג האוויר בחיפה"], el: ["πρότεινέ μου ένα καλό βιβλίο"],
    ru: ["какая погода в москве", "Какая столица Австралии?"], uk: ["яка погода у львові"],
  };
  for (const [l, list] of Object.entries(cases)) for (const t of list) { const d = detectLang(t); assert.equal(d.lang, l, t + " -> " + d.lang); assert.equal(d.confident, true, t); }
  // a foreign word inside a Latin ask does not turn it into that script's language
  assert.equal(lang("what does 愛 mean in english"), "en");
  assert.equal(lang("translate ありがとう to english please"), "en");
});

test("Latin-script languages the app is asked in", () => {
  const cases = {
    es: ["recomiendame un buen libro de historia", "¿Qué hora es en Nueva York?"], pt: ["me recomenda um bom livro de historia", "quero comprar um celular barato"],
    it: ["consigliami un buon libro di storia", "voglio comprare un telefono economico"], fr: ["recommande moi un bon livre d'histoire", "je veux acheter un telephone pas cher"],
    de: ["empfiehl mir ein gutes geschichtsbuch", "ich möchte ein günstiges handy kaufen"], nl: ["ik wil een goedkope telefoon kopen", "beveel een goed boek aan"],
    sv: ["rekommendera en bra bok för mig"], tr: ["bana iyi bir kitap öner"], id: ["rekomendasikan buku yang bagus untuk saya"], fi: ["suosittele minulle hyvää kirjaa"], pl: ["polecisz mi dobrą książkę o historii"], vi: ["gợi ý cho tôi một cuốn sách hay"],
  };
  for (const [l, list] of Object.entries(cases)) for (const t of list) assert.equal(lang(t), l, t);
});

test("thin evidence is unknown or right, never a confident wrong answer (short informal asks with rare words)", () => {
  const hedged = [["es", "quiero comprar un telefono barato"], ["hi", "मुझे एक अच्छी किताब बताओ"], ["ru", "покажи рецепт блинов на молоке"], ["ru", "посоветуй хорошую книгу"], ["uk", "порадь гарну книгу"], ["es", "como hago pan casero"], ["pt", "e a esposa dele"], ["ms", "saya mahu belajar bermain gitar"]];
  for (const [l, t] of hedged) { const d = detectLang(t); assert.ok(!d.confident || d.lang === l || (l === "ms" && d.lang === "id"), `${t} -> ${d.lang}`); }
});

test("related pairs are not coin-flipped into a confident wrong answer more often than they are right (Latin-script es/pt/it/ca, no/da/sv)", () => {
  // a measured floor, not a claim of solved: the pair class is reported in docs/LANGID-PREREG.md
  const items = JSON.parse(fs.readFileSync(new URL("./eval/langid/labelled.json", import.meta.url), "utf8")).filter((x) => x.split !== "held" && ["es", "pt", "it", "ca", "no", "da", "sv"].includes(x.accept[0]) && x.cls === "lang" && /^[\p{Script=Latin}\P{L}]+$/u.test(x.text));
  let right = 0, wrong = 0;
  for (const x of items) { const l = lang(x.text); if (x.accept.includes(l)) right++; else if (l !== "unknown") wrong++; }
  assert.ok(items.length > 50);
  assert.ok(wrong / (right + wrong) <= 0.05, `${wrong} wrong of ${right + wrong} confident`);
  assert.ok(right / items.length >= 0.75, `coverage ${right}/${items.length}`);
});

test("the labelled dev+val sets meet the frozen bars (held-out is never read here)", () => {
  const items = JSON.parse(fs.readFileSync(new URL("./eval/langid/labelled.json", import.meta.url), "utf8")).filter((x) => x.split !== "held");
  const ans = (t) => { const d = detectLang(t); return d.confident ? d.lang : "unknown"; };
  const en = items.filter((x) => ["en", "en-keyword"].includes(x.cls)); const enBad = en.filter((x) => { const a = ans(x.text); return a !== "unknown" && a !== "en"; });
  assert.ok(1 - enBad.length / en.length >= 0.99, "English safety " + JSON.stringify(enBad.map((x) => x.text)));
  const ct = items.filter((x) => x.cls === "cannot-tell"); assert.ok(ct.filter((x) => ans(x.text) === "unknown").length / ct.length >= 0.9, "cannot-tell");
  const conf = items.map((x) => [x, ans(x.text)]).filter(([, a]) => a !== "unknown");
  assert.ok(conf.filter(([x, a]) => x.accept.includes(a)).length / conf.length >= 0.95, "precision on confident answers");
  const hard = items.filter((x) => /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Thai}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Arabic}\p{Script=Hebrew}]/u.test(x.text) && !/\p{Script=Latin}{4,}/u.test(x.text.replace(/\p{Script=Latin}+(?=\s)/gu, "")));
  const hc = hard.filter((x) => ans(x.text) !== "unknown"); assert.ok(hc.filter((x) => x.accept.includes(ans(x.text))).length / hc.length >= 0.98, "caseless precision"); assert.ok(hc.length / hard.length >= 0.95, "caseless coverage");
});

test("deterministic, offline, fast: the same answer twice, under 2 ms per ask once the priors are decoded", () => {
  const asks = ["show me a cookie recipe", "recomiendame un buen libro de historia", "给我推荐一本好书", "какая погода в москве", "keanu reeves"];
  const a = asks.map((t) => JSON.stringify(detectLang(t))), b = asks.map((t) => JSON.stringify(detectLang(t)));
  assert.deepEqual(a, b);
  const t0 = process.hrtime.bigint(); for (let i = 0; i < 200; i++) for (const t of asks) detectLang(t); const ms = Number(process.hrtime.bigint() - t0) / 1e6 / (200 * asks.length);
  assert.ok(ms < 2, `${ms.toFixed(3)} ms per ask`);
});

test("identify never throws and names its candidates", () => {
  for (const x of [null, undefined, 5, {}, "\u0000", "🙂🙂", "a".repeat(5000)]) assert.doesNotThrow(() => identify(x));
  assert.ok(languagesOf("Latin").includes("en") && languagesOf("Latin").includes("es") && languagesOf("Cyrillic").includes("ru"));
});

// ── the thread: follow-ups inherit, evidence flips ──────────────────────────────────────────────────────────
test("threadLanguage: the last confident language of the person's own turns; an evidence-less turn never sets it", () => {
  assert.equal(threadLanguage([{ role: "user", content: "¿Qué hora es en Nueva York?" }, { role: "assistant", content: "The time in New York is five o'clock in the evening." }, { role: "user", content: "chewier" }]), "es");
  assert.equal(threadLanguage([{ role: "user", content: "show me a pancake recipe" }]), "en");
  assert.equal(threadLanguage([{ role: "user", content: "keanu reeves" }]), null);
  assert.equal(threadLanguage([]), null);
  assert.equal(threadLanguage([{ role: "user", content: "quiero comprar un telefono barato" }, { role: "user", content: "show me a pancake recipe" }]), "en", "the most recent confident turn wins");
});

test("FLIP TEST: elliptical follow-ups inherit the thread's language; confident turns in another language flip it", () => {
  const threads = [
    ["en", "show me a pancake recipe", ["chewier", "and him?", "more", "crispier please", "and the other one"]],
    ["es", "enseñame una receta de tortitas con mucha fruta", ["mas crujientes", "y su esposa", "otra", "mas corta"]],
    ["fr", "montre moi une recette de crepes pour le petit dejeuner", ["et lui", "plus croustillant", "autre"]],
    ["de", "zeig mir ein rezept für pfannkuchen zum frühstück", ["und er", "knuspriger", "noch eins"]],
    ["zh", "给我看一个煎饼食谱", ["再脆一点", "他呢"]],
    ["ru", "посоветуй хорошую книгу про историю", ["а он", "хрустящее"]],
  ];
  let total = 0, kept = 0;
  for (const [l, first, follow] of threads) {
    const prior = threadLanguage([{ role: "user", content: first }]); assert.equal(prior, l, first);
    for (const f of follow) { total++; const d = detectLang(f, { prior }); if (d.lang === l) kept++; else assert.fail(`${l} thread flipped on ${JSON.stringify(f)} -> ${d.lang}`); }
  }
  assert.equal(kept, total);
  // a confident turn in another language flips, even inside a thread
  assert.equal(detectLang("show me a cookie recipe", { prior: "es" }).lang, "en");
  assert.equal(detectLang("recomiendame un buen libro de historia", { prior: "en" }).lang, "es");
  assert.equal(detectLang("给我推荐一本好书", { prior: "en" }).lang, "zh");
  assert.equal(detectLang("what is the capital of canada", { prior: "ru" }).lang, "en");
  // no thread, no evidence: unknown, and the model is not told a language
  assert.equal(detectLang("chewier").lang, "unknown");
  assert.doesNotMatch(languageInstruction("chewier"), /The person wrote in/);
  assert.match(languageInstruction("chewier", { prior: "es" }), /The person wrote in Spanish/);
  assert.doesNotMatch(languageInstruction("show me a cookie recipe", { prior: "es" }), /The person wrote in/);
  // an English thread: an elliptical follow-up stays unnamed (English needs no instruction) and the thread language is English
  assert.equal(detectLang("chewier", { prior: "en" }).lang, "en");
});

test("sameLanguage: related-family replies count as the same; a Portuguese reply to a Spanish ask does not", () => {
  assert.equal(sameLanguage("hvad er klokken i københavn", "Klokken i København er lige nu fem om eftermiddagen, ligesom resten af landet.").same, true);
  const es = "¿Cuál es la capital de Francia?";
  assert.equal(sameLanguage(es, "A capital da França é Paris, que também é a maior cidade do país e fica no norte.").same, false);
});

test("2026-10-07 E2E: short Cyrillic asks are ru/uk/bg, not 'bg for everything' (declared clues beat thin treebank priors)", () => {
  assert.equal(detectLang("Кто президент?").lang, "ru");
  assert.equal(detectLang("Хто президент?").lang, "uk");
  assert.equal(detectLang("Кой е президентът?").lang, "bg");
  assert.equal(detectLang("Что случилось?").lang, "ru");
});

test("2026-10-07 E2E: Spanish ¿¡ IS evidence — a bare '¿Y él?' / '¿Dónde nació?' is Spanish even after an English thread (marks count as function words, beat the prior)", () => {
  assert.equal(detectLang("¿Y él?", { prior: "en" }).lang, "es");
  assert.equal(detectLang("¿Dónde nació?", { prior: "en" }).lang, "es");
  assert.equal(detectLang("¿Y él?").confident, true);
});

test("2026-10-07 E2E: a decisive own word flips the thread, never inherits over it", () => {
  assert.equal(detectLang("Wer war Marie Curie?", { prior: "en" }).lang, "de");
  assert.equal(detectLang("Why did he die poor?", { prior: "de" }).lang, "en");
  assert.equal(detectLang("Pourquoi est-ce arrivé ?").lang, "fr");
});
