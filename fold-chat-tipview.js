// fold-chat-tipview.js — the ONE "Tip the creator" control, used by the recipe card, the Sources-only strand and the
// facing page's source rows (fold-chat-tip.js is the logic; this is only the hand).
//
// A click looks for how the creator's OWN site says to reach them, then:
//   email -> opens the person's own email app with a draft (a mailto: link; nothing is sent until they send it),
//   form  -> copies the draft and opens the creator's own contact page in a new tab,
//   none  -> says so, opens nothing.
// Nothing happens without a click. Nothing is paid or sent by the Fold. textContent only; a page's words never become markup.
import { findContact, tipDraft, TIP_SAY, isPlatformSite, looksLikeHandle } from "./fold-chat-tip.js";
import { readText as webReadText } from "./fold-chat-web.js";

const deps = { readText: (u) => webReadText(u), pause: undefined };
/** The app wires its audited, memoised page reader here once (fold-chat.js); tests may pass their own. */
export function configureTip(o = {}) { Object.assign(deps, o); }

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const siteOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return ""; } };

/**
 * @param src   { url, title, creator?, site?, contact? }   contact: what the page offered when read (see contactOfPassage)
 * @param opts  { toast?, quiet? }   quiet: the text-style button for a source row (the card uses the bordered one)
 * @returns the control: a span holding the button, a polite status line, and (after a click) a visible way to retry.
 */
export function tipControl(src, { toast = null, quiet = false } = {}) {
  const url = String(src.url || "");
  // a contributor credited by handle on a marketplace/UGC platform is not who the site's address reaches
  const contributor = isPlatformSite(url) || (!!src.creator && looksLikeHandle(src.creator));
  const who = (contributor ? "" : src.creator) || src.site || siteOf(url) || "the creator";
  const wrap = el("span", "tip" + (quiet ? " tip-quiet" : ""));
  const btn = el("button", "tip-btn" + (quiet ? "" : " snip-tip"), "Tip the creator"); btn.type = "button";
  btn.dataset.tip = "";
  btn.setAttribute("aria-label", "Tip the creator" + (src.title ? " of " + src.title : ""));
  const say = el("span", "tip-say"); say.setAttribute("role", "status"); say.setAttribute("aria-live", "polite"); say.hidden = true;
  const area = el("span", "tip-area"); area.hidden = true;
  wrap.append(btn, say, area);

  const tell = (msg) => { say.textContent = msg; say.hidden = !msg; };
  const done = (msg) => { tell(msg); if (typeof toast === "function") toast(msg); };
  let busy = false;

  btn.addEventListener("click", async () => {
    if (busy) return;
    busy = true; btn.setAttribute("aria-busy", "true"); area.replaceChildren(); area.hidden = true;
    tell(TIP_SAY.looking(who));
    let r;
    try { r = await findContact({ url, contact: src.contact }, { readText: deps.readText, ...(deps.pause ? { pause: deps.pause } : {}) }); } catch { r = { kind: "none" }; }
    try {
      if (r.kind === "email") {
        const d = tipDraft({ to: r.address, creator: src.creator, title: src.title, url });
        const a = el("a", "tip-link", "Open the email draft again");
        a.href = d.mailto; a.dataset.mailto = d.mailto; btn.dataset.mailto = d.mailto;
        area.append(a); area.hidden = false;
        a.click();                                  // the person's own mail app; nothing is sent until they send it
        done(TIP_SAY.email(r.address, r.where) + (contributor ? TIP_SAY.siteContact : ""));
      } else if (r.kind === "form") {
        const d = tipDraft({ creator: src.creator, title: src.title, url });
        btn.dataset.form = r.url;
        const link = el("a", "tip-link", "Open their contact page"); link.href = r.url; link.target = "_blank"; link.rel = "noopener noreferrer";
        area.append(link); area.hidden = false;
        let copied = false;
        try { await navigator.clipboard.writeText(d.body); copied = true; } catch { copied = false; }
        try { window.open(r.url, "_blank", "noopener,noreferrer"); } catch { /* the visible link above is the way */ }
        if (!copied) {
          const ta = el("textarea", "tip-copy"); ta.readOnly = true; ta.value = d.body; ta.rows = 6;
          ta.setAttribute("aria-label", "Your message, to copy"); area.append(ta); ta.focus(); ta.select();
        }
        done(copied ? TIP_SAY.form : TIP_SAY.formNoCopy);
      } else {
        done(TIP_SAY.none);
      }
    } catch { done(TIP_SAY.none); }
    busy = false; btn.removeAttribute("aria-busy");
  });
  return wrap;
}
