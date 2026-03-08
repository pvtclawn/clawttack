# Clawttack Progress Report Template

Use this template for digests, PR summaries, and mechanism-adjacent status updates.

## Required classification

```yaml
progressType: governance | mechanism | mixed
baselineStatus: changed | unchanged | unknown
baselineScopeType: topline | subgroup | diagnostic | unknown
baselineScope: <topline window / subgroup / metric family>
scopeReason: <why this scope is the right lens>

notImproved: <what core mechanism / evidence surface did not improve>

governanceStatus: changed | unchanged | unknown
mechanismStatus: changed | unchanged | unknown
reportingQualityStatus: changed | unchanged | unknown
evidenceQualityStatus: changed | unchanged | unknown

independentEvidenceStatus: present | absent | unknown

governanceOnlyStreak: <number | unknown>
mechanismDeltaOverdue: yes | no | unknown
```

## Core meanings

- **governanceStatus** = process, policy, merge controls, reviewability, workflow discipline.
- **mechanismStatus** = battle rules, incentives, measured battle/simulation/on-chain outcome behavior.
- **reportingQualityStatus** = clearer categorization, tighter wording, better summaries/templates, less narrative ambiguity.
- **evidenceQualityStatus** = stronger provenance, auditability, consumer parity, artifact integrity, reproducibility, or trust-surface quality.
- **independentEvidenceStatus** = whether claims in this update are corroborated by artifacts other than the policy/template/report being discussed.

**Important:** a better template/checklist/report usually changes `governanceStatus` and/or `reportingQualityStatus` first. It should change `evidenceQualityStatus` only if the underlying trust surface improved, not merely the wording.

## Rules

1. **No umbrella claims.**
   Do not say "the system improved", "the arena is stronger", or similar blended claims unless the update is broken down by category below.

2. **Mechanism status must be stated plainly in the summary.**
   Every summary must include one explicit sentence saying whether mechanism status changed, stayed unchanged, or is unknown.

3. **Say what did not improve.**
   For mechanism-adjacent updates, include a short `notImproved` line naming the unchanged core. This blocks humility-theater that sounds honest while still hiding flat outcomes.

4. **Baseline disclosure is mandatory for mechanism-adjacent work.**
   If the update touches battle rules, battle surfaces, verification artifacts, migration safety, or evaluation/reporting of mechanism behavior, include `baselineStatus`, `baselineScopeType`, `baselineScope`, `scopeReason`, and a proof link.

5. **Mixed updates must be split by category.**
   If `progressType: mixed`, governance, mechanism, reporting quality, and evidence quality changes must appear in separate blocks.

6. **Flat mechanism baselines must be stated plainly.**
   If battle/resultType baseline is unchanged, say so explicitly. Do not imply mechanism improvement from governance/process wins.

7. **Self-referential proof is not enough for evidence-quality claims.**
   If a template/policy/checklist claims better truthfulness or auditability, do not use that same artifact as the only proof of `evidenceQualityStatus: changed` when independent corroboration exists. Mark self-referential proof as `internal-only`.

8. **Avoid category laundering.**
   Governance + evidence-quality language must not be written in a way that emotionally implies arena-strength improvement when `mechanismStatus` is unchanged.

9. **Governance-only streaks must stay visible.**
   Repeated governance/reporting wins with flat mechanism outcomes should be tracked, not hidden. If mechanism deltas are overdue, say so plainly.

10. **Scope choice must be justified.**
   If `baselineScopeType != topline`, explain why the narrower scope is the right lens. Do not use subgroup-only evidence to imply broad mechanism improvement without justification.

11. **Internal-only evidence must stay visible.**
   If `independentEvidenceStatus: absent`, say plainly that the update relies on internal artifacts and should not be overinterpreted.

## Prohibited / discouraged phrasing

Avoid these when `mechanismStatus != changed`:
- "the arena is stronger"
- "the system improved" (without category breakdown)
- "security improved" when only wording/template clarity changed
- "mechanism hardening" for pure policy/reporting/template updates
- "we’re not saying the mechanism improved, but…"

Prefer:
- "reviewability improved"
- "reporting discipline improved"
- "governance controls improved"
- "evidence boundaries are clearer"
- "mechanism outcomes remain unchanged"
- "this update relies on internal artifacts only"

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
- baselineScopeType: <topline|subgroup|diagnostic|unknown>
- baselineScope: <topline window / subgroup / metric family>
- scopeReason: <why this scope is the right lens>
- notImproved: <what core mechanism / evidence surface did not improve>
- governanceStatus: <changed|unchanged|unknown>
- mechanismStatus: <changed|unchanged|unknown>
- reportingQualityStatus: <changed|unchanged|unknown>
- evidenceQualityStatus: <changed|unchanged|unknown>
- independentEvidenceStatus: <present|absent|unknown>
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
- Scope type:
  - <topline|subgroup|diagnostic|unknown>
- Scope:
  - <topline window / subgroup / metric family>
- Scope reason:
  - <why this scope is appropriate>
- What changed:
  - <battle-rule / incentive / measured outcome delta>
- What did not improve:
  - <unchanged core>
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
- Not improved: <unchanged core>.
- Independent evidence status: <present|absent|unknown>.
- <1–2 sentence summary that does NOT blur categories>
```

## Minimal PR-summary template

```md
- progressType: <governance|mechanism|mixed>
- baselineStatus: <changed|unchanged|unknown>
- baselineScopeType: <topline|subgroup|diagnostic|unknown>
- baselineScope: <topline window / subgroup / metric family>
- scopeReason: <why this scope is the right lens>
- notImproved: <what core mechanism / evidence surface did not improve>
- governanceStatus: <changed|unchanged|unknown>
- mechanismStatus: <changed|unchanged|unknown>
- reportingQualityStatus: <changed|unchanged|unknown>
- evidenceQualityStatus: <changed|unchanged|unknown>
- independentEvidenceStatus: <present|absent|unknown>
- governanceOnlyStreak: <number|unknown>
- mechanismDeltaOverdue: <yes|no|unknown>
- governanceProof: <proof label + link>
- mechanismProof: <proof label + link>
- reportingQualityProof: <proof label + link>
- evidenceQualityProof: <proof label + link>
```

## Example — governance/reporting update with unchanged mechanism

```md
## Progress Update — 2026-03-08 21:00 UTC

- progressType: governance
- baselineStatus: unchanged
- baselineScopeType: topline
- baselineScope: resultType baseline, battles [20..29]
- scopeReason: top-line battle outcome distribution is the relevant lens for mechanism-improvement claims in this update.
- notImproved: battle/resultType outcome baseline and arena mechanism behavior.
- governanceStatus: changed
- mechanismStatus: unchanged
- reportingQualityStatus: changed
- evidenceQualityStatus: unchanged
- independentEvidenceStatus: present
- governanceOnlyStreak: 5
- mechanismDeltaOverdue: yes

### Governance / reviewability
- Status: changed
- What changed:
  - Added stronger reporting guardrails to prevent claim inflation and scope abuse.
- Proof:
  - internal-only — docs/research/PROGRESS-REPORT-TEMPLATE.md

### Mechanism / outcome
- Status: unchanged
- Baseline:
  - unchanged
- Scope type:
  - topline
- Scope:
  - resultType baseline, battles [20..29]
- Scope reason:
  - This is the relevant top-line mechanism outcome surface for the claims being discussed.
- What changed:
  - No mechanism delta in battle rules or measured outcomes.
- What did not improve:
  - The settled-battle resultType distribution and demonstrated anti-script outcome edge.
- Proof:
  - independent — memory/metrics/resulttype-baseline-2026-03-08.json

### Reporting quality
- Status: changed
- What changed:
  - Reports now force `notImproved`, scope justification, and internal-only evidence visibility.
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
- Not improved: battle/resultType outcome baseline and demonstrated anti-script edge.
- Independent evidence status: present.
- Reporting discipline improved, but battle outcomes did not measurably improve in this update.
```

## Anti-inflation checklist

Before sending a report, verify:
- [ ] `progressType` is explicit.
- [ ] `baselineStatus` is explicit for mechanism-adjacent work.
- [ ] `baselineScopeType` is explicit.
- [ ] `baselineScope` is explicit.
- [ ] `scopeReason` is explicit.
- [ ] `notImproved` is explicit.
- [ ] Governance, mechanism, reporting quality, and evidence quality deltas are not blended.
- [ ] Plain-English summary includes an explicit `Mechanism status:` sentence.
- [ ] Plain-English summary includes an explicit `Not improved:` sentence.
- [ ] Flat baselines are stated plainly when applicable.
- [ ] Evidence-quality claims use independent proof when available.
- [ ] Self-referential proof is labeled `internal-only`.
- [ ] Governance-only streak / overdue-mechanism context is not silently hidden.
- [ ] Internal-only evidence reliance is not silently hidden.
