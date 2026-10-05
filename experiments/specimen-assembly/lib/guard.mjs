// guard.mjs — the door in front of any model call. The request's STRING VALUES (never its keys, never its JSON
// punctuation) are passed together through fold-chat-redact.js `deidentify` (the local Python redactor, asked again about
// the masked text); the masked values are put back into the same structure. Masking the serialised JSON instead lets one
// redactor span swallow quotes and keys and silently merge fields (measured 2026-10-05: see RESULTS-PAGES.md).
// Fails closed: if the redactor cannot be reached or still finds details, `deidentify` throws err.notSent and nothing is
// sent. A string value that EXACTLY equals a term of the program's own vocabulary (an obligation id, a slot or holon
// name) is not private by construction and is left unsent-to-the-redactor and unmasked; that is the only exemption, and
// it never applies to part of a string. Provenance never uses the masked text: records refer to specimens by their own ids.
import { deidentify, createRedactor } from "../../../fold-chat-redact.js";

function leaves(node, path, out) {
  if (typeof node === "string") out.push({ path, value: node });
  else if (Array.isArray(node)) node.forEach((v, i) => leaves(v, [...path, i], out));
  else if (node && typeof node === "object") for (const k of Object.keys(node)) leaves(node[k], [...path, k], out);
  return out;
}
const setAt = (root, path, value) => { let o = root; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path[path.length - 1]] = value; };

export function makeGuard({ redactor = createRedactor(), taint = null, extra = [], mode = "default", redact = null, vocabulary = [], exempt = [] } = {}) {
  const spans = redact || ((texts) => redactor.spans(texts));
  const vocab = new Set(vocabulary);
  const sent = [];
  const guard = async (request) => {
    const copy = JSON.parse(JSON.stringify(request));
    const all = leaves(copy, [], []);
    const todo = all.filter((l) => !vocab.has(l.value) && l.value.trim().length > 0);
    const out = await deidentify(todo.map((l) => l.value), { taint, extra, mode, redact: spans, ...(exempt.length ? { exempt } : {}) });
    todo.forEach((l, i) => setAt(copy, l.path, out.texts[i]));
    const info = { viaRedactor: out.viaRedactor, passes: out.passes, stats: out.deid.stats(), strings: all.length, sentToRedactor: todo.length, exempt: all.length - todo.length };
    sent.push(info);
    return { request: copy, unmask: out.deid.unmask, ...info };
  };
  guard.sent = sent;
  return guard;
}

// where did masking change a request? (so an over-masked value can be shown to the de-id owner)
export function diffMasked(a, b, path = "$") {
  if (typeof a !== typeof b) return [{ path, was: a, became: b }];
  if (a && typeof a === "object") { const keys = new Set([...Object.keys(a), ...Object.keys(b || {})]); return [...keys].flatMap((k) => diffMasked(a[k], (b || {})[k], `${path}.${k}`)); }
  return a === b ? [] : [{ path, was: a, became: b }];
}
