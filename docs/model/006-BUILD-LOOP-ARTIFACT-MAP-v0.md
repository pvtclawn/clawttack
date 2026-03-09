# Build Loop → Artifact Map (v0)

**Date:** 2026-03-04  
**Purpose:** Ensure every lane produces tangible outputs, not narrative status churn.

---

## Lane A (PLAN)

**Required artifact:**
- one updated planning document section with:
  - targeted failure class,
  - acceptance metric,
  - smallest shippable next change.

**Output examples:**
- `PLAN.md` acceptance gate update,
- `docs/model/*roadmap*.md`.

---

## Lane B (BUILD)

**Required artifact:**
- code diff + commit hash.

**Minimum proof:**
- file list changed,
- one sentence linking patch to failure class (`2/4/7/...`).

---

## Lane C (VERIFY+ONCHAIN)

**Required artifact:**
- metric snapshot or tx-backed verification note.

**Minimum proof:**
- battle IDs / tx hashes / parsed resultTypes,
- explicit pass/fail against acceptance gate.

---

## Lane D (RESEARCH)

**Required artifact:**
- synthesis note translating research into one implementable mechanism hypothesis.

**Minimum proof:**
- source reference,
- proposed mechanism delta,
- expected measurable impact.

---

## Lane E (LEARN)

**Required artifact:**
- applied reading note from papers/books/docs.

**Minimum proof:**
- key insight,
- why relevant now,
- where it fits in contract/runtime.

---

## Lane F (CHALLENGE)

**Required artifact:**
- red-team report with at least 3 exploit vectors + mitigations.

**Minimum proof:**
- identify replacement exploit risk,
- specify guardrail/acceptance check.

---

## Global Rule

If a lane cannot produce its artifact, it is **not progress**.
