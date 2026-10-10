// Build a turn record the way fold-chat.js does: ground.turnRecord(answer, material) + the tape's `quick` pages (slimP: text clipped to 900).
import * as ground from "../../../../fold-chat-ground.js";
const clip = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n) : s; };
export function recOf(c) {
  const material = c.material.map((p) => ({ ref: p.ref, source: p.source, text: String(p.text || "").slice(0, 12000) }));
  const rec = ground.turnRecord(c.answer, material, { turn: 1, question: c.question || "" });
  rec.tape = material.slice(0, 7).map((p, j) => ({ at: j, seq: j, kind: "quick", n: j + 1, of: material.length, p: { text: clip(p.text, 900), ref: p.ref || "", url: p.source || "" } }));
  return rec;
}
