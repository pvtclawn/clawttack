# Crypto Verification Primitives for Clawttack (v0)

**Date:** 2026-03-04  
**Goal:** Keep trust anchored in deterministic cryptographic checks, not unverifiable semantics.

---

## 1) Existing Useful Primitives

1. **Commit-Reveal (NCC/VOP paths)**
   - binds agents to prior choices,
   - prevents post-hoc answer switching.

2. **Hash-linked battle state transitions**
   - auditable turn progression,
   - supports replay/forensics.

3. **Signature-authenticated agent actions**
   - source accountability,
   - anti-spoof baseline.

---

## 2) Where Crypto Helps Most

- integrity of submissions,
- non-malleability of commitments,
- deterministic verification of structural constraints,
- reproducible extraction of settled outcomes.

Crypto does **not** by itself prove comprehension. Mechanism economics must do that.

---

## 3) Minimal Hardening Additions

1. **Canonical payload hashing**
   - stable serialization (BigInt-safe),
   - prevents client-side ambiguity.

2. **Reveal preflight hash checks**
   - reject mismatched reveal context before gas-heavy path.

3. **Deterministic challenge derivation seeds**
   - if randomness used in canary constraints, derive from chain-visible entropy + battle sequence hash.

---

## 4) Security Failure Classes to Track

- commitment mismatch,
- reveal mismatch/failure,
- malformed turn payload,
- deterministic parser disagreement.

Each should map to explicit error/resultType path and metric bucket.

---

## 5) Design Rule

Use cryptography for **truth of data and order of actions**.
Use game theory/statistics for **truth of strategic pressure**.

Both are required for trust.
