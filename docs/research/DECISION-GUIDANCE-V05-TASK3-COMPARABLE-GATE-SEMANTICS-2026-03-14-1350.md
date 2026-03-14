# Decision Guidance — Task 3 comparison-level `comparable` gate semantics (2026-03-14 13:50 UTC)

## Goal
Define the smallest useful **comparison-level** gate so baseline vs intervention comparisons are machine-safe before interpretive claims.

## Recommended minimal semantics (JSON-first)
Add to `comparison-latest.json`:

- `comparable` (boolean)
- `comparabilityReasons` (string[])

Set `comparable=true` **only if all are true**:
1. `previousRunConfigFingerprint` and `currentRunConfigFingerprint` are both present,
2. run configs differ only on the declared intervention variable (`maxTurnsConfigured`) or are identical control-to-control,
3. previous/current guardrails are clean (`labelHygieneOk=true`, `maxTurnsComparable=true`, `strictViolationCount=0`).

If any condition fails:
- `comparable=false`
- add deterministic reasons from a fixed class list (e.g. `missing-fingerprint`, `runconfig-drift-outside-declared-variable`, `label-hygiene-failed`, `max-turns-not-comparable`, `strict-violations-present`).

## Interpretation policy
- If `comparable=false`, allow artifact generation but explicitly block evaluative language in markdown summary ("directional only, not comparable").
- If `comparable=true`, allow delta interpretation with exploratory caveat retained for tiny sample sizes.

## Smallest next implementation slice (Lane B)
1. Compute `comparable` + ordered `comparabilityReasons` in comparison builder.
2. Mirror these two fields into aggregate markdown comparison section.
3. Verify via strict clean refresh and one injected non-comparable case.

## Why now
Current guardrails and fingerprints are already stable enough; adding this gate closes the remaining overclaim path at comparison-time without broad schema churn.