# Clawttack Progress Report Template

Use this template for digests, PR summaries, and mechanism-adjacent status updates.

## Required classification

```yaml
progressType: governance | mechanism | mixed
baselineStatus: changed | unchanged | unknown

governanceStatus: changed | unchanged | unknown
mechanismStatus: changed | unchanged | unknown
evidenceQualityStatus: changed | unchanged | unknown
```

## Rules

1. **No umbrella claims.**
   Do not say "the system improved", "the arena is stronger", or similar blended claims unless the update is broken down by category below.

2. **Baseline disclosure is mandatory for mechanism-adjacent work.**
   If the update touches battle rules, battle surfaces, verification artifacts, migration safety, or evaluation/reporting of mechanism behavior, include `baselineStatus` and a proof link.

3. **Mixed updates must be split by category.**
   If `progressType: mixed`, governance, mechanism, and evidence-quality changes must appear in separate blocks.

4. **Flat mechanism baselines must be stated plainly.**
   If battle/resultType baseline is unchanged, say so explicitly. Do not imply mechanism improvement from governance/process wins.

5. **Evidence-quality is its own category.**
   Improved reviewability, auditability, consumer parity, provenance, or artifact trust should be reported as `evidenceQualityStatus` or `governanceStatus`, not as mechanism progress unless outcome evidence itself moved.

## Compact digest template

```md
## Progress Update — <date/time>

- progressType: <governance|mechanism|mixed>
- baselineStatus: <changed|unchanged|unknown>
- governanceStatus: <changed|unchanged|unknown>
- mechanismStatus: <changed|unchanged|unknown>
- evidenceQualityStatus: <changed|unchanged|unknown>

### Governance / reviewability
- Status: <changed|unchanged|unknown>
- What changed:
  - <artifact/process delta>
- Proof:
  - <commit/doc/link>

### Mechanism / outcome
- Status: <changed|unchanged|unknown>
- Baseline:
  - <changed|unchanged|unknown>
- What changed:
  - <battle-rule / incentive / measured outcome delta>
- Proof:
  - <artifact/sim/on-chain link>

### Evidence quality / trust surface
- Status: <changed|unchanged|unknown>
- What changed:
  - <artifact integrity / provenance / consumer parity / auditability delta>
- Proof:
  - <doc/artifact/link>

### Plain-English summary
- <1–2 sentence summary that does NOT blur categories>
```

## Minimal PR-summary template

```md
- progressType: <governance|mechanism|mixed>
- baselineStatus: <changed|unchanged|unknown>
- governanceStatus: <changed|unchanged|unknown>
- mechanismStatus: <changed|unchanged|unknown>
- evidenceQualityStatus: <changed|unchanged|unknown>
- governanceProof: <link>
- mechanismProof: <link>
- evidenceQualityProof: <link>
```

## Example — governance-only update

```md
## Progress Update — 2026-03-08 20:20 UTC

- progressType: governance
- baselineStatus: unchanged
- governanceStatus: changed
- mechanismStatus: unchanged
- evidenceQualityStatus: changed

### Governance / reviewability
- Status: changed
- What changed:
  - Added PR #8 split-series execution note and explicit merge-gate language.
- Proof:
  - docs/research/PR8-SPLIT-SERIES-EXECUTION-NOTE.md

### Mechanism / outcome
- Status: unchanged
- Baseline:
  - unchanged
- What changed:
  - No mechanism delta in battle rules or measured outcomes.
- Proof:
  - memory/metrics/resulttype-baseline-2026-03-08.json

### Evidence quality / trust surface
- Status: changed
- What changed:
  - Migration reviewability improved through explicit consumer-parity and replacement-mapping gates.
- Proof:
  - docs/research/PR8-SPLIT-SERIES-EXECUTION-NOTE.md

### Plain-English summary
- Reviewability improved, but the mechanism did not measurably improve in this update; the baseline stayed flat.
```

## Anti-inflation checklist

Before sending a report, verify:
- [ ] `progressType` is explicit.
- [ ] `baselineStatus` is explicit for mechanism-adjacent work.
- [ ] Governance, mechanism, and evidence-quality deltas are not blended.
- [ ] Flat baselines are stated plainly when applicable.
- [ ] Each changed category has at least one proof link.
