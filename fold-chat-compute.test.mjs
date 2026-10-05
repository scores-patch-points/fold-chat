// fold-chat-compute.test.mjs — the mechanical evaluator: a number the model never authors (II.9).
import test from "node:test";
import assert from "node:assert/strict";
import { evaluate, evalExpression, convertUnits, fmtNumber, numbersOf, answerKeeps } from "./fold-chat-compute.js";

test("evalExpression: precedence, parentheses, unary minus, power, percent, sqrt — and no eval()", () => {
  assert.equal(evalExpression("2+3*4").value, 14);
  assert.equal(evalExpression("(2+3)*4").value, 20);
  assert.equal(evalExpression("-3+10").value, 7);
  assert.equal(evalExpression("2^3^2").value, 512, "power is right-associative");
  assert.equal(evalExpression("50%*80").value, 40);
  assert.equal(evalExpression("sqrt 144").value, 12);
  assert.equal(evalExpression("10/4").value, 2.5);
  assert.equal(evalExpression("7 %% 3").value, 1);
  for (const evil of ["process.exit()", "2+alert(1)", "constructor", "1;2", "__proto__", "(1", "1+", "", "2 3"]) {
    assert.equal(evalExpression(evil).ok, false, evil);
  }
  assert.equal(evalExpression("1/0").ok, false);
  assert.equal(evalExpression("sqrt -4").ok, false);
});

test("evaluate: the everyday asks, computed (en)", () => {
  const cases = [
    ["What is 15% of 240?", "36"], ["what's 2+2", "4"], ["How much is 20 times 7", "140"], ["calculate 12 * 12", "144"],
    ["What is 100 divided by 8?", "12.5"], ["What is the square root of 144?", "12"], ["2^10", "1024"], ["What is 20% of 85.50?", "17.1"],
    ["Convert 5 miles to km", "8.04672 km"], ["how many inches in 2 feet", "24 in"], ["100 f to c", "37.77777778 °C"], ["What is 1,000 + 250?", "1250"],
    ["what is 15 percent of 240", "36"], ["(2+3)*4 =", "20"],
  ];
  for (const [q, want] of cases) { const r = evaluate(q); assert.equal(r.ok, true, q); assert.equal(r.valueText, want, q); }
});

test("evaluate: other languages — symbolic asks and declared stems (es/fr/de/ru/zh)", () => {
  assert.equal(evaluate("¿Cuánto es 15% de 240?").valueText, "36");
  assert.equal(evaluate("Combien font 12 × 12 ?").valueText, "144");
  assert.equal(evaluate("Was ist 15 Prozent von 240?").valueText, "36");
  assert.equal(evaluate("сколько будет 12*12").valueText, "144");
  assert.equal(evaluate("240的15%是多少").valueText, "36");
  assert.equal(evaluate("计算 3+4*2").valueText, "11");
});

test("evaluate: the result line carries the expression and the value; currency survives; percent never gets one", () => {
  assert.equal(evaluate("What is 15% of 240?").text, "15% of 240 = 36");
  assert.equal(evaluate("15 percent of $240").text, "15% of $240 = $36");
  assert.equal(evaluate("how many feet in 330 meters").text, "330 m = 1082.677165 ft");
});

test("evaluate: NOT arithmetic — a question with words we do not hold, a lone number, a date range, an unknown unit", () => {
  for (const q of [
    "What is the capital of Australia?", "How many calories are in 2 avocados?", "3-day itinerary for Lisbon", "what is 5", "1990-2000",
    "Who won the 2018 World Cup", "What is the speed of light in km/s", "convert 3 apples to oranges", "What is 10 divided by 0",
    "How tall is the Eiffel Tower in feet?", "when was 1066 and all that", "Was ist die Hauptstadt von Frankreich?", "东京有多少人口？", "Summarize this: 2+2 is four", "hi", "",
  ]) assert.equal(evaluate(q).ok, false, q);
});

test("convertUnits: definitional factors, temperature, kinds must agree", () => {
  assert.equal(convertUnits(1, "mile", "km"), 1.609344);
  assert.equal(convertUnits(1, "lb", "kg"), 0.45359237);
  assert.equal(Math.round(convertUnits(212, "f", "c")), 100);
  assert.equal(convertUnits(0, "c", "k"), 273.15);
  assert.equal(convertUnits(1, "km", "kg"), null, "different kinds");
  assert.equal(convertUnits(1, "parsec", "m"), null, "unknown unit");
});

test("fmtNumber: ten significant digits, no float noise, no trailing zeros", () => {
  assert.equal(fmtNumber(0.1 + 0.2), "0.3");
  assert.equal(fmtNumber(36), "36");
  assert.equal(fmtNumber(1 / 3), "0.3333333333");
  assert.equal(fmtNumber(-0), "0");
  assert.equal(fmtNumber(1e21), "1e+21");
});

test("numbersOf: reads thousands separators and decimal commas", () => {
  assert.deepEqual(numbersOf("1,234.5 and 3 and 7.25"), [1234.5, 3, 7.25]);
  assert.deepEqual(numbersOf("1.234,5"), [1234.5]);
});

test("answerKeeps (II.9): the model's wording must state the computed result and add no figure of its own", () => {
  const c = evaluate("What is 15% of 240?");
  assert.equal(answerKeeps("15% of 240 is 36.", c).ok, true);
  assert.equal(answerKeeps("That comes to 36 — fifteen percent of 240.", c).ok, true);
  assert.equal(answerKeeps("It is 37.", c).ok, false, "a wrong figure");
  assert.equal(answerKeeps("Fifteen percent of the number is a fraction of it.", c).ok, false, "no result stated");
  const steps = answerKeeps("Divide 15 by 100 = 0.15, multiply by 240 gives 36, plus 12 more", c);
  assert.equal(steps.ok, false); assert.ok(steps.extra.includes(12), "the figure the model added on its own is named");
  assert.equal(answerKeeps("anything", { ok: false }).ok, true, "no computed value, nothing to hold it to");
});
