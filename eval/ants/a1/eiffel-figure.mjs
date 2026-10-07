import * as web from "../../../fold-chat-web.js";
import * as O from "../../../fold-chat-origin.js";
const u = "https://www.worldatlas.com/articles/how-tall-is-the-eiffel-tower.html";
const x = await web.readText(u, { fetchImpl: fetch, memo: web.makeMemo() }); console.log("ok", x.ok, x.via, (x.text || "").length);
const sents = (x.text || "").split(/(?<=[.!?])\s+/).filter((s) => /330|1,?083|1,?063|324/.test(s)).slice(0, 4); console.log(JSON.stringify(sents, null, 1));
for (const c of ["The Eiffel Tower is 330 meters (1,083 ft) tall.", "The Eiffel Tower is 330 meters tall.", "The Eiffel Tower is 330 metres (1,083 ft) tall.", "The Eiffel Tower is 1,083 feet tall.", "The Eiffel Tower is 330 m tall."]) { const s = O.supportOf(c, { url: u, title: x.title, text: x.text }, { forWhom: "How tall is the Eiffel Tower?" }); console.log(s.verdict, s.why || "", s.detail || "", "|", c, "|", (s.sentence || "").slice(0, 100)); }
