// fold-chat-tip.js — "Tip the creator": find how to reach the creator FROM THEIR OWN WEBSITE and draft the note.
//
// NOTHING IS PAID OR SENT. The Fold finds how the creator publishes a way to reach them, and either opens the
// person's own email app with a draft (mailto:) or, when the site publishes no address, points at the creator's own
// contact form with the draft copied. The person reads and sends it themselves.
//
// The rules, each enforced here and pinned by a test (fold-chat-tip.test.mjs):
//   1. NEVER guess or construct an address (no info@ / contact@ patterns). Only what the page — or the site's own
//      contact/about page — publishes (fold-chat-contact.js says what counts).
//   2. NO registry, WHOIS/RDAP, hosting-provider or IP-owner lookups. Only the creator's own site is read, only
//      because the person clicked, at most 1 + MAX_PAGES loads, politely paced, same site only.
//   3. Machinery mailboxes (abuse@, privacy@, legal@, noreply@ …) never qualify.
//   4. The address is used only to fill the draft on this machine. It is never logged, never put in a request, the
//      audit/outbound ledger or a trace; the card keeps it only on its own `contact`.
//   5. The app never sends mail and never opens anything without a click.
import { contactsFromHtml, isUsableEmail, hostBase, emailDomainOk } from "./fold-chat-contact.js";

export const TIP_LIMITS = Object.freeze({ maxMailto: 1800, maxTitle: 100, maxPages: 2, pauseMs: 1200 });

/** The words the draft says (from the person who asked for the feature; nearly verbatim). */
export const DRAFT_LINE = "I enjoyed your content I was served through the community driven AI-agent The Fold. I would like to give you a monetary tip because I found it valuable. Do you have a way I can send this to you?";

/** What the surface says after a click. One place, so the wording is the same on every card and a test can pin it. */
export const TIP_SAY = Object.freeze({
  looking: (who) => `Looking for a way to reach ${who}…`,
  email: (address, where) => `Opened an email draft to ${address} (found ${where}). Nothing is sent until you send it.`,
  form: "No public email. Opened their contact page; your message is copied — paste it there.",
  formNoCopy: "No public email. Opened their contact page; copy your message below and paste it there.",
  none: "Couldn't find a public contact for this creator. The original page is linked above.",
  siteContact: " This is the site's contact, not the individual's.",
});

// Marketplaces and user-contributed platforms: the credited name is a contributor, and the site's address is the
// platform's, not theirs. Declared, short; the giver is the 2026-10-05 allrecipes check ("Hi ELIZABETHBH!").
const PLATFORMS = /(^|\.)(allrecipes\.com|food\.com|cookpad\.com|instructables\.com|reddit\.com|youtube\.com|pinterest\.com|etsy\.com|amazon\.com|ebay\.com|wikihow\.com|quora\.com)$/i;
/** Is the page on a platform whose contributors are credited by handle? */
export const isPlatformSite = (url) => { try { return PLATFORMS.test(new URL(String(url)).hostname.replace(/^www\./, "")); } catch { return false; } };
/** Is this credit a contributor's username (ALLCAPS handle, digits, no space) rather than a person's name? */
export const looksLikeHandle = (c) => { const t = cleanText(c); return !!t && (!/\s/.test(t) || /[0-9_]/.test(t) || (t.length > 3 && t === t.toUpperCase() && /[A-Z]/.test(t))); };

const ORG_WORD = /\b(team|staff|editors?|editorial|kitchen|bakery|co|inc|llc|ltd|gmbh|news|magazine|media|studio|studios|network|press|the|foods?|recipes?|blog|publishing|company|group|association)\b/i;
const clip = (s, n) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length <= n ? t : t.slice(0, n - 1).trimEnd() + "…"; };
const cleanText = (s) => String(s ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim();

/** "Hi <first name>!" only for a person the PAGE named; an organisation, a site name or nothing gives a plain "Hi!". */
export function firstNameOf(creator) {
  const c = cleanText(creator);
  if (!c || looksLikeHandle(c) || c.length > 60 || ORG_WORD.test(c) || /[0-9@/:.]/.test(c) || /['\u2019]s\b/.test(c)) return "";   // a possessive is a brand ("Sally's Baking Addiction")
  const parts = c.split(" ");
  if (parts.length > 4) return "";
  const first = parts[0].replace(/[,;]+$/, "");
  return /^\p{Lu}[\p{L}'’-]{0,24}$/u.test(first) ? first : "";
}

const httpUrl = (u) => { try { const x = new URL(String(u)); return /^https?:$/.test(x.protocol) ? x : null; } catch { return null; } };
// An address that goes into mailto: must be one plain address: no list, no header-smuggling punctuation.
const plainAddress = (a) => { const t = String(a ?? "").trim(); return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test(t) && isUsableEmail(t) ? t : ""; };

/**
 * The draft. `to` is optional (a contact form has none). Returns { subject, body, mailto } — `mailto` is null without a
 * usable `to`. Percent-encoded; line breaks are %0D%0A (never raw); the whole URL is capped (titles are cut first,
 * then the link loses its query).
 */
export function tipDraft({ to = "", creator = "", title = "", url = "" } = {}) {   // a creator credited on a marketplace/UGC platform is a contributor: plain "Hi!"
  const addr = to ? plainAddress(to) : "";
  if (to && !addr) throw new Error("not a usable address");
  const page = httpUrl(url);
  const name = isPlatformSite(url) ? "" : firstNameOf(creator);
  const build = (t, link) => {
    const subject = t ? `A tip for "${t}"` : "A tip for your content";
    const lines = [`${name ? `Hi ${name}!` : "Hi!"} ${DRAFT_LINE}`, ""];
    if (t) lines.push(`“${t}”`);
    if (link) lines.push(link);
    if (t || link) lines.push("");
    lines.push("Thank you,", "");
    const body = lines.join("\n");
    const mailto = addr ? `mailto:${encodeURIComponent(addr).replace(/%40/g, "@")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body).replace(/%0A/g, "%0D%0A")}` : null;
    return { subject, body, mailto };
  };
  let t = clip(cleanText(title), TIP_LIMITS.maxTitle);
  let link = page ? page.href : "";
  let d = build(t, link);
  const tooLong = (x) => x.mailto && x.mailto.length > TIP_LIMITS.maxMailto;
  if (tooLong(d) && page) { link = page.origin + page.pathname; d = build(t, link); }
  while (tooLong(d) && t.length > 20) { t = clip(t, Math.max(20, Math.floor(t.length * 0.7))); d = build(t, link); }
  if (tooLong(d)) d = build("", link.length > 300 ? "" : link);
  return d;
}

const sameSite = (a, b) => { const x = hostBase(a), y = hostBase(b); return !!x && x === y; };
const viaWord = (where) => String(where || "").replace(/\bon the page\b/, "on their contact page");

// An address is accepted only if it is usable AND came from a place the page puts forward (see contactsFromHtml).
const PUBLISHED = /^(the page's structured data|a mailto link on|a protected email link on|written on)/;
const acceptAt = (e, site) => !!e && isUsableEmail(e.address) && PUBLISHED.test(String(e.where || "")) && emailDomainOk(e.address, site);

/** What a stored/passed `contact` or `contacts` says, as the raw found shape { emails, pages, forms }. */
function asFound(source) {
  const site = source && source.url;
  const accept = (e) => acceptAt(e, site);
  const c = source && source.contacts;
  if (c && typeof c === "object") return { emails: (c.emails || []).filter(accept), pages: c.pages || [], forms: c.forms || [] };
  const k = source && source.contact;
  if (k && typeof k === "object") {
    return { emails: k.kind === "email" && accept({ address: k.address, where: k.where }) ? [{ address: String(k.address).toLowerCase(), where: k.where, rank: 1 }] : [], pages: k.pages || [], forms: k.kind === "form" && k.url ? [k.url] : [] };
  }
  return null;
}

/**
 * How to reach a creator, from their own site only.
 *   source: { url, contacts?, contact? }   contacts/contact: what the page offered when it was read
 *   deps:   { readText(url) -> { ok, contacts? }, pause(ms) }   injected; readText is the app's page reader
 * Returns { kind:'email', address, where, tried } | { kind:'form', url, where, tried } | { kind:'none', tried }.
 * `tried` lists the page URLs loaded for this click (never an address).
 */
export async function findContact(source, { readText, pause = (ms) => new Promise((r) => setTimeout(r, ms)), maxPages = TIP_LIMITS.maxPages, pauseMs = TIP_LIMITS.pauseMs } = {}) {
  const url = String(source && source.url || "");
  const tried = [];
  const emails = [], forms = []; let pages = [];
  const take = (f, contactPage) => {
    if (!f) return;
    for (const e of f.emails || []) if (acceptAt(e, url) && !emails.some((x) => x.address === e.address)) emails.push({ address: String(e.address).toLowerCase(), where: contactPage ? viaWord(e.where) : e.where, rank: e.rank ?? 1 });
    for (const u of f.forms || []) if (httpUrl(u) && sameSite(u, url) && !forms.includes(u)) forms.push(u);
    for (const u of f.pages || []) if (httpUrl(u) && sameSite(u, url) && !pages.includes(u) && u.split(/[?#]/)[0] !== url.split(/[?#]/)[0]) pages.push(u);
  };
  const best = () => { const s = emails.slice().sort((a, b) => a.rank - b.rank); return s[0] ? { kind: "email", address: s[0].address, where: s[0].where, tried } : null; };
  let loads = 0;
  const load = async (u) => {
    if (loads++) await pause(pauseMs);       // polite: one at a time, a pause between
    tried.push(u);
    try { const rd = await readText(u); return rd && rd.ok ? rd : null; } catch { return null; }
  };

  // (a) what was captured when the page was read
  const known = asFound(source);
  take(known, false);
  if (best()) return best();
  // (b) nothing captured at all: read the page itself once (the person clicked); then the site's own contact/about pages
  if (!known && httpUrl(url)) {
    const rd = await load(url);
    if (rd && rd.contacts) take(rd.contacts, false);
    if (best()) return best();
  }
  let n = 0;
  for (const u of pages.slice()) {
    if (n >= maxPages) break;
    if (tried.includes(u)) continue;
    n++;
    const rd = await load(u);
    if (rd && rd.contacts) take(rd.contacts, true);
    if (best()) return best();
  }
  // (c) a message form of their own, (d) nothing
  if (forms.length) return { kind: "form", url: forms[0], where: "the site's contact form", tried };
  return { kind: "none", tried };
}

/** The part of a found contact the card keeps on its snip: kind, where, and the address only here (never elsewhere). */
export function contactOfPassage(p) {
  const c = p && p.contacts;
  if (!c || typeof c !== "object") return null;
  const e = (c.emails || []).find((x) => acceptAt(x, p.url || p.source));
  const pages = (c.pages || []).filter((u) => httpUrl(u) && sameSite(u, p.url || p.source)).slice(0, 3);
  if (e) return { kind: "email", address: String(e.address).toLowerCase(), where: e.where, ...(pages.length ? { pages } : {}) };
  const f = (c.forms || [])[0];
  if (f && httpUrl(f)) return { kind: "form", url: f, where: "the site's contact form", ...(pages.length ? { pages } : {}) };
  return pages.length ? { kind: "pages", where: "the site's contact page", pages } : null;
}

/** Read-time extraction, shared by fold-chat-web.js: keep it only when the page offered something. */
export function contactsOfRaw(raw, url) {
  try {
    const c = contactsFromHtml(raw, url);
    return c.emails.length || c.forms.length || c.pages.length ? c : null;
  } catch { return null; }
}
