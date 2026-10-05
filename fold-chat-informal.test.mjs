import test from "node:test";
import assert from "node:assert/strict";
import { informalNames } from "./fold-chat-informal.js";
import { createDeid } from "./fold-chat-deid.js";

const lc = (a) => a.map((x) => x.toLowerCase());
const finds = (text, ...want) => { const got = lc(informalNames(text)); for (const w of want) assert.ok(got.includes(w.toLowerCase()), `${w} not found in "${text}": ${JSON.stringify(got)}`); };

test("a lowercase name after 'for' is found: it is not an ordinary word in that slot", () => {
  finds("make a timer for eleanor voss", "eleanor", "voss");
  finds("can u make a page where priya can see her shifts".replace("where priya", "for priya"), "priya");
});

test("SMS-style and Singlish asks: '4', 'w/', possessives, kin words, 'n'", () => {
  finds("pls make a countdown 4 ayesha's wedding on sat, her mum is called fatima khan", "ayesha", "fatima", "khan");
  finds("need app 2 track hours 4 jamal n devonte", "jamal", "devonte");
  finds("eh can you help me make one website for my auntie siti's kueh stall lah", "siti");
});

test("titles and kin words carry even a name that is also a word", () => {
  finds("book w/ dr kim please", "kim");
  finds("make a page for miss pearl's kitchen", "pearl");
  finds("mamaw lou is in charge and big mike does the money", "lou");
});

test("handles, nicks and identifiers", () => {
  finds("give jdoe_42 access, @kevin_t pasted it", "jdoe_42", "kevin_t");
  finds("rename getEleanorBalance and fix marlowdental_api", "marlowdental_api");
  finds("in the sheet for priya_k change the owner", "priya");
});

test("street addresses", () => finds("my landlord at 4 elm st wants a tracker", "4 elm st"));

test("ordinary asks name nothing: no false masking of the app words, the clock, the weather", () => {
  for (const t of [
    "make a timer with start pause and reset buttons",
    "wat time is it in tokyo rn, make a clock page lah",
    "can u make a todo list that saves to localstorage",
    "yo make a lil calculator thingy w/ dark mode, big buttons",
    "build a weather widget using the open meteo api for new york",
    "mark the completed items green and will it let me drag them",
    "i miss you, text me when u get home",
  ]) assert.deepEqual(informalNames(t), [], t);
});

test("end to end: the lowercase ask loses its names on the wire and gets them back", () => {
  const ask = "make a timer for eleanor voss, her cousin tyrone runs the desk at 4 elm st";
  const d = createDeid({ extra: informalNames(ask) });
  const m = d.mask(ask);
  for (const s of ["eleanor", "voss", "tyrone", "elm st"]) assert.ok(!m.includes(s), s + " survived: " + m);
  assert.match(m, /make a timer for/);
  assert.equal(d.unmask(m), ask);
});
