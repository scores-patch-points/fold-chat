// Collect search results INSIDE a real browser (Chromium), because Node's fetch is answered with a bot
// challenge / HTTP 429 by DuckDuckGo and Brave on the same address where a browser gets 200 OK.
// Paste into the page's console at https://html.duckduckgo.com/ (same-origin fetch), with `window.__H`
// set to a list of [id, question, regex, lang] (see holdout.json). Rows land in window.__hrows; read them
// back with JSON.stringify(window.__hrows). ~3.5 s apart; stop on any challenge. The browser pane in the
// Claude app cannot reach localhost, so results come back through the tool output, not a local collector.
window.__unwrap = (h) => { const m = /[?&]uddg=([^&]+)/.exec(h); if (m) { try { return decodeURIComponent(m[1]); } catch { return null; } } return /^https?:/.test(h) ? h : (/^\/\//.test(h) ? "https:" + h : null); };
window.__hrows = {}; window.__state3 = { done: 0, blocked: null, running: true };
(async () => {
  for (const [id, q] of window.__H) {
    try {
      const r = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), { credentials: "omit" });
      const h = await r.text();
      if (/anomaly|botnet/i.test(h)) { window.__state3.blocked = id; break; }
      const doc = new DOMParser().parseFromString(h, "text/html");
      const results = [...doc.querySelectorAll(".result")].map((b) => { const a = b.querySelector("a.result__a"); const s = b.querySelector(".result__snippet"); const u = a ? window.__unwrap(a.getAttribute("href")) : null; return a && u && !/duckduckgo\.com\/(y\.js|html)/.test(u) ? { t: a.textContent.replace(/\s+/g, " ").trim().slice(0, 90), u: u.slice(0, 160), s: (s ? s.textContent : "").replace(/\s+/g, " ").trim().slice(0, 230) } : null; }).filter(Boolean).slice(0, 8);
      window.__hrows[id] = { q, status: r.status, results };
    } catch (e) { window.__hrows[id] = { q, error: String(e.message) }; }
    window.__state3.done++;
    await new Promise((r) => setTimeout(r, 3500));
  }
  window.__state3.running = false;
})();
