// build.mjs — inline kernel + one model + the real data into one self-contained HTML per stacking model.
//   node docs/playback/nav/prep.mjs && node docs/playback/nav/build.mjs
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const HERE = path.dirname(fileURLToPath(import.meta.url)); const rd = (p) => fs.readFileSync(path.join(HERE, p), "utf8");
const data = rd("data/scenarios.json");
const MODELS = {
  "a-sheets": { id: "a", name: "A · sheet stack", title: "Nav A — bottom-sheet stack", parts: ["a"] },
  "b-push": { id: "b", name: "B · push + spine", title: "Nav B — full-bleed push with a spine", parts: ["b"] },
  "c-zoom": { id: "c", name: "C · spatial zoom", title: "Nav C — spatial zoom", parts: ["c"] },
  "d-split": { id: "d", name: "D · split / sheets", title: "Nav D — split on wide, sheets on narrow", parts: ["a", "d"] },
};
for (const [file, m] of Object.entries(MODELS)) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="color-scheme" content="light dark">
<title>${m.title}</title>
<style>
${rd("src/kernel.css")}
${m.parts.map((p) => rd(`src/${p}.css`)).join("\n")}
</style>
</head>
<body>
<script>window.__DATA__ = ${data.replace(/</g, "\\u003c")}; window.__CFG__ = ${JSON.stringify({ model: m.id, name: m.name })};</script>
<script>
${rd("src/kernel.js")}
</script>
${m.parts.map((p) => `<script>\n${rd(`src/${p}.js`)}\n</script>`).join("\n")}
</body>
</html>
`;
  fs.writeFileSync(path.join(HERE, file + ".html"), html); console.log(file, (html.length / 1024).toFixed(0) + " KB");
}
