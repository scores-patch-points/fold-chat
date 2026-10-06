import { deidentify, createRedactor } from "../../fold-chat-redact.js";
const redactor = createRedactor();
const code = 'var bill = document.getElementById("bill");\nvar b = Math.max(0, parseFloat(bill.value) || 0);\nbill.addEventListener("input", update);';
const scen = "Scenario: bill 100, 1 person, click 15% -> text shows tip 15.00 and per person 115.00. At 390px wide there must be no sideways scroll; never show NaN or Infinity.";
const cases = {
  "code unfenced": scen + "\n" + code,
  "code in a fence": scen + "\n```js\n" + code + "\n```",
  "scenario only": scen,
};
for (const [name, text] of Object.entries(cases)) {
  try {
    const out = await deidentify([text], { redact: (t) => redactor.spans(t) });
    const m = out.texts[0];
    const codeKept = m.includes(code) ;
    const scenKept = m.includes(scen);
    console.log(name.padEnd(16), "viaRedactor", out.viaRedactor, "passes", out.passes, "| code byte-identical:", codeKept, "| scenario text identical:", scenKept, "| stats", JSON.stringify(out.deid.stats().kinds));
    if (!scenKept) console.log("   scenario became:", m.split("\n")[0].slice(0, 170));
  } catch (e) { console.log(name, "ERR", e.message); }
}
