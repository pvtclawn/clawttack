# Clawttack Progress Report Template

Use this template for digests, PR summaries, and mechanism-adjacent status updates.

## Required classification

```yaml
progressType: governance | mechanism | mixed
baselineStatus: changed | unchanged | unknown
baselineScope: <topline window / subgroup / metric family>

governanceStatus: changed | unchanged | unknown
mechanismStatus: changed | unchanged | unknown
reportingQualityStatus: changed | unchanged | unknown
evidenceQualityStatus: changed | unchanged | unknown

governanceOnlyStreak: <number | unknown>
mechanismDeltaOverdue: yes | no | unknown
```

## Core meanings

- **governanceStatus** = process, policy, merge controls, reviewability, workflow discipline.
- **mechanismStatus** = battle rules, incentives, measured battle/simulation/on-chain outcome behavior.
- **reportingQualityStatus** = clearer categorization, tighter wording, better summaries/templates, less narrative ambiguity.
- **evidenceQualityStatus** = stronger provenance, auditability, consumer parity, artifact integrity, reproducibility, or trust-surface quality.

**Important:** a better template/checklist/report usually changes `governanceStatus` and/or `reportingQualityStatus` first. It should change `evidenceQualityStatus` only if the underlying trust surface improved, not merely the wording.

## Rules

1. **No umbrella claims.**
   Do not say "the system improved", "the arena is stronger", or similar blended claims unless the update is broken down by category below.

2. **Mechanism status must be stated plainly in the summary.**
   Every summary must include one explicit sentence saying whether mechanism status changed, stayed unchanged, or is unknown.

3. **Baseline disclosure is mandatory for mechanism-adjacent work.**
   If the update touches battle rules, battle surfaces, verification artifacts, migration safety, or evaluation/reporting of mechanism behavior, include `baselineStatus`, `baselineScope`, and a proof link.

4. **Mixed updates must be split by category.**
   If `progressType: mixed`, governance, mechanism, reporting quality, and evidence quality changes must appear in separate blocks.

5. **Flat mechanism baselines must be stated plainly.**
   If battle/resultType baseline is unchanged, say so explicitly. Do not imply mechanism improvement from governance/process wins.

6. **Self-referential proof is not enough for evidence-quality claims.**
   If a template/policy/checklist claims better truthfulness or auditability, do not use that same artifact as the only proof of `evidenceQualityStatus: changed` when independent corroboration exists. Mark self-referential proof as `internal-only`.

7. **Avoid category laundering.**
   Governance + evidence-quality language must not be written in a way that emotionally implies arena-strength improvement when `mechanismStatus` is unchanged.

8. **Governance-only streaks must stay visible.**
   Repeated governance/reporting wins with flat mechanism outcomes should be tracked, not hidden. If mechanism deltas are overdue, say so plainly.

## Prohibited / discouraged phrasing

Avoid these when `mechanismStatus != changed`:
- "the arena is stronger"
- "the system improved" (without category breakdown)
- "security improved" when only wording/template clarity changed
- "mechanism hardening" for pure policy/reporting/template updates

Prefer:
- "reviewability improved"
- "reporting discipline improved"
- "governance controls improved"
- "evidence boundaries are clearer"
- "mechanism outcomes remain unchanged"

## Proof guidance

Use proof labels when helpful:
- `independent` = separate artifact/output corroborates the claim
- `internal-only` = artifact mainly proves its own existence, not an independent trust-surface delta

For `evidenceQualityStatus: changed`, prefer at least one `independent` proof when available.

## Compact digest template

```md
## Progress Update — <date/time>

- progressType: <governance|mechanism|mixed>
- baselineStatus: <changed|unchanged|unknown>
- baselineScope: <topline window / subgroup / metric family>
- governanceStatus: <changed|unchanged|unknown>
- mechanismStatus: <changed|unchanged|unknown>
- reportingQualityStatus: <changed|unchanged|unknown>
- evidenceQualityStatus: <changed|unchanged|unknown>
- governanceOnlyStreak: <number|unknown>
- mechanismDeltaOverdue: <yes|no|unknown>

### Governance / reviewability
- Status: <changed|unchanged|unknown>
- What changed:
  - <artifact/process delta>
- Proof:
  - <proof label: independent|internal-only> — <commit/doc/link>

### Mechanism / outcome
- Status: <changed|unchanged|unknown>
- Baseline:
  - <changed|unchanged|unknown>
- Scope:
  - <topline window / subgroup / metric family>
- What changed:
  - <battle-rule / incentive / measured outcome delta>
- Proof:
  - <proof label: independent|internal-only> — <artifact/sim/on-chain link>

### Reporting quality
- Status: <changed|unchanged|unknown>
- What changed:
  - <template/wording/clarity delta>
- Proof:
  - <proof label: independent|internal-only> — <doc/example/link>

### Evidence quality / trust surface
- Status: <changed|unchanged|unknown>
- What changed:
  - <artifact integrity / provenance / consumer parity / auditability delta>
- Proof:
  - <proof label: independent|internal-only> — <doc/artifact/link>

### Plain-English summary
- Mechanism status: <changed|unchanged|unknown>.
- <1–2 sentence summary that does NOT blur categories>
```

## Minimal PR-summary template

```md
- progressType: <governance|mechanism|mixed>
- baselineStatus: <changed|unchanged|unknown>
- baselineScope: <topline window / subgroup / metric family>
- governanceStatus: <changed|unchanged|unknown>
- mechanismStatus: <changed|unchanged|unknown>
- reportingQualityStatus: <changed|unchanged|unknown>
- evidenceQualityStatus: <changed|unchanged|unknown>
- governanceOnlyStreak: <number|unknown>
- mechanismDeltaOverdue: <yes|no|unknown>
- governanceProof: <proof label + link>
- mechanismProof: <proof label + link>
- reportingQualityProof: <proof label + link>
- evidenceQualityProof: <proof label + link>
```

## Example — governance/reporting update with unchanged mechanism

```md
## Progress Update — 2026-03-08 20:40 UTC

- progressType: governance
- baselineStatus: unchanged
- baselineScope: resultType baseline, battles [20..29]
- governanceStatus: changed
- mechanismStatus: unchanged
- reportingQualityStatus: changed
- evidenceQualityStatus: unchanged
- governanceOnlyStreak: 4
- mechanismDeltaOverdue: yes

### Governance / reviewability
- Status: changed
- What changed:
  - Added explicit progress-report classification and anti-inflation structure.
- Proof:
  - internal-only — docs/research/PROGRESS-REPORT-TEMPLATE.md

### Mechanism / outcome
- Status: unchanged
- Baseline:
  - unchanged
- Scope:
  - resultType baseline, battles [20..29]
- What changed:
  - No mechanism delta in battle rules or measured outcomes.
- Proof:
  - independent — memory/metrics/resulttype-baseline-2026-03-08.json

### Reporting quality
- Status: changed
- What changed:
  - Reports now force category labels, baseline scope, and explicit mechanism-status language.
- Proof:
  - internal-only — docs/research/PROGRESS-REPORT-TEMPLATE.md

### Evidence quality / trust surface
- Status: unchanged
- What changed:
  - No independent trust-surface delta beyond clearer reporting structure.
- Proof:
  - independent — memory/metrics/resulttype-baseline-2026-03-08.json

### Plain-English summary
- Mechanism status: unchanged.
- Reporting discipline and governance controls improved, but battle outcomes did not measurably improve in this update.
```

## Anti-inflation checklist

Before sending a report, verify:
- [ ] `progressType` is explicit.
- [ ] `baselineStatus` is explicit for mechanism-adjacent work.
- [ ] `baselineScope` is explicit.
- [ ] Governance, mechanism, reporting quality, and evidence quality deltas are not blended.
- [ ] Plain-English summary includes an explicit `Mechanism status:` sentence.
- [ ] Flat baselines are stated plainly when applicable.
- [ ] Evidence-quality claims use independent proof when available.
- [ ] Self-referential proof is labeled `internal-only`.
- [ ] Governance-only streak / overdue-mechanism context is not silently hidden.
