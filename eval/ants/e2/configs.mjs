import path from "node:path";
import { fileURLToPath } from "node:url";
const H = path.dirname(fileURLToPath(import.meta.url));
const P = (f) => path.join(H, "patched", f);
export const ROUTE = { page: { "**/fold-chat.js*": P("fold-chat.js") }, web: { "**/fold-chat-web.js*": P("fold-chat-web.js") }, prim: { "**/fold-chat-primary.js*": P("fold-chat-primary.js") } };
ROUTE.webf = { "**/fold-chat-web.js*": P("fold-chat-web-f.js") };
ROUTE.webh = { "**/fold-chat-web.js*": P("fold-chat-web-h.js") };
ROUTE.g = { "**/fold-chat.js*": P("fold-chat-g.js") };
export const CONFIGS = {
  A: { name: "baseline (tracked code, default flags)", patch: {}, flags: {} },
  B: { name: "L1 answer-first only", patch: { ...ROUTE.page }, flags: { "fold-chat:e2rec": "off" } },
  C: { name: "stack: L1 + L2a + L3 + L6", patch: { ...ROUTE.page, ...ROUTE.web, ...ROUTE.prim }, flags: {} },
  D: { name: "stack + salience on", patch: { ...ROUTE.page, ...ROUTE.web, ...ROUTE.prim }, flags: { "fold-chat:salience": "on" } },
  E: { name: "slot pipeline on (tracked code)", patch: {}, flags: { "fold-chat:answerPipeline": "on" } },
  F: { name: "recommended stack minus L2b: L1 + L2a + L3 + web cap/grace", patch: { ...ROUTE.page, ...ROUTE.webf, ...ROUTE.prim }, flags: {} },
  G: { name: "F + L2b (REC laps after the answer) + L9 (origin box 2 s)", patch: { ...ROUTE.g, ...ROUTE.webf, ...ROUTE.prim }, flags: {} },
  H: { name: "Sources only (answer mode snips), tracked code", patch: {}, flags: { "fold-chat:answerMode": "snips" } },
  I: { name: "Sources only + web cap/grace", patch: { ...ROUTE.webf }, flags: { "fold-chat:answerMode": "snips" } },
  J: { name: "F + web budget ends 2 s after another source answered", patch: { ...ROUTE.page, ...ROUTE.webh, ...ROUTE.prim }, flags: {} },
  K: { name: "FULL: L1+L2a+L2b+L3+L9 + web cap/grace/budget-grace/doors", patch: { ...ROUTE.g, ...ROUTE.webh, ...ROUTE.prim }, flags: {} },
  L: { name: "Sources only + web cap/grace/budget-grace/doors", patch: { ...ROUTE.webh }, flags: { "fold-chat:answerMode": "snips" } },
};
