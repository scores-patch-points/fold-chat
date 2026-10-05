// Regenerates fold-chat-support-routes-def.js from fold-chat-support-routes.json (the declarative definition of the
// kind "creator-support-route"). The JSON is the one place the definition is edited; the .js mirror exists only because the
// app is static and browsers' JSON-module support is not universal. A test fails if they differ.
// node scripts/gen-support-routes.mjs          write the mirror
// node scripts/gen-support-routes.mjs --check  exit 1 if the mirror is stale
import fs from "node:fs";
const here = new URL("../", import.meta.url);
const def = JSON.parse(fs.readFileSync(new URL("fold-chat-support-routes.json", here), "utf8"));
const deepFreeze = "const deepFreeze = (o) => { if (o && typeof o === \"object\") { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };";
export const mirrorSource = (d) => `// fold-chat-support-routes-def.js — GENERATED from fold-chat-support-routes.json by scripts/gen-support-routes.mjs. Never hand-edit.
// The declarative definition of the kind "creator-support-route" and its sub-kinds (docs/CREATOR-SUPPORT-ROUTES.md).
${deepFreeze}
export const SUPPORT_ROUTES = deepFreeze(${JSON.stringify(d, null, 1)});
`;
const out = mirrorSource(def);
const target = new URL("fold-chat-support-routes-def.js", here);
if (process.argv.includes("--check")) {
  const cur = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : "";
  if (cur !== out) { console.error("fold-chat-support-routes-def.js is stale: run node scripts/gen-support-routes.mjs"); process.exit(1); }
  console.log("fold-chat-support-routes-def.js is current");
} else { fs.writeFileSync(target, out); console.log("wrote fold-chat-support-routes-def.js"); }
