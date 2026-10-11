// fold-chat-spine.js — THE THIN CLIENT SEAM (2026-10-10).
//
// The surface as a thin client over the machine spine: when `window.__spineBase`
// is set (a machine-side spiral-door, penelope gym/spiral-door.mjs), a widget
// make is NOT drawn in the browser at all — it is POSTed to the machine, which
// runs the proven chain (arrange → behavioral judge with box wants, cube-tied
// acts) and returns the artifact + its append-only log. A follow-up edit is a
// ONE-UNIT patch on the machine's session log: re-projected, re-judged, never
// a rewrite. Without __spineBase the fold keeps its own builder, unchanged.
//
// Falsifying control: a make or edit that reports a machine verdict the door's
// own record does not carry; or an edit that changes more than one unit while
// the machine's log reports "patch" — the seam never fabricates a verdict.

export function spineBase() {
  try { return (typeof window !== "undefined" && window.__spineBase) ? String(window.__spineBase).replace(/\/+$/, "") : null; } catch { return null; }
}
async function post(spPath, body) {
  const base = spineBase();
  if (!base) throw new Error("no spine door is set (window.__spineBase)");
  const r = await fetch(base + spPath, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error("spine " + r.status);
  const j = await r.json().catch(() => null);
  if (!j || typeof j.ok !== "boolean") throw new Error("the spine door answered nothing typed");
  return j;
}
export async function buildViaSpine(task) { return post("/v1/widget/build", { task }); }
export async function editViaSpine(session, edit) { return post("/v1/widget/edit", { session, edit }); }

export default { spineBase, buildViaSpine, editViaSpine };