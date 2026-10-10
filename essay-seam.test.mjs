import test from 'node:test';
import assert from 'node:assert/strict';
import { locateSentences, essayBoxFromRead, sealEssayDraft, verifyDraftClaims, boundEdgesFromRead, discloseUnsupported, rewriteParts, isBeing, cleanEdges, classifyEssay } from './essay-seam.mjs';

const sourceFile = '/only/authorized.txt';
const source = 'Préface 🔬\nCHAPTER I\nPierre saw Natasha. Natasha greeted Pierre.\n';
const excerptStart = source.indexOf('CHAPTER I');
const excerpt = source.slice(excerptStart);
const sentences = [
  { order: 0, text: 'CHAPTER I\nPierre saw Natasha.' },
  { order: 1, text: 'Natasha greeted Pierre.' },
];
const clauses = [
  { order: 0, verb: 'saw', subject: { head: 'pierre' }, object: { head: 'natasha' }, learning: 0.9 },
  { order: 1, verb: 'greeted', subject: { head: 'natasha' }, object: { head: 'pierre' }, learning: 0.8 },
];
const read = { sents: sentences, clauses, THR: 0.7, subjectRefOf: (c) => c.subject?.head, objectRefOf: (c) => c.object?.head };

// FALSIFIERS: a map converted using Object.keys() yields zero neighbors; a
// relative character offset points before the witnessed sentence in UTF-8.
test('Janus receives actual reciprocal company vectors (not Object.keys(Map))', () => {
  let vectors = null;
  const r = essayBoxFromRead({ sourceText: source, excerptStart, excerpt, sourceFile, read,
    induceKinds(vs) { vectors = vs; return [{ members: vs.map((x) => x.ref) }]; } });
  assert.deepEqual(vectors.find((x) => x.ref === 'pierre').names, ['natasha']);
  assert.equal(vectors.find((x) => x.ref === 'natasha').company.pierre, 2);
  assert.equal(r.kinds[0].members.length, 2);
});

test('marker addresses are absolute UTF-8 byte addresses, not char or excerpt offsets', () => {
  const r = essayBoxFromRead({ sourceText: source, excerptStart, excerpt, sourceFile, read, induceKinds: () => [] });
  const byte = Buffer.byteLength(source.slice(0, source.indexOf('CHAPTER I')), 'utf8');
  assert.equal(r.hunt[0].at, byte);
  assert.equal(r.hunt[0].marker, `⟦${sourceFile}@${byte}⟧`);
  assert.equal(r.partial, true);
  assert.equal(r.sourceBytes, Buffer.byteLength(source));
});

test('missing witness refuses address; never guesses closest text', () => {
  const result = locateSentences(source, excerptStart, [...sentences, { order: 2, text: 'Invented dialogue.' }]);
  assert.equal(result.found.size, 2);
  assert.equal(result.gaps[0].reason, 'sentence_not_at_source');
});

test('lowercase referents participate as identities', () => {
  const r = essayBoxFromRead({ sourceText: source, excerptStart, excerpt, sourceFile, read, induceKinds: () => [] });
  assert.deepEqual(r.cast.sort(), ['natasha', 'pierre']);
});

const snipSentence = (_src, at) => ({ ok: true, quote: `Text at ${at}`, len: 9 });
const replaceCites = (draft, { resolve }) => {
  const snips = [];
  const text = draft.replace(/⟦([^⟧]+)@(\d+)⟧/g, (_whole, source, at) => {
    const r = resolve(source, Number(at));
    snips.push(r.ok ? { source, abs: Number(at), verified: true } : { source, abs: Number(at), verified: false, gap: r.gap.kind });
    return r.ok ? `“${r.quote}”` : '⟦REFUSED⟧';
  });
  return { text, snips, refused: snips.filter((s) => !s.verified) };
};
const seal = (draft) => sealEssayDraft({ draft, sourceFile, snipSentence, replaceCites });

test('quotations alone can seal, not surrounding unverified claims', () => {
  const q = seal(`⟦${sourceFile}@10⟧`);
  assert.equal(q.verdict, 'SEALED');
  assert.equal(q.claimsVerified, false);
  assert.equal(q.sealScope, 'quotations_only');
  const wrong = seal(`Pierre secretly ruled France. ⟦${sourceFile}@10⟧`);
  assert.equal(wrong.verdict, 'UNVERIFIED');
  assert.equal(wrong.citationsVerified, true);
  assert.equal(wrong.claimsVerified, false);
});

test('a marker aimed at a sensitive file is refused before the snipper reads it', () => {
  let read = 0;
  const q = sealEssayDraft({ draft: '⟦/etc/passwd@0⟧', sourceFile,
    replaceCites, snipSentence() { read++; return { ok: true, quote: 'secret' }; } });
  assert.equal(read, 0);
  assert.equal(q.verdict, 'REFUSED');
  assert.equal(q.refused[0].gap, 'source_not_authorized');
});

test('invented prose and naked quotes never earn a verified claim', () => {
  assert.equal(seal('“A wholly invented quote.”').verdict, 'REFUSED');
  assert.equal(seal('Pierre made an assertion.').verdict, 'REFUSED');
});

test('sentence in another part of the book cannot be laundered into a partial read',()=>{
 const source='Section A. Section B. Section C.';
 const read=locateSentences(source,0,[{order:0,text:'Section A.'},{order:1,text:'Section C.'}],{endChar:'Section A.'.length});
 assert.deepEqual([...read.found.keys()],[0]);
 assert.equal(read.gaps[0].reason,'sentence_outside_read_extent');
});
test('unsupported symbolic claims cannot hide next to otherwise verified quotations',()=>{
 const result=seal(`⟦${sourceFile}@10⟧ ⇒`);
 assert.equal(result.verdict,'UNVERIFIED');
 assert.equal(result.claimsVerified,false);
});

test('source file path stays private; client sees only logical source ID',()=>{
 const sourceId='fold:essay-source';const secret='/Users/example/private-novel.txt';
 const r=essayBoxFromRead({sourceText:source,excerptStart,excerpt,sourceFile:secret,sourceId,read,induceKinds:()=>[]});
 assert.equal(r.source,sourceId);assert.ok(r.hunt.length>0);
 assert.match(r.hunt[0].marker,/^⟦fold:essay-source@/);
 assert.doesNotMatch(JSON.stringify(r),/private-novel/);
 let calledPath=null;
 const sealed=sealEssayDraft({draft:`⟦${sourceId}@10⟧`,sourceFile:secret,sourceId,replaceCites,
  snipSentence(p){calledPath=p;return{ok:true,quote:'source bytes',len:12};}});
 assert.equal(calledPath,secret);assert.equal(sealed.verdict,'SEALED');
});

test('Janus kinds from company structure are candidates until null and band controls run',()=>{
 const r=essayBoxFromRead({sourceText:source,excerptStart,excerpt,sourceFile,read,induceKinds:()=>[{members:['pierre','natasha']} ]});
 assert.equal(r.kinds[0].standing,'candidate');
 assert.equal(r.kinds[0].falsifiers.shuffledCompany,'not-run');
});

// ── THE CLAIM SEAM (2026-10-10) ─────────────────────────────────────────────
// The box now also exposes its BOUND EDGES, and the seal can be handed the
// mouth's own prose read by the SAME reader, so a claim is checked, not trusted.
const edges = [{ s: 'pierre', v: 'saw', o: 'natasha', at: 10 }, { s: 'natasha', v: 'greeted', o: 'pierre', at: 20 }];
const dr = (clauses) => ({ clauses, subjectRefOf: (c) => c.subject?.head ?? null, objectRefOf: (c) => c.object?.head ?? null, sents: [] });
const claim = (s, v, o, sent) => ({ subject: { head: s }, verb: v, object: o == null ? null : { head: o }, sent });

test('the box exposes its bound edges, each at its own witness byte', () => {
  const r = essayBoxFromRead({ sourceText: source, excerptStart, excerpt, sourceFile, read, induceKinds: () => [] });
  assert.equal(r.edges.length, 2);
  assert.deepEqual(r.edges[0], { s: 'pierre', v: 'saw', o: 'natasha', at: Buffer.byteLength(source.slice(0, source.indexOf('CHAPTER I')), 'utf8') });
});

test('verifyDraftClaims: bound / slot-competition / unheard are told apart', () => {
  const { claims, summary } = verifyDraftClaims({ read: dr([
    claim('pierre', 'saw', 'natasha', 'Pierre saw Natasha.'),
    claim('pierre', 'saw', 'andrei', 'Pierre saw Andrei.'),
    claim('pierre', 'danced', 'natasha', 'Pierre danced with Natasha.'),
  ]), edges });
  assert.equal(claims[0].verdict, 'bound');
  assert.equal(claims[1].verdict, 'unbound');
  assert.match(claims[1].reason, /not to this object/);
  assert.equal(claims[2].verdict, 'unheard');
  assert.equal(summary.total, 3);
  assert.equal(summary.allBound, false);
});

test('a grounded prose claim seals at claim scope', () => {
  const claims = verifyDraftClaims({ read: dr([claim('pierre', 'saw', 'natasha', 'Pierre saw Natasha.')]), edges });
  const r = sealEssayDraft({ draft: `Pierre saw Natasha. ⟦${sourceFile}@10⟧`, sourceFile, snipSentence, replaceCites, claims });
  assert.equal(r.verdict, 'SEALED');
  assert.equal(r.claimsVerified, true);
  assert.equal(r.sealScope, 'claims_and_quotations');
  assert.equal(r.claimsSummary.bound, 1);
});

test('prose that binds no edge stays UNVERIFIED, even beside a verified quote', () => {
  const claims = verifyDraftClaims({ read: dr([claim('pierre', 'ruled', 'france', 'Pierre ruled France.')]), edges });
  const r = sealEssayDraft({ draft: `Pierre ruled France. ⟦${sourceFile}@10⟧`, sourceFile, snipSentence, replaceCites, claims });
  assert.equal(r.verdict, 'UNVERIFIED');
  assert.equal(r.claimsVerified, false);
  assert.equal(r.citationsVerified, true);
});

test('a negated claim against a positive edge is contradicted, and refused', () => {
  const claims = verifyDraftClaims({ read: dr([claim('pierre', 'saw', 'natasha', 'Pierre did not see Natasha.')]), edges });
  assert.equal(claims.claims[0].verdict, 'contradicted');
  assert.equal(claims.claims[0].polarity, '-');
  const r = sealEssayDraft({ draft: `Pierre did not see Natasha. ⟦${sourceFile}@10⟧`, sourceFile, snipSentence, replaceCites, claims });
  assert.equal(r.verdict, 'REFUSED');
  assert.equal(r.claimsVerified, false);
});

test('boundEdgesFromRead: a witness-less sentence is never an edge', () => {
  const e = boundEdgesFromRead({ sourceText: source, excerptStart, excerpt, read });
  assert.equal(e.length, 2);
  assert.equal(e[0].s, 'pierre');
});

test('without a claim read the seal is unchanged: quotations only', () => {
  const r = sealEssayDraft({ draft: `Pierre saw Natasha. ⟦${sourceFile}@10⟧`, sourceFile, snipSentence, replaceCites });
  assert.equal(r.verdict, 'UNVERIFIED');
  assert.equal(r.claimsVerified, false);
  assert.equal(r.sealScope, 'quotations_only');
});

// ── P186: DISCLOSURE, NOT CENSORSHIP ────────────────────────────────────────
// The old filter DELETED ungrounded sentences and shipped the residue. The law
// (Gary, P186) is that the mouth is not censored: the seal keeps every word and
// NAMES what does not bind; the only legal repair goes back through the mouth.
const dtext = 'Pierre saw Natasha. Pierre ruled France.';
const dRead = {
  clauses: [
    { subject: { head: 'pierre' }, verb: 'saw', object: { head: 'natasha' }, sent: 'Pierre saw Natasha.', span: [0, 19] },
    { subject: { head: 'pierre' }, verb: 'ruled', object: { head: 'france' }, sent: 'Pierre ruled France.', span: [20, 40] },
  ],
  sents: [{ order: 0, text: 'Pierre saw Natasha.', offset: 0 }, { order: 1, text: 'Pierre ruled France.', offset: 20 }],
  subjectRefOf: (c) => c.subject?.head ?? null, objectRefOf: (c) => c.object?.head ?? null,
};

test('discloseUnsupported names the ungrounded sentence and never edits the text', () => {
  const claims = verifyDraftClaims({ read: dRead, edges, text: dtext });
  const d = discloseUnsupported({ read: dRead, claims });
  assert.equal(d.unsupported.length, 1);
  assert.equal(d.unsupported[0].at, 20);
  assert.equal(d.unsupported[0].because, 'unheard');
  assert.equal(d.supported, 1);
});

test('rewriteParts hands the mouth the bound material for the ungrounded sentence', () => {
  const claims = verifyDraftClaims({ read: dRead, edges, text: dtext });
  const parts = rewriteParts({ read: dRead, claims, edges });
  assert.equal(parts.length, 1);
  assert.ok(parts[0].parts.length > 0);
  assert.match(parts[0].parts[0].marker, /^⟦fold:essay-source@\d+⟧$/);
});

test('the seal keeps the mouth’s whole text and discloses the ungrounded sentence', () => {
  const claims = verifyDraftClaims({ read: dRead, edges, text: dtext });
  const d = discloseUnsupported({ read: dRead, claims });
  const r = sealEssayDraft({ draft: dtext, sourceFile, snipSentence, replaceCites, claims, unsupported: d.unsupported });
  assert.equal(r.verdict, 'UNVERIFIED');
  assert.equal(r.claimsVerified, false);
  assert.equal(r.unsupported.length, 1);
  // P186: nothing was deleted — the mouth's own words are still all present.
  assert.match(r.text, /Pierre saw Natasha\./);
  assert.match(r.text, /Pierre ruled France\./);
});

// ── THE TWO LANES: grounded, or explicit terrain-altitude voice cited to source ──
const scene = (...parts) => {
  let o = 0;
  const sents = parts.map((t, i) => { const s = { order: i, text: t, offset: o }; o += t.length + 1; return s; });
  return { draft: parts.join(' '), read: { sents, clauses: [], subjectRefOf: () => null, objectRefOf: () => null } };
};

test('voice lane: a terrain-altitude thought cited to a source span is admitted; the rest fail', () => {
  const { draft, read } = scene(
    '[voice:atmosphere] The room feels tense ⟦fold:essay-source@100⟧',
    '[voice] a thought with no terrain altitude ⟦fold:essay-source@100⟧',
    '[voice:kind] a thought citing nothing',
    'A bare assertion with no witness.',
  );
  const lanes = classifyEssay({ draft, read, claims: { claims: [] }, sourceAt: new Set([100]) });
  assert.equal(lanes.counts.voice, 1);
  assert.equal(lanes.counts.fail, 3);
  assert.equal(lanes.counts.altitudes.atmosphere, 1);
  assert.match(lanes.sentences.find((s) => s.lane === 'voice').because, /atmosphere/);
});

test('voice lane: a thought cited to a byte the reading never witnessed is not prompted by the text', () => {
  const { draft, read } = scene('[voice:lens] A reading of the scene ⟦fold:essay-source@999⟧');
  const lanes = classifyEssay({ draft, read, claims: { claims: [] }, sourceAt: new Set([100]) });
  assert.equal(lanes.counts.voice, 0);
  assert.equal(lanes.counts.fail, 1);
  assert.equal(lanes.sentences[0].because, 'voice with no witnessed source span (a thought not prompted by the text)');
});

test('the box admits no negation contraction or auxiliary as a being', () => {
  assert.equal(isBeing('pierre'), true);
  assert.equal(isBeing("don't"), false);
  assert.equal(isBeing('was'), false);
  assert.equal(cleanEdges([{ s: 'pierre', v: 'saw', o: 'natasha' }, { s: 'don’t', v: 'tell', o: null }, { s: 'prince', v: 'was', o: 'family' }]).length, 1);
});

test('the two-lane seal: grounded + cited voice SEALS; an uncited voice does not', () => {
  const { draft, read } = scene(
    '[voice:kind] Beau monde and household form two kinds ⟦fold:essay-source@100⟧',
  );
  const lanes = classifyEssay({ draft, read, claims: { claims: [] }, sourceAt: new Set([100]) });
  const ok = sealEssayDraft({ draft, sourceFile, sourceId: 'fold:essay-source', snipSentence, replaceCites, lanes });
  assert.equal(ok.verdict, 'SEALED');
  assert.equal(ok.sealScope, 'grounded_and_voiced');
  const bad = classifyEssay({ ...scene('[voice:kind] A thought with no citation'), claims: { claims: [] } });
  const refused = sealEssayDraft({ draft: scene('[voice:kind] A thought with no citation').draft, sourceFile, sourceId: 'fold:essay-source', snipSentence, replaceCites, lanes: bad });
  assert.equal(refused.verdict, 'UNVERIFIED');
});
