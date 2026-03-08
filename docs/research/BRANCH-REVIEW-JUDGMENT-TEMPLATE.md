# Branch Review Judgment Template

Use this template when giving a merge/no-merge judgment on a branch or PR.

## Required fields

```yaml
reviewedRef: <commit sha / fetched ref>
judgmentType: prHead | mergeCandidate
reviewScope:
  - runtimeConsumers
  - docs
  - typecheck
  - tests
  - ciStatus
  - mergeState
codeImpact: none | unknown | changed
mechanismImpact: none | unknown | changed
semanticConfidence: low | medium | high
invalidatedPriorBlockers:
  - <previous blocker no longer present on reviewedRef>
remainingCurrentBlockers:
  - <blocker still present on reviewedRef>
envNoise:
  - <local/dependency/tooling issue not proven to be branch-state>
notChecked:
  - <areas not reviewed>
```

## Rules

1. **Always pin the exact reviewed ref.**
   Never give a merge judgment against an unpinned local impression.

2. **Always declare scope.**
   `reviewedRef` without `reviewScope` is incomplete and can overstate confidence.

3. **Invalidate stale blockers explicitly.**
   If a previously cited blocker is gone on the reviewed ref, list it under `invalidatedPriorBlockers`.

4. **Separate branch-state from environment-state.**
   If a failure may be local/dependency noise, put it under `envNoise` until proven otherwise.

5. **Distinguish PR head from merge candidate.**
   A `prHead` approval is not automatically a `mergeCandidate` approval.

6. **State code/mechanism impact explicitly.**
   If the review artifact or process improved but the underlying code/mechanism did not, say `codeImpact: none` and `mechanismImpact: none`.

7. **Scope-qualify the verdict.**
   If review coverage is partial, the headline judgment must say so (for example: `mergeable at prHead/runtime+typecheck scope`). Avoid unqualified global `mergeable` when scope is limited.

8. **Use `notChecked` as a real disclosure, not a decorative field.**
   If meaningful areas were not checked, say so plainly. Empty `notChecked` on a partial review is a governance defect.

9. **Freshness is not semantic certainty.**
   `semanticConfidence` exists so a fresh ref review can still admit limited confidence about deeper correctness.

## Scope-qualified verdict examples

**Acceptable:**
- `mergeable at prHead/runtime+typecheck scope`
- `not mergeable at mergeCandidate/docs+tests scope`
- `mergeable with caveats at prHead/runtimeConsumers scope`

**Unacceptable when scope is partial:**
- `mergeable`
- `safe to merge`
- `looks good to me`

## Compact review template

```md
## Branch Review Judgment

- reviewedRef: <sha>
- judgmentType: <prHead|mergeCandidate>
- reviewScope:
  - <scope item>
- codeImpact: <none|unknown|changed>
- mechanismImpact: <none|unknown|changed>
- semanticConfidence: <low|medium|high>
- invalidatedPriorBlockers:
  - <item>
- remainingCurrentBlockers:
  - <item>
- envNoise:
  - <item>
- notChecked:
  - <item>

### Judgment
- <scope-qualified mergeable / not mergeable / mergeable with caveats>

### Rationale
- <1–3 bullets tied only to reviewedRef + declared scope>
```

## Example — stale review corrected by live head

```md
## Branch Review Judgment

- reviewedRef: 56341e3
- judgmentType: prHead
- reviewScope:
  - runtimeConsumers
  - docs
  - typecheck
  - tests
- codeImpact: changed
- mechanismImpact: none
- semanticConfidence: medium
- invalidatedPriorBlockers:
  - `useChain.ts` still using stale `BattleV4Created`
  - active scripts still calling `createBattleV4`
  - stale test name `requiresV4Impl`
- remainingCurrentBlockers:
  - lingering doc drift in active-ish docs (`CHANGELOG.md`, `docs/SKILL.md`)
  - active script naming drift (`packages/sdk/scripts/fight.ts` still importing `V4Fighter`)
- envNoise:
  - `bun test --bail` failing on missing `ethers` in local test env
- notChecked:
  - merge-candidate state against latest base

### Judgment
- mergeable with caveats at prHead/runtimeConsumers+docs+typecheck+tests scope

### Rationale
- Original runtime blockers are no longer present on the reviewed ref.
- Remaining issues are narrower and mostly naming/doc drift.
- Test red signal appears environment-scoped rather than proven branch regression.
```

## Anti-prestige reminders

- A more disciplined review template improves **judgment quality**, not code quality.
- Fresh ref + structured fields does not imply deep semantic review.
- Governance/review artifacts should not be narrated as mechanism progress unless outcome evidence changes.
