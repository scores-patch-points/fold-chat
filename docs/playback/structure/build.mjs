// build.mjs — inline base.css/base.js, a stage's css/js and the two recorded turns into one self-contained HTML per stage.
//   node docs/playback/structure/prep.mjs && node docs/playback/structure/build.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const rd = (p) => fs.readFileSync(path.join(HERE, p), "utf8");
const turns = ["wall", "t0", "t1", "t2"].map((n) => JSON.parse(rd(`data/${n}.json`)));
const STAGES = { seg: "SEG \u2014 the sentence, cut", con: "CON \u2014 the bind", syn: "SYN \u2014 the sentence, stitched" };
for (const [id, title] of Object.entries(STAGES)) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${title}</title>
<style>
${rd("src/base.css")}
${rd(`src/${id}.css`)}
</style>
</head>
<body>
<script>window.__DATA__ = ${JSON.stringify(turns).replace(/</g, "\\u003c")};</script>
<script>
${rd(`src/${id}.js`)}
</script>
<script>
${rd("src/base.js")}
</script>
</body>
</html>
`;
  fs.writeFileSync(path.join(HERE, `${id}.html`), html); console.log(id, (html.length / 1024).toFixed(0) + " KB");
}
