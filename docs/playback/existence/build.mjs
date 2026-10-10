// build.mjs — compose the three self-contained mocks (nul.html, sig.html, ins.html) from parts/ + data.json. No network, no fonts, no external scripts.
//   node docs/playback/existence/extract.mjs && node docs/playback/existence/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const rd = (f) => fs.readFileSync(path.join(HERE, f), "utf8");
const data = rd("data.json").replace(/</g, "\\u003c");
const STAGES = [
  { file: "nul", title: "Stage 1 NUL: the open slot", n: 1, code: "NUL" },
  { file: "sig", title: "Stage 2 SIG: the swimlane", n: 2, code: "SIG" },
  { file: "ins", title: "Stage 3 INS: page and clippings", n: 3, code: "INS" },
];
for (const s of STAGES) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${s.title}</title>
<style>
${rd("parts/common.css")}
${rd("parts/" + s.file + ".css")}
</style>
</head>
<body>
<details class="mock" id="mock"><summary>Mock controls (not part of the product)</summary><div class="mockrow" id="mockrow"></div></details>
<main class="pv" aria-label="Stage ${s.n}, ${s.code}">
  <div class="pv-in">
    <header class="pv-head"><p class="crumbs" id="crumbs"></p><p class="cap" id="cap" aria-live="polite"></p></header>
    <div class="pv-body">
      <div class="faces" id="faces" role="group" aria-roledescription="three faces of one stage"></div>
      <div class="hints"><button type="button" class="hint" id="hl"></button><button type="button" class="hint" id="hr"></button></div>
    </div>
  </div>
</main>
<script id="data" type="application/json">${data}</script>
<script>
${rd("parts/" + s.file + ".js")}
${rd("parts/common.js")}
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(HERE, s.file + ".html"), html);
  console.log(s.file + ".html", (html.length / 1024).toFixed(0) + " KB");
}
