// fold-blocks-make.js — the agent's make lane, the watchmaker's way. ONE small assembly at a time; the kernel checks it
// alone; a failure goes back to the model with the typed errors (twice at most), then is vetoed and said so.
// THE MODEL IS THE LEAF. The app lays out each assembly as a skeleton: the names, the types and every binding it can
// decide itself (which room a block reads, which field is the title). The model writes only the values after the `=`.
// A 2B model cannot reliably invent structure; it can fill a form. The frame (the app) is composed by the app alone.
import { BLOCKS, KINDS, FORMULAS } from "./fold-blocks.js";
import { createKernel, ingest } from "./fold-blocks-kernel.js";
import { editEOT } from "./fold-blocks-edit.js";
import { weaveAssembly } from "./fold-blocks-weave.js";

const LEGEND = `You fill in EOT, a tiny line format. You get a skeleton of lines. Copy every line in order, and after each "=" that has nothing after it, write a short value for the request.
Rules: no prose, no code fences, no comments. Keep lines that already have a value exactly as they are. Lists are comma separated. The last line is the !EVA line, copied as is. Write nothing after it.`;

const has = (ask, rx) => rx.test(String(ask || "").toLowerCase());
const rooms = (k) => k.names().filter((n) => n.type === "room");
const inputs = (k) => k.names().filter((n) => n.type === "input");

export const PLANS = Object.freeze({
  website: [
    { id: "look", goal: "the look: one theme", required: false,
      skeleton: () => `look : theme\nlook.accent = \nlook.font = \nlook.radius = \nlook.density = \n!EVA look`,
      hints: `accent: one #hex colour that suits the request (dark enough to read white text on)\nfont: sans, serif, mono or rounded\nradius: sharp, soft or round\ndensity: compact, cozy or airy`,
      example: `look : theme\nlook.accent = #b4532a\nlook.font = serif\nlook.radius = soft\nlook.density = airy\n!EVA look` },
    { id: "content", goal: "the things the site offers: three records", required: false,
      skeleton: () => `offer : room\noffer.schema.name = text\noffer.schema.price = text\noffer.schema.note = text\noffer.row = \noffer.row = \noffer.row = \n!EVA offer`,
      hints: `name: what is offered, two to five words, different for each record\nprice: its price exactly as the request states it; if the request gives none, write —\nnote: one short detail about it`,
      example: `offer : room\noffer.schema.name = text\noffer.schema.price = text\noffer.schema.note = text\noffer.row = Puncture repair | £12 | 20 minutes\noffer.row = Full service | £65 | ready next day\noffer.row = Brake tune | £25 | about an hour\n!EVA offer` },
    { id: "page", goal: "the page, top to bottom", required: true,
      skeleton: (k, ask) => {
        const room = rooms(k).find((r) => r.name === "offer");
        const form = has(ask, /\b(book|booking|contact|sign ?up|form|enquir|inquir|order|reserve|rsvp|register|subscribe|apply)/);
        const parts = [`top : nav\ntop.brand = \ntop.items = `, `intro : hero\nintro.title = \nintro.sub = \nintro.cta = \nintro.image = `];
        const names = ["top", "intro"];
        if (room) { parts.push(`list : cards\nlist.heading = \nlist.room = offer\nlist.title = name\nlist.sub = price\nlist.meta = note`); names.push("list"); }
        if (form) { parts.push(`book : form\nbook.title = \nbook.fields = \nbook.submit = `); names.push("book"); }
        parts.push(`end : footer\nend.text = `); names.push("end");
        return parts.join("\n") + `\n!EVA ${names.join(", ")}`;
      },
      hints: `brand: the name of the place\nitems: three menu words, comma separated\ntitle: one inviting sentence\nsub: one plain sentence of detail\ncta: two to four words on the main button\nimage: what photo belongs there, in a few words\nheading: a one or two word heading for the list\nfields: the form's fields, comma separated\nsubmit: the form button's words\nend.text: the name and a place, one line`,
      example: `top : nav\ntop.brand = Spoke & Chain\ntop.items = Repairs, Visit, Book\nintro : hero\nintro.title = Bikes fixed while you wait\nintro.sub = Same-day repairs in Leith, six days a week.\nintro.cta = Book a repair\nintro.image = the shop front\nlist : cards\nlist.heading = Repairs\nlist.room = offer\nlist.title = name\nlist.sub = price\nlist.meta = note\nbook : form\nbook.title = Book a repair\nbook.fields = Name, Email, Date, Bike\nbook.submit = Request a slot\nend : footer\nend.text = Spoke & Chain, 12 Leith Walk\n!EVA top, intro, list, book, end` },
  ],
  widget: [
    { id: "look", goal: "the look: one theme", required: false,
      skeleton: () => `look : theme\nlook.accent = \nlook.font = \nlook.radius = \n!EVA look`,
      hints: `accent: one #hex colour (dark enough for white text)\nfont: sans, serif, mono or rounded\nradius: sharp, soft or round`,
      example: `look : theme\nlook.accent = #1d4ed8\nlook.font = sans\nlook.radius = round\n!EVA look` },
    { id: "inputs", goal: "a title and the three numbers a person types in", required: true,
      skeleton: () => `title : heading\ntitle.text = \na : input\na.kind = number\na.name = \na.label = \na.value = \nb : input\nb.kind = number\nb.name = \nb.label = \nb.value = \nc : input\nc.kind = number\nc.name = \nc.label = \nc.value = \n!EVA title, a, b, c`,
      hints: `title.text: what the widget does, a few words\nname: ONE lowercase word with no spaces, used in formulas (like price or rate)\nlabel: what the person sees\nvalue: a sensible starting number (digits only)`,
      example: `title : heading\ntitle.text = Split the bill\na : input\na.kind = number\na.name = bill\na.label = Bill total (£)\na.value = 60\nb : input\nb.kind = number\nb.name = tip\nb.label = Tip (%)\nb.value = 12\nc : input\nc.kind = number\nc.name = people\nc.label = People\nc.value = 3\n!EVA title, a, b, c` },
    { id: "results", goal: "the answer: pick a formula from the catalog and give it the inputs (the app computes it)", required: true,
      skeleton: () => `out : result\nout.label = \nout.formula = \nout.args = \n!EVA out`,
      hints: (k) => `label: what the answer is\nformula: ONE name from this catalog:\n${Object.entries(FORMULAS).map(([n, f]) => `  ${n} (${f.params.join(", ")}): ${f.about}`).join("\n")}\nargs: the formula's values IN ORDER, comma separated. Each is one of these input names: ${inputs(k).map((x) => x.input).join(", ") || "(none)"}, or a plain number (like 25)`,
      example: `out : result\nout.label = Each person pays\nout.formula = split_bill\nout.args = bill, tip, people\n!EVA out` },
  ],
  document: [
    { id: "look", goal: "the look: one theme", required: false,
      skeleton: () => `look : theme\nlook.accent = \nlook.font = serif\nlook.density = cozy\n!EVA look`,
      hints: `accent: one #hex colour (dark enough to read on white)`,
      example: `look : theme\nlook.accent = #7c3aed\nlook.font = serif\nlook.density = cozy\n!EVA look` },
    { id: "body", goal: "the document: a title, an opening paragraph, and three short sections", required: true,
      skeleton: () => `t : heading\nt.level = 1\nt.text = \nintro : text\nintro.text = \nh1 : heading\nh1.text = \np1 : text\np1.text = \nh2 : heading\nh2.text = \np2 : text\np2.text = \nh3 : heading\nh3.text = \np3 : text\np3.text = \n!EVA t, intro, h1, p1, h2, p2, h3, p3`,
      hints: `headings: a few words each\ntexts: one to three plain sentences each, on one line. Do not invent statistics, sources or quotes.`,
      example: `t : heading\nt.level = 1\nt.text = Starting a community fridge\nintro : text\nintro.text = A community fridge lets neighbours share food that would otherwise go to waste.\nh1 : heading\nh1.text = Find a host\np1 : text\np1.text = You need a sheltered spot with a power socket and someone who can open it daily.\nh2 : heading\nh2.text = Set the rules\np2 : text\np2.text = Agree what can go in, and label everything with the date it arrived.\nh3 : heading\nh3.text = Keep it clean\np3 : text\np3.text = Share a cleaning rota and check the fridge every day.\n!EVA t, intro, h1, p1, h2, p2, h3, p3` },
  ],
});

/** Which kind an ask is, when the person did not say. Declared word lists; when unsure: website. */
export function guessKind(ask) {
  const q = String(ask || "").toLowerCase();
  if (/\b(calculator|calculate|converter|estimator|estimate|widget|counter|split|tip|loan|mortgage|budget|bmi|score|quiz|timer)\b/.test(q)) return "widget";
  if (/\b(report|document|doc|memo|essay|guide|handbook|brief|article|policy|plan|proposal|letter|notes|summary|write-?up)\b/.test(q)) return "document";
  return "website";
}

/** monologue(ask, {kind}) — the fold's INTERNAL THINKING, made visible: what it
 *  reads the ask as, how it would satisfy that, and whether the shape can
 *  POSSIBLY satisfy it (or whether the ask names a thing the shape cannot
 *  compute). Returns { kind, satisfiable, why, lines:[{say, why, bad}] }. Pure. */
export function monologue(ask, { kind = null } = {}) {
  const q = String(ask || "").toLowerCase();
  const words = [...new Set((q.match(/[a-z]+/g) || []))];
  const k = KINDS.includes(kind) ? kind : guessKind(ask);
  const lines = [];
  const matched = words.filter((w) => new RegExp(`\\b${w}\\b`).test(q)).slice(0, 8);
  lines.push({ say: `Reading the ask: “${String(ask).trim()}”.`, why: matched.length ? `words seen: ${matched.join(", ")}` : null });
  lines.push({ say: `I take it as a ${k}.`, why: k === "widget" ? "a small calculator-like thing" : k === "document" ? "a written document" : "a page of blocks" });
  const steps = (PLANS[k] || []).map((s) => s.goal);
  lines.push({ say: `To satisfy a ${k}, I must produce:`, why: steps.join("; ") });

  if (k === "widget") {
    const fnames = Object.keys(FORMULAS);
    lines.push({ say: `A widget computes exactly ONE formula from a fixed catalog.`, why: `the catalog: ${fnames.join(", ")}` });
    const wantsTimer = /\b(countdown|timer|stopwatch|clock)\b/.test(q);
    if (wantsTimer) {
      lines.push({ say: `A countdown timer is not in the catalog — nothing there counts down or ticks.`, bad: true });
      lines.push({ say: `So this CANNOT be satisfied as a widget. What would satisfy it: a timer block that decrements and shows the remaining time. That block is not built.`, bad: true });
      return { kind: k, satisfiable: false, why: "a countdown timer is not a catalog formula, and no timer block exists — a widget would have to borrow a wrong formula", lines };
    }
    const hit = fnames.filter((n) => q.includes(n.split("_")[0]));
    if (!hit.length) {
      lines.push({ say: `No catalog formula matches this ask by name. A widget could only borrow a wrong one.`, bad: true });
      return { kind: k, satisfiable: false, why: "no catalog formula matches the ask", lines };
    }
    lines.push({ say: `Closest catalog formula: ${hit[0]}. If the model picks anything else, it is filling the shape, not the ask.`, why: null });
    return { kind: k, satisfiable: true, why: null, lines };
  }
  if (k === "document") lines.push({ say: `A document is satisfied by its own writing: a title, an opening, three sections.`, why: "no formula; the words are the thing" });
  if (k === "website") lines.push({ say: `A website is satisfied by its offer: three records, one theme, the page top to bottom.`, why: "no formula; the blocks are the thing" });
  return { kind: k, satisfiable: true, why: null, lines };
}

function prompt(step, ask, kernel, i, total) {
  const hints = typeof step.hints === "function" ? step.hints(kernel) : step.hints;
  return [
    { role: "system", content: LEGEND },
    { role: "user", content: `Request: ${ask}\n\nAssembly ${i + 1} of ${total}: ${step.goal}.\n\nAn example, for a different request (copy the shape, not the words):\n${step.example}\n\nWhat to write after each "=":\n${hints}\n\nNow fill in this skeleton for the request:\n${step.skeleton(kernel, ask)}` },
  ];
}
const explain = (v) => v.errors.slice(0, 6).map((e) => `- ${e.msg}${e.fix ? ` (${e.fix})` : ""}`).join("\n");

/** Merge the model's answer into the app's skeleton. Only the VALUES of blank slots are taken (matched by name.prop, then
 *  by prop in order); every structural line stays the app's. What the model changed and was ignored is reported. */
export function fillSkeleton(skeleton, answer) {
  const DEF = /^\s*([A-Za-z_][\w-]*)((?:\.[A-Za-z_][\w-]*)+)\s*=\s*(.*?)\s*$/, INS = /^\s*([A-Za-z_][\w-]*)\s*:\s*([A-Za-z_][\w-]*)\s*$/;
  const typeOf = (src) => { const m = new Map(); for (const l of String(src).split("\n")) { const x = INS.exec(l); if (x) m.set(x[1], x[2].toLowerCase()); } return m; };
  const skT = typeOf(skeleton), anT = typeOf(answer);
  const byKey = new Map(), byTyped = new Map(), byTail = new Map(), used = new Set(), ignored = [];
  const push = (map, k, i) => (map.get(k) || map.set(k, []).get(k)).push(i);
  const lines = String(answer || "").split("\n");
  lines.forEach((l, i) => { const m = DEF.exec(l); if (!m || !m[3]) return; push(byKey, m[1] + m[2], i); push(byTail, m[2], i); if (anT.has(m[1])) push(byTyped, anT.get(m[1]) + m[2], i); });
  const take = (q) => { while (q && q.length) { const i = q.shift(); if (!used.has(i)) { used.add(i); return DEF.exec(lines[i])[3]; } } return null; };
  let filled = 0, missing = 0;
  const out = String(skeleton).split("\n").map((l) => {
    const m = DEF.exec(l); if (!m || m[3]) return l;
    const typed = skT.get(m[1]) + m[2];
    const v = take(byKey.get(m[1] + m[2])) ?? (anT.size ? take(byTyped.get(typed)) : take(byTail.get(m[2])));
    if (v == null || v === "") { missing++; return l; }
    filled++; return `${m[1]}${m[2]} = ${v}`;
  });
  lines.forEach((l, i) => { const t = l.trim(); if (t && !used.has(i) && !/^!EVA\b/i.test(t) && !String(skeleton).split("\n").some((s) => s.trim() === t)) ignored.push(t); });
  return { text: out.join("\n"), filled, missing, ignored };
}

/** A catalog formula names a value no input provides: adding that input is structure, so the APP does it (its own
 *  checkpointed assembly). The starting value is read from the request only when the request states it ("over 25 years"). */
export function supplyInputs(kernel, text, ask) {
  const f = /\.formula\s*=\s*([a-z_]+)/i.exec(text), a = /\.args\s*=\s*(.+)/i.exec(text);
  if (!f || !a || !FORMULAS[f[1].toLowerCase()]) return null;
  const F = FORMULAS[f[1].toLowerCase()];
  const args = a[1].split(/\s*,\s*/).map((x) => x.trim()).filter(Boolean);
  const have = new Set(inputs(kernel).map((x) => x.input));
  const missing = args.map((x, i) => ({ name: x, param: F.params[i] })).filter((x) => x.param && /^[A-Za-z_]\w*$/.test(x.name) && !have.has(x.name));
  if (!missing.length) return null;
  const lines = [], names = [], said = [];
  missing.forEach((m, j) => {
    const id = `auto_${m.name}`.slice(0, 32);
    const word = m.name.replace(/_/g, " ");
    const num = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*%?\\s*(?:-\\s*)?${word.split(" ")[0]}`, "i").exec(String(ask || ""));
    lines.push(`${id} : input`, `${id}.kind = number`, `${id}.name = ${m.name}`, `${id}.label = ${m.param[0].toUpperCase() + m.param.slice(1)}`);
    if (num) { lines.push(`${id}.value = ${num[1]}`); said.push(`${m.name} = ${num[1]} (from your request)`); } else said.push(`${m.name} (no value in the request; set it in the widget)`);
    names.push(id);
  });
  const t = lines.join("\n") + `\n!EVA ${names.join(", ")}`;
  const v = kernel.submit(t, { by: "app", label: "supplied inputs" });
  return v.ok ? { text: t, note: `the formula needs ${missing.map((m) => m.name).join(", ")}, which no input gave, so the app added ${missing.length > 1 ? "them" : "it"}: ${said.join("; ")}` } : null;
}

/** The frame: the app places what passed, in order. Composed by the app, checked by the kernel like everything else. */
export function frameOf(kernel, kind, ask) {
  const st = kernel.state();
  const placed = new Set(Object.values(st.entities).flatMap((e) => (BLOCKS[e.type]?.container ? String(e.raw.children || "").split(/\s*,\s*/).filter(Boolean) : [])));
  const blocks = st.order.filter((n) => { const e = st.entities[n]; return e.committed && BLOCKS[e.type] && !BLOCKS[e.type].ambient && !placed.has(n); });
  if (!blocks.length) return null;
  const titled = blocks.map((n) => st.entities[n]).find((e) => e.type === "nav" || e.type === "hero" || e.type === "heading");
  const title = String(titled?.props.brand || titled?.props.title || titled?.props.text || ask).slice(0, 80).replace(/\n/g, " ");
  return `app : app\napp.kind = ${kind}\napp.title = ${title}\napp.blocks = ${blocks.join(", ")}\n!EVA app`;
}

/* ---------------- follow-ups: a change to what stands, as one more assembly ---------------- */
const ADDABLE = Object.freeze({ card: /\bcards?\b/, steps: /\bsteps?\b|\bhow it works\b|\bprocess\b/, quote: /\bquote|testimonial/, text: /\bparagraph|\btext\b|\bsection\b/, heading: /\bheading|\btitle\b/, button: /\bbutton|\blink\b/, slot: /\bimage|\bphoto|\bpicture/, stat: /\bstat|\bfigure|\bnumber\b/ });
const WORDS = Object.freeze({ nav: /\bnav|\bmenu\b|\bbrand\b|\bname of\b/, hero: /\bhero\b|\bheadline\b|\btagline\b|\bintro\b|\bopening\b|\bbutton text\b|\bcta\b/, cards: /\bcards?\b|\bprices?\b|\bclasses\b|\blist\b/, form: /\bform\b|\bfields?\b|\bbooking\b/, footer: /\bfooter\b|\baddress\b/, result: /\bresult\b|\banswer\b|\bformula\b/, heading: /\btitle\b|\bheading\b/, theme: /\bcolou?rs?\b|\bfont\b|\blook\b|\bdarker\b|\blighter\b|\bwarmer\b|\bcooler\b|\brounder\b|\bspacing\b|\btheme\b|\baccent\b/ });
const bindingProp = (t) => /^(blocks|room|field|fields)\??$/.test(t);

/** Which standing part a follow-up is about: the one the person pointed at, else declared words, else the model picks
 *  ONE name from the list (a constrained choice, checked). */
export async function targetOf(kernel, request, { target = null, complete = null, signal = null } = {}) {
  const parts = kernel.names().filter((n) => BLOCKS[n.type] && n.type !== "app");
  if (target && parts.some((p) => p.name === target)) return { name: target, how: "you pointed at it" };
  const q = String(request || "").toLowerCase();
  for (const [type, rx] of Object.entries(WORDS)) { if (!rx.test(q)) continue; const p = parts.find((x) => x.type === type); if (p) return { name: p.name, how: `the request mentions the ${type}` }; }
  if (!complete) return null;
  const list = parts.map((p) => `${p.name} (${p.type})`).join(", ");
  const out = await complete([{ role: "system", content: "Answer with ONE name from the list, and nothing else." }, { role: "user", content: `Parts: ${list}\nChange requested: ${request}\nWhich part should change? One name:` }], { maxTokens: 12, signal });
  const pick = parts.find((p) => new RegExp(`\\b${p.name}\\b`, "i").test(String(out)));
  return pick ? { name: pick.name, how: "the model chose it from the list" } : null;
}

/**
 * followUp(kernel, request, { complete, target, onEvent, signal })
 * Either ADDS one block (the app writes the structure, the model the values, the app re-frames with !REC) or CHANGES one
 * standing part (the part's current lines are the skeleton; the model writes new values; only what changed is written).
 */
export async function followUp(kernel, request, { complete, target = null, onEvent = () => {}, signal = null, retries = 2, maxTokens = 360 } = {}) {
  const app = kernel.names().find((n) => n.type === "app");
  const st = kernel.state();
  const q = String(request || "").toLowerCase();
  // THE BOX OWNS LITERAL EDITS: 'change "X" to "Y"', '"X" → "Y"', 'replace X with Y'. The words are the person's; no mouth is asked.
  const lit = /["“']([^"”']+)["”']\s*(?:to|with|into|→|->)\s*["“']([^"”']+)["”']/i.exec(request) || /\b(?:replace|swap|rename)\s+(\S+)\s+(?:with|to|for)\s+(\S+)/i.exec(request);
  if (lit) {
    const [, from, to] = lit;
    const esc = from.replace(/[.*+?^${}()|[\]\\]/g, (ch) => "\\" + ch);
    const has = (s) => new RegExp(esc, "i").test(String(s));
    const swap = (s) => String(s).replace(new RegExp(esc, "gi"), (mm) => (mm === mm.toUpperCase() && mm !== mm.toLowerCase() ? to.toUpperCase() : mm[0] !== mm[0].toLowerCase() ? to[0].toUpperCase() + to.slice(1) : to));
    const fwd = [], back = [], touched = new Set();
    for (const n of target ? [target] : st.order) {
      const e = st.entities[n]; if (!e?.committed) continue;
      if (BLOCKS[e.type]) for (const [k, v] of Object.entries(e.raw)) { if (bindingProp(BLOCKS[e.type].props[k] || "") || !has(v)) continue; fwd.push(`${n}.${k} = ${swap(v)}`); back.push(`${n}.${k} = ${v}`); touched.add(n); }
      if (e.type === "room" && e.rows.some((r) => r.values.some(has))) { fwd.push(`${n}.rows = ~`, ...e.rows.map((r) => `${n}.row = ${r.values.map(swap).join(" | ")}`)); back.push(`${n}.rows = ~`, ...e.rows.map((r) => `${n}.row = ${r.values.join(" | ")}`)); touched.add(n); }
    }
    const how = "a literal replacement is box-owned: no model was asked";
    if (!fwd.length) return { ok: false, mode: "replace", how, why: `"${from}" does not appear in ${target ? "part " + target : "the artifact"}` };
    const eva = `\n!EVA ${[...touched].join(", ")}`;
    onEvent({ type: "target", mode: "replace", name: [...touched].join(", "), how });
    const text = fwd.join("\n") + eva;
    const v = kernel.submit(text, { by: "app", label: `replace "${from}" → "${to}"` });
    const att = { by: "app", raw: "", text, ok: v.ok, errors: v.errors, notes: v.notes, ms: 0, inverse: v.ok ? back.join("\n") + eva : null };
    onEvent({ type: "verdict", attempt: 0, ...att, model: kernel.model() });
    return v.ok ? { ok: true, mode: "replace", name: [...touched].join(", "), how, text, inverse: att.inverse, attempts: [att], model: kernel.model() } : { ok: false, mode: "replace", how, attempts: [att], why: v.errors.map((x) => x.msg).join("; ") };
  }
  const addType = /\b(add|include|insert|put in|another|new)\b/.test(q) ? Object.keys(ADDABLE).find((t) => ADDABLE[t].test(q)) : null;
  let skeleton, name, how, mode;
  if (addType) {
    mode = "add"; name = `${addType}_${Object.keys(st.entities).length}`; how = `the request asks to add a ${addType}`;
    skeleton = `${name} : ${addType}\n` + Object.entries(BLOCKS[addType].props).filter(([, t]) => !bindingProp(t)).map(([k]) => `${name}.${k} = `).join("\n") + `\n!EVA ${name}`;
  } else {
    const t = await targetOf(kernel, request, { target, complete, signal });
    if (!t) return { ok: false, why: "no part of the artifact matches the request; point at the part to change" };
    mode = "change"; name = t.name; how = t.how;
    const e = st.entities[name];
    // only the properties the request names are units; the rest stand as they are
    const SYN = { title: /\btitle|headline|heading\b/, sub: /\bsub(title|heading)?\b|tagline|subline/, cta: /\bbutton|\bcta\b|call to action/, items: /\bmenu|\bitems|\blinks\b/, brand: /\bbrand|\bname\b/, text: /\btext|paragraph|wording|copy\b/, label: /\blabel/, fields: /\bfields?\b/, submit: /\bsubmit|send button/, image: /\bimage|photo|picture/, accent: /\bcolou?r|accent/, font: /\bfont|typeface/, radius: /\bcorners?|round/, density: /\bspacing|density|airy|compact/ };
    const all = Object.entries(BLOCKS[e.type].props).filter(([, ty]) => !bindingProp(ty)).map(([k]) => k);
    const named = all.filter((k) => (SYN[k] || new RegExp(`\\b${k}\\b`)).test(q));
    skeleton = (named.length ? named : all).map((k) => `${name}.${k} = `).join("\n") + `\n!EVA ${name}`;
  }
  onEvent({ type: "target", mode, name, how });
  const e = st.entities[name];
  const now = e ? Object.entries(e.raw).filter(([k]) => !bindingProp(BLOCKS[e.type].props[k] || "")).map(([k, v]) => `${name}.${k} = ${v}`).join("\n") : "";
  const def = BLOCKS[mode === "add" ? addType : e.type];
  const props = Object.entries(def.props).filter(([, t]) => !bindingProp(t)).map(([k, t]) => `${k}: ${t.replace(/\?$/, " (optional)").replace(/^choice:/, "one of ").replace(/\|/g, ", ")}`).join("\n");
  const user = `The artifact: ${app ? st.entities[app.name].props.title || "" : ""} (${st.entities[app?.name]?.props.kind || "website"}).\nRequested change: ${request}\n\n${mode === "add" ? `Write a new ${addType}: ${def.about}.` : `The ${e.type} "${name}" now reads:\n${now}\n\nWrite its new values. Leave a line empty to keep it as it is.`}\nWhat each value is:\n${props}\n\nFill in:\n${skeleton}`;
  let messages = [{ role: "system", content: LEGEND }, { role: "user", content: user }];
  const attempts = [];
  for (let a = 0; a <= retries; a++) {
    if (signal?.aborted) break;
    const t0 = Date.now();
    const raw = await complete(messages, { maxTokens, signal, onToken: (tok) => onEvent({ type: "token", attempt: a, text: tok }) });
    const fill = fillSkeleton(skeleton, ingest(raw).text);
    let text, inverse = null;
    if (mode === "add") text = fill.text.split("\n").filter((l) => !/=\s*$/.test(l)).join("\n");
    else {
      const vals = {}; for (const l of fill.text.split("\n")) { const m = /^[\w-]+\.([\w-]+)\s*=\s*(.+)$/.exec(l); if (m) vals[m[1]] = m[2]; }
      const ed = editEOT(kernel, name, vals);
      if (!ed) { attempts.push({ raw, text: "", ok: false, errors: [{ code: "no-change", msg: "the model wrote no new values", fix: "" }], ms: Date.now() - t0 }); onEvent({ type: "verdict", attempt: a, ...attempts[a] }); messages = [...messages, { role: "assistant", content: raw }, { role: "user", content: `That repeats what it says now. Write a DIFFERENT value that makes this change: ${request}\n${skeleton}` }]; continue; }
      text = ed.text; inverse = ed.inverse;
    }
    const v = kernel.submit(text, { by: "model", label: `follow-up: ${request.slice(0, 60)}` });
    attempts.push({ raw, text, ok: v.ok, errors: v.errors, notes: v.notes, ms: Date.now() - t0, inverse });
    onEvent({ type: "verdict", attempt: a, ...attempts[a], model: kernel.model() });
    if (v.ok) {
      let frame = null;
      if (mode === "add" && app) {
        const blocks = [...(st.entities[app.name].props.blocks || [])];
        const at = blocks.findIndex((b) => st.entities[b]?.type === "footer");
        blocks.splice(at < 0 ? blocks.length : at, 0, name);
        frame = `!REC ${app.name}.blocks = ${blocks.join(", ")}\n!EVA ${app.name}`;
        const fv = kernel.submit(frame, { by: "app", label: `place ${name}` });
        onEvent({ type: "frame", text: frame, ok: fv.ok, errors: fv.errors, model: kernel.model() });
        inverse = `!REC ${app.name}.blocks = ${(st.entities[app.name].props.blocks || []).join(", ")}\n!EVA ${app.name}`;
      }
      return { ok: true, mode, name, how, text, frame, inverse, attempts, model: kernel.model() };
    }
    messages = [...messages, { role: "assistant", content: raw }, { role: "user", content: `The checkpoint rejected it:\n${explain(v)}\n\nFill in again:\n${skeleton}` }];
  }
  return { ok: false, mode, name, how, attempts, why: "the change could not be built as asked" };
}

/**
 * make(ask, { kind, complete, onEvent, signal, retries })
 *   complete(messages, { maxTokens, signal, onToken }) → Promise<string>   (any model; the in-tab one in practice)
 *   onEvent(e): { type: 'plan'|'start'|'token'|'verdict'|'veto'|'stopped'|'frame'|'done', … }
 * Returns { ok, kind, kernel, model, steps, frame }.
 */
export async function make(ask, { kind = null, complete, onEvent = () => {}, signal = null, memory = null } = {}) {
  kind = KINDS.includes(kind) ? kind : guessKind(ask);
  const plan = PLANS[kind];
  const kernel = createKernel();
  const steps = plan.map((s) => ({ id: s.id, goal: s.goal, status: "waiting", attempts: [] }));
  onEvent({ type: "plan", kind, steps: steps.map((s) => ({ ...s })) });
  for (let i = 0; i < plan.length; i++) {
    if (signal?.aborted) break;
    const step = plan[i], rec = steps[i];
    rec.status = "running"; onEvent({ type: "start", i, id: step.id });
    const hints = typeof step.hints === "function" ? step.hints(kernel) : step.hints;
    const t0 = Date.now();
    const notes = [];
    const ser = (r) => ({ key: r.key, value: r.value, by: r.by, address: r.address || null, attempts: r.attempts });
    let w;
    try {
      w = await weaveAssembly({ skeleton: step.skeleton(kernel, ask), hints, ask, kind, kernel, complete, memory, signal, label: step.id,
        onUnit: (r) => onEvent({ type: "unit", i, ...ser(r) }),
        beforeSubmit: (text) => { const added = supplyInputs(kernel, text, ask); if (added) { notes.push(added.note); onEvent({ type: "supplied", i, ...added, model: kernel.model() }); } } });
    } catch (e) { if (!signal?.aborted) { rec.attempts.push({ ok: false, errors: [{ code: "model", msg: String(e?.message || e), fix: "" }], ms: Date.now() - t0 }); onEvent({ type: "verdict", i, ok: false, errors: rec.attempts[0].errors }); } w = null; }
    if (w) {
      if (w.dropped.length) notes.push(`set down without ${w.dropped.join(", ")}: ${w.dropped.length > 1 ? "they" : "it"} could not be built as asked`);
      rec.units = w.units.map(ser);
      rec.attempts.push({ ok: w.ok, text: w.text, errors: w.verdict?.errors || [], notes: [...notes, ...(w.verdict?.notes || [])], ms: Date.now() - t0, draws: w.units.reduce((n, u) => n + u.attempts.length, 0) });
      onEvent({ type: "verdict", i, ok: w.ok, text: w.text, errors: w.verdict?.errors || [], notes: rec.attempts[rec.attempts.length - 1].notes, units: rec.units, model: kernel.model() });
      if (w.ok) rec.status = "passed";
    }
    if (rec.status !== "passed") {
      rec.status = signal?.aborted ? "stopped" : "vetoed";
      onEvent({ type: rec.status === "stopped" ? "stopped" : "veto", i, id: step.id, required: step.required });
      if (rec.status === "stopped" || step.required) break;
    }
  }
  let frame = null;
  if (!signal?.aborted) {
    const text = frameOf(kernel, kind, ask);
    if (text) { const v = kernel.submit(text, { by: "app", label: "frame" }); frame = { text, ok: v.ok, errors: v.errors, notes: v.notes }; onEvent({ type: "frame", ...frame, model: kernel.model() }); }
  }
  const ok = !!frame?.ok && steps.every((s, j) => s.status === "passed" || !plan[j].required);
  const out = { ok, kind, kernel, model: kernel.model(), steps, frame };
  onEvent({ type: "done", ok, kind, steps, model: out.model });
  return out;
}
