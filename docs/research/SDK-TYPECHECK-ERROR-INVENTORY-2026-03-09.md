# SDK Typecheck Error Inventory — 2026-03-09

Source command:
- `bunx tsc --noEmit -p packages/sdk`

Snapshot (post transport-shape fix in this heartbeat):
- total emitted diagnostic lines: **84**
- highest-density files:
  - `packages/sdk/src/v4-fighter.ts` → **49**
  - `packages/sdk/src/v4-integration.test.ts` → **11**
  - `packages/sdk/src/ncc-helper.ts` → **5**
  - `packages/sdk/src/bip39-scanner.ts` → **5**

---

## Category A — Transport payload shape drift (RESOLVED in this heartbeat)
**Symptoms (before fix):** `message` vs `narrative` mismatch across `waku-*` and `ws-transport`, plus Waku config typing drift.

**Files touched:**
- `packages/sdk/src/waku-transport.ts`
- `packages/sdk/src/waku-fighter.ts`
- `packages/sdk/src/ws-transport.ts`

**Action shipped:**
- normalized signed turn payload to `narrative` end-to-end,
- aligned `TurnMessage` construction with protocol type,
- wired optional Waku timeout function typing,
- preserved compatibility for inbound legacy payloads via `payload.narrative ?? payload.message`.

**Verification gate:**
- no remaining `waku-*` / `ws-transport` diagnostics in latest `tsc -p packages/sdk` output.

---

## Category B — `v4-fighter` strict nullability / control-flow safety
**Symptoms:**
- `TS2532`, `TS2722`, `TS2322`, `TS2454` (possibly undefined invocations, nullable receipts, use-before-assign).

**Scope:**
- concentrated in `packages/sdk/src/v4-fighter.ts`.

**Merge-sized candidate fix:**
1. introduce small local guards (`assertDefined`) for callback/function slots before invocation,
2. make transaction receipt lifecycle explicit (`let receipt: ContractTransactionReceipt | undefined`) and guard before read,
3. split high-branch functions into smaller helpers to preserve control-flow narrowing.

**Verification gate:**
- `bunx tsc --noEmit -p packages/sdk` shows `v4-fighter.ts` diagnostics reduced to zero in that PR.

---

## Category C — Test indexing safety in `v4-integration.test.ts`
**Symptoms:**
- array/tuple index access under strict mode (`possibly undefined`), optional hex arguments.

**Merge-sized candidate fix:**
1. replace direct index access with explicit tuple destructuring/assertions,
2. add tiny test helper `mustHex(x): 0x${string}` to fail fast when fixture is malformed.

**Verification gate:**
- `v4-integration.test.ts` emits zero diagnostics.

---

## Category D — Helper modules missing defensive guards
**Symptoms:**
- `bip39-scanner`, `ncc-helper`, `cloze-helper`, `gateway strategy`, one pentest test use strict-unsafe accesses.

**Merge-sized candidate fix:**
1. add narrow input guards at API boundaries,
2. convert optional map/dict function usage to explicit local checked refs,
3. avoid passing possibly undefined values into strict function params.

**Verification gate:**
- all Category D files clean under `tsc -p packages/sdk`.

---

## Category E — Missing SDK dependency typing (`viem`)
**Symptoms:**
- `TS2307` in `packages/sdk/src/v3-vop-boilerplate.ts` for missing `viem` import types.

**Merge-sized candidate fix:**
1. add `viem` as direct dependency in `packages/sdk/package.json` (or remove stale file if deprecated by v0 migration).

**Verification gate:**
- no module-resolution errors remain.

---

## Recommended next PR order
1. **Category B** (`v4-fighter`) — biggest error volume.
2. **Category C** (`v4-integration.test.ts`) — low-risk cleanup.
3. **Category E** (`viem`) — one-line dependency/cleanup.
4. **Category D** (helpers) — sweep with per-file commits.
