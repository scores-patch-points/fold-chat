// fold-webllm-worker.js — the module Worker that holds the WebLLM engine, so a generation never blocks the UI thread
// (2026-10-05). fold-chat-webllm.js starts it with CreateWebWorkerMLCEngine; this file only forwards messages to web-llm's own
// handler. The import URL is the pinned one in fold-chat-webllm.js (WEBLLM_ESM_URL) — a test checks they are the same string.
// It is a static import on purpose: a worker that imported lazily could miss the first messages. Nothing runs until the page
// constructs the Worker, and the page does that only when the person loads an in-page model.
//
// WOULD PROVE IT WRONG: messages posted before the handler exists being lost; a version here that differs from the page's.

import { WebWorkerMLCEngineHandler } from "https://cdn.jsdelivr.net/npm/@mlc-ai/web-llm@0.2.85/+esm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = (msg) => handler.onmessage(msg);
