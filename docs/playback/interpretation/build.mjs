// docs/playback/interpretation/build.mjs — assembles def.html, eva.html, rec.html (each fully self-contained: inline CSS, JS and a trimmed real record).
//   node docs/playback/interpretation/extract.mjs && node docs/playback/interpretation/build.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url));
const rd = (f) => fs.readFileSync(path.join(HERE, f), "utf8");
const data = rd("data.json").replace(/<\//g, "<\\/");
const PAGES = [["def", "Pin down: what is claimed"], ["eva", "Compare: what it was compared with"], ["rec", "Settle: where it stands"]];
for (const [k, title] of PAGES) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
${rd("src/shared.css")}
${rd(`src/${k}.css`)}
</style>
</head>
<body>
<script id="data" type="application/json">${data}</script>
<script>
${rd("src/shared.js")}
${rd(`src/${k}.js`)}
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(HERE, `${k}.html`), html);
  console.log(k + ".html", html.length, "bytes");
}
