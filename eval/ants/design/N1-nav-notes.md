# N1 notes (scratch): navigating inside the holograph

Deliverables are in docs/playback/nav/ (README.md is the write-up). Rebuild: node docs/playback/nav/prep.mjs && node docs/playback/nav/build.mjs; test: node --test docs/playback/nav/sitestyle.test.mjs; drive: node docs/playback/nav/verify.mjs; shots: shots.mjs, compare.mjs, contact.mjs.

Things worth remembering that are not in the README:
- Two of the four chat turns are COMPOSED from eval/snips/cache pages (nose, curie), labelled in the UI; the recorded ones are the structure stage's t0 and wall trims.
- Site look is read per DOMAIN from the cached page of that domain with the most tokens (prep.mjs richestPage); one labelled stand-in (skyatnightmagazine -> bbc).
- sitestyle needs the relay to fetch the first stylesheet to be worth it: 44% of 986 cached pages give no inline token.
- Kernel quirks fixed on the way: pop focus must target removed[0].trigger (the lowest layer that left), not the last; a hash edit without reload is a popstate with null state.
- No app files were edited; no git operations were run.
