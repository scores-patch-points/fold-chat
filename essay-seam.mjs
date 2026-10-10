// The Fold essay seam: one addressed reading enters Janus; Penelope seals only what it can verify.
// Pure, model-free functions. The caller supplies Khora's reader and Janus's kind inducer.

import { locateSentences } from '../khora/native/the-fold/source-address.mjs';
export { locateSentences } from '../khora/native/the-fold/source-address.mjs';

export const ESSAY_SEAM_SCHEMA = 'EssaySeam@1';

const normalize = (x) => x == null ? null : String(x).trim().toLowerCase() || null;

/** Keep the scene's declared corpus extent visible. Do not pretend an 80K-char
 * experiment has read a whole book. Return only evidenced events and Janus vectors. */
export function essayBoxFromRead({ sourceText, sourceFile, sourceId = sourceFile, excerptStart = 0, excerpt, read, induceKinds, topic = '' } = {}) {
  if (typeof sourceText !== 'string' || typeof excerpt !== 'string' || !sourceFile || !read || typeof induceKinds !== 'function') throw new TypeError('essayBoxFromRead: source, excerpt, reader, and kind inducer required');
  if (sourceText.slice(excerptStart, excerptStart + excerpt.length) !== excerpt) throw new TypeError('essayBoxFromRead: excerpt is not at declared source position');
  const { found, gaps } = locateSentences(sourceText, excerptStart, read.sents ?? [], { endChar: excerptStart + excerpt.length });
  const cast = new Map();
  const company = new Map();
  const events = [];
  for (const c of read.clauses ?? []) {
    const witness = found.get(c.order);
    if (!witness) continue;
    const s = normalize(typeof read.subjectRefOf === 'function' ? read.subjectRefOf(c) : c.subject?.head);
    const o = normalize(typeof read.objectRefOf === 'function' ? read.objectRefOf(c) : c.object?.head);
    const v = normalize(c.verb);
    if (!s || !v) continue;
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
    events: events.length, source: sourceId, sourceBytes: Buffer.byteLength(sourceText, 'utf8'),
    readBytes: Buffer.byteLength(excerpt, 'utf8'), partial: excerptStart !== 0 || excerptStart + excerpt.length < sourceText.length,
    gaps,
  };
}

/** Quote provenance does not prove surrounding assertions. Untrusted mouth text
 * receives SEALED only if it consists exclusively of source-address markers
 * (plus punctuation/spacing) and every marker resolves within the ONE allowed
 * source. A prose draft is UNVERIFIED until a claim-level verifier exists. */
export function sealEssayDraft({ draft, sourceFile, sourceId = sourceFile, replaceCites, snipSentence } = {}) {
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
  const verdict = !clean ? 'REFUSED' : hasProse ? 'UNVERIFIED' : 'SEALED';
  return {
    schema: 'EssaySeal@1', text: result.text, snips: result.snips, refused: result.refused,
    // SEALED means only the source's literal QUOTES were verified. Even a
    // quotation by itself is not proof of the assertion someone draws from it.
    verdict, claimsVerified: false, citationsVerified: clean, sealScope: 'quotations_only',
    unsupportedProse: hasProse, malformedMarkers: malformed, reason: !clean ? 'a citation was absent, malformed or refused' : hasProse
      ? 'verbatim citations verified; the surrounding assertions have no claim-level witness'
      : 'output contains only source-verified quotations',
  };
}
