# Competitor Records — 2026-03-07

## 1) Clawber / somaxai.pro
- Name: Clawber
- URL: https://www.somaxai.pro/
- Date reviewed: 2026-03-07
- Current Assurance Tier: 0 (provisional)
- Trajectory: unknown

### Trust model
- Adjudication location: unknown
- Evidence links:
  - https://www.somaxai.pro/

### Failure model
- Declared handling: not visible in landing-page snapshot.
- Evidence links:
  - https://www.somaxai.pro/

### Replayability proof
- Independent replay steps: not available from current public snapshot.
- Replay verdict: not attempted

### Tier gate
- Replay missing => Tier 2+ blocked.
- Required evidence incomplete => max Tier 1.

### Unknowns + uncertainty penalty
- Unknowns:
  1. On-chain/off-chain adjudication path not disclosed | severity: critical | owner: PrivateClawn | dueDate: 2026-03-08 | status: open
  2. Replayable battle verification steps missing | severity: critical | owner: PrivateClawn | dueDate: 2026-03-08 | status: open
  3. Failure-mode behavior under model/API outages unknown | severity: major | owner: PrivateClawn | dueDate: 2026-03-09 | status: open
- Missing-vs-negative evidence:
  - missingEvidenceCount: 3
  - negativeEvidenceCount: 0
- Uncertainty penalty:
  - rawPenalty: 45
  - penaltyCap: 35
  - appliedPenalty: 35

### Final verdict
- Base Confidence: 45
- Final Confidence: 10
- Final Tier: 0 (provisional)
- Final Verdict Reason: marketing-visible features exist, but no reproducible adjudication/replay evidence collected yet.

---

## 2) OpenClawArena / openclawarena.io
- Name: OpenClaw Arena
- URL: https://openclawarena.io/
- Date reviewed: 2026-03-07
- Current Assurance Tier: 0 (provisional)
- Trajectory: unknown

### Trust model
- Adjudication location: unknown
- Evidence links:
  - https://openclawarena.io/

### Failure model
- Declared handling: not visible via fetch; site appears JS-rendered shell from static extraction path.
- Evidence links:
  - https://openclawarena.io/

### Replayability proof
- Independent replay steps: unavailable until browser/API-level inspection.
- Replay verdict: not attempted

### Tier gate
- Replay missing => Tier 2+ blocked.
- Required evidence incomplete => max Tier 1.

### Unknowns + uncertainty penalty
- Unknowns:
  1. Core architecture/adjudication path hidden behind JS rendering | severity: critical | owner: PrivateClawn | dueDate: 2026-03-08 | status: open
  2. Independent replay steps unavailable | severity: critical | owner: PrivateClawn | dueDate: 2026-03-08 | status: open
  3. Failure-handling model not disclosed | severity: major | owner: PrivateClawn | dueDate: 2026-03-09 | status: open
- Missing-vs-negative evidence:
  - missingEvidenceCount: 3
  - negativeEvidenceCount: 0
- Uncertainty penalty:
  - rawPenalty: 45
  - penaltyCap: 35
  - appliedPenalty: 35

### Final verdict
- Base Confidence: 40
- Final Confidence: 5
- Final Tier: 0 (provisional)
- Final Verdict Reason: insufficient technical disclosure from static extraction; cannot verify adjudication model yet.
