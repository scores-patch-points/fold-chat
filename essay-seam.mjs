// The Fold essay seam: one addressed reading enters Janus; Penelope seals only what it can verify.
// Pure, model-free functions. The caller supplies Khora's reader and Janus's kind inducer.
//
// 2026-10-10 — the claim seam. `sealEssayDraft` used to certify QUOTATIONS ONLY
// (`claimsVerified:false`): a mouth could phrase fluent prose and every byte of
// it rode on a citation, claim by claim unchecked — the transfer function's
// "coherence, never correspondence" hole. Now the caller may also hand the seal
// the bound EDGES a read produced and the mouth's own read of its prose
// (`verifyDraftClaims`), and a draft whose every claim sits on a bound edge
// SEALS at claim scope. The mouth's prose is read by the SAME Khora reader that
// read the material, so a claim's referents are the same beings the edges were
// bound to — agreement by construction, not by a second parser.

import { locateSentences } from '../khora/native/the-fold/source-address.mjs';
import { NEGATION_WORDS, SUBJECT_PRONOUNS, AUXILIARY_VERBS } from '../khora/native/adapters/text/priors.js';
export { locateSentences } from '../khora/native/the-fold/source-address.mjs';

export const ESSAY_SEAM_SCHEMA = 'EssaySeam@1';
export const CLAIM_SEAM_SCHEMA = 'ClaimSeam@1';

const normalize = (x) => x == null ? null : String(x).trim().toLowerCase() || null;
// THE RECEIVED CLOSED CLASSES (priors.js, giver lang/en) — never a hand-typed
// list. The English seam admits a negation contraction ("can't") or an auxiliary
// ("was") as a sub/object head, so the raw box carries "beings" like `don’t` and
// `can't`, and hands the mouth material no one can compose from. A BEING is a
// letter-word that is not a negation, a person-pronoun, or an auxiliary — the
// same refusal the reader's own third-person doctrine states, applied to the box
// the mouth is handed (Gary's job: a clean input, not a censored output).
const straight = (w) => String(w).toLowerCase().replace(/[’‘]/g, "'");
// The third-person doctrine's own closed class (giver lang/en): first- and
// second-person postures of address, contractions included — "you"/"I" are who
// is addressed, never who the text does things to or by; a being never is one.
const POSTURES = new Set("i me my mine you your yours he him his she her hers we us our ours they them their theirs it its i'll i've i'm i'd you'll you've you're you'd we'll we've we're we'd they'll they've they're they'd he'll he's he'd she'll she's she'd it's it'll it'd that's what's who's".split(" "));
const CLOSED = new Set([...NEGATION_WORDS, ...SUBJECT_PRONOUNS, ...AUXILIARY_VERBS, ...POSTURES].map(straight));
export const isBeing = (x) => !!x && /^[\p{L}][\p{L}'’-]*$/u.test(String(x)) && !CLOSED.has(straight(x));
/** Drop edges whose subject or object is not a being, or whose act is an
 * auxiliary — the box the mouth composes from. Pure; edges in, edges out. */
export function cleanEdges(edges = []) {
  return (Array.isArray(edges) ? edges : []).filter((e) => e && isBeing(e.s) && isBeing(e.v) && (!e.o || isBeing(e.o)));
}
// Straighten the curly apostrophes a literary mouth emits before the received
// class is consulted (NEGATION_WORDS carries the orthographic contractions).
const NEG_TOKENS = new Set([...NEGATION_WORDS].map((w) => w.replace(/[’‘]/g, "'")));
const negated = (sentence) => {
  if (typeof sentence !== 'string') return false;
  for (const m of sentence.toLowerCase().matchAll(/[\p{L}]+(?:['’‘][\p{L}]+)*/gu)) {
    if (NEG_TOKENS.has(m[0].replace(/[’‘]/g, "'"))) return true;
  }
  return false;
};

/** NAME SIGNALS — mid-sentence capitalized tokens (proper beings recur in name
 * form). NEVER the only signal (the case-free law forbids a capital gate): the
 * name signal corroborates recurrence + company. Sentence-initial capitals and
 * dialogue-line capitals are stripped first, so only true mid-prose names land. */
export function nameSignals(sourceText) {
  const body = String(sourceText ?? "").replace(/(?:^|[.!?…—])\s+(?:["“'’])?[A-Z]*/gu, " ⟦ ");
  const out = new Set();
  for (const m of body.matchAll(/\b[A-Z][\p{L}'’]*\b/gu)) {
    const w = m[0].toLowerCase();
    if (w.length >= 3) out.add(w);
  }
  return out;
}

/** SCREEN the box's beings (identity-at-a-point, mechanically). A subject is a
 * being the telling may speak when it is a NAME (mid-sentence signal), or it
 * folds a WIDE company (>= 8 others — the protagonists), or it both participates
 * (appears as a patient somewhere) and keeps a modest company (>= 3). A miseated
 * scene-word like `face` (company 4, never a name, never a patient) is dropped;
 * a city like `petersburg` (a name AND a patient) stays — it is a real entity.
 * Pure; the source is only for the name signal. */
export function screenBeings(edges, { sourceText = null } = {}) {
  const sig = sourceText ? nameSignals(sourceText) : new Set();
  const company = new Map();
  const patient = new Set();
  for (const e of edges || []) {
    for (const x of [e.s, e.o]) {
      if (!x) continue;
      if (!company.has(x)) company.set(x, new Set());
      for (const y of [e.s, e.o]) if (y && y !== x) { company.get(x).add(y); company.get(y)?.add(x); }
    }
    if (e.o) patient.add(e.o);
  }
  const eligible = (x) => !!x && (sig.has(x) || (company.get(x)?.size ?? 0) >= 8 || ((company.get(x)?.size ?? 0) >= 3 && patient.has(x)));
  return (edges || []).filter((e) => eligible(e.s));
}

/** Keep the scene's declared corpus extent visible. Do not pretend an 80K-char
 * experiment has read a whole book. Return only evidenced events and Janus vectors. */
export function essayBoxFromRead({ sourceText, sourceFile, sourceId = sourceFile, excerptStart = 0, excerpt, read, induceKinds, topic = '' } = {}) {
  if (typeof sourceText !== 'string' || typeof excerpt !== 'string' || !sourceFile || !read || typeof induceKinds !== 'function') throw new TypeError('essayBoxFromRead: source, excerpt, reader, and kind inducer required');
  if (sourceText.slice(excerptStart, excerptStart + excerpt.length) !== excerpt) throw new TypeError('essayBoxFromRead: excerpt is not at declared source position');
  const { found, gaps } = locateSentences(sourceText, excerptStart, read.sents ?? [], { endChar: excerptStart + excerpt.length });
  const cast = new Map();
  const company = new Map();
  const events = [];
  const edges = [];
  for (const c of read.clauses ?? []) {
    const witness = found.get(c.order);
    if (!witness) continue;
    const s = normalize(typeof read.subjectRefOf === 'function' ? read.subjectRefOf(c) : c.subject?.head);
    const o = normalize(typeof read.objectRefOf === 'function' ? read.objectRefOf(c) : c.object?.head);
    const v = normalize(c.verb);
    if (!s || !v) continue;
    // Only a real being may enter the box the mouth draws on: no negation
    // contraction, pronoun, or auxiliary masquerading as an entity.
    if (!isBeing(s) || !isBeing(v) || (o && !isBeing(o))) continue;
    // The BOUND EDGES — every witnessed (s,v,o) the material's own reading
    // holds, the ground a draft claim is checked against. `at` is the byte
    // the act was witnessed at, so a claim can name where it is answered.
    edges.push({ s, v, o: o ?? null, at: witness.byteAt, delta: Number(c.learning ?? 0) });
    cast.set(s, (cast.get(s) ?? 0) + 1);
    if (o && o !== s) {
      if (!company.has(s)) company.set(s, new Map());
      if (!company.has(o)) company.set(o, new Map());
      company.get(s).set(o, (company.get(s).get(o) ?? 0) + 1);
      company.get(o).set(s, (company.get(o).get(s) ?? 0) + 1);
    }
    events.push({ s, v, o, at: witness.byteAt, span: [witness.byteAt, witness.byteEnd], delta: Number(c.learning ?? 0) });
  }
  const topCast = [...cast].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 14).map(([name]) => name);
  const deeds = new Map();
  for (const e of events) deeds.set(e.v, (deeds.get(e.v) ?? 0) + 1);
  const vecs = [...new Set([...cast.keys(), ...company.keys()])].map((ref) => {
    const neighbors = company.get(ref) ?? new Map();
    return { ref, names: [...neighbors.keys()], company: Object.fromEntries(neighbors), total: [...neighbors.values()].reduce((n, v) => n + v, 0) };
  });
  const induced = induceKinds(vecs);
  const kinds = induced.map((kind, i) => ({ id: i, members: kind.members, standing: 'candidate',
    falsifiers: { shuffledCompany: 'not-run', frequencyBand: 'not-run' } }));
  const floor = Number(read.THR ?? 0);
  const salient = events.filter((e) => e.o && e.delta >= floor).slice(0, 14);
  return {
    schema: ESSAY_SEAM_SCHEMA, topic, cast: topCast, deeds: [...deeds].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([verb]) => verb),
    kinds,
    hunt: salient.map((e) => ({ s: e.s, v: e.v, o: e.o, at: e.at, marker: `⟦${sourceId}@${e.at}⟧` })),
    edges,
    events: events.length, source: sourceId, sourceBytes: Buffer.byteLength(sourceText, 'utf8'),
    readBytes: Buffer.byteLength(excerpt, 'utf8'), partial: excerptStart !== 0 || excerptStart + excerpt.length < sourceText.length,
    gaps,
  };
}

/** The material's BOUND EDGES, each at its own source byte — the ground a draft
 * claim is checked against. The caller supplies the read, exactly as it does
 * for the box; this is pure and model-free. */
export function boundEdgesFromRead({ sourceText, excerptStart = 0, excerpt, read } = {}) {
  if (typeof sourceText !== 'string' || typeof excerpt !== 'string' || !read) throw new TypeError('boundEdgesFromRead: source, excerpt, and reader required');
  if (sourceText.slice(excerptStart, excerptStart + excerpt.length) !== excerpt) throw new TypeError('boundEdgesFromRead: excerpt is not at declared source position');
  const { found } = locateSentences(sourceText, excerptStart, read.sents ?? [], { endChar: excerptStart + excerpt.length });
  const edges = [];
  for (const c of read.clauses ?? []) {
    const witness = found.get(c.order);
    if (!witness) continue;
    const s = normalize(typeof read.subjectRefOf === 'function' ? read.subjectRefOf(c) : c.subject?.head);
    const v = normalize(c.verb);
    const o = normalize(typeof read.objectRefOf === 'function' ? read.objectRefOf(c) : c.object?.head);
    if (!s || !v) continue;
    if (!isBeing(s) || !isBeing(v) || (o && !isBeing(o))) continue;
    edges.push({ s, v, o: o ?? null, at: witness.byteAt, delta: Number(c.learning ?? 0) });
  }
  return edges;
}

/** Map<byteAddress, sentenceText> for the read — the byte-trace witnesses a
 * wandered/quoted sentence may be verified against (Tarski convention-T). */
export function sentenceWitnesses({ sourceText, excerptStart = 0, excerpt, read } = {}) {
  if (typeof sourceText !== 'string' || typeof excerpt !== 'string' || !read) throw new TypeError('sentenceWitnesses: source, excerpt, and reader required');
  if (sourceText.slice(excerptStart, excerptStart + excerpt.length) !== excerpt) throw new TypeError('sentenceWitnesses: excerpt is not at declared source position');
  const { found } = locateSentences(sourceText, excerptStart, read.sents ?? [], { endChar: excerptStart + excerpt.length });
  const out = new Map();
  for (const s of read.sents ?? []) {
    const w = found.get(s.order);
    if (w && typeof s.text === 'string') out.set(w.byteAt, s.text);
  }
  return out;
}

/** Assertion-level grounding for a draft. The caller supplies the mouth's own
 * prose, read by the SAME Khora reader that read the material (so a claim's
 * referents are the same beings the edges bound — agreement by construction,
 * not by a second parser), plus the material's bound edges. Every clause is
 * judged: a claim whose (subject, verb, object) sits on a bound edge is
 * `bound`; a claim the material never makes is `unbound`; a claim using a verb
 * the material never measured is `unheard`; a NEGATED claim that otherwise
 * matches a positive edge is `contradicted` — the English seam attests verbs
 * and referents but not polarity, so a negation is refused rather than bound
 * (the false guarantee falsify-mouth measured). No move is invented; every
 * verdict is disclosed. */
export function verifyDraftClaims({ read, edges = [], text = '' } = {}) {
  if (!read || !Array.isArray(read.clauses)) throw new TypeError('verifyDraftClaims: a draft read is required');
  const edgeBySVO = new Set();
  const edgeBySV = new Set();
  const verbs = new Set();
  for (const e of edges) {
    if (!e || !e.s || !e.v) continue;
    edgeBySVO.add(`${e.s}\x00${e.v}\x00${e.o ?? ''}`);
    edgeBySV.add(`${e.s}\x00${e.v}`);
    verbs.add(e.v);
  }
  const claims = [];
  for (const c of read.clauses ?? []) {
    const s = normalize(typeof read.subjectRefOf === 'function' ? read.subjectRefOf(c) : c.subject?.head);
    const v = normalize(c.verb);
    const o = normalize(typeof read.objectRefOf === 'function' ? read.objectRefOf(c) : c.object?.head);
    const sentence = typeof c.sent === 'string' ? c.sent
      : (Array.isArray(c.span) && typeof text === 'string' ? text.slice(c.span[0], c.span[1]) : '');
    const isNeg = negated(sentence);
    const at = Array.isArray(c.span) ? c.span[0] : null;
    const svo = `${s}\x00${v}\x00${o ?? ''}`;
    const sv = `${s}\x00${v}`;
    let verdict, reason;
    if (!s || !v) { verdict = 'unbound'; reason = 'the claim bound no subject or verb in the reading'; }
    else if (isNeg && (edgeBySVO.has(svo) || edgeBySV.has(sv))) {
      verdict = 'contradicted'; reason = 'a negated claim against a positive bound edge — the English seam attests no polarity, so it is refused, not bound';
    } else if (edgeBySVO.has(svo)) { verdict = 'bound'; reason = 'the material binds exactly this (being, act, object)'; }
    else if (!o && edgeBySV.has(sv)) { verdict = 'bound'; reason = 'the material binds this being and act'; }
    else if (edgeBySV.has(sv)) { verdict = 'unbound'; reason = 'the material binds this being and act, but not to this object'; }
    else if (!verbs.has(v)) { verdict = 'unheard'; reason = `the material never uses the verb “${v}”`; }
    else { verdict = 'unbound'; reason = 'no bound edge carries this claim'; }
    claims.push({ s, v, o: o ?? null, polarity: isNeg ? '-' : '+', at, sentence: sentence || null, verdict, reason });
  }
  const count = (k) => claims.filter((x) => x.verdict === k).length;
  const total = claims.length;
  const bound = count('bound');
  const summary = {
    schema: CLAIM_SEAM_SCHEMA, total, bound, unbound: count('unbound'),
    contradicted: count('contradicted'), unheard: count('unheard'),
    allBound: total > 0 && bound === total, anyContradicted: count('contradicted') > 0,
  };
  return { schema: CLAIM_SEAM_SCHEMA, claims, summary };
}

/** DISCLOSURE, NOT CENSORSHIP (P186 — "the mouth is not censored"). The old
 * coherent-receiving filter DELETED the mouth's ungrounded sentences and shipped
 * the residue as the essay; that edits a word the mouth said back. This version
 * only NAMES what does not bind, per sentence, and never touches the text. It
 * returns, for each sentence span the reader saw, the worst verdict among its
 * claims — so a caller can mark the essay and offer a repair, never rewrite it.
 * `text` (the draft with markers replaced at EQUAL length) is the offset space. */
export function discloseUnsupported({ read, claims } = {}) {
  if (!read || !Array.isArray(claims?.claims)) throw new TypeError('discloseUnsupported: a draft read and its claim verdicts are required');
  const spans = (read.sents ?? [])
    .map((s) => ({ at: Number(s.offset), len: String(s.text ?? '').length }))
    .filter((s) => Number.isFinite(s.at) && s.len > 0).sort((a, b) => a.at - b.at);
  const atOf = (c) => (Array.isArray(c.span) && Number.isFinite(c.span[0]) ? c.span[0] : (Number.isFinite(c.at) ? c.at : -1));
  const unsupported = [];
  for (const s of spans) {
    const cs = claims.claims.filter((c) => atOf(c) >= s.at && atOf(c) < s.at + s.len);
    const bad = cs.find((c) => c.verdict !== 'bound');
    if (cs.length === 0 || bad) unsupported.push({ at: s.at, len: s.len, claims: cs.length,
      bound: cs.filter((c) => c.verdict === 'bound').length, because: bad?.verdict ?? 'no-claim' });
  }
  return { schema: CLAIM_SEAM_SCHEMA, unsupported, supported: spans.length - unsupported.length };
}

/** THE TWO LANES OF AN ESSAY. Every sentence must be ONE of:
 *   GROUNDED — every claim sits on a bound edge;
 *   VOICE    — the model's own reading, EXPLICITLY marked `[voice:<altitude>]`
 *              where altitude is a TERRAIN abstraction (kind · field · link ·
 *              network · atmosphere · lens · paradigm — the fold's own grid,
 *              "kinds on kinds" and upward), AND tied to the SOURCE span that
 *              prompted it (a ⟦src@byte⟧ marker whose address is a witnessed
 *              source byte). The model cites its thoughts to the source content
 *              that prompted them, NEVER to its own output — the address space
 *              IS the source file, so a marker can only resolve against source
 *              bytes (self-citation is impossible by construction), and the
 *              witnessed-address gate makes it explicit;
 *   FAIL     — neither (a bare assertion with no witness, or a voice with no
 *              terrain altitude, or a voice citing nothing). Disclosed, never
 *              deleted (P186); the essay is not SEALED while a FAIL stands.
 * `draft` is the ORIGINAL draft (markers intact); its offsets align with the
 * equal-length prose the `read` was taken over, so each span slices the draft.
 * `sourceAt` (optional) is the Set of witnessed source byte addresses; a voice
 * sentence must cite one of them, not any old byte.
 * `witnesses` (optional) is a Map<byteAddress, sourceSentenceText>. A sentence
 * that is VERBATIM the source at its own byte — a travelled/wandered real
 * sentence, or any mouth that quotes exactly — is GROUNDED by the byte-trace
 * (Tarski convention-T), even where claim-matching cannot re-bind it out of
 * context. The quoted string's semantics is verified at its byte address. */
export const VOICE_MARK = '[voice]';
export const VOICE_ALTITUDES = Object.freeze(['kind', 'field', 'link', 'network', 'atmosphere', 'lens', 'paradigm']);
const normW = (x) => String(x ?? "").replace(/\s+/g, " ").replace(/^["“']+|["“']+$/g, "").replace(/[.,;:!?…"“”'’\s]+$/g, "").trim().toLowerCase();
const CONTENT_RE = /[\p{L}'’-]+/gu;
/** A received-lite content word: a letter-token of length >= 4 that is not one
 * of the lang/en closed classes already loaded. Used ONLY to gate that a voice
 * thought is prompted BY the span it cites — never as an identity. */
export function contentWords(text) {
  return new Set((String(text ?? "").toLowerCase().match(CONTENT_RE) ?? [])
    .map((w) => w.replace(/[’‘]/g, "'")).filter((w) => w.length >= 4 && !CLOSED.has(straight(w))));
}
export function classifyEssay({ draft, read, claims, sourceAt = null, witnesses = null } = {}) {
  if (typeof draft !== 'string' || !read || !Array.isArray(claims?.claims)) throw new TypeError('classifyEssay: draft, a draft read, and its claim verdicts are required');
  const witnessed = sourceAt instanceof Set ? sourceAt : null;
  const spans = (read.sents ?? [])
    .map((s) => ({ at: Number(s.offset), len: String(s.text ?? '').length }))
    .filter((s) => Number.isFinite(s.at) && s.len > 0).sort((a, b) => a.at - b.at);
  const atOf = (c) => (Array.isArray(c.span) && Number.isFinite(c.span[0]) ? c.span[0] : (Number.isFinite(c.at) ? c.at : -1));
  const sentences = [];
  for (const s of spans) {
    const raw = draft.slice(s.at, s.at + s.len);
    const cs = claims.claims.filter((c) => atOf(c) >= s.at && atOf(c) < s.at + s.len);
    const cites = [...raw.matchAll(/⟦([^⟧]+)@(\d+)⟧/g)].map((m) => Number(m[2]));
    const sourceCites = cites.filter((n) => !witnessed || witnessed.has(n));
    const vm = raw.match(/\[voice(?::\s*([a-z]+))?\]/i);
    const isVoice = !!vm;
    const altitude = (vm?.[1] ?? '').toLowerCase() || null;
    const contradicted = cs.some((c) => c.verdict === 'contradicted');
    const allBound = cs.length > 0 && cs.every((c) => c.verdict === 'bound');
    const rawNoMark = `${raw}`.replace(/⟦[^⟧]*⟧/g, " ").replace(/\s+/g, " ").trim();
    const verbatim = witnesses instanceof Map && sourceCites.some((n) => witnesses.has(n) && normW(witnesses.get(n)) === normW(rawNoMark));
    // THE RELEVANCE GATE (the thought must be PROMPTED BY the span it cites):
    // when witnesses are in view, a voice thought must share at least one content
    // word with the source sentence at its citation — otherwise it cites a span it
    // never engaged (a thought from nowhere pinned to a byte).
    const thoughtWords = contentWords(rawNoMark);
    const prompted = witnesses instanceof Map && sourceCites.some((n) => witnesses.has(n)
      && [...contentWords(witnesses.get(n))].some((w) => thoughtWords.has(w)));
    let lane, because;
    if (verbatim) { lane = 'grounded'; because = 'verbatim witnessed at its byte'; }
    else if (contradicted) { lane = 'fail'; because = 'contradicted'; }
    else if (allBound) { lane = 'grounded'; because = 'bound'; }
    else if (isVoice && VOICE_ALTITUDES.includes(altitude) && sourceCites.length > 0 && (!(witnesses instanceof Map) || prompted)) { lane = 'voice'; because = `explicit ${altitude}-altitude voice, cited to a source span it shares content with`; }
    else if (isVoice && VOICE_ALTITUDES.includes(altitude) && sourceCites.length > 0) { lane = 'fail'; because = 'voice not prompted by the cited span (no shared content with it)'; }
    else if (isVoice && !VOICE_ALTITUDES.includes(altitude)) { lane = 'fail'; because = `voice without a terrain altitude (${VOICE_ALTITUDES.join('/')})`; }
    else if (isVoice) { lane = 'fail'; because = witnessed ? 'voice with no witnessed source span (a thought not prompted by the text)' : 'voice without a source span'; }
    else { lane = 'fail'; because = cs.length === 0 ? 'no-claim' : (cs.find((c) => c.verdict !== 'bound')?.verdict ?? 'unbound'); }
    sentences.push({ at: s.at, len: s.len, text: raw.trim(), lane, because, voice: isVoice, altitude, prompted, cites: sourceCites.length, markers: cites.length, claims: cs.length });
  }
  const count = (k) => sentences.filter((x) => x.lane === k).length;
  const contradicted = sentences.some((x) => x.because === 'contradicted');
  const altitudes = {};
  for (const x of sentences) if (x.lane === 'voice') altitudes[x.altitude] = (altitudes[x.altitude] ?? 0) + 1;
  return { schema: CLAIM_SEAM_SCHEMA, sentences,
    counts: { schema: CLAIM_SEAM_SCHEMA, total: sentences.length, grounded: count('grounded'), voice: count('voice'), fail: count('fail'), contradicted, altitudes } };
}


/** THE ONE DISCLOSED CARVE-OUT (piece-revise.js:129, P186): a later, explicit,
 * voluntary REPAIR — the mouth is asked for one sentence's replacement, and the
 * replacement is adopted only if its own reading grounds. This function does the
 * part that is Gary's job: it hands the mouth the MATERIAL it may compose from,
 * per ungrounded sentence — the bound edges whose subject that sentence already
 * names (the parts that can ground it), each with its source byte marker. It
 * edits nothing; the mouth produces the words, and the caller splices only on a
 * grounded result, on the record. */
export function rewriteParts({ read, claims, edges = [], sourceId = 'fold:essay-source', maxParts = 6 } = {}) {
  const { unsupported } = discloseUnsupported({ read, claims });
  const pool0 = cleanEdges(edges);
  const words = (t) => new Set(String(t ?? '').toLowerCase().match(/[\p{L}]+/gu) ?? []);
  const sentAt = new Map((read.sents ?? []).map((s) => [Number(s.offset), String(s.text ?? '')]));
  return unsupported.map((u) => {
    const toks = words(sentAt.get(u.at));
    const mine = pool0.filter((e) => toks.has(e.s));
    const pool = (mine.length ? mine : pool0).slice(0, maxParts)
      .map((e) => ({ s: e.s, v: e.v, o: e.o, at: e.at, marker: `⟦${sourceId}@${e.at}⟧` }));
    return { at: u.at, len: u.len, because: u.because, parts: pool };
  });
}

/** Seal a draft. With the caller's `claims` (from verifyDraftClaims) the seal
 * JUDGES the mouth's own assertions and never edits them (P186): every sentence
 * the mouth wrote ships, with the ungrounded ones NAMED (`unsupported`), not
 * deleted. Verdicts: SEALED (every claim bound + every marker the source's own
 * bytes), REFUSED (a claim contradicts a bound edge, or a marker is refused),
 * UNVERIFIED (claims with no bound witness — disclosed, sentence by sentence).
 * Without `claims` the seal is unchanged — literal QUOTATIONS ONLY. */
export function sealEssayDraft({ draft, sourceFile, sourceId = sourceFile, replaceCites, snipSentence, claims = null, unsupported = [], rewrite = null, lanes = null } = {}) {
  if (typeof draft !== 'string' || !sourceFile || typeof replaceCites !== 'function' || typeof snipSentence !== 'function') throw new TypeError('sealEssayDraft: draft, allowed source, and snip organs required');
  const marker = /⟦([^⟧]+)@(\d+)⟧/g;
  const residual = draft.replace(marker, '');
  // Extra operators, emoji or symbolic relations can assert something without
  // a single letter: merely excluding alphanumerics is not a sound seal.
  const hasProse = /[^\p{White_Space}\p{P}]/u.test(residual);
  const bracketed = [...draft.matchAll(/⟦[^⟧]*⟧/g)].length;
  const syntactic = [...draft.matchAll(/⟦([^⟧]+)@(\d+)⟧/g)].length;
  const malformed = bracketed !== syntactic || (residual.includes('⟦') || residual.includes('⟧'));
  const result = replaceCites(draft, { resolve: (requested, at) => requested === sourceId
    ? snipSentence(sourceFile, at)
    : { ok: false, gap: { kind: 'source_not_authorized' } } });
  const valid = result.snips.filter((s) => s.verified);
  const clean = result.refused.length === 0 && valid.length > 0 && !malformed;
  const citationsOk = result.refused.length === 0 && !malformed;
  const base = {
    schema: 'EssaySeal@1', text: result.text, snips: result.snips, refused: result.refused,
    unsupportedProse: hasProse, malformedMarkers: malformed,
    unsupported: Array.isArray(unsupported) ? unsupported : [], rewrite: rewrite ?? null,
  };
  // THE TWO-LANE SEAL: grounded propositions OR explicit, span-cited model voice
  // at a terrain altitude. This is the essay's own truth condition.
  if (lanes && lanes.counts) {
    const L = lanes.counts;
    const claimsVerified = L.total > 0 && L.voice === 0 && L.fail === 0;
    let verdict, sealScope = 'grounded_and_voiced', reason;
    if (!citationsOk) { verdict = 'REFUSED'; reason = 'a citation was absent, malformed or refused'; }
    else if (!hasProse) { verdict = valid.length > 0 ? 'SEALED' : 'REFUSED'; sealScope = 'quotations_only'; reason = valid.length > 0 ? 'output contains only source-verified quotations' : 'a citation was absent, malformed or refused'; }
    else if (L.contradicted) { verdict = 'REFUSED'; reason = 'a claim contradicts a bound edge'; }
    else if (L.total === 0) { verdict = 'UNVERIFIED'; reason = 'no sentence the reader could check against the reading'; }
    else if (L.fail === 0) { verdict = 'SEALED'; reason = `every proposition is grounded (${L.grounded}) or an explicit terrain-altitude voice cited to a source span (${L.voice})`; }
    else { verdict = 'UNVERIFIED'; reason = `${L.fail} sentence(s) neither grounded nor a cited terrain-altitude voice — disclosed, kept (P186)`; }
    return { ...base, lanes, verdict, claimsVerified, citationsVerified: citationsOk, sealScope, unsupportedClaims: claims?.summary ?? null, reason };
  }
  if (claims && claims.summary) {
    const cs = claims.summary;
    const claimsVerified = cs.total > 0 && cs.allBound === true;
    const unsupportedClaims = cs.allBound ? null : cs;
    let verdict, sealScope = 'quotations_only', reason;
    if (!citationsOk) { verdict = 'REFUSED'; reason = 'a citation was absent, malformed or refused'; }
    else if (!hasProse) { verdict = valid.length > 0 ? 'SEALED' : 'REFUSED'; reason = valid.length > 0 ? 'output contains only source-verified quotations' : 'a citation was absent, malformed or refused'; }
    else if (cs.anyContradicted) { verdict = 'REFUSED'; sealScope = 'claims_and_quotations'; reason = 'a claim contradicts a bound edge'; }
    else if (cs.total === 0) { verdict = 'UNVERIFIED'; sealScope = 'claims_and_quotations'; reason = 'the prose carried no claim the reader could check against the reading'; }
    else if (claimsVerified) { verdict = 'SEALED'; sealScope = 'claims_and_quotations'; reason = 'every claim sits on a bound edge and every citation is the source’s own bytes'; }
    else { verdict = 'UNVERIFIED'; sealScope = 'claims_and_quotations'; reason = `${cs.unbound + cs.unheard} claim(s) have no bound witness — disclosed, sentence by sentence; the mouth’s words are kept (P186)`; }
    return { ...base, claims: claims.claims, claimsSummary: cs, verdict, claimsVerified, citationsVerified: citationsOk, sealScope, unsupportedClaims, reason };
  }
  const verdict = !clean ? 'REFUSED' : hasProse ? 'UNVERIFIED' : 'SEALED';
  return {
    ...base,
    // SEALED means only the source's literal QUOTES were verified. Even a
    // quotation by itself is not proof of the assertion someone draws from it.
    verdict, claimsVerified: false, citationsVerified: clean, sealScope: 'quotations_only', unsupportedClaims: null,
    reason: !clean ? 'a citation was absent, malformed or refused' : hasProse
      ? 'verbatim citations verified; the surrounding assertions have no claim-level witness'
      : 'output contains only source-verified quotations',
  };
}
