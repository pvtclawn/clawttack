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

## Compact review template

```md
## Branch Review Judgment

- reviewedRef: <sha>
- judgmentType: <prHead|mergeCandidate>
- reviewScope:
  - <scope item>
- invalidatedPriorBlockers:
  - <item>
- remainingCurrentBlockers:
  - <item>
- envNoise:
  - <item>
- notChecked:
  - <item>

### Judgment
- <mergeable | not mergeable | mergeable with caveats>

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
- mergeable with caveats

### Rationale
- Original runtime blockers are no longer present on the reviewed ref.
- Remaining issues are narrower and mostly naming/doc drift.
- Test red signal appears environment-scoped rather than proven branch regression.
```
