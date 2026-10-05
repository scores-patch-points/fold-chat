// fold-chat-lang.test.mjs — which language a person wrote in, and whether the reply is in it.
import test from "node:test";
import assert from "node:assert/strict";
import { detectLang, sameLanguage, languageInstruction, restateMessages, languageNotice, proseOf, DECLARED } from "./fold-chat-lang.js";

// The DECLARED stopword signatures were TUNED on an in-sample set while building (it is not kept
// here). This HELD-OUT set was written afterwards, as fresh everyday sentences, and never tuned on:
// the accuracy asserted below is what it measured (2026-10-05) — a measured outcome, not a derived threshold.
const HELD_OUT = {
  en: ["Where can I find a good recipe for lasagna?", "The museum opens at nine and closes at five every day.", "Can you help me write a message to my landlord about the heating?", "My flight was delayed because of the storm."],
  es: ["¿Dónde puedo encontrar una buena receta de lasaña?", "El museo abre a las nueve y cierra a las cinco todos los días.", "¿Puedes ayudarme a escribir un mensaje a mi casero sobre la calefacción?", "Mi vuelo se retrasó por la tormenta."],
  fr: ["Où puis-je trouver une bonne recette de lasagnes ?", "Le musée ouvre à neuf heures et ferme à cinq heures tous les jours.", "Peux-tu m'aider à écrire un message à mon propriétaire à propos du chauffage ?", "Mon vol a été retardé à cause de la tempête."],
  de: ["Wo finde ich ein gutes Rezept für Lasagne?", "Das Museum öffnet um neun Uhr und schließt jeden Tag um fünf Uhr.", "Kannst du mir helfen, eine Nachricht an meinen Vermieter wegen der Heizung zu schreiben?", "Mein Flug hatte wegen des Sturms Verspätung."],
  pt: ["Onde posso encontrar uma boa receita de lasanha?", "O museu abre às nove e fecha às cinco todos os dias.", "Você pode me ajudar a escrever uma mensagem para o meu senhorio sobre o aquecimento?", "O meu voo atrasou por causa da tempestade."],
  it: ["Dove posso trovare una buona ricetta per le lasagne?", "Il museo apre alle nove e chiude alle cinque ogni giorno.", "Puoi aiutarmi a scrivere un messaggio al mio padrone di casa sul riscaldamento?", "Il mio volo è stato ritardato a causa della tempesta."],
  nl: ["Waar kan ik een goed recept voor lasagne vinden?", "Het museum opent om negen uur en sluit elke dag om vijf uur.", "Kun je me helpen een bericht aan mijn huisbaas over de verwarming te schrijven?", "Mijn vlucht had vertraging door de storm."],
  ru: ["Где найти хороший рецепт лазаньи?", "Музей открывается в девять и закрывается в пять каждый день."],
  zh: ["哪里可以找到一份好的千层面食谱？", "博物馆每天九点开门，五点关门。"],
  ja: ["おいしいラザニアのレシピはどこで見つかりますか？"], ko: ["맛있는 라자냐 레시피는 어디에서 찾을 수 있나요?"], ar: ["أين أجد وصفة جيدة للازانيا؟"], hi: ["लज़ान्या की अच्छी रेसिपी कहाँ मिलेगी?"], el: ["Πού μπορώ να βρω μια καλή συνταγή για λαζάνια;"], he: ["איפה אפשר למצוא מתכון טוב ללזניה?"], th: ["หาสูตรลาซานญ่าอร่อยๆ ได้ที่ไหน"],
};

test("detectLang: a held-out sample is never judged WRONG; the known misses are 'unknown' (nothing is restated on a coin-flip)", () => {
  let right = 0, unknown = 0, wrong = 0; const wrongs = [];
  for (const [lang, list] of Object.entries(HELD_OUT)) for (const t of list) {
    const d = detectLang(t);
    if (d.lang === lang) right++; else if (d.lang === "unknown") unknown++; else { wrong++; wrongs.push([lang, d.lang, t]); }
  }
  const n = right + unknown + wrong;
  assert.equal(wrong, 0, "a wrong-language call would restate a correct answer: " + JSON.stringify(wrongs));
  assert.ok(right / n >= 0.9, `measured held-out accuracy ${right}/${n} (${unknown} unknown)`);
});

test("detectLang: the languages the app is asked in — es, fr, de, pt, ru, zh, ja, ar, hi", () => {
  const q = { es: "¿Cuál es la capital de Francia?", fr: "Quelle est la capitale de la France ?", de: "Wie funktioniert ein Elektromotor?", pt: "Qual é a capital da França?", ru: "Какая столица Франции?", zh: "东京有多少人口？", ja: "東京の人口はどのくらいですか？", ar: "ما هي عاصمة فرنسا؟", hi: "फ्रांस की राजधानी क्या है?" };
  for (const [lang, text] of Object.entries(q)) assert.equal(detectLang(text).lang, lang, text);
  assert.equal(detectLang("What is the capital of France?").lang, "en");
});

test("detectLang: too little evidence is 'unknown', not a guess", () => {
  for (const t of ["", "ok", "Paris", "12345", "?!"]) assert.equal(detectLang(t).lang, "unknown", JSON.stringify(t));
  assert.equal(detectLang("Paris").confident, false);
});

test("proseOf: code, urls and source labels say nothing about the prose's language", () => {
  const p = proseOf("Voici:\n```python\nprint('hello world and the rest')\n```\nVoir https://example.com/the/page [W1]");
  assert.ok(!/print|example|W1/.test(p), p);
  assert.equal(detectLang("```js\nconst the = and + of\n```").lang, "unknown");
});

test("sameLanguage: an English reply to a Spanish question is a mismatch; the same language is not", () => {
  const es = "¿Cuál es la capital de Francia?";
  const en = "The capital of France is Paris, which is also the largest city in the country.";
  const es2 = "La capital de Francia es París, que también es la ciudad más grande del país.";
  const m = sameLanguage(es, en);
  assert.equal(m.same, false); assert.equal(m.question.lang, "es"); assert.equal(m.reply.lang, "en");
  assert.equal(sameLanguage(es, es2).same, true);
  assert.equal(sameLanguage("What is the capital of France?", en).same, true);
});

test("sameLanguage: non-Latin asks answered in English (or Latin script) are mismatches; zh/ja/ar/hi/ru replies match their asks", () => {
  const en = "The population of Tokyo is about fourteen million people, and it is the capital of Japan.";
  for (const q of ["东京有多少人口？", "東京の人口はどのくらいですか？", "ما هي عاصمة فرنسا؟", "फ्रांस की राजधानी क्या है?", "Какая столица Франции?"]) {
    const r = sameLanguage(q, en);
    assert.equal(r.same, false, q);
  }
  assert.equal(sameLanguage("东京有多少人口？", "东京的人口约为一千四百万，是日本的首都，也是世界上最大的城市之一。").same, true);
  assert.equal(sameLanguage("Какая столица Франции?", "Столицей Франции является Париж, самый большой город страны.").same, true);
});

test("sameLanguage: never judges on a coin-flip — unknown question, unknown reply, a short reply", () => {
  assert.equal(sameLanguage("Paris", "The capital of France is Paris.").same, true, "an unknown question language never triggers a restate");
  assert.equal(sameLanguage("¿Cuál es la capital de Francia?", "París.").same, true, "too short to judge");
  assert.equal(sameLanguage("¿Cuál es la capital de Francia?", "12 345 678 901 234 567 890 123 456 789").same, true, "no language evidence");
  assert.ok(DECLARED.minReplyLetters >= 12);
});

test("languageInstruction: always asks for the asker's language; names it when confident and not English", () => {
  assert.match(languageInstruction("hello"), /same language the person wrote in/);
  assert.match(languageInstruction("¿Cuál es la capital de Francia?"), /wrote in Spanish/);
  assert.match(languageInstruction("东京有多少人口？"), /wrote in Chinese/);
  assert.doesNotMatch(languageInstruction("What is the capital of France?"), /wrote in English/);
});

test("restateMessages: asks for ONLY the translation of the model's own draft, keeping figures", () => {
  const [sys, usr] = restateMessages("Paris has 2.1 million people.", "Spanish");
  assert.equal(sys.role, "system"); assert.match(sys.content, /into Spanish/); assert.match(sys.content, /Keep every number/);
  assert.equal(usr.content, "Paris has 2.1 million people.");
});

test("languageNotice: a typed note naming both languages and whether a restate was tried", () => {
  const q = detectLang("¿Cuál es la capital de Francia?"), r = detectLang("The capital of France is Paris, the largest city in the whole country.");
  const n = languageNotice(q, r, { restated: true });
  assert.equal(n.kind, "language"); assert.match(n.text, /Spanish/); assert.match(n.text, /English/); assert.match(n.text, /restate/);
});
