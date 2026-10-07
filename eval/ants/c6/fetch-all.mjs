// fetch-all.mjs — read every battery page once into the cache (no classification happens here).
import fs from "node:fs";
import { read, closeReader } from "./reader.mjs";
const items = JSON.parse(fs.readFileSync(new URL("./" + (process.argv[2] || "battery.json"), import.meta.url), "utf8")).items;
const urls = [...new Set(items.map((i) => i.url))];
for (const u of urls) { const t = Date.now(); const r = await read(u); console.log(r.ok ? "ok  " : "FAIL", r.via, r.status, ((r.html || r.text || "").length / 1000).toFixed(0) + "k", Date.now() - t + "ms", u, r.ok ? "" : r.why); }
await closeReader();
