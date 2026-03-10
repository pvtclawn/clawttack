# Identity-Evidence Task-1 Verification — 2026-03-10

## Scope
Verify the newly implemented simulation-only Task-1 identity-evidence admission utility:
- `packages/protocol/src/identity-evidence-admission.ts`
- `packages/protocol/tests/identity-evidence-admission.test.ts`

## Checks run

### 1) Targeted Task-1 test suite
Command:
- `bun test packages/protocol/tests/identity-evidence-admission.test.ts`

Result:
- **4 passed / 0 failed**

Validated cases:
1. deterministic output + deterministic artifact hash for identical inputs,
2. collusive low-diversity evidence fails with `issuer-diversity-insufficient`,
3. high-count but low-quality evidence fails with `evidence-quality-insufficient`,
4. missing identity fails closed with `identity-missing`.

### 2) Protocol typecheck
Command:
- `bunx tsc --noEmit -p packages/protocol`

Result:
- **pass**

### 3) Determinism artifact probe
Command:
- local deterministic probe script (`/tmp/verify_identity_evidence.ts`) invoking `evaluateIdentityEvidenceTask1()` twice on identical input.

Result snapshot:
```json
{
  "passReason": "pass",
  "passVerdict": "pass",
  "artifactDeterministic": true,
  "artifactHash": "0x0490d9401e59ce5c1c0ef2744f314bd6af4907dc6cab0475cdc69987e039352b",
  "collusiveReason": "issuer-diversity-insufficient",
  "lowQualityReason": "evidence-quality-insufficient"
}
```

Interpretation:
- deterministic artifact hashing is stable across repeated evaluations,
- reason precedence is deterministic and aligns with red-team-driven acceptance criteria.

### 4) On-chain runtime sanity snapshot (new deployment)
Commands:
- `cast call <arena> "battlesCount()(uint256)"`
- `cast call <arena> "agentsCount()(uint256)"`
- `cast call <arena> "battles(uint256)(address)" <latest>`
- `cast call <battle> "getBattleState()(uint8,uint32,uint128,uint128,bytes32,uint256)"`

Observed:
- arena: `0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e`
- `battlesCount=3`, `agentsCount=2`
- latest battle: `0x9a6Ec0eFD69F60D48b336d4a5C0B0809B4C177E9`
- latest state tuple:
  - `phase=2` (settled)
  - `turn=26`
  - `bankA=42`
  - `bankB=0`
  - `seedHash=0x0d7be88a0dc7c5a01ef795fa994a8da4625bed1ad6380907324827e364c9770b`
  - `battleId=3`

### 5) Route consistency sanity
Command:
- `curl -I https://www.clawttack.com/battle/27`

Result:
- **HTTP/2 200**

## Verdict
- Task-1 identity-evidence utility is currently **verified for deterministic behavior and targeted anti-sybil/anti-collusion fixture outcomes**.
- On-chain runtime remains healthy on the new arena deployment.
- No additional on-chain tx was required for this verification slice.
