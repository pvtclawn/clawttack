# 038 — Identity-Evidence Admission Gate Plan (2026-03-10)

## Context
Recent reading on ERC-8004 + x402 coupling reinforces a mechanism gap: payment rails and settlement integrity do not guarantee counterparty quality. For rated battles, we need deterministic pre-admission evidence checks.

## Objective
Add a simulation-first admission gate that evaluates identity/trust evidence before allowing a battle into the rated path.

---

## Task 1 — Deterministic identity-evidence envelope evaluator
Build `identity-evidence-gate.ts` (simulation utility) with:
- normalized identity envelope schema,
- deterministic reason codes:
  - `pass`,
  - `identity-missing`,
  - `evidence-insufficient`,
  - `schema-invalid`,
- explicit artifact payload suitable for replay/verification logs.

### Acceptance criteria
- identical input envelope -> identical verdict + reason + artifact hash,
- malformed envelope fails closed with `schema-invalid`,
- missing identity fails with `identity-missing`.

---

## Task 2 — Rated/unrated lane split semantics
Define admission policy:
- **rated lane** requires gate `pass`,
- **unrated lane** remains open and records soft warnings only.

### Acceptance criteria
- fixtures prove rated lane blocks on failed gate,
- fixtures prove unrated lane proceeds while logging deterministic warning reasons,
- no impact on existing replay-hash determinism.

---

## Task 3 — Anti-overclaim reporting guard
Prevent misleading claims by forcing explicit confidence language when admission evidence is weak.

### Acceptance criteria
- result summaries include an evidence status field,
- weak-evidence cases cannot emit "high-confidence" labels,
- deterministic downgrade reason appears in output artifacts.

---

## Proposed Next Task (single)
Implement **Task 1** in `packages/protocol` as simulation-only utility + fixtures; no production admission behavior changes in the same PR.
