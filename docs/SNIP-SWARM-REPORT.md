# Snip swarm report

Source: one result file per content type in `eval/swarm/results/`, each with 4 sites and a failure mode. 25 files were read. 23 types ran and 2 did not (below). Site hosts and URLs are in the result files and are left out here. No contact addresses appear anywhere in this report.

## 0. What did not run

- **howto**: 0 sites. The session's WebSearch was unavailable, so no real URLs were found and none were invented.
- **reviews**: 0 sites. WebSearch hit its usage limit, so no pages were loaded.

Types that ran with a site count other than 4: nonenglish 5 (one fetch failed and was replaced; both are in the record), product 6, realestate 5 (extra sites were tested after failed or walled fetches, and all are kept). Total: 96 sites in 23 types. Everything below is over these 96. The two missing types are not zero results; they are unmeasured.

## 1. Pre-registered bars (fixed before reading results, not moved)

1. Every snip is verbatim on the page: **100%**.
2. Junk shown as content (nav, cookie text, bot-wall text, inlined CSS, boilerplate passed off as the answer): **<= 5% of sites**.
3. Relevance: share of reachable sites with relevance >= 1, reported by rung and by content type. **No bar.**
4. Answers (relevance 2): share by type. **No bar.**
5. Blocked: share by type. **No bar.**

Definitions used here, taken from the result fields. Relevance is 0 (nothing useful), 1 (gist or related), 2 (answers the ask). **Reachable** = fetch OK and not flagged blocked (82 of 96). **Blocked** = blocked flag set (12 of 96): 10 failed to fetch (403 walls, 404/410, dropped connection) and 2 fetched but were a wall (a member-only story and a waiting room). 2 more sites failed to fetch without being a wall (a protocol error and a timeout); they count as not reachable and not blocked. `junkShown` is the harness's judgment that a snip a person would see presented as content was junk. On walled pages this is a naive-display judgment: the snip text was a wall or expiry notice.

## 2. Results against the bars

| Bar | Target | Result | Verdict |
|---|---|---|---|
| 1. Every snip verbatim | 100% | 93/96 sites all-verbatim (97%). Of the 82 reachable sites, 79 (96%). Blocked sites are vacuous (nothing, or only wall text). 3 sites had a snip that failed the check: one academic, one apidocs, one news. In each, the failing text was an impression or baseline snip stitched across fragments or carrying markup. | **FAIL** |
| 2. Junk shown as content | <= 5% of sites | 79/96 sites (82%). Of the 82 reachable sites, 72 (88%). Only 17 sites were clean. | **FAIL, by a wide margin** |
| 3. Relevance >= 1 | no bar | 78/82 reachable sites (95%). Tables 2.2 and 2.3. | reported |
| 4. Answers (relevance 2) | no bar | 39/82 reachable sites (48%). Mean relevance on reachable sites 1.43. Table 2.1. | reported |
| 5. Blocked | no bar | 12/96 sites (13%). Table 2.1. | reported |

Both pass/fail bars fail. Bar 1 is close (3 sites, all in the lower rungs). Bar 2 is not close.

One pattern in bar 2 is exact in this data. All 72 reachable sites with junk had the impression rung (c) among their snips. Half of the 10 reachable clean sites (5) had a declared structured block; the other 5 were clean pages with no chrome problem. Declared structure alone does not prevent junk: 14 of the 19 reachable sites with a declared block still showed junk, because the lower rungs were displayed beside it. Only 2 reachable sites lacked rung c at all, so this is suggestive, not proven. It points at rung c as the main place junk enters.

### 2.1 Per type: reachability, relevance, junk, contact, tip route

Contact and tip-route counts are over all sites of the type, including blocked ones. "none" for contact means no contact path was found on a page that could be read. "blocked" means the wall hid it.

| Type | Sites | Reachable | Blocked | Mean relevance (reachable) | Junk shown | Contact: email / form / none / blocked | Tip route: tip-link / social / none |
|---|---|---|---|---|---|---|---|
| academic | 4 | 4 | 0 | 1.50 | 4 | 2 / 0 / 2 / 0 | 0 / 2 / 2 |
| apidocs | 4 | 4 | 0 | 1.25 | 3 | 1 / 0 / 3 / 0 | 0 / 1 / 3 |
| blog | 4 | 3 | 1 | 1.33 | 3 | 2 / 0 / 2 / 0 | 1 / 2 / 1 |
| changelog | 4 | 4 | 0 | 1.25 | 4 | 0 / 0 / 4 / 0 | 0 / 3 / 1 |
| encyclopedia | 4 | 4 | 0 | 1.50 | 2 | 2 / 1 / 1 / 0 | 1 / 2 / 1 |
| events | 4 | 4 | 0 | 1.25 | 3 | 2 / 0 / 2 / 0 | 0 / 3 / 1 |
| forum | 4 | 4 | 0 | 1.00 | 4 | 1 / 1 / 2 / 0 | 0 / 1 / 3 |
| government | 4 | 3 | 1 | 1.33 | 4 | 0 / 0 / 3 / 1 | 0 / 3 / 1 |
| health | 4 | 3 | 1 | 1.33 | 4 | 2 / 0 / 1 / 1 | 0 / 2 / 2 |
| jobs | 4 | 2 | 2 | 0.50 | 3 | 1 / 1 / 2 / 0 | 0 / 3 / 1 |
| legal | 4 | 4 | 0 | 1.75 | 4 | 1 / 0 / 3 / 0 | 1 / 1 / 2 |
| literature | 4 | 4 | 0 | 1.25 | 3 | 2 / 0 / 2 / 0 | 3 / 1 / 0 |
| localbiz | 4 | 3 | 1 | 1.33 | 4 | 2 / 1 / 0 / 1 | 0 / 2 / 2 |
| museum | 4 | 4 | 0 | 1.25 | 4 | 4 / 0 / 0 / 0 | 0 / 4 / 0 |
| news | 4 | 4 | 0 | 2.00 | 3 | 1 / 0 / 3 / 0 | 0 / 3 / 1 |
| nonenglish | 5 | 4 | 0 | 1.50 | 4 | 1 / 0 / 4 / 0 | 1 / 2 / 2 |
| podcast | 4 | 4 | 0 | 1.75 | 4 | 3 / 0 / 1 / 0 | 0 / 4 / 0 |
| product | 6 | 2 | 3 | 2.00 | 3 | 2 / 0 / 1 / 3 | 0 / 2 / 4 |
| readme | 4 | 4 | 0 | 1.75 | 3 | 1 / 0 / 3 / 0 | 2 / 1 / 1 |
| realestate | 5 | 3 | 2 | 1.67 | 4 | 1 / 0 / 2 / 2 | 0 / 2 / 3 |
| recipe | 4 | 4 | 0 | 1.75 | 2 | 2 / 0 / 2 / 0 | 0 / 3 / 1 |
| sports | 4 | 4 | 0 | 1.00 | 4 | 1 / 0 / 3 / 0 | 0 / 2 / 2 |
| travel | 4 | 3 | 1 | 1.33 | 3 | 0 / 1 / 2 / 1 | 0 / 1 / 3 |
| **All 23 types** | 96 | 82 | 12 | 1.43 | 79 | 34 / 5 / 48 / 9 | 9 / 50 / 37 |

### 2.2 Per type against the bars

Relevance and answers are shares of reachable sites. Blocked and junk are shares of all sites of the type. Four sites per type is small: one site is 25 points. Do not rank types on one-site differences.

| Type | Sites | Rel>=1 of reachable | Answers (rel 2) of reachable | Blocked of sites | Junk of sites | Snip not verbatim (sites) |
|---|---|---|---|---|---|---|
| academic | 4 | 4/4 (100%) | 2/4 (50%) | 0/4 (0%) | 4/4 (100%) | 1 |
| apidocs | 4 | 4/4 (100%) | 1/4 (25%) | 0/4 (0%) | 3/4 (75%) | 1 |
| blog | 4 | 3/3 (100%) | 1/3 (33%) | 1/4 (25%) | 3/4 (75%) | 0 |
| changelog | 4 | 4/4 (100%) | 1/4 (25%) | 0/4 (0%) | 4/4 (100%) | 0 |
| encyclopedia | 4 | 4/4 (100%) | 2/4 (50%) | 0/4 (0%) | 2/4 (50%) | 0 |
| events | 4 | 3/4 (75%) | 2/4 (50%) | 0/4 (0%) | 3/4 (75%) | 0 |
| forum | 4 | 4/4 (100%) | 0/4 (0%) | 0/4 (0%) | 4/4 (100%) | 0 |
| government | 4 | 3/3 (100%) | 1/3 (33%) | 1/4 (25%) | 4/4 (100%) | 0 |
| health | 4 | 3/3 (100%) | 1/3 (33%) | 1/4 (25%) | 4/4 (100%) | 0 |
| jobs | 4 | 1/2 (50%) | 0/2 (0%) | 2/4 (50%) | 3/4 (75%) | 0 |
| legal | 4 | 4/4 (100%) | 3/4 (75%) | 0/4 (0%) | 4/4 (100%) | 0 |
| literature | 4 | 3/4 (75%) | 2/4 (50%) | 0/4 (0%) | 3/4 (75%) | 0 |
| localbiz | 4 | 3/3 (100%) | 1/3 (33%) | 1/4 (25%) | 4/4 (100%) | 0 |
| museum | 4 | 4/4 (100%) | 1/4 (25%) | 0/4 (0%) | 4/4 (100%) | 0 |
| news | 4 | 4/4 (100%) | 4/4 (100%) | 0/4 (0%) | 3/4 (75%) | 1 |
| nonenglish | 5 | 4/4 (100%) | 2/4 (50%) | 0/5 (0%) | 4/5 (80%) | 0 |
| podcast | 4 | 4/4 (100%) | 3/4 (75%) | 0/4 (0%) | 4/4 (100%) | 0 |
| product | 6 | 2/2 (100%) | 2/2 (100%) | 3/6 (50%) | 3/6 (50%) | 0 |
| readme | 4 | 4/4 (100%) | 3/4 (75%) | 0/4 (0%) | 3/4 (75%) | 0 |
| realestate | 5 | 3/3 (100%) | 2/3 (67%) | 2/5 (40%) | 4/5 (80%) | 0 |
| recipe | 4 | 4/4 (100%) | 3/4 (75%) | 0/4 (0%) | 2/4 (50%) | 0 |
| sports | 4 | 3/4 (75%) | 1/4 (25%) | 0/4 (0%) | 4/4 (100%) | 0 |
| travel | 4 | 3/3 (100%) | 1/3 (33%) | 1/4 (25%) | 3/4 (75%) | 0 |
| **All** | 96 | 78/82 (95%) | 39/82 (48%) | 12/96 (13%) | 79/96 (82%) | 3 |

### 2.3 By rung

Rungs: a = structured block the page declares, b = meta description, c = impression (sentences that differ the ask), d = lexical baseline. The result files record which rungs produced a snip for each site, but give one relevance score per site, not one per rung. So the table below is conditional on the rung being present. It is not credit assigned to that rung. The rungs overlap heavily (most sites have three or four), so these numbers are not independent.

| Rung | Reachable sites where it produced a snip | Relevance >= 1 | Relevance 2 | Sites with junk shown |
|---|---|---|---|---|
| a, declared structured block | 19 | 19 (100%) | 11 (58%) | 14 |
| b, meta description | 54 | 54 (100%) | 29 (54%) | 48 |
| c, impression | 80 | 76 (95%) | 37 (46%) | 72 |
| d, lexical baseline | 75 | 71 (95%) | 36 (48%) | 68 |

By the first (leading) rung only: leading a, 19 sites, all relevance >= 1, 11 answers. Leading b, 37 sites, all relevance >= 1, 19 answers. Leading c, 26 sites, 22 relevance >= 1, 9 answers. Rung d never led. Read this as a hint: when a page declares structure or has a meta description, the lead snip is reliably at least a gist (56 of 56). When the ladder has to start at rung c, 4 of 26 leading cases (15%) were relevance 0.

Caveat on the "100%" for a and b: relevance 1 includes "a one-line gist of the page", so a meta description clears that bar almost by being there. Rung b answers (relevance 2) a specific ask only 54% of the time.

Relevance 0 on a reachable site happened 4 times of 82 (5%). All blocked sites but one (the member-only story, relevance 1) are relevance 0, as are the 2 non-wall fetch failures.

## 3. Overall

| Measure | Value |
|---|---|
| Content types run / missing | 23 / 2 (howto, reviews) |
| Sites | 96 |
| Reachable | 82 (85%) |
| Blocked | 12 (13%) |
| Failed, not a wall | 2 (2%) |
| Mean relevance, reachable | 1.43 |
| Relevance 0 / 1 / 2, reachable | 4 / 39 / 39 |
| Relevance >= 1, reachable | 78 (95%) |
| Answers (relevance 2), reachable | 39 (48%) |
| Junk shown, all sites / reachable | 79 (82%) / 72 (88%) |
| All snips verbatim, all sites / reachable | 93 (97%) / 79 (96%) |
| Contact: email / form / none / wall | 34 / 5 / 48 / 9 |
| Tip route: tip-link / social / none | 9 / 50 / 37 |

Answers by type, best to worst, with the 4-site caveat. Best: news 4 of 4, legal 3 of 4, podcast 3 of 4, readme 3 of 4, recipe 3 of 4. Worst (no answers, or 1 of 4): forum 0, jobs 0 of 2 reachable, then apidocs, blog, changelog, government, health, localbiz, museum, sports, travel at 1 each. Structured data types (news, recipe) and prose-heavy types (legal) do best. Tables, code, listings and walled pages do worst.

Blocked, worst first: product 3 of 6, jobs 2 of 4, realestate 2 of 5, then one of four each in blog, government, health, localbiz, travel. The commerce, listing and ATS sites are where walls cluster. 15 of 23 types had no blocked site.

## 4. Failure modes, ranked

Ranked by how many of the 23 types' own failure-mode statements name the cause. A type can name several. Counts are my reading of those statements.

1. **Page chrome leads the snip (nav, menus, cookie and consent text, banners, skip links, inlined CSS, session or player markup).** Named by all 23 types. This is the main cause of the bar 2 failure. It mostly hits rungs c and d, which start from page text with no notion of where the content is.
2. **Meta description is clean but only a gist.** About 6 types (academic, apidocs, museum, news, podcast, readme). Safe and verbatim, but it rarely answers a specific ask.
3. **The answer is in a table, a code block, a list or client-rendered widgets, not in sentences.** About 6 types (apidocs, changelog, events, sports, literature, travel). Sentence snipping picks neighbouring prose or menu text.
4. **Walls, expiry and member-only gates shown or showable as content.** About 8 types (government, health, jobs, localbiz, product, realestate, travel, blog). The wall text can be returned as a snip. In health the harness's own wall heuristic stayed false on a 403 wall, a real gap: the wall text was returned as a snip. A member-only story and a queue page also fetched with status OK, so a status-code check alone would miss them.
5. **Long pages bury the answer.** About 4 types (academic, encyclopedia, legal, museum). Truncation, tables of contents and bibliographies sit ahead of the passage.
6. **Not-verbatim stitches.** 3 sites. Fragments joined across menus and markup fail the page check. This is the whole of bar 1's failure.
7. **No declared answer to pick (forum).** The ladder does not tell an accepted answer from other posts.
8. **Non-English text.** The ranker falls back to chrome text, and CJK or RTL text without spaces or with sidebars gives junk-led snips even when the answer is on the page. This is one type, with 5 sites.
9. **Unmeasured:** howto and reviews did not run.

## 5. What snipping cannot do

This is the honest part.

- **Snipping cannot answer a question the page does not state in findable prose.** It cuts and cites, it does not compute or read a table. Sports figures, API parameter semantics, changelog diffs and event dates held in widgets are out of reach unless the page declares them. This is by design (find, snip and cite, never rewrite), so the ceiling is the page.
- **It cannot get past a wall, and it must not try.** About 13% of sites here were walls, higher for commerce, listings and job boards. The right behavior is to say so and hand the person to the real page. No circumvention was attempted in any run.
- **It cannot tell content from chrome without help.** Rungs c and d have no sense of main content. Without a content-region step or a junk filter, they will keep surfacing boilerplate. A snip that is verbatim but is a cookie banner is still a wrong answer.
- **It cannot tell which sentence is the answer when many sentences are on topic.** Of reachable sites 52% were not relevance 2. Many were relevance 1: the right page, a gist, not the asked-for fact.
- **It cannot resolve who the creator is.** Contact and social links found are often the site's or publisher's, not the individual creator's (several notes say so). Where the site is a platform, a tip or contact link goes to the platform.
- **It cannot read JavaScript-rendered pages the fetch never rendered**, expired pages, or pages that fail at the protocol level. Those yield nothing.
- **Small sample.** 4 sites per type, 23 types, sites picked from search results, except museum, which used four well-known object pages from memory because search was rate-limited. Relevance and junk are single-rater judgments from the run notes. This measures failure modes well and rates poorly.
- **The rung table is not attribution**, as noted in 2.3. The files do not say which rung produced the relevance score.

## 6. Concrete next fixes

In rough order of payoff against the bars.

1. **Junk gate on every displayed snip (bar 2).** Reject or demote any snip whose text matches chrome patterns: cookie or consent, "skip to", sign in, subscribe, access denied, verification, "no longer available", inlined CSS or markup. Where a or b exist, lead with them and show c and d only if they pass. Every junk case here had rung c, and having a declared block was not enough (14 of 19 such sites still showed junk) because c and d were displayed too.
2. **Make blocked-like detection real.** The flag stayed false on a 403 wall in one case and missed a member-only story and a waiting room. Detect on status codes (403, 404, 410, 429), wall phrases and queue pages, and suppress the snip entirely. Replace it with the fallback in fix 5.
3. **Fix the three verbatim failures (bar 1).** Re-check every stitched snip against the page after joining, and drop any piece that fails rather than ship the stitch. Strip markup from fragments before the check. This should close bar 1.
4. **Content-region step before rungs c and d.** Start sentence scoring after nav and banner regions (main, article, or the densest text block), and cut inlined CSS. This addresses failure mode 1, the largest.
5. **Reach fallbacks per the user's steer, when we cannot tip or cannot read:**
   - If the page cannot be snipped (blocked, expired, failed fetch), send the person to the original site in a new browser tab, with a plain message that it could not be read here. Do not show wall text as content.
   - If there is no tip route, try the creator's social, then the site in a new tab (section 7).
6. **Per-type handling:** a table and code reader for apidocs, sports and changelog (still verbatim, but pick the cell or block rather than prose); a render step or honest "needs the live page" for events and literature; the declared-structure rung extended to more types (Article, FAQ, QAPage, Product, Event).
7. **Non-English.** Add language detection and sentence segmentation for CJK and RTL before ranking (the langid prereg already points this way), and test it on its own.
8. **Run the two missing types** (howto, reviews) once WebSearch is available, and rerun with more than 4 sites per type before treating any per-type number as stable. Record per-rung relevance in the harness so the rung table can be an attribution, not a presence count.
9. **Record social platforms for every site.** Only 3 sites in the results carry a platform list, so platform coverage cannot be reported.

## 7. Contact and tip coverage

No addresses are listed. Counts only. "Tip link" means a page-declared support or tip route (donate, sponsor, support link). "Social" means a social profile route was found with no tip link. "None" means neither was found. The fallback in the user's steer is: tip link first, else social, else the site in a new browser tab.


### 7.0 Coverage by type (7.1 and 7.2 follow)

| Type | Sites | Email contact | Form contact | No contact found | Contact not checkable (wall) | Tip link | Social only | No tip/social | Any tip-or-social route |
|---|---|---|---|---|---|---|---|---|---|
| academic | 4 | 2 | 0 | 2 | 0 | 0 | 2 | 2 | 2/4 (50%) |
| apidocs | 4 | 1 | 0 | 3 | 0 | 0 | 1 | 3 | 1/4 (25%) |
| blog | 4 | 2 | 0 | 2 | 0 | 1 | 2 | 1 | 3/4 (75%) |
| changelog | 4 | 0 | 0 | 4 | 0 | 0 | 3 | 1 | 3/4 (75%) |
| encyclopedia | 4 | 2 | 1 | 1 | 0 | 1 | 2 | 1 | 3/4 (75%) |
| events | 4 | 2 | 0 | 2 | 0 | 0 | 3 | 1 | 3/4 (75%) |
| forum | 4 | 1 | 1 | 2 | 0 | 0 | 1 | 3 | 1/4 (25%) |
| government | 4 | 0 | 0 | 3 | 1 | 0 | 3 | 1 | 3/4 (75%) |
| health | 4 | 2 | 0 | 1 | 1 | 0 | 2 | 2 | 2/4 (50%) |
| jobs | 4 | 1 | 1 | 2 | 0 | 0 | 3 | 1 | 3/4 (75%) |
| legal | 4 | 1 | 0 | 3 | 0 | 1 | 1 | 2 | 2/4 (50%) |
| literature | 4 | 2 | 0 | 2 | 0 | 3 | 1 | 0 | 4/4 (100%) |
| localbiz | 4 | 2 | 1 | 0 | 1 | 0 | 2 | 2 | 2/4 (50%) |
| museum | 4 | 4 | 0 | 0 | 0 | 0 | 4 | 0 | 4/4 (100%) |
| news | 4 | 1 | 0 | 3 | 0 | 0 | 3 | 1 | 3/4 (75%) |
| nonenglish | 5 | 1 | 0 | 4 | 0 | 1 | 2 | 2 | 3/5 (60%) |
| podcast | 4 | 3 | 0 | 1 | 0 | 0 | 4 | 0 | 4/4 (100%) |
| product | 6 | 2 | 0 | 1 | 3 | 0 | 2 | 4 | 2/6 (33%) |
| readme | 4 | 1 | 0 | 3 | 0 | 2 | 1 | 1 | 3/4 (75%) |
| realestate | 5 | 1 | 0 | 2 | 2 | 0 | 2 | 3 | 2/5 (40%) |
| recipe | 4 | 2 | 0 | 2 | 0 | 0 | 3 | 1 | 3/4 (75%) |
| sports | 4 | 1 | 0 | 3 | 0 | 0 | 2 | 2 | 2/4 (50%) |
| travel | 4 | 0 | 1 | 2 | 1 | 0 | 1 | 3 | 1/4 (25%) |
| **All** | 96 | 34 | 5 | 48 | 9 | 9 | 50 | 37 | 59/96 (61%) |

### 7.1 Overall coverage

| Measure | All 96 | Reachable 82 |
|---|---|---|
| Email contact | 34 (35%) | 33 (40%) |
| Form contact | 5 (5%) | 4 (5%) |
| Email or form | 39 (41%) | 37 (45%) |
| No contact found | 48 (50%) | 45 (55%) |
| Contact unchecked, wall | 9 (9%) | 0 |
| Tip link | 9 (9%) | 9 (11%) |
| Social, no tip link | 50 (52%) | 49 (60%) |
| Neither tip nor social | 37 (39%) | 24 (29%) |
| Any tip-or-social route | 59 (61%) | 58 (71%) |

Email vs form vs none, plainly: half of the sites gave no contact path at all; of the other half, email is about seven times more common than a form. Form was rare (5 sites).

Tip link vs social vs none: a real tip link was found on 1 site in 11. Social was the usual route (about 6 in 10 reachable sites). With the social route as the first fallback, about 7 in 10 reachable sites have some route to the creator or site; 3 in 10 have only the new-tab fallback to the site itself.

Types with the most tip links: literature 3 of 4 (donate links on public-domain and library sites), readme 2 of 4. Four more types had one each (blog, encyclopedia, legal, nonenglish) and the rest had none. Museum and podcast had social on every site and no tip link. Literature had the best any-route coverage (4 of 4, three tip links). Apidocs, forum, travel and product had no route on 3 or 4 of their sites.

### 7.2 Caveats on this coverage

- The tip-link and social findings are page-level and often belong to the site or publisher, not the individual creator. Several notes say the socials found were a publisher's or a government agency's. A "social" route is a route to the site's account, not necessarily to the person who made the thing.
- Contact emails are mostly a site-level about or contact page, not an author. About 4 notes explicitly say the contact is not an author.
- Most blocked sites carry no tip or contact information (the wall hid it; 9 sites have contact marked blocked). For these the only route is the site in a new tab, which the person's own browser can pass.
- 47 of 50 social findings have no platform list in the results, so a platform breakdown (X, Facebook, Instagram, etc.) cannot be given. Where it was recorded (3 sites), it ranged from 2 to 7 platforms.
- No tip was attempted and none sent. These are discovery counts only.
- A new-tab link to the site is always possible (96 of 96 sites have a URL), which is what makes the fallback complete. It is the same route whether the page was snipped or not.
