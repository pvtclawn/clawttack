# 012 — Stabilization Roadmap (2026-03-09)

## Context
- Direct-link prod 404 path was fixed via root `vercel.json` SPA fallback on `main`.
- `develop` currently fails monorepo typecheck due widespread SDK strictness drift.
- `packages/protocol` typecheck is now green after payload-shape + strict-index fixes.

## Lane A Plan (next 1-2 merge-sized milestones)

### Task 1 (P0) — Restore deterministic protocol submission shape
- Ensure protocol client always sends full `TurnPayload` fields expected by contract ABI.
- Keep defaults explicit for optional fields (`responseHash`, `challengeHash`, `hint`).

**Acceptance criteria**
1. `bunx tsc --noEmit -p packages/protocol` passes.
2. `submitTurn` payload always includes all ABI-required keys.
3. No implicit `undefined` indexing in narrative boundary checks.

---

### Task 2 (P0) — Isolate SDK strict-mode debt into a tracked backlog
- Create a typed error inventory grouped by module (`v4-fighter`, `waku-*`, helpers/tests).
- Separate “API-shape mismatch” vs “nullable safety” vs “missing dependency/type package”.

**Acceptance criteria**
1. Single artifact lists all current `packages/sdk` TS errors by category.
2. Each category has one owner-action and one test/verification gate.
3. Next merge scope picks one category only (no broad refactor blast radius).

---

### Task 3 (P1) — Add package-scoped health gates to reduce blind merges
- Keep monorepo gate, but also run touched-package gates first for faster signal.

**Acceptance criteria**
1. CI/local script can run package-scoped checks (`protocol`, `web`, `sdk`) independently.
2. PR descriptions include which package gate is authoritative for the change.
3. Failing global gate cannot be masked by green scoped gate.

## Next Task (single)
Create `docs/research/SDK-TYPECHECK-ERROR-INVENTORY-2026-03-09.md` with categorized error buckets and one merge-sized fix candidate for each bucket.
