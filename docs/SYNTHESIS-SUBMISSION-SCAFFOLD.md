# Synthesis Submission Scaffold (Short + Long)

Use this as the source for both short and long submission variants.

---

## 0) Requirement-fit map (MANDATORY)

| Synthesis Theme | Implemented Component | Proof Link(s) |
|---|---|---|
| Agents that pay | [component] | [tx/commit/artifact] |
| Agents that trust | [component] | [tx/commit/artifact] |
| Agents that cooperate | [component] | [tx/commit/artifact] |

Rule: no theme claim without at least one concrete component and proof link.

---

## 1) Problem

`[MEASURED|EXTERNAL]` One concise statement of the failure mode being solved.

---

## 2) Mechanism

- `[MEASURED|EXTERNAL]` Component 1
- `[MEASURED|EXTERNAL]` Component 2
- `[MEASURED|EXTERNAL]` Component 3

---

## 3) Proof (critical claims)

For each critical claim include:
1. Repro command
2. Artifact/commit/tx proof link

Template:
- Claim: `[MEASURED] ...`
  - Repro: ``[command]``
  - Proof: `[link/path/hash]`

---

## 4) Results

Include mandatory bundle:
- Reliability metrics: `[value]`
- Efficiency metrics: `[value]`
- Evidence quality: `success|degraded_success|insufficient_evidence`
- Comparability verdict: `comparable|non_comparable` (+ reason codes)

Rule: no unmeasured numeric claims.

---

## 5) Caveats with impact class

| Caveat | Impact (`minor|moderate|blocking`) | Headline Implication |
|---|---|---|
| [caveat] | [class] | [allowed / downgraded / blocked] |

Rule: headline eligibility must be derivable from this table.

---

## 6) Headline eligibility decision

- Eligible for strong headline? `[yes/no]`
- Reason: `[derived from evidence quality + caveat impact]`

---

## 7) Short version (judge first-pass)

Problem → Mechanism → Proof → Result (4-8 lines max).

Short-form guardrails (MANDATORY):
- Include at least one **direct proof pointer** (commit hash / artifact path / tx hash).
- Include explicit **status token**: `success|degraded_success|insufficient_evidence|non_comparable`.
- Mechanism lines must avoid future-tense roadmap wording (`will`, `plan`, `soon`).

---

## 8) Long version

Expanded version with requirement-fit table, reproducibility steps, metrics, and caveats.

Long-form hardening rules (MANDATORY):
- Every outcome section must include:
  1) at least one direct proof pointer, and
  2) one objective `evidence -> implication` line.
- Outcome sections must reference caveat row/class (or explicitly `Caveat: none`).
- Section conclusions must avoid promotional language and remain evidence-anchored.

---

## 9) External-claim wording guard

For any `EXTERNAL` claim, use qualified wording only:
- `reported`, `suggests`, `hypothesis`, `preliminary`

Never phrase external claims as confirmed local outcomes.
