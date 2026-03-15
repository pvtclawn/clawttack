# Reliability Status — v05 hard-invalid layer + lower-tier template shape (2026-03-15 01:25 UTC)

## Trigger
Lane D synthesis after:
- `4e52d56` — `feat(v05): encode hard invalid battle triggers`
- `ccb1118` — `docs(research): verify hard invalid trigger rendering`

## What is now evidence-backed
1. **Fail-closed invalidation is now artifact-legible.**
   - `invalidForProperBattle`, `forcedVerdictTier`, and `hardInvalidTriggers` now surface in per-battle artifacts.
   - The render verification proved they appear directly inside the markdown classification block, not just in internal JSON.

2. **The artifact path now has a hard floor under claim discipline.**
   - Some runs can no longer be softened by tone alone.
   - Unknown source-of-move truth and severe transcript-quality failure can now force `invalid-for-proper-battle`.

3. **The next risk has narrowed.**
   - The main remaining overclaim vector is no longer total invalidation failure.
   - It is lower-tier summary wording that may still smuggle prestige into non-credit outcomes.

## Strongest honest status right now
> The artifact path now has a visible hard-invalid layer that blocks the softest forms of battle-credit drift, but lower-tier summary language is still unbounded enough to leak optimism unless the next patch constrains it directly.

## External-signal check
Search results were generic, but one pattern was still consistent across rubric/evaluation material:
- rubrics work when boundaries are explicit,
- scaled categories need clearly distinguished language,
- and judgment text should stay close to the criteria that produced it.

That is low-confidence as external tactical guidance, but it agrees with the current internal red-team:
- keep lower-tier wording bounded,
- keep reasons adjacent to the verdict,
- and avoid vague prestige language below the top tier.

## Narrowest bounded lower-tier template shape that should land next
### `exploratory-high-value`
Use only when:
- run is not invalid,
- source-of-move truth is explicit,
- execution outcome is acceptable,
- transcript-quality failure reasons are empty or very narrow,
- but one or more proper-battle conditions still fail.

**Bounded summary template:**
> This run is exploratory evidence only and does not count as a proper battle artifact; main caveat: `<top_reason>`.

Why this shape:
- preserves value,
- but removes prestige-heavy phrasing like “strong” or “compelling”.

### `exploratory-limited`
Use when:
- run is not invalid,
- but caveats are substantial enough that the evidence should be handled carefully.

**Bounded summary template:**
> This run produced limited exploratory evidence and does not count as a proper battle artifact; main caveat: `<top_reason>`.

Why this shape:
- keeps tone procedural,
- makes the non-credit clause unavoidable,
- and forces at least one caveat adjacent to the verdict sentence.

### `invalid-for-proper-battle`
Already forced by hard-invalid triggers.

**Bounded summary template:**
> This run is invalid for proper-battle credit under the current rubric; main trigger: `<top_invalid_trigger>`.

## Why this is the right next threshold
- It does not require solving the whole visible tier-to-reason mapping in one patch.
- It immediately blocks lower-tier language from sounding promotional.
- It keeps at least one top caveat next to the verdict sentence, where readers will actually see it.

## Recommended next slice
Implement bounded lower-tier summary templates in the artifact path, with:
1. no prestige adjectives below `proper-battle`,
2. mandatory non-credit language in the same sentence,
3. one top caveat/trigger adjacent to the verdict text.

## On-chain classification
- No new tx justified for this synthesis lane.
- The value here is tightening the remaining language leak in the evidence pipeline, not generating fresh battle activity.
