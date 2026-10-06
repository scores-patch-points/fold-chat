# The other mind — pre-registration (2026-10-06)

Written AFTER step 1 (correction capture) was implemented and BEFORE any measurement run. Nothing below has been measured on real asks yet; the unit
tests only prove the mechanism, not that it helps. Plan: `~/.claude/plans/make-a-plan-to-joyful-wadler.md`. Code: `fold-chat-minds.js`.

Claim under test: when the person refuses a carried referent ("not Ada Lovelace"), the fold stops reading their pronouns through it, and says what it
knows of them as counted evidence (khora `kernel/perspective.js`), never as a profile.

| id | conjecture | refuted if |
|---|---|---|
| M1 | after a `carry-rejected` op, `followUp("what happened to her?")` is not `carried` on that surface | the surface is carried again, for any wording of the pronoun ask |
| M2 | CONTROL: with no op, the same ask IS carried | it is not (a gate that carries nothing survives M1 and is useless) |
| M3 | a refusal is not carried into another session | session B carries what session A refused |
| M4 | `personMind` of a session with no ops and no sources is `measured:false`, never an empty profile | it returns `measured:true` with nothing recorded |
| M5 | the discourse-summary clause appears ONLY when the switch `localStorage["fold-chat:minds"]="on"` is set and a refusal exists | it appears with the switch off |
| M6 | on a labelled set of pronoun follow-ups (`eval/minds/m6.mjs`, 12 cases), refusing what was carried-but-not-meant leaves nothing wrong carried, and a case that was already right is untouched | a wrong carry survives refusal, or a control changes |

Status 2026-10-06: M1, M2, M4 and the clause text are covered by `fold-chat-minds.test.mjs`. The UI control was exercised once by hand in the live page
(render → click → op stored → button "won't carry …"). M3 is in the unit tests. M5 (the switch gating the summary clause) is NOT yet tested.

Known limit: `personLike` (fold-chat-mind.js) reads any two capitalised words as a person, so after refusing the one real person a pronoun can fall through
to a capitalised thing ("Babbage's Analytical Engine"). That is today's heuristic, not changed here.

## M6 result (2026-10-06, `node eval/minds/m6.mjs`, offline, deterministic)
STANDS: 11/11 wrong carries cleared by refusal, the meant referent carried afterwards in 11/11, the 1 control (a thread with one person) untouched.

Read it with its limits:
* **The baseline is the finding.** Today's carry is wrong (carries a name the person did not mean) in **11 of 12** two-name threads, because `DECLARED.carryMax` is 2 and a gendered pronoun still carries both people. The refusal control is a repair for something the carry does often, not a rare edge.
* **The simulated person is an oracle.** The driver refuses exactly the wrong names, so "cleared" shows the mechanism works, not that people will click it. Whether they do is unmeasured (no live use yet).
* **Synthetic, 12 hand-built cases**, English, one-sentence answers. It says nothing about real threads or other languages.
* A cheaper and larger lever may sit upstream of the refusal: a gendered pronoun ("he", "she") that still carries two people. Not tried here; it would be measured against this same set.
