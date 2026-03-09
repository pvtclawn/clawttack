# Clawttack Next Steps — Updated Mar 3, 2026

## Immediate Execution (current)
1. Track live battle #18 state on v4.2 arena (`notified -> accepted -> first-turn -> settled`).
2. Apply acceptance timeout ladder for target-locked battles:
   - +10m follow-up ping,
   - +20m second follow-up,
   - +30m cancel/recreate decision (alternate acceptor is invalid when `targetAgentId` is set).
3. Capture first-turn telemetry pack once accepted:
   - create tx hash,
   - accept tx hash,
   - turn-0 submit tx hash,
   - phase/turn/bank snapshot,
   - narrative diversity + anti-template metrics scaffold fields.
4. Append telemetry to `docs/V1-READINESS-REPORT.md` before starting larger sample expansion.
5. Fill `docs/PROOF-PACK-TEMPLATE.md` for every fresh run (battle id + notify proof + tx hashes + before/after deltas).

## Completed Tonight
- [x] 17 battles settled (B10-B27), 76.5% A win rate
- [x] Statistical analysis: LLM advantage = NOT significant
- [x] ClozeVerifier.sol (13/13 Forge tests, ~62K gas)
- [x] cloze-helper.ts (SDK attack/defense/verify)
- [x] AutoInject + BTS paper deep reads
- [x] Overnight report for Egor

## Next Priority: Integrate Cloze into Battle Contract

### P0 — Wire ClozeVerifier into ClawttackBattleV4
1. Add `clozeEnabled` flag to BattleConfig
2. On `submitTurn()`: if clozeEnabled, call `ClozeVerifier.verifyBlank(narrative)`
3. Store `blankOffset` per turn for reveal verification
4. On NCC reveal: verify revealed word reconstructs valid narrative at blank offset
5. Existing NCC scoring unchanged — Cloze just makes NCC solvable for comprehenders

### P1 — SDK Integration
1. Update `ncc-helper.ts` to support Cloze mode (blanked narratives)
2. Update `v4-fighter.ts` to generate Cloze-compatible narratives
3. Update `v4-strategy-template.ts` with Cloze attack/defense examples
4. Add `solveCloze()` call in fighter's NCC defense path

### P2 — Test with Real Battles
1. Deploy updated contracts to Base Sepolia
2. Run 10 Cloze-enabled battles
3. Measure LLM vs script NCC accuracy (expect ~75% vs ~25%)
4. Verify the accuracy gap creates meaningful bank drain difference

### P3 — For Egor Review
1. Present statistical analysis + Cloze proposal
2. Get feedback on Cloze integration design
3. Discuss: mandatory Cloze or optional (backwards compatible)?
4. Discuss: BTS-inspired Elo system for v4.2?

## Parking Lot (not now)
- [ ] Quote Requirement (Layer 1) — moderate impact, add after Cloze proves out
- [ ] Diversity Gate (Layer 2) — weakest, skip unless needed
- [ ] RL training loop for fighter strategy (inspired by AutoInject)
- [ ] OpenClaw subagent architecture for battle management
- [ ] Web frontend updates for Cloze visualization

## 2026-03-02 20:31 — Anti-Script Survival Fix Candidate (v4.3 draft)

### Mechanic: Fail-Threshold Auto-Loss
- Track rolling NCC/Cloze defense failures per agent in battle-local state.
- Rule: if an agent fails >=4 of last 6 defenses, battle auto-settles against that agent.
- Goal: scripts may enter but cannot survive long by hovering near random/weak defense.

### Why this first
- Deterministic and cheap to reason about.
- Minimal surface-area change vs full quote-proof redesign.
- Directly enforces acceptance gate: "scripts shouldn’t survive".

### Validation plan
1. Simulate 100+ script-vs-agent runs with current narrative generator.
2. Measure script elimination rate + false positives on competent agents.
3. Tune threshold/window (e.g., 3/5, 4/6, 5/8) for strongest separation.

### v4.3 implementation sketch (02:51)
- Add battle-local rolling window state:
  - `uint8 failBitsA`, `uint8 failBitsB` (last 6 defense outcomes, 1=fail)
  - `uint8 failCountA`, `uint8 failCountB` (popcount cache)
- On each consumed NCC defense result:
  - shift window, insert latest fail bit, update failCount with O(1) delta.
- Threshold rule:
  - if `failCountX >= 4` after at least 6 defenses observed for X -> immediate settle against X.
- Settlement path:
  - call existing `_settleBattle(winnerId, loserId, ResultType.BANK_EMPTY)` with dedicated reason note in event/log comment.
- Test plan:
  - unit tests for window math (3/5, 4/6, 5/8 boundaries)
  - integration: script-like fail pattern must auto-lose before normal bank depletion.
