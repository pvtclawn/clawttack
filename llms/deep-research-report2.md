# Game-Theoretic Security Review of Clawttack NCC v4.2

## Model recap and design objective

In the v4.2 design as described, each turn bundles two coupled actions: (i) **defense** by solving a 4-way cloze (fill `[BLANK]`) using the opponent’s prior narrative, and (ii) **attack** by emitting the next narrative with one `[BLANK]` plus four BIP39 candidate words and a commitment to the correct choice for the next defender. The intended separation is that cheap scripts are reduced to near-random guessing, while LLM agents exploit semantic and grammatical context to substantially outperform random guessing.

Using BIP39 as the candidate vocabulary gives a fixed finite set of words (the English list is size 2048), which is convenient for compact indexing and deterministic on-chain generation if you encode candidates as indices rather than full strings. citeturn0search0turn0search12

Any commitment scheme and “deterministic randomness” design here will typically be built on the chain’s standard hash primitive (Keccak-256 in Ethereum’s execution model), which is cheap and ubiquitous on EVM chains. citeturn1search1turn1search12

The three problems you listed are tightly coupled: if an attacker can (a) remove semantic signal from the NCC (Problem 1), they simultaneously reduce the usefulness of any statistical differentiator (Problem 3), and replays (Problem 2) become more attractive because quality text can be farmed without paying inference costs. A robust fix therefore benefits from **shared primitives** (battle/turn binding, deterministic candidate generation, and evidence-based classification).

## Problem: Unsolvable blanks and how to make them unprofitable

### Why the current rule is game-theoretically fragile
If the contract only checks “exactly one `[BLANK]` exists,” then *semantic solvability* is unconstrained. A rational attacker who expects to lose against a better comprehender can shift the game toward randomness by emitting low-signal or incoherent contexts (your example is effectively a low-mutual-information multiple choice). Because EVM cannot evaluate semantics directly, the fix must come from **(a) constraining the action space** to make “garbage” hard to express within the allowed format, and/or **(b) changing payoffs** so “garbage” is not an equilibrium best response.

### On-chain verifiable constraint: contract-controlled distractors (remove attacker choice)
The simplest high-leverage change is: **attackers stop choosing the 3 distractors**.

Instead, the attacker provides only:
- the narrative (with `[BLANK]`),
- the **set** of 4 candidate indices *or* just the intended correct word (depending on which variant you pick),
- a commitment that binds the intended correct choice to the battle state.

Then the contract deterministically derives (or verifies) the candidate set using a per-turn seed:
- `seed = keccak256(battleId, turnIndex, sequenceHash, attackerAddress, …domain sep…)`. citeturn1search1turn1search12

Two practical variants:

**Variant A (stronger anti-griefing):**  
The contract forces the candidate set to be `{correctWord} ∪ {3 pseudo-random BIP39 words}` and forces the shuffle (positioning) by `seed`. Since the attacker cannot hand-pick distractors, it becomes much harder to engineer “four equally plausible” options. With a 2048-word list, random distractors will often be syntactically/semantically incompatible with the local context, restoring a meaningful LLM advantage without needing semantic verification. citeturn0search0

**Variant B (preserve semantic difficulty):**  
If you worry Variant A makes the task too easy via trivial heuristics (e.g., “pick the only noun”), you can still remove attacker control but sample distractors from a *contract-defined partition* (e.g., pre-tagged sets such as “noun-like / verb-like / modifier-like”). This requires an on-chain verifiable membership proof (e.g., a Merkle proof into a fixed root of word→category tags). It preserves “same-part-of-speech distractors” without letting the attacker craft adversarial sets.

Both variants remain **fully on-chain verifiable** because the contract can recompute indices from `seed` and check distinctness. The key is that the on-chain contract need not store the BIP39 strings—only indices 0…2047—which off-chain clients map to words via the published list. citeturn0search0turn0search12

### Constraint hardening: syntactic lints that are cheap and measurable
Even without semantic evaluation, small **lint rules** remove the worst degeneracies at low gas cost, especially if you already do a linear scan to ensure exactly one `[BLANK]`.

Examples of cheap constraints (all purely byte-level / structural):
- Cap narrative byte length (prevents “state bloat” and keeps scans bounded).
- Enforce `[BLANK]` appears between two ASCII letters (discourages placing it as a standalone token or inside gibberish hashes).
- Enforce minimum number of word separators before/after blank (prevents “The [BLANK]” ultra-short prompts).
- Require a minimum total token count in the narrative.

These rules do **not** guarantee semantic solvability, but they increase the minimum “signal budget” per puzzle while keeping verification extremely cheap.

### Payoff shaping: an uncertainty escape hatch that scripts cannot exploit
Even if you constrain distractors, *some* low-signal/ambiguous prompts will still occur (whether accidentally or adversarially). A purely economic, fully on-chain mitigation is to add a **defender option** that converts “I am uncertain” into a controlled loss that is *strictly better for competent agents than random guessing*, but *does not materially improve scripts*.

A workable mechanism is:

- Add a third defense action: **ABSTAIN**.
- If ABSTAIN: defender pays a fixed penalty `C` (no 20-block strike), receives no time refund, and the game advances.

To prevent scripts from always abstaining (since for a 25% guesser the expected penalty from guessing wrong is high), gate ABSTAIN behind a rolling performance condition such as “ABSTAIN is permitted only if your recent verified accuracy exceeds θ.” This is purely on-chain because the contract already knows past correctness outcomes once reveals settle.

This is a standard mechanism-design pattern: you give sophisticated players a “variance-reduction” action that only they can access consistently, which blunts griefing while keeping the script baseline poor.

The **game-theoretic effect** is important:
- Against an LLM defender, an attacker gains little from making prompts maximally ambiguous because the defender can ABSTAIN on the rare “nonsense” turns instead of paying repeated 20-block penalties.
- A script cannot reliably unlock ABSTAIN because its observed accuracy remains low (and if it occasionally does by luck, it has already paid substantial expected penalties to get there).

This is on-chain, gas-cheap, and does not require any semantic oracle.

## Problem: Replay and faking dynamic generation

### Threat analysis
The “replay” attack is essentially a **proof-of-work avoidance**: scripts harvest high-quality narratives/candidate sets from other matches and re-submit them without paying inference cost. On its own, replay does not improve a script’s defense accuracy, but it undermines the “LLMs are favored because they generate/understand text” story and can interact badly with any future reward/penalty rules tied to attack quality.

You asked specifically for binding narratives to: **this battle, this turn, this sequence hash**, with minimal gas.

### Battle/turn binding with deterministic tags
A minimal binding that is cheap to verify is to require a **turn tag** that is deterministically derived from state and must appear at a fixed position (e.g., prefix).

Example:
- Define `tag = keccak256(battleId, turnIndex, sequenceHash)`.
- Require the narrative begins with a fixed-format ASCII prefix like: `0x` + first 8 bytes of `tag` rendered as hex (16 hex chars), followed by a space.

This is extremely cheap to check because it is a fixed-length prefix comparison rather than substring search. It makes **verbatim replays from other battles invalid** because the prefix differs.

If you prefer “all-word narratives,” encode the tag into 2–4 BIP39 words (indices derived from slices of `tag`) and require those indices appear in fixed positions at the start of the narrative. This leverages the fixed 2048-word list for compact encoding. citeturn0search0turn0search12

### Candidate binding: per-battle deterministic distractors also solves replay
If you implement contract-controlled distractors (Problem 1), you automatically get a strong replay resistance property:

- The candidate set becomes a deterministic function of `(battleId, turnIndex, sequenceHash, attackerAddress, …)`.
- A narrative+candidates copied from another battle will not match the verifier-generated candidates in this battle, so it fails validation.

This is a particularly valuable synergy: one design change hardens both “unsolvable blank” and “replay”.

### Seed generation: avoid relying on fragile on-chain randomness
Do **not** rely on `blockhash` as a long-horizon entropy source: EVM access is limited to the most recent 256 blocks and older queries return zero. citeturn1search4turn1search11

Instead, for deterministic candidate derivation you don’t need unpredictability; you need **unforgeable context binding**. Using a domain-separated hash of battle state is enough (Keccak-256 as specified in Ethereum’s formal model). citeturn1search1turn1search12

If you *do* need unpredictability (e.g., to prevent precomputation markets), use a standard two-party commit-reveal at match start (both players commit to salts, later reveal), then derive `battleSalt = keccak256(saltA, saltB)` and fold it into per-turn seeds. This stays oracle-free and introduces only two extra transactions total.

## Problem: Fail-threshold calibration and statistical guarantees

### Why “fail 4 of last 6” is much harsher than it looks
For a defender with independent per-turn success probability `p`, the number of failures in a window of size `n` is binomial with parameter `q = 1 − p`, and:
\[
P(F=k) = \binom{n}{k} q^k (1-q)^{n-k}.
\]
citeturn2search3

If an LLM defender succeeds with `p = 0.75` (fails with `q = 0.25`), the probability of **≥4 failures in 6** is:
- \( \sum_{k=4}^{6} \binom{6}{k} 0.25^k 0.75^{6-k} \approx 3.76\% \) per *single* 6-turn window.

If `p = 0.80` (`q = 0.20`), it is still about **1.70%** per single window.

The critical issue is that your rule triggers on a **rolling** window (“last 6”), which is repeated many times. Over a 20–40 turn match, the cumulative false-forfeit probability becomes large even for good agents (because eventually a bad streak happens). Under an i.i.d. model:
- At `p = 0.75`, the chance of *ever* hitting “≥4 failures in a rolling window of 6” is on the order of **~23% by 20 turns**, **~34% by 30 turns**, and **~43% by 40 turns** (computed via a Markov/DP over rolling outcomes).

That is far too punitive if you expect legitimate LLMs to play 20–40+ turns without being executed for variance alone, and it gets worse if any fraction of prompts are genuinely ambiguous.

### A statistically safer rolling rule with strong script discrimination
A robust threshold should satisfy two properties simultaneously:

1. **Low false-forfeit** for competent agents at conservative `p` (pick a worst-case LLM accuracy you can realistically defend, e.g. 0.70 rather than 0.80).
2. **Fast detection** for scripts near random guessing, i.e. `p ≈ 0.25`.

A materially safer rolling-window alternative is:

- **Execute if failures ≥ 9 in the last 12 defenses** (rolling 12, threshold 9).

Under the same i.i.d. model used above, this yields:
- For `p = 0.75`: false-forfeit probability over 40 turns ≈ **0.54%**.
- For `p = 0.70`: false-forfeit over 40 turns ≈ **~2%**.
- For scripts at `p = 0.25`: detection by 40 turns ≈ **99%+**.

This keeps the “executioner” effect—scripts die early with high probability—while dramatically reducing the chance that a legitimate agent is wiped by a normal variance streak.

Similar “safe band” rules include `(fail ≥ 10 of last 14)` or `(fail ≥ 11 of last 16)`, which trade slightly slower script detection for even lower false positives. The general tuning knob is: increase `n` and set `k` high enough that the binomial tail under your conservative LLM model is small.

### A more principled and gas-cheap option: SPRT as an on-chain classifier
Instead of a hard rolling window, you can implement a **sequential likelihood test** that is optimal (in expected sample size) for distinguishing two Bernoulli rates. This is the **Sequential Probability Ratio Test**, introduced by entity["people","Abraham Wald","sequential analysis pioneer"]. citeturn0search7turn0search3

SPRT maintains a running log-likelihood ratio and stops when it crosses boundaries derived from target Type I/II errors α, β (approximate boundaries \(a \approx \log(\beta/(1-\alpha)), b \approx \log((1-\beta)/\alpha)\)). citeturn0search3turn0search19

On-chain implementation can be made extremely cheap:
- Store a single signed integer “evidence score”.
- Each verified success adds a constant; each verified failure subtracts a constant.
- If score < lowerBound ⇒ classify as script ⇒ forfeit.
- Optionally if score > upperBound ⇒ classify as “competent” ⇒ unlock ABSTAIN or other privileges (Problem 1).

This uses only addition and comparisons per turn—no exponentials, no binomial tables—while giving you explicit control over false-forfeit and missed-detection rates in a principled way.

### Where proper scoring rules fit (optional)
If you later extend NCC to have defenders submit probabilities over the 4 candidates, you can use strictly proper scoring rules (so agents maximize expected score by reporting true beliefs). The Brier score, proposed by entity["people","Glenn W. Brier","forecast verification 1950"], is one such rule and is widely discussed in the proper scoring rule literature (including work by entity["people","Tilmann Gneiting","statistician proper scoring"] and entity["people","Adrian E. Raftery","statistician proper scoring"]). citeturn1search6turn1search3turn1search9

This can create additional incentive levers around “uncertainty” without semantic oracles, but it is more complex than the rolling/SRPT classifiers above.

## Gas-efficient implementation patterns for Base Sepolia deployment

### Prefer indices and hashes over strings wherever possible
The dominant cost drivers in on-chain text systems are calldata and storage. EIP-2028 specifies calldata pricing in terms of bytes, reducing non-zero calldata costs relative to pre-2019 schedules (16 gas per non-zero byte; 4 gas per zero byte). citeturn0search5turn0search1

Implications for NCC:
- Represent each candidate word as a `uint16` index (0…2047) rather than a UTF-8 string.
- Consider representing the narrative as:
  - either a bounded-length `bytes` blob with very simple parsing rules, or
  - a tokenized form (e.g., packed 11-bit BIP39 indices plus a small punctuation alphabet) if you want deep on-chain validation.

The BIP39 fixed wordlist size makes the “index not string” approach natural. citeturn0search0turn0search12

### Minimize storage writes; use events for narrative history
Persistent storage writes are expensive and also interact with cold/warm access rules (EIP-2929 introduced the cold vs warm state access distinction and raised the cost of first access in a transaction). citeturn0search2turn0search6

For narrative history that does not need to be read by other contracts, emit it as an **event log** rather than storing it. Logs are far cheaper than storage and are designed for off-chain indexing/consumption; they are also not accessible to contracts, which is often fine for narration. citeturn2search6turn2search2

A practical split is:
- Contract stores only: `battleStateHash`, commitments, and compact rolling outcome bitmasks.
- Contract emits events with: narrative bytes, candidate indices, revealed salts.

### Rolling-window logic as a bitmask is extremely cheap
Any rolling threshold or ABSTAIN gating can be implemented as:
- `uintN outcomes`, where each bit encodes success/failure for the last N defenses.
- Update by shift+OR and popcount (or a small lookup-table popcount).

This yields O(1) state update per turn and avoids storing full arrays.

### Transient storage is not a substitute for state, but can simplify intra-tx bookkeeping
If you add intra-transaction mechanisms (e.g., reentrancy guards or complex settlement in one call), EIP-1153 transient storage provides cheap per-transaction key/value space that resets at transaction end. citeturn2search0turn2search4

For NCC, this is usually less important than “events + compact state,” but it can help if settlement and reveal logic becomes multi-step within a single call.

## Equilibrium arguments and remaining edge cases

### Why comprehension becomes the dominant strategy under the recommended changes
Under the combined design:
1. **Replay becomes non-viable** because each turn’s valid narrative must include a deterministic battle/turn tag (fixed prefix), and candidates/distractors are bound to battle state (seeded derivation). A replay from another match fails verification, so “copying” no longer reduces inference costs without modification.
2. **Unsolvable blank griefing loses its leverage** because:
   - the attacker cannot hand-pick adversarial distractors (contract-controlled distractors),
   - the defender can reduce loss on rare ambiguous turns via a gated ABSTAIN action,
   - the classifier/threshold (Problem 3) makes it difficult for scripts to survive long enough to benefit from “turning the game into randomness.”

Given these, the best response for any agent that wants to maximize win probability is:
- maintain high defense accuracy (requires comprehension or a comparably strong statistical language model),
- produce valid tagged narratives (cheap for all, but no longer a way to “fake” competence),
- avoid strategies that increase the chance opponents invoke ABSTAIN cheaply (because it reduces the attacker’s advantage per turn against competent opponents).

In Nash terms, once both players are competent, “garbage attacks” cease to be profitable deviations: they are constrained (distractors) and partially neutralized (ABSTAIN), so they do not reliably change expected payoffs in the attacker’s favor, while still risking accelerating objective clock loss when the defender remains resilient.

### Residual risks to explicitly acknowledge
- **Adversarially crafted ambiguity can’t be eliminated fully without a semantic oracle**, only reduced via constraints and payoff shaping.
- **Model drift and correlated failures:** if failures are not i.i.d. (e.g., bursts due to networking outages), any hard execution rule must be conservative. This is a key reason to prefer larger windows or an SPRT classifier with explicit error targets. citeturn0search3turn0search7
- **Entropy sources:** avoid designs that depend on long-range `blockhash` access or assume unpredictability where the EVM cannot provide it. citeturn1search4turn1search11

Taken together, the simplest robust path is: **(i) bind each turn to battle state via a deterministic tag, (ii) make candidates/distractors a deterministic function of battle state rather than attacker choice, (iii) replace “4 of 6 fails” with a statistically safer execution rule (e.g., 9 of 12 rolling) or SPRT, and (iv) add a gated ABSTAIN to blunt the remaining ambiguity tail.**