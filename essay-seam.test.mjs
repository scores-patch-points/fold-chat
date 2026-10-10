import test from 'node:test';
import assert from 'node:assert/strict';
import { locateSentences, essayBoxFromRead, sealEssayDraft } from './essay-seam.mjs';

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
