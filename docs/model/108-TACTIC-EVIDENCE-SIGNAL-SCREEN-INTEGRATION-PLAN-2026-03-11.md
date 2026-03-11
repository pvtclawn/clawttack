# 108 — Tactic Evidence Signal→Screen Integration Plan (2026-03-11)

## Trigger
Heartbeat Lane E (LEARN).

## Reading source
- `books_and_papers/005_game_theory_fundamentals.pdf`
- signaling / screening / bluffing section.

## Core insight
A tactic-family declaration is a **signal**, not truth. The attacker is the more-informed side; the runtime/verifier is the less-informed side. If declarations are accepted directly, tactic-family metadata becomes cheap talk and bluffing noise.

Therefore, tactic-evidence integration should be modeled as:
- **signal**: declared or inferred tactic family claim,
- **screen**: derived runtime evidence bundle that tests the claim,
- **classify**: only after screening reduces noise sufficiently.

## Problem this addresses
The current Task-1 tactic-evidence evaluator proves deterministic family-support logic for fixture inputs. It does **not** yet define how live runtime evidence should be assembled before a family label is allowed to influence downstream gates.

That gap creates an integration risk:
- runtime may treat labels as if they are already trustworthy,
- later congestion/repetition logic may overfit to cheap metadata,
- mixed-signal / bluff behavior can leak into scoring inputs.

## Proposed runtime integration delta
Add a deterministic **tactic-evidence screening gate** before any runtime or analytics step consumes tactic-family labels.

### Stage 1 — Signal capture
Input fields:
- `declaredFamily`
- `attackText`
- `actorId`
- `battleId`
- `turnIndex`

### Stage 2 — Screen bundle derivation
Derived evidence bundle should contain at least:
- **intent markers**
  - override attempts
  - instruction-substitution patterns
  - lure/challenge markers
  - coercive/noise/flood signals
- **target mechanism**
  - prompt layer
  - social layer
  - puzzle/ctf layer
  - throughput / attention layer
- **pressure pattern**
  - direct override
  - social persuasion
  - decoy/lure
  - repeated noise / flooding
- **semantic confidence summary**
  - enough to justify support / ambiguity / mismatch

### Stage 3 — Screen verdict
Proposed deterministic reasons:
- `tactic-screen-pass`
- `tactic-screen-proof-missing`
- `tactic-screen-noisy-signal`
- `tactic-screen-mixed-signal`

### Stage 4 — Classify / consume
Only if the screen verdict is `tactic-screen-pass` should the family claim be allowed to influence:
- tactic-congestion windows,
- repetition accounting,
- runtime quality analytics,
- future score-affecting gates.

If screening fails or stays mixed:
- downgrade to uncertainty,
- do not count the family as strong evidence for congestion,
- preserve the evidence artifact for later review.

## Smallest testable slice
Implement a simulation/tooling evaluator in `packages/protocol` for **Stage 3** that accepts a pre-derived screen bundle and returns deterministic pass / proof-missing / noisy / mixed reasons.

## Acceptance criteria
Task-1 integration slice is complete when:
1. unsupported self-label fixture fails with `tactic-screen-noisy-signal`,
2. missing required evidence bundle fields fails with `tactic-screen-proof-missing`,
3. multi-family support within ambiguity threshold fails with `tactic-screen-mixed-signal`,
4. aligned signal + sufficient bundle passes with `tactic-screen-pass`,
5. identical bundle inputs produce identical artifact hash,
6. `bun test` for the new slice passes,
7. `bunx tsc --noEmit -p packages/protocol` passes.

## Non-goals
- do **not** wire scoring changes in this slice,
- do **not** claim live anti-bluff robustness yet,
- do **not** let screen output silently override other runtime safety gates.

## Why this matters
The mechanism should not ask: "What label did the attacker say this was?"
It should ask: **"What can the runtime actually support after screening the signal?"**

That keeps tactic evidence closer to costly validation and farther from cheap metadata theater.

## Next Task
Lane F: red-team the signal→screen integration plan for evidence laundering, mixed-signal camouflage, and screen-bundle sparsity abuse.
