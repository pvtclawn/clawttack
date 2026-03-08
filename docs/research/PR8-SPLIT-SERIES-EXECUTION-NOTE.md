# PR #8 Split-Series Execution Note

**Scope:** `pr-8` v4-only migration / remove v3 artifacts  
**Goal:** preserve the architectural win (single canonical battle surface) without merging downstream breakage, silent coverage loss, or review-noise churn.

## Why split this PR

PR #8 currently mixes four different concerns:
1. **real interface migration** (contract/type/file renames),
2. **downstream consumer migration** (web, SDK, scripts, docs),
3. **historical/canonical documentation cleanup**,
4. **generated/noise files** unrelated to mechanism correctness.

That shape raises audit risk. A reviewer can agree with the architectural direction while still missing runtime breakage, because the diff is wider than the mechanism boundary.

## Recommended split series

### Slice 1 — Core migration: canonical battle surface
**Purpose:** land the actual rename/unification safely.

**Allowed changes:**
- contract/file/type renames needed to collapse v3/v4 split
- arena factory/API rename(s)
- interface files required by the new canonical surface
- direct first-party consumer migrations required to keep runtime behavior working
- migrated tests that preserve or replace prior guarantees

**Must be included in this slice:**
- web event consumer updated to new unified `BattleCreated` ABI
- maintained scripts/SDK callers updated away from `createBattleV4` and deleted `v4-*` names
- replacement or retirement mapping for every deleted test suite

**Must NOT be included in this slice:**
- research note dumps
- package-manager churn unrelated to the migration
- broad historical doc rewrites beyond active canonical references

**Merge gate:**
- all downstream runtime consumers for the unified surface are green in the same PR.

---

### Slice 2 — Active-doc canonicalization
**Purpose:** make the repository tell one consistent story after Slice 1 lands.

**Allowed changes:**
- active README / SDK README / changelog / current docs updates
- canonical path/name replacements for files/functions changed by Slice 1
- explicit historical notes where old `v4` naming must remain for chronology

**Required rule:**
- every active doc must point at existing canonical files/functions after Slice 1.

**Merge gate:**
- zero stale canonical references to deleted files in active docs.

---

### Slice 3 — Noise / generated artifact cleanup
**Purpose:** isolate review-noise so it cannot hide mechanism regressions.

**Allowed changes:**
- `.pnp.*`, lockfile, install-state, generated files
- LLM scratchpads / research dump moves or cleanup
- any tooling-only regeneration with explicit rationale

**Required rule:**
- each generated artifact class must have a justification line and reviewer relevance statement.

**Merge gate:**
- no mechanism/runtime semantic delta hidden in the noise PR.

## Merge order

1. **Slice 1 — Core migration**
2. **Slice 2 — Active-doc canonicalization**
3. **Slice 3 — Noise/generated cleanup**

If Slice 1 cannot stand alone with working consumers, stop and split again.

## Downstream migration checklist (required for Slice 1)

### A. Web/event parity
- [ ] `packages/web/src/hooks/useChain.ts` consumes the new unified `BattleCreated` event shape.
- [ ] no active UI path depends on `BattleV4Created` as canonical source.
- [ ] one integration proof or fixture demonstrates battle discovery still works.

### B. Maintained script + SDK parity
- [ ] no maintained first-party script calls `createBattleV4`.
- [ ] no maintained first-party code imports deleted `v4-*` canonical paths unless explicitly marked historical/compat.
- [ ] public SDK surface is internally consistent with renamed contract/types.

### C. Canonical-reference parity
- [ ] active docs do not point at deleted files like `ClawttackBattleV4.sol` or `createBattleV4()`.
- [ ] historical docs that intentionally preserve old names are labeled as historical.

## Deleted-suite replacement mapping (required for large rename PRs)

For every removed suite, provide one row in the migration note:

| Removed suite | Status (`replaced` / `retired`) | Replacement or rationale | Reviewer proof |
|---|---|---|---|
| `ClawttackBattle.t.sol` |  |  |  |
| `ClawttackE2E.t.sol` |  |  |  |
| `ClawttackSecurity.t.sol` |  |  |  |
| `VOPs.t.sol` |  |  |  |
| `ContextualLinguisticParser.t.sol` |  |  |  |

**Rule:** blank rows block merge.

## Reviewer summary line (copyable)

> Strategic direction is correct; merge only if the canonical rename ships with downstream consumer parity, explicit deleted-suite mapping, and zero unrelated noise files in the core migration PR.
