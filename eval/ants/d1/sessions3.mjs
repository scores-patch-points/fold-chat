// sessions3.mjs — claim (3d): a fact established in session 1, asked for in session 3 (three chats, one person). The app keeps no cross-session store for claims
// (s.claims is per session; the only global memory is the reader's NAME, fold-chat-memory.js extractStatedName -> localStorage "fold-chat:reader"). This runs the app's own
// decision code over three separate sessions and reports what the third can reach. Replay only.
import fs from "node:fs";
import { makeReplayFetch } from "./lib/replay.mjs";
import { newSession, runTurn, makeCtx } from "./sim.mjs";
import { extractStatedName } from "../../../fold-chat-memory.js";
const f = makeReplayFetch({ mode: "replay" });
const rows = [];
const ctx = makeCtx({ fetchImpl: f });
const s1 = newSession("one"), s2 = newSession("two"), s3 = newSession("three");
const t = async (s, q) => { const r = await runTurn(s, q, ctx); return { q, path: r.path, web: r.web, pages: r.pages, recallTurn: r.recallTurn, spoken: r.spoken.slice(0, 120), claims: s.claims.length }; };
rows.push(await t(s1, "How tall is the Eiffel Tower?"));
rows.push(await t(s1, "Who invented the telephone?"));
rows.push(await t(s2, "How long is the Great Wall of China?"));
rows.push(await t(s2, "What did you tell me about the Eiffel Tower earlier?"));          // asked in chat 2 about chat 1
rows.push(await t(s3, "What did you tell me about the Eiffel Tower earlier?"));          // asked in chat 3 about chat 1
rows.push(await t(s3, "How tall is it?"));
rows.push({ q: "My name is Ana (name learned)", name: extractStatedName("My name is Ana") });
const sharedClaims = [s1, s2, s3].map((s) => s.claims.length);
fs.mkdirSync(new URL("./out/", import.meta.url), { recursive: true });
fs.writeFileSync(new URL("./out/sessions3.json", import.meta.url), JSON.stringify({ misses: f.stats.misses, sharedClaims, rows }, null, 1));
console.log(JSON.stringify({ sharedClaims, rows }, null, 1));
