# Narrative Patch Verification — 2026-03-10 02:34

## Scope
Verify the patched Clawttack narrative/runtime changes landed in commit `1651321`:
- tactic rotation (`social-engineering`, `ctf-lure`, `prompt-injection`, `dos-noise`)
- joker usage
- improved narrative coherence
- OpenRouter-backed LLM fallback
- replacement-fee retry behavior

## Checks run

### 1) Patched log sample analysis
Sampled logs:
- `battle-results/batch-29-1773109163.log`
- `battle-results/batch-53-1773109597.log`

Computed metrics:
- sampled turns: `26`
- joker yes/no: `8 / 18`
- joker usage rate: `30.8%`
- attack mix:
  - `social-engineering`: `8`
  - `ctf-lure`: `8`
  - `prompt-injection`: `5`
  - `dos-noise`: `5`
- old slurry phrase `abandon ability able about`: `0` occurrences
- keyword counts inside patched logs:
  - `ctf`: `11`
  - `inject`: `5`
  - `override`: `2`
  - `flood`: `2`
  - `sign`: `7`

Interpretation:
- Joker usage is no longer effectively zero.
- Tactic classes are materially diversified.
- The pre-patch slurry signature disappeared from the sampled patched logs.

### 2) Route sanity
Command:
- `curl -I https://www.clawttack.com/battle/27`

Result:
- **HTTP/2 200**

### 3) On-chain arena snapshot
Command set:
- `cast call <arena> "battlesCount()(uint256)"`
- `cast call <arena> "battles(<latest>)(address)"`
- `cast call <battle> "getBattleState()(uint8,uint32,uint128,uint128,bytes32,uint256)"`

Observed:
- arena: `0x2Ab05EAB902db3FDA647b3Ec798c2D28C7489b7e`
- `battlesCount = 109`
- latest battle: `0xbaCA3641cB6618204011De3650559626c07c1975`
- latest state: `phase=0` (open/unaccepted), turn `0`, empty banks

Interpretation:
- Arena is live and continuing to receive created battles.
- The latest battle being open is consistent with the balance failure observed on the acceptor account during sustained batching.

### 4) Runtime blocker diagnosis
Observed blockers during overnight batching:
1. **Acceptor balance exhaustion**
   - `clawnjr` balance: `725774732213446` wei
   - below the previous `0.001 ETH` stake requirement, causing accept failures.
2. **Nonce/replacement turbulence under overlapping runners**
   - `nonce too low` / `replacement underpriced` appeared during sustained concurrent runs.
   - overlapping batch sessions poisoned wallet nonce ordering.

Interpretation:
- Narrative quality has improved.
- The primary blocker has shifted to runtime orchestration/funding, not prompt quality.

## Verdict
The patched narrative/runtime slice is **verified as materially improved** on the dimensions Egor asked about:
- more coherent lines,
- real tactic diversity,
- actual joker usage,
- visible CTF / prompt-injection / DoS / social-engineering behavior.

The current bottleneck is now:
- acceptor funding,
- single-writer nonce discipline for autonomous battle sessions.
