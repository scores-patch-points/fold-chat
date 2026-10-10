import test from 'node:test';
import assert from 'node:assert/strict';
import { runConstitutiveCycle } from './constitutive-cycle.mjs';
const A={id:'a',forWhom:'reader',relation:{subject:'source',verb:'contains',object:'phrase'},witnesses:['book#3-10']};
const pass=()=>({verdict:'supported',method:'testimony',by:'byte auditor',basis:'verified by raw slice',witnesses:['book#3-10']});
const reencounter=async (artifact)=>({schema:'ArtifactEncounter@1',observations:[{about:'artifact',text:artifact.text}]});
test('same apparatus makes a new ground with world evidence separate from its own output',async()=>{
 const r=await runConstitutiveCycle({proposals:[A],assess:pass,artifact:{text:'none'},budget:2,
   propose:()=>({text:'sourced quotation'}),test:()=>({ok:true}),assessParent:()=>({ok:true}),reencounter});
 assert.equal(r.status,'revised');assert.deepEqual(r.nextGround.witnessedClaims,['a']);
 assert.equal(r.generation.admitted,1);
 assert.equal(r.nextGround.artifact.independence,'artifact-self-observation-not-source-corroboration');
 assert.equal(r.log.length,2);
});
test('without independent attestation the mouth is never invoked',async()=>{
 let draws=0;
 const r=await runConstitutiveCycle({proposals:[A],assess:()=>({verdict:'unresolved',method:'testimony',by:'auditor',basis:'insufficient source'}),artifact:'previous',
 propose:()=>{draws++;return 'invented';},test:()=>({ok:true}),assessParent:()=>({ok:true}),reencounter});
 assert.equal(r.status,'no_ground');assert.equal(draws,0);assert.equal(r.nextGround,null);
});

test('a revoked mandatory source claim blocks a second artifact rotation',async()=>{
  const {appendReasoning}=await import('../janus/native/organs/reasoning-spiral.js');
  const proposed={kind:'propose',...A};
  const log=[proposed,{kind:'assess',id:'a',...pass()}, {kind:'withdraw',id:'a',basis:'the source changed'}]
    .reduce((l,e)=>appendReasoning(l,e),[]);
  let drawn=0;
  const r=await runConstitutiveCycle({log,requiredClaimIds:['a'],assess:pass,artifact:'previous',
    propose:()=>{drawn++; return 'new';},test:()=>({ok:true}),assessParent:()=>({ok:true}),reencounter});
  assert.equal(r.status,'no_ground');assert.deepEqual(r.missingRequired,['a']);assert.equal(drawn,0);
});
