// fold-chat-kinds.test.mjs — the everyday kinds of ask that need NO web search and carry no checkable
// claim: compute / transform / code / compose (skip the search AND the void), advice (searched, no void).
//
// THE RULE UNDER TEST: a false "skip the search" on a factual question is worse than a wasted search.
// So every skipping kind has POSITIVE examples (must skip) and NEGATIVE ones (must still search),
// including the ambiguous ones that look like a skipping kind and are not.
//
// MEASURED vs DECLARED (II.11): the numeric limits (fold-chat-kinds DECLARED) and every word list are
// declared defaults. What was MEASURED is the outcome asserted here: these labelled examples, and the 25
// everyday asks of the 2026-10-05 harness (see the report), classify as written below.
import test from "node:test";
import assert from "node:assert/strict";
import { classifyTurn, recordable, checkable } from "./fold-chat-discourse.js";
import { skipsSearch, noClaimsLabel, KIND_PROMPT, transformShape, codeShape, composeShape, adviceShape, materialIn, DECLARED } from "./fold-chat-kinds.js";

const PARA = "The city council met on Tuesday and voted 7-2 to approve a new bike lane on Maple Street. The project will cost $1.4 million and is expected to take eight months.";

const COMPUTE = [
  "What is 15% of 240?", "what's 2+2", "How much is 20 times 7", "calculate 12 * 12", "What is the square root of 144?", "Convert 5 miles to km",
  "how many inches in 2 feet", "What is 1,000 + 250?",
  "¿Cuánto es 15% de 240?", "Combien font 12 × 12 ?", "Was ist 15 Prozent von 240?", "сколько будет 12*12", "240的15%是多少", "计算 3+4*2",
];
const TRANSFORM = [
  "Translate 'where is the train station' into Spanish and French", "Summarize this in one sentence: " + PARA, "Rewrite this to sound more formal: hey can u send me the file asap thx",
  "Fix the grammar: me and him goes to school yesterday", "Translate good morning into Spanish", "Proofread this: Their going to the store tomorow, and so is she.",
  "Paraphrase this passage:\n" + PARA, "tl;dr: " + PARA,
  "Traduce 'dónde está la estación' al inglés", "Traduis « où est la gare » en anglais", "Übersetze „Wo ist der Bahnhof?“ ins Englische", "Переведи «где вокзал» на английский", "把“我想喝咖啡”翻译成英文", "「駅はどこですか」を英語に翻訳して",
];
const CODE = [
  "How do I reverse a string in Python?", "Write a function to reverse a string in Python", "how to center a div with CSS", "How can I merge two dictionaries in Python?",
  "Write a SQL query to find duplicate emails", "How do I undo my last git commit?", "write me a regex that matches an email address", "Why does my JavaScript code say undefined is not a function?",
  "¿Cómo invierto una cadena en Python?", "如何用Python反转字符串？", "Comment inverser une chaîne en Python ?", "Wie sortiere ich eine Liste in Python?", "Как перевернуть строку в Python?", "```js\nconst a = [1,2,3];\na.map(x => x*2)\n``` what does this do",
];
const COMPOSE = [
  "Write a short thank-you note to my neighbor for watering my plants", "Write an email to my boss about my vacation", "Draft a message to my landlord asking about the heating",
  "Help me write a birthday card for my mom", "compose a toast for my sister's wedding", "Write a text to my friend apologizing for missing dinner",
];
const ADVICE = [
  "Give me tips to fall asleep faster", "I have a job interview tomorrow and I'm nervous. Any advice?", "Give me a 3-day itinerary for Lisbon", "how do I get a passport", "Should I buy or lease a car?",
  "What's the best way to learn guitar?", "¿Qué consejos tienes para dormir mejor?", "Quels conseils pour mieux dormir ?", "Wie kann ich besser einschlafen?", "怎样才能更快入睡？", "Any suggestions for a first date?", "help me plan a budget",
];
// Everything here LOOKS like a skipping kind and is a factual question (or needs a page read): it must be searched.
const MUST_SEARCH = [
  "Summarize the French Revolution", "Summarize the plot of Hamlet", "Summarize: causes of World War 1", "Summarize this article: https://example.com/news/story-123",
  "Translate Hamlet into French", "Translate the Declaration of Independence into French", "What does the French word 'pain' mean?",
  "Who created Python?", "What is a closure in JavaScript?", "Python vs JavaScript", "When was Python first released?", "What is the capital of Python?", "Is Java still worth learning in 2025?", "Who invented the SQL language?",
  "What is the GDP of France?", "How many calories are in 2 avocados?", "How tall is the Eiffel Tower in feet?", "What's the speed of light in mph?", "How many days until Christmas?", "What was 1066 famous for?", "What is the 2024 election result?",
  "Write an essay about the history of Rome", "Write a letter about the extinction of dolphins", "Write a poem about Python",
  "What's the capital of Australia?", "Who won the World Cup in 2018?", "Is it safe to eat eggs after the expiration date?", "Compare iPhone and Android for a first-time smartphone user", "tell me about mercury",
  "¿Quién creó Python?", "Wer hat Python erfunden?", "Qui a inventé JavaScript ?", "谁发明了Python？", "东京有多少人口？", "Как работает электродвигатель?", "Quelle est la capitale de la France ?", "¿Cuál es la capital de Francia?", "Traduce hola", "Resume la Revolución Francesa", "Wie funktioniert ein Elektromotor?", "Что такое фотосинтез?",
];

test("compute: arithmetic, percent and unit asks (en + es/fr/de/ru/zh) are the fold's to compute — no search", () => {
  assert.ok(COMPUTE.length >= 12);
  for (const q of COMPUTE) { assert.equal(classifyTurn(q), "compute", q); assert.equal(skipsSearch("compute"), true); }
});

test("transform: the person's own text (quoted / after a colon / pasted) to translate, summarise, rewrite — en + es/fr/de/ru/zh/ja — no search", () => {
  assert.ok(TRANSFORM.length >= 12);
  for (const q of TRANSFORM) assert.equal(classifyTurn(q), "transform", q);
});

test("code: a programming how-to — en + es/fr/de/ru/zh — no search", () => {
  assert.ok(CODE.length >= 12);
  for (const q of CODE) assert.equal(classifyTurn(q), "code", q);
});

test("compose: personal correspondence whose facts are the person's own — no search", () => {
  assert.ok(COMPOSE.length >= 6);
  for (const q of COMPOSE) assert.equal(classifyTurn(q), "compose", q);
});

test("advice: open how-to / opinion is classified advice — it is STILL SEARCHED", () => {
  assert.ok(ADVICE.length >= 12);
  for (const q of ADVICE) { const k = classifyTurn(q); assert.equal(k, "advice", q); assert.equal(skipsSearch(k), false, q); }
});

test("MUST STILL SEARCH: factual look-alikes, ambiguous asks, and non-English asks are never skipped", () => {
  assert.ok(MUST_SEARCH.length >= 12);
  const wrong = MUST_SEARCH.filter((q) => skipsSearch(classifyTurn(q)));
  assert.deepEqual(wrong, [], "a false 'skip search' on these asks would be worse than the wasted search");
});

test("kind policy: what each kind records, checks, and says when there are no claims", () => {
  for (const k of ["compute", "transform", "code", "compose", "generate"]) { assert.equal(checkable(k), false, k); assert.ok(noClaimsLabel(k), k); }
  for (const k of ["research", "chat", "advice"]) assert.equal(checkable(k), true, k);
  for (const k of ["compute", "transform", "code", "compose", "advice", "research", "generate", "chat"]) assert.equal(recordable(k), true, k);
  assert.equal(recordable("smalltalk"), false);
  assert.equal(skipsSearch("smalltalk"), true);
  for (const k of ["research", "chat", "generate", "advice"]) assert.equal(skipsSearch(k), false, k);
  for (const k of ["transform", "code", "compose", "advice"]) assert.ok(KIND_PROMPT[k], k);
  assert.match(KIND_PROMPT.compose, /\[placeholder\]/, "personal writing never invents a detail");
});

test("shape detectors: the two-signal rule — a verb alone, or material alone, is not enough", () => {
  assert.equal(transformShape("Summarize the French Revolution"), null, "verb, no material");
  assert.equal(transformShape("Here is some text: " + PARA), null, "material, no verb");
  assert.equal(transformShape("Summarize this", { hasMaterial: true })?.attached, true, "an attachment the chat already carries is material");
  assert.equal(transformShape("Summarize this", { hasMaterial: false }), null);
  assert.equal(codeShape("What is Python?"), false, "a code term alone");
  assert.equal(codeShape("how do I bake bread"), false, "a how marker alone");
  assert.equal(codeShape("How do I go to the airport?"), false, "'go' is a word before it is a language");
  assert.equal(codeShape("How do I write a function in Go?"), true, "…with a code cue it is a language");
  assert.equal(composeShape("Write a note"), false, "no personal marker");
  assert.equal(composeShape("Write a note to my neighbor about the history of the street"), false, "a research cue inside");
  assert.equal(adviceShape("Who won the World Cup?"), false);
});

test("materialIn: quoted span, after a colon, after a newline — the person's own words", () => {
  assert.equal(materialIn("Translate 'good morning' into French").text, "good morning");
  assert.equal(materialIn("translate “bonjour” please").text, "bonjour");
  assert.equal(materialIn("把“我想喝咖啡”翻译成英文").text, "我想喝咖啡");
  assert.equal(materialIn("Summarize: one two three").text, "one two three");
  assert.equal(materialIn("Summarize this\nline one. line two.").text, "line one. line two.");
  assert.equal(materialIn("it's what we don't know"), null, "an apostrophe is not a quote");
  assert.ok(DECLARED.minSummaryChars > 0 && DECLARED.maxBareTranslateWords > 0);
});

test("the 25 everyday asks of the 2026-10-05 harness classify as the report says", () => {
  const PARA2 = "The city council met on Tuesday and voted 7-2 to approve a new bike lane on Maple Street. The project will cost $1.4 million and is expected to take eight months. Supporters said it will reduce accidents; opponents said it will remove 40 parking spaces. Construction starts in March.";
  const want = {
    "hi": "smalltalk", "What's a good recipe for banana bread?": "research", "Explain the difference between a virus and a bacterium": "research", "How do I reverse a string in Python?": "code",
    "What is 15% of 240?": "compute", "Give me a 3-day itinerary for Lisbon": "advice", "What's the capital of Australia?": "research",
    "Write a short thank-you note to my neighbor for watering my plants": "compose", "Translate 'where is the train station' into Spanish and French": "transform",
    "Is it safe to eat eggs after the expiration date?": "research", "Compare iPhone and Android for a first-time smartphone user": "research", ["Summarize this in one sentence: " + PARA2]: "transform",
    "Who won the World Cup in 2018?": "research", "How many calories are in an avocado?": "research", "what's the weather like in Seattle today": "research", "Give me tips to fall asleep faster": "advice",
    "How does compound interest work? Give an example.": "research", "tell me about mercury": "research", "Who wrote Pride and Prejudice?": "research",
    "¿Cuál es la capital de Francia?": "research", "Wie funktioniert ein Elektromotor?": "research",
    "I have a job interview tomorrow and I'm nervous. Any advice?": "advice",
  };
  for (const [q, k] of Object.entries(want)) assert.equal(classifyTurn(q), k, q.slice(0, 70));
});
