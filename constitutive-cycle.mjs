// One situated Khora (encounter) -> Janus (consequence) -> Penelope (artifact)
// -> encounter cycle. The re-encounter is a typed observation about the
// GENERATED ARTIFACT, not independent testimony about its source universe.
// This module orchestrates existing organs without copying their laws.
import { reasoningAt, reasoningRound } from '../janus/native/organs/reasoning-spiral.js';
import { reviseArtifact } from '../penelope/organs/generation/spiral-revision.mjs';

export const CONSTITUTIVE_CYCLE_SCHEMA = 'ConstitutiveCycle@1';

export async function runConstitutiveCycle({
  log = [], proposals = [], assess, artifact, propose, test, assessParent,
  reencounter, budget = 3, forWhom = 'reader', previousGround = null, requiredClaimIds = [],
} = {}) {
  if (typeof assess !== 'function' || typeof reencounter !== 'function')
    throw new TypeError('constitutive cycle requires independent reasoning instrument and artifact reader');
  const before = reasoningAt(log);
  const inferred = await reasoningRound(log, proposals, { assess });
  const supported = inferred.fold.claims.filter((x) => x.standing === 'supported');
  // Never manufacture an artifact when no independently tested proposition
  // from this round can support one. Surface the unresolved work instead.
  const missingRequired = requiredClaimIds.filter((id) => !supported.some((c) => c.id === id));
  if (!supported.length || missingRequired.length) return {
    schema: CONSTITUTIVE_CYCLE_SCHEMA, status: 'no_ground', before,
    after: inferred.fold, log: inferred.log, artifact, nextGround: null,
    openings: inferred.fold.openings, missingRequired,
  };
  const generation = await reviseArtifact({ artifact, propose: (cur, ctx) => propose(cur, { ...ctx, reasoning: inferred.fold }),
    test: (newArt, oldArt) => test(newArt, oldArt, inferred.fold),
    assessParent: (newArt, oldArt) => assessParent(newArt, oldArt, inferred.fold), budget });
  const encounter = await reencounter(generation.artifact, inferred.fold);
  if (!encounter || encounter.schema !== 'ArtifactEncounter@1' || !Array.isArray(encounter.observations))
    throw new TypeError('reencounter must produce typed observations about the generated artifact');
  const nextGround = Object.freeze({
    schema: 'ConstitutiveGround@1', forWhom,
    previousGround: previousGround?.schema ?? null,
    // Only already witnessed claims appear as world-ground; generated text
    // and its observations stay in the separate artifact register.
    witnessedClaims: supported.map((c) => c.id),
    artifact: { hash: generation.artifactHash, admittedRevisions: generation.admitted,
      observations: encounter.observations, independence: 'artifact-self-observation-not-source-corroboration' },
    unresolved: inferred.fold.openings.map((x) => ({ id: x.id, standing: x.standing })),
  });
  return { schema: CONSTITUTIVE_CYCLE_SCHEMA, status: generation.admitted ? 'revised' : 'unchanged',
    before, after: inferred.fold, log: inferred.log, generation, encounter, nextGround };
}
