import { createDeid } from "../../fold-chat-deid.js";
const code = 'var bill = document.getElementById("bill");\nvar b = Math.max(0, parseFloat(bill.value) || 0);\nbill.addEventListener("input", update);';
const scen = "Scenario: bill 100, 1 person, click 15% -> tip 15.00. At 390px wide no sideways scroll; never show NaN or Infinity. Contact me at jane.doe@example.com.";
for (const [name, text] of Object.entries({ "fenced, shapes only (createDeid)": scen + "\n```js\n" + code + "\n```", "unfenced, shapes only": scen + "\n" + code })) {
  const d = createDeid(); const [m] = d.maskAll([text]);
  console.log(name.padEnd(36), "code identical:", m.includes(code), "| email masked:", !m.includes("jane.doe@example.com"), "| residual:", d.residual(m).length, "| kinds", JSON.stringify(d.stats().kinds));
}
