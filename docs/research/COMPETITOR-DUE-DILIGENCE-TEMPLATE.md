# Competitor Due Diligence Template (Verifiability-First)

Use this template for each external arena/project.

## 0) Project Snapshot
- Name:
- URL:
- Date reviewed:
- Reviewer:
- Current Assurance Tier (0-3):
- Trajectory: `improving | stable | regressing | unknown`

## 1) Trust Model (Required)
- Adjudication location: `on-chain | off-chain | hybrid | unknown`
- Who can unilaterally alter outcomes?
- Key trust assumptions:
- Evidence links:
  - [ ] link 1
  - [ ] link 2
- Reproducibility status: `reproducible | partial | none`

## 2) Failure Model (Required)
- Declared failure handling (RPC/API/model downtime, retries, fallbacks):
- Safety behavior under degraded conditions:
- Liveness behavior under degraded conditions:
- Evidence links:
  - [ ] link 1
  - [ ] link 2

## 3) Replayability Proof (Hard gate for Tier 2+)
- Independent replay steps:
  1.
  2.
  3.
- Expected outputs:
- Actual outputs:
- Replay verdict: `pass | fail | not attempted`
- Evidence links:
  - [ ] logs
  - [ ] tx hashes / artifacts

## 4) Evidence Quality Checklist
- [ ] At least one reproducible evidence link per required section
- [ ] No claim accepted without source
- [ ] Time-bounded observations (date + context)
- [ ] Contradictions explicitly logged

## 5) Anti-Gaming Spot Checks
- Spot-check A (adversarial prompt/path): `pass | fail | n/a`
- Spot-check B (edge case): `pass | fail | n/a`
- Spot-check C (consistency over repeated runs): `pass | fail | n/a`
- Notes:

## 6) Tier Assignment Rules
- Tier 0: marketing-only claims, no reproducible evidence.
- Tier 1: partial evidence, weak reproducibility.
- Tier 2: reproducible artifacts and deterministic/inspectable adjudication path.
- Tier 3: full cryptographic/verifiable pipeline + independent replay.

### Tier Gate
- If replay verdict != `pass`, then Tier >=2 is **blocked**.
- If required sections missing evidence links, max Tier = 1.

## 7) Unknowns + Uncertainty Penalty (Required for Tier 0/1)
- Unknown severity taxonomy:
  - `critical` = blocks trust/replayability determination
  - `major` = weakens confidence materially
  - `minor` = informational gap with limited decision impact
- Unknowns:
  - [ ] `<unknown item>` | severity: `critical|major|minor` | owner: `<name>` | dueDate: `YYYY-MM-DD` | status: `open|in_progress|resolved`
- Missing-vs-negative evidence flags:
  - `missingEvidenceCount`:
  - `negativeEvidenceCount`:
- Uncertainty penalty:
  - `rawPenalty`:
  - `penaltyCap`:
  - `appliedPenalty` (must be capped):

## 8) Confidence and Risks
- Base confidence score (0-100):
- Final confidence score (0-100, after applied penalty):
- Top 3 unresolved risks:
  1.
  2.
  3.

## 9) Final Verdict
- Final Tier:
- Final Verdict Reason:
- Next review date:
