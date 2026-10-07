import * as O from "../../../fold-chat-origin.js";
import * as web from "../../../fold-chat-web.js";
const idx = await O.wikiIndex("https://en.wikipedia.org/wiki/Eiffel_Tower", { fetchImpl: fetch });
const n = idx.notes.get("9"); console.log("note 9:", JSON.stringify({ url: n.url, archived: n.archived, text: n.text.slice(0, 160) }));
const claim = "The tower is 330 metres (1,083 ft) tall, about the same height as an 81-storey building, and the tallest structure in Paris.";
for (const u of [n.archived, "https://web.archive.org/web/2023/" + n.url].filter(Boolean)) { const x = await web.readText(u, { fetchImpl: fetch, memo: web.makeMemo(), timeoutMs: 8000 }); console.log(u.slice(0, 90), "ok", x.ok, x.via, (x.text || "").length); if (x.ok) { for (const c of [claim, "The Eiffel Tower is 330 meters (1,083 feet) tall."]) { const s = O.supportOf(c, { url: n.url, title: x.title, text: x.text }, { forWhom: "How tall is the Eiffel Tower?" }); console.log("  ", s.verdict, s.why || "", (s.sentence || "").slice(0, 140)); } const m = x.text.match(/.{100}\b330\b.{100}/); console.log("   page:", m && m[0]); } }
