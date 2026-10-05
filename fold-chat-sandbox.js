// fold-chat-sandbox.js — the agent's eyes. Runs what the machine door returned
// in a sandboxed iframe (scripts allowed, NO same-origin: it cannot touch this
// page, its storage, or the bridge) and reports what it actually did:
//
//   · did it load without throwing?
//   · did anything render?
//   · when each control is clicked, does it throw, and does the page change?
//
// These are observed facts, not a model's opinion of its own work. The loop
// (fold-chat-agent.js) turns a failing fact into the next attempt's prompt.
// Browser only — it needs a DOM; the loop's logic is tested in node with a
// fake observer and this is exercised by the live e2e.

/** The probe injected ahead of the artifact. It reports over postMessage with a
 *  per-run nonce; the parent only believes messages from this iframe. */
function probeScript(nonce, { click }) {
  return `<script>(function(){
var P=window.parent,ID=${JSON.stringify(nonce)};
function send(t,d){try{P.postMessage({__foldprobe:ID,type:t,data:d||{}},"*")}catch(e){}}
window.addEventListener("error",function(e){send("error",{message:String(e.message||e.error||"error"),line:e.lineno||null})});
window.addEventListener("unhandledrejection",function(e){var r=e.reason;send("error",{message:"unhandled rejection: "+(r&&r.message||r)})});
var ce=console.error;console.error=function(){send("console",{message:[].slice.call(arguments).map(String).join(" ")});try{ce.apply(console,arguments)}catch(e){}};
function snap(){var b=document.body;return {text:(b&&b.innerText||"").replace(/\\s+/g," ").trim(),html:b?b.innerHTML.length:0,vis:document.querySelectorAll("canvas,svg,img,video").length}}
// Ready when the DOM is ready — NOT when every image, font and external script has finished (a slow or blocked
// resource would hold "load" back and a perfectly good page would be reported as hung). "load" is only a fallback.
var began=false;
function begin(){ if(began)return; began=true; setTimeout(go,200); }
function go(){
  var s0=snap(),title=document.title||"";
  var ctl=[].slice.call(document.querySelectorAll("button,[role=button],input[type=button],input[type=submit],a[href^='#']")).slice(0,${click ? 12 : 0});
  var inputs=document.querySelectorAll("input,textarea,select").length;
  var labels=[].slice.call(document.querySelectorAll("button,[role=button],input,textarea,select,a,label,h1,h2,h3")).map(function(e){return (e.innerText||e.value||e.placeholder||e.getAttribute("aria-label")||e.title||"").replace(/\\s+/g," ").trim().toLowerCase()}).filter(Boolean).slice(0,60);
  send("loaded",{title:title,textLen:s0.text.length,sample:s0.text.slice(0,80),visuals:s0.vis,controls:ctl.length,inputs:inputs,labels:labels,text:s0.text.slice(0,3000).toLowerCase()});
  var changed=0,i=0;
  (function next(){
    if(i>=ctl.length){send("done",{clicked:ctl.length,changed:changed});return}
    var c=ctl[i++],before=snap();
    try{c.click()}catch(e){send("error",{message:"click threw: "+e.message})}
    setTimeout(function(){var a=snap();if(a.text!==before.text||a.html!==before.html)changed++;next()},120);
  })();
}
if(document.readyState==="interactive"||document.readyState==="complete")begin();
else{document.addEventListener("DOMContentLoaded",begin);window.addEventListener("load",begin);}
})()<\/script>`;
}

/** Put the probe first: inside <head> if there is one, else ahead of everything. */
export function withProbe(html, nonce, opts) {
  const probe = probeScript(nonce, opts);
  const m = html.match(/<head[^>]*>/i);
  if (m) return html.slice(0, m.index + m[0].length) + probe + html.slice(m.index + m[0].length);
  const d = html.match(/<!doctype[^>]*>/i);
  if (d) return html.slice(0, d.index + d[0].length) + probe + html.slice(d.index + d[0].length);
  return probe + html;
}

/** Wrap a bare script so the probe can watch it run. */
export function pageFor(code, kind) {
  if (kind === "html") return code;
  if (kind === "js") {
    // A module ("export function …", "import …") is not a classic script: run it as one, or `export` is a SyntaxError that was never the model's fault.
    const isModule = /^\s*(?:export|import)\b/m.test(String(code));
    return `<!doctype html><html><head><meta charset="utf-8"></head><body><script${isModule ? ' type="module"' : ""}>\n${String(code).replace(/<\/script/gi, "<\\/script")}\n<\/script></body></html>`;
  }
  return code;
}

/**
 * Observe an artifact. Resolves to { checks:[{name, ok, detail?}] }. Never
 * rejects on the artifact's own faults — those ARE the result.
 *   ok:true  → evidence the work holds     ok:false → a problem to repair
 *   ok:null  → information only (never fails the round)
 */
export function observeArtifact(code, { kind = "html", timeoutMs = 12000, host = document.body, signal = null } = {}) {
  return new Promise((resolve) => {
    if (kind !== "html" && kind !== "js") {
      resolve({ checks: [{ name: "runs as code", ok: null, detail: `a ${kind} answer is not run` }] });
      return;
    }
    const nonce = "p" + Math.random().toString(36).slice(2);
    const errors = [], consoleErrors = [];
    const loadErrors = [], clickErrors = [];
    let loaded = null, done = null, finished = false, LINE_OFFSET = 0;
    const frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");          // scripts only: no same-origin, no forms, no popups
    frame.setAttribute("aria-hidden", "true");
    // ON-screen but invisible: a hidden or off-screen cross-origin frame has its timers throttled to ~1/second, which made
    // every click step cost a full second (measured: 3 buttons = 4.0s, 12 buttons > 13s). opacity:0 keeps it "visible" to the browser.
    frame.style.cssText = "position:fixed;left:0;top:0;width:900px;height:640px;border:0;opacity:0;pointer-events:none;z-index:-1";
    const finish = () => {
      if (finished) return; finished = true;
      clearTimeout(timer); clearTimeout(hardCap); document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("message", onMsg); signal?.removeEventListener?.("abort", finish);
      frame.remove();
      const checks = [];
      const rendered = !!loaded && (loaded.textLen > 0 || loaded.visuals > 0 || loaded.controls > 0 || loaded.inputs > 0);
      if (loadErrors.length) {
        checks.push({ name: "loads without errors", ok: false, detail: loadErrors.slice(0, 3).map((e) => e.message + (e.line ? ` (line ${e.line})` : "")).join(" · ") });
      } else if (!loaded) {
        checks.push({ name: "loads without errors", ok: false, detail: "the page never finished loading (it hung or blocked)" });
      } else {
        checks.push({ name: "loads without errors", ok: true, detail: loaded.title ? `“${loaded.title}”` : null });
      }
      if (loaded) {
        // Only a PAGE is expected to draw something; a function or module that draws nothing is exactly as asked.
        if (kind === "html") checks.push({ name: "renders something visible", ok: rendered, detail: rendered ? `${loaded.textLen} chars of text · ${loaded.controls} control(s) · ${loaded.inputs} input(s) · ${loaded.visuals} visual(s)` : "the page is blank" });
        if (loaded.controls > 0) {
          if (!done) checks.push({ name: "controls respond", ok: null, detail: `clicked ${loaded.controls} control(s); the sandbox did not report back` });
          else checks.push({ name: "controls respond", ok: clickErrors.length === 0, detail: clickErrors.length ? `a click threw: ${clickErrors[0].message}` : `clicked ${done.clicked}; ${done.changed} changed the page` });
        }
      }
      if (consoleErrors.length) checks.push({ name: "console", ok: null, detail: consoleErrors.slice(0, 2).join(" · ") });
      const facts = {
        loaded: !!loaded, loadErrors, clickErrors, rendered, page: kind === "html",
        controls: loaded?.controls || 0, clicked: done?.clicked || 0, changed: done?.changed || 0,
        labels: loaded?.labels || [], text: loaded?.text || "", title: loaded?.title || "",
      };
      resolve({ checks, facts });
    };
    const onMsg = (e) => {
      const d = e.data;
      if (e.source !== frame.contentWindow || !d || d.__foldprobe !== nonce) return;
      if (d.type === "error") { if (d.data && d.data.line) d.data.line = d.data.line > LINE_OFFSET ? d.data.line - LINE_OFFSET : null; errors.push(d.data); (loaded ? clickErrors : loadErrors).push(d.data); }
      else if (d.type === "console") consoleErrors.push(d.data.message);
      else if (d.type === "loaded") loaded = d.data;
      else if (d.type === "done") { done = d.data; finish(); }
    };
    window.addEventListener("message", onMsg);
    signal?.addEventListener?.("abort", finish);
    // A tab in the background does not run the test frame at all, so "it never reported back" there means "nobody looked", not
    // "the page hung". Judge only a frame that had the chance to run: if the tab is hidden when the clock runs out, wait for it to
    // be shown and start the clock again (a hard cap keeps a forgotten tab from holding the run forever).
    const hidden = () => typeof document !== "undefined" && document.visibilityState === "hidden";
    let timer = null, hardCap = null;
    const arm = () => { clearTimeout(timer); timer = setTimeout(() => { if (!loaded && hidden()) return; finish(); }, timeoutMs); };
    const onVisible = () => { if (!hidden() && !loaded && !finished) arm(); };
    document.addEventListener("visibilitychange", onVisible);
    hardCap = setTimeout(finish, Math.max(timeoutMs, 300000));
    arm();
    // The probe is injected ahead of the artifact, so the browser's line numbers are offset by its length (and by the one
    // wrapper line for a bare script). Report lines relative to the MODEL'S code — "line 63" must mean line 63 of what it wrote.
    const probeLines = (probeScript(nonce, { click: true }).match(/\n/g) || []).length;
    LINE_OFFSET = probeLines + (kind === "js" ? 1 : 0);
    frame.srcdoc = withProbe(pageFor(code, kind), nonce, { click: true });
    host.append(frame);
  });
}
