// fold-chat-client.js — The Fold's chat surface, speaking to Heimdall.
//
// The Fold's chat version is a browser page, not a server app. Its models and
// routing live on this machine: the heimdall bridge (localhost:8790) speaks
// the OpenAI wire, holds the fleet (phones, linked native hosts) and the
// configured remote/frontier providers, and ENFORCES the sealed-external gate
// for outside models. This module is the chat's half of that wire:
//
//   listModels()     GET /api/tags   -> every model heimdall can serve, with
//                     its heimdall metadata (frontier? privacy class?) — the
//                     metadata tells the chat which models MUST be sealed.
//   isSealed(id)     a model heimdall marks frontier/sealed-only
//   chat()           POST /v1/chat/completions (SSE stream) — for a sealed
//                     model the body carries heimdall_privacy:"sealed-external"
//                     and ONLY the user's own messages; raw workspace spans
//                     never ride this wire.
//   meter()/ledger() GET /api/meter, /api/ledger — who did the work, exact
//                     external tokens, and the marked estimates.
//   frontier()       GET /api/frontier — the sealed gate's shape.
//
// Browser + node (tests use an injected fetch).

export const DEFAULT_BRIDGE = "http://localhost:8790";

/** The bridge a caller points at. Overridable (localStorage in the page,
 *  constructor arg in tests). */
export function bridgeBase(override = null) {
  return String(override || DEFAULT_BRIDGE).replace(/\/+$/, "");
}

/** Normalize an OpenAI-compatible chat body the bridge understands. */
export function chatBody(model, messages, { privacy = null, temperature = 0.7, maxTokens = 1024 } = {}) {
  const body = { model, messages, temperature, max_tokens: maxTokens, stream: true };
  if (privacy) body.heimdall_privacy = privacy;
  return body;
}

/** True when heimdall's metadata marks this model sealed-only (an outside
 *  provider). A sealed model must never receive raw workspace material. */
export function isSealed(meta) {
  return !!(meta?.frontier || meta?.privacy === "sealed-external");
}

/** Read the bridge's model list from /api/tags (Ollama shape, but carries the
 *  heimdall per-model metadata: webllm/native workers, or frontier+privacy).
 *  Returns [{ id, sealed, location, provider, contextWindow }]. */
export async function listModels({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/tags", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  const j = await r.json();
  const out = [];
  for (const m of Array.isArray(j?.models) ? j.models : []) {
    if (!m?.name) continue;
    const h = m.heimdall || {};
    out.push({
      id: String(m.name),
      sealed: isSealed(h),
      provider: h.frontier ?? h.native ?? (h.webllm ? "webllm" : h.workers ? "fleet" : "local"),
      location: h.location ?? "local",
      contextWindow: h.context_window ?? null,
    });
  }
  return out;
}

/** One chat turn over the bridge. SSE streams tokens to onToken(text); the
 *  resolved value is { text, tokens } (tokens counted per delta). A sealed
 *  model is forced sealed-external unless the caller chose "explicit".
 *  Rejects with { status, message } on bridge/provider errors. */
export async function chat(model, messages, { base = null, privacy = null, onToken = null, signal = null, temperature = 0.7, maxTokens = 1024, fetchImpl = fetch } = {}) {
  const url = bridgeBase(base) + "/v1/chat/completions";
  // Sealed by default for outside models: the Fold selects the privacy mode
  // and seals first. Raw spans never leave — only what the caller put in
  // `messages` rides the wire.
  const effective = privacy ?? "sealed-external";
  const body = chatBody(model, messages, { privacy: effective, temperature, maxTokens });
  let res;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (e) {
    const err = new Error("bridge unreachable: " + (e?.message || e));
    err.status = 0;
    throw err;
  }
  if (res.status === 400) {
    let msg = "heimdall refused the request";
    try { msg = (await res.json())?.error?.message || msg; } catch {}
    const err = new Error(msg);
    err.status = 400;
    throw err;
  }
  if (!res.ok || !res.body) {
    const err = new Error("heimdall bridge answered " + res.status);
    err.status = res.status;
    throw err;
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  const dec = new TextDecoder();
  let buf = "";
  let text = "";
  let tokens = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value ?? "";
    let nl;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).replace(/\r$/, "").trim();
      buf = buf.slice(nl + 1);
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let j;
      try { j = JSON.parse(payload); } catch { continue; }
      if (j.error) { const err = new Error(j.error?.message || "bridge stream error"); err.status = 502; throw err; }
      const delta = j.choices?.[0]?.delta?.content;
      if (typeof delta === "string" && delta) {
        text += delta;
        tokens++;
        onToken?.(delta);
      }
    }
  }
  return { text, tokens };
}

/** The savings meter: exact external tokens, lane counts, and the marked
 *  estimates heimdall computes. { counts, externalTokens, estimated }. */
export async function meter({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/meter", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  return r.json();
}

/** Recent dispatch-ledger entries (the last 200): who did what, predicted vs
 *  actual, and the privacy mode. */
export async function ledger({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/ledger", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  return r.json();
}

/** The sealed gate's shape: which providers are configured, and the rule. */
export async function frontier({ base = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/frontier", { cache: "no-store" });
  if (!r.ok) throw new Error("heimdall bridge answered " + r.status);
  return r.json();
}

/** Whether a coding machine (opencode) is attached behind the bridge. */
export async function codeStatus({ base = null, fetchImpl = fetch } = {}) {
  try { const r = await fetchImpl(bridgeBase(base) + "/api/code/status", { cache: "no-store" }); return r.ok ? r.json() : null; }
  catch (e) { return null; }
}

/** Run one coding job THROUGH heimdall — the bridge dispatches to the local
 *  opencode machine door, whose own model calls are routed by the bridge. The
 *  chat never talks to opencode directly. Returns
 *  { sessionId, text, activity, ms, lane }. */
export async function code(prompt, { base = null, title = null, model = null, agent = null, signal = null, fetchImpl = fetch } = {}) {
  const r = await fetchImpl(bridgeBase(base) + "/api/code", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prompt, title, model, agent }),
    signal,
  });
  if (!r.ok) {
    let msg = "the coding machine did not answer";
    try { msg = (await r.json())?.error || msg; } catch {}
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return r.json();
}