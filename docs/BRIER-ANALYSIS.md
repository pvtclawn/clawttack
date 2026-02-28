# Brier Scoring Deep Dive for Clawttack v4e

**Date:** 2026-03-01 (overnight)
**Purpose:** Analyze edge cases, gaming vectors, and integer arithmetic for on-chain Brier scoring

---

## 1. Brier Score Basics

The Brier score measures calibration of probabilistic forecasts:

```
BS = (1/N) × Σ (pᵢ - oᵢ)²
```

Where:
- pᵢ = forecasted probability for outcome i
- oᵢ = observed outcome (1 for actual, 0 for others)
- Lower BS = better calibration

For Clawttack: N=4 candidates, one-hot observed vector.

## 2. On-Chain Integer Math

### Encoding
- Probabilities: uint8[4], sum to 255 (not 256 to avoid overflow)
- Observed: one-hot [0,0,255,0] based on defender's guess
- Score computed as inverse (higher = better): `MAX_SCORE - sumOfSquaredDiffs`

### Computation
```solidity
function brierScore(
    uint8[4] memory probs,
    uint8 guessIdx
) internal pure returns (uint256) {
    uint256 sumSqDiff = 0;
    for (uint8 i = 0; i < 4; i++) {
        int256 diff;
        if (i == guessIdx) {
            diff = int256(uint256(probs[i])) - 255; // predicted - observed(255)
        } else {
            diff = int256(uint256(probs[i])); // predicted - observed(0)
        }
        sumSqDiff += uint256(diff * diff);
    }
    // Max possible sumSqDiff: 4 * 255^2 = 260,100
    // Min possible (perfect prediction): 0
    return 260100 - sumSqDiff; // higher = better
}
```

### Range
- Perfect prediction: p=[0,0,255,0], guess=2 → score = 260,100
- Worst prediction: p=[255,0,0,0], guess=2 → score = 260,100 - (255² + 0 + 255² + 0) = 260,100 - 130,050 = 130,050
  Wait, let me recalculate:
  - diff[0] = 255-0 = 255, sq = 65,025
  - diff[1] = 0-0 = 0, sq = 0
  - diff[2] = 0-255 = -255, sq = 65,025
  - diff[3] = 0-0 = 0, sq = 0
  - sumSqDiff = 130,050
  - score = 260,100 - 130,050 = 130,050

- Uniform prediction: p=[64,64,64,63], guess=any
  - For guess=0: diffs = [64-255, 64, 64, 63] = [-191, 64, 64, 63]
  - sq = [36481, 4096, 4096, 3969] = 48,642
  - score = 260,100 - 48,642 = 211,458

- Random prediction (worst case): p=[255,0,0,0], guess=1,2, or 3
  - Already calculated: score = 130,050

So score range: 130,050 (worst) to 260,100 (perfect)

### Gas
- 4 iterations, each: 1 comparison + 1 subtraction + 1 multiplication + 1 addition
- Total: ~200-300 gas. Negligible.

## 3. Gaming Vectors

### 3.1 Always Predict Uniform [64,64,64,63]
**Strategy:** Never commit to any specific answer. Hedge all bets.
**Brier score:** ~211,458 regardless of defender's guess
**Analysis:**
- Guaranteed moderate score (81% of max)
- Never gets perfect score
- An honest predictor who knows their riddle is clear should predict [200,20,20,15] → if defender picks correctly, score = 260,100 - (200-255)² - 20² - 20² - 15² = 260,100 - 3025 - 400 - 400 - 225 = 256,050 (98.4% of max)
- Uniform prediction is DOMINATED by honest prediction if riddle is solvable
- **Proper scoring rule guarantees this**: Brier is strictly proper, so honest forecasting always maximizes expected score

### 3.2 Always Predict [255,0,0,0] (Overconfident)
**Strategy:** Always claim 100% confidence in candidate 0.
**Analysis:**
- If guess=0: score = 260,100 (perfect!)
- If guess≠0: score = 130,050 (minimum!)
- Expected score: 0.25 * 260,100 + 0.75 * 130,050 = 162,562
- vs uniform: 211,458
- **Overconfidence is strictly worse** than uniform when your riddle is ambiguous
- Only profitable if you're genuinely >64% confident (which requires understanding the text)

### 3.3 Copy Opponent's Previous Prediction
**Strategy:** Use opponent's previous Brier forecast as your own.
**Analysis:**
- Opponent's forecast was for THEIR riddle, not yours
- Different narrative, different candidates → no correlation
- Essentially random → worse than uniform
**Verdict:** Not viable.

### 3.4 Forecast Based on Candidate Position (Scriptable)
**Strategy:** Predict p=[100,80,50,25] assuming defenders tend to pick earlier candidates.
**Analysis:**
- If there IS a positional bias in LLM behavior, this could work
- But: smart attackers randomize intended answer position → no consistent positional pattern
- Over many games: positional strategies converge to uniform
**Verdict:** Marginal, dominated by honest forecasting.

### 3.5 Brier Manipulation via Trivial Riddle
**Strategy:** Write trivially solvable riddle, predict [255,0,0,0] for the obvious answer.
**Analysis:**
- Defender (LLM or script) picks correct answer → Brier = 260,100 (maximum!)
- Attacker gets maximum Brier bonus every turn
- BUT: this means the DEFENDER also gets NCC success refund every turn
- Net effect: both agents maintain high bank → game length determined by decay
- The attacker gets slightly more benefit (Brier bonus) than from hard riddles where defender might fail
- This is the trivial riddle problem from the red-team (section 2.1)
**Verdict:** ⚠️ Trivial riddles + maximum Brier is a dominant strategy IF the Brier bonus is material. If Brier bonus is small relative to NCC refund, the effect is minimal.

## 4. Brier Threshold Design

The V4-DESIGN.md proposed a BRIER_THRESHOLD — attacker only gets timer shield if Brier > threshold.

### Option A: Fixed Threshold
- BRIER_THRESHOLD = 240,000 (92% of max)
- Only very confident, correct predictions earn bonus
- Scripts rarely achieve this (would need to be right AND confident)
- Problem: threshold is arbitrary

### Option B: Relative Threshold
- Compare attacker's Brier to the "uniform baseline" (211,458)
- Bonus = (score - 211,458) / (260,100 - 211,458) × maxBonus
- Linear scaling: better prediction → bigger bonus
- Uniform prediction → zero bonus
- Script with no understanding → approximately zero bonus

### Option C: No Threshold (Continuous)
- Every Brier score above minimum earns proportional bonus
- Even bad predictions earn something (but less)
- Simplest implementation

### Recommendation: Option B (Relative to Uniform)
- Clean incentive: anything better than "I have no idea" earns bonus
- Mathematically: `bonusBlocks = (score - 211458) * MAX_BONUS / 48642`
- With MAX_BONUS = 10 blocks: perfect prediction = +10, uniform = +0, worst = negative (penalty?)

## 5. Should Brier Be in v1?

### Arguments FOR Brier in v1:
- Makes solvable riddles dominant strategy (proper scoring rule)
- Adds attacker incentive layer (not just defender consequences)
- Only ~60 lines of Solidity
- Gas cost: ~300 gas (negligible)

### Arguments AGAINST Brier in v1:
- SDK complexity: agent must forecast probabilities (extra LLM call)
- Commitment size increases (4 extra uint8s in hash)
- Trivial riddle + max Brier is a gaming vector (section 3.5)
- Chess clock + NCC penalty already achieves 100% LLM vs script win rate
- Brier adds depth but not essential for core anti-scripting
- Can be added in v1.1 without redesign

### Verdict: **SKIP Brier for v1, add in v1.1**
The chess clock + NCC penalty (v4d) is sufficient. Brier is a refinement, not a requirement.

---

## 6. Summary

| Question | Answer |
|---|---|
| Is Brier implementable on-chain? | ✅ Yes, ~300 gas, integer math only |
| Does Brier prevent trivial riddles? | ⚠️ Partially — honest prediction is dominant but trivial riddles still game it |
| Is Brier necessary for v1? | ❌ No — chess clock + penalty achieves 100% without it |
| Should Brier be in v1.1? | ✅ Yes — adds attacker incentive, strengthens anti-griefing |
| Can scripts game Brier? | ⚠️ Uniform prediction gives 81% of max — but honest prediction is strictly better |
| Best threshold model? | Option B: relative to uniform baseline |
