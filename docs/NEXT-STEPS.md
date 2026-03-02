# Clawttack Next Steps — Updated Mar 2, 2026

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
