# v05 Gateway Parser Readiness Verification (2026-03-14 23:32 UTC)

## Trigger
Heartbeat Lane C (VERIFY + ON-CHAIN).

## Purpose
Verify whether the newly extracted gateway JSON parsing helper is:
1. present and tested,
2. actually wired into the live `v05-battle-loop.ts` code path,
3. and ready to support the three target battle modes on the fresh verified arena.

## Verification actions
1. Reviewed:
   - `packages/sdk/scripts/v05-battle-loop.ts`
   - `packages/sdk/scripts/gateway-json.ts`
2. Ran source-structure checks against the live runner.
3. Ran a strict `openclaw agent --agent fighter --json` probe with the same battle-style target/poison/seed constraints.
4. Queried the fresh verified arena directly for battle state readiness.

## Verified results
### A. Parser utility exists and is tested in isolation
- `packages/sdk/scripts/gateway-json.ts` exists.
- It provides:
  - balanced-object extraction,
  - noisy-preamble tolerant JSON extraction,
  - explicit validation gating.
- The strict probe against the isolated `fighter` agent returned a coherent non-template move, e.g.:
  > At dawn we begin with a brief sweep of the dock office; I almost step past the artefact cache, then decide to build our case slowly, logging each timestamp before anyone can rewrite the trail.

### B. Live runner wiring is only partially complete
Verified against `packages/sdk/scripts/v05-battle-loop.ts`:
- `generateNarrativeViaGateway(...)` **present**.
- `constructNarrative` callsite replaced with `await buildNarrative(...)` **present**.
- old `llm-strategy` import **absent**.
- strategy constants for gateway/script split **present**.
- `extractJsonObject(...)` callsites **present** at the gateway parse stages.

### C. Critical blocker found
Despite those callsites, the current top-of-file imports show:
- **no import for `extractJsonObject` from `./gateway-json`**.

That means the parser extraction hardening is **not yet truly battle-ready in the live runner**. The code references the helper, but the current file as verified would fail at runtime/compile until the missing import is added.

## Fresh arena readiness snapshot
Current verified arena:
- `0x16297349997ec5076190C57FF241946129fa1B26`

Direct battle-state checks:
- battle `#3` (`0xa4Ec2Fcd2278eAdBba0E5b62e0823BdfC68F5B1c`) => **Settled**, turn `15`
- battle `#4` (`0x3f7fFdE8B095dBa94e33435462182c39EE61FB33`) => **Settled**, turn `0`
- battle `#5` (`0x28edEa553940FdAC01B5a147a40fDbd7E4136B09`) => **Settled**, turn `0`
- battle `#6` (`0xf1a119648E19967D93E76a592eCD0217AfD13365`) => **Open**, turn `0`

## Battle-mode readiness assessment
### Script-vs-script
**Partially proven.**
- One fresh battle settled successfully on the new arena (#3).
- Additional open/accept flows were noisy, but not due to gateway parsing.

### Agent-vs-script
**Not ready.**
- Gateway agent move generation itself works.
- Live runner parser hardening is not fully wired because the import is missing.
- Accept/turn-0 path on the fresh deployment still needs clean verification after the import fix.

### Agent-vs-agent
**Not ready.**
- Depends on the same gateway runner path being solid first.
- Also requires side-specific agent identity discipline after agent-vs-script is stable.

## Verdict
The parser-boundary hardening work is **real but incomplete**:
- utility exists,
- tests/probe behavior are promising,
- but the current live runner is **not fully wired** due to a missing import.

So the correct state is:
- **gateway parsing concept verified**,
- **live runner readiness not yet verified**,
- **do not accept another claimed gateway-agent battle until the import/path is fixed and rechecked**.

## On-chain classification
**Verified no new on-chain action needed for this lane.**
This lane inspected contract/UI/runtime state only.

## Next Task
Lane B: add the missing `extractJsonObject` import to `v05-battle-loop.ts`, run one strict runner-level smoke check, and only then resume agent battle mode work.
