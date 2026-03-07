The core flaw is that the current NCC makes **“make the opponent fail”** the attacker’s objective, but gives the contract no way to distinguish **hard but fair** from **garbage and unsolvable**. So under the current payoff, readable text is **not** the dominant strategy.

## 1) Unsolvable-blank griefing

### Why the current incentive is broken

Let `q` be the defender’s failure probability on your NCC.

With the current rules, the attacker’s expected value from the NCC penalty term is basically:

`U_attack ≈ 20q`

So the attacker is always rewarded for pushing `q` upward, even by making the blank semantically useless.

A simple “dual penalty” does **not** fix that unless it is larger than the defender’s miss penalty. If the attacker is slashed `s` whenever the defender misses, then:

`U_attack ≈ q(20 - s)`

So as long as `s < 20`, the attacker still wants higher `q`. That is why a small symmetric slash or light mirror penalty does not truly remove the grief incentive.

### The cleanest low-gas fix: make the **candidate set contract-derived**

Do **not** let the attacker submit the 4 candidate words.

Instead derive them on-chain from a battle-specific seed:

`turnSeed = keccak256(battleId, turnNo, prevSeqHash, chainId, address(this))`

Then sample 4 distinct BIP39 word indices from that seed. The BIP-39 English list has 2048 words, and the spec intentionally avoids similar/confusable words while making lookup easy, so word-index-based sampling is very natural here. ([GitHub][1])

Then the attacker only submits:

* the narrative with one `[BLANK]`
* a commitment to which of the 4 contract-derived indices is correct

That removes the attacker’s strongest ambiguity lever: **hand-picking adversarial distractors**.

This is also cheaper:

* no 4-word candidate calldata every turn
* no need to store candidate strings on-chain
* clients can reconstruct the 4 indices locally from `turnSeed`

### Add one small economic safety valve: limited **nullify tokens**

Even with contract-derived candidates, an attacker can still write garbage context. The simplest way to cap that is:

* each player gets `2` or `3` **nullify** rights per battle
* if defender nullifies, the NCC does **not** resolve as a miss
* defender gets **no time refund**
* defender still consumes the turn normally
* attacker loses a small **author bond** (I would use about `10` blocks), and that bond is **burned**, not paid to the defender

Why this works:

* LLMs can recognize “this prompt is semantically empty” better than scripts can
* scripts cannot time those nullifies well
* because the bond is burned, defenders cannot farm value by spamming nullify

If readable prompts produce about `q = 0.25` against good LLMs, but obvious garbage pushes toward `q = 0.75`, then with a 10-block author bond, garbage stops being better once obvious junk gets nullified even ~40% of the time. That is a very reachable target for competent LLM defenders.

### Stronger v2, if you want even less attacker control

If you later want to remove **blank-position control** too, have the attacker commit a Merkle root of eligible BIP39 tokens in the narrative and let the contract choose the blank position from `turnSeed`. OpenZeppelin already exposes calldata-friendly Merkle proof verification, so this is implementable, just heavier than the contract-derived-candidates patch. ([OpenZeppelin Docs][2])

### Best-response effect

With current rules, the best response is “minimize solveability.”
With contract-derived candidates + nullify/bond, the best response becomes “write readable context around an exogenous candidate set,” because unreadable junk no longer has clean positive EV.

That is exactly the equilibrium shift you want.

---

## 2) Replay / faking comprehension from other battles

### The real issue

Right now, a script can scrape an LLM-authored turn from another battle and replay it because the puzzle is not strongly bound to:

* this battle
* this turn
* this transcript prefix

### Use transcript-domain separation everywhere

Bind every turn to the current battle state:

`turnSeed = keccak256(battleId, turnNo, prevSeqHash, chainId, address(this))`

Then use `turnSeed` for **all** of:

* candidate-word derivation
* the commitment preimage
* a required visible turn tag

So the attacker’s commitment becomes:

`commit = keccak256(turnSeed, correctIdx, salt)`

This is the same design principle as EIP-712 domain separation: include chain/domain-specific fields so identical payloads are not valid across different contexts. EIP-712 explicitly uses fields like `chainId`, `verifyingContract`, and optional `salt`, and its rationale is to prevent collisions across otherwise identical structures. ([Ethereum Improvement Proposals][3])

### Add a visible 3-word battle tag

Derive a **3-word BIP39 tag** from the same seed and require it to appear in a fixed preamble of the narrative.

Because the BIP39 list has 2048 words, each word carries 11 bits. So:

* 2-word tag = 22 bits
* 3-word tag = 33 bits

A 3-word tag is enough to make “copy exact text from some other battle” useless unless the script actually rewrites the prompt for the current battle.

That is the important distinction:

* exact replay dies
* lazy template reuse gets much harder
* agents now have to condition on the live transcript state

### Gas-efficient storage pattern

Do not store full text in contract storage.

Store only:

* `prevSeqHash`
* `commit`
* rolling fail-state
* small counters/bonds

Emit the narrative in an event and keep only `keccak256(narrative)` in state if you need integrity checks.

### What this does and does not solve

This **does** kill cheap copy-paste replay.

It does **not** make sophisticated NLP scripting impossible. But it forces scripts to actually condition on the current battle state, which is the point: cheap scraping should not be enough.

---

## 3) Is 400 bank / 20 penalty tight enough? And is “4 fails in last 6” too harsh?

### First: 400 is mostly pacing, not discrimination

Under the natural reading that “flat 2% decay” means `8` blocks per turn from a 400-block bank, the expected drain from miss penalties alone is:

* good LLM (`p = 0.75` success): `8 + 20(0.25) = 13`
* blind script (`p = 0.25` success): `8 + 20(0.75) = 23`

So expected survival is roughly:

* LLM: `400 / 13 ≈ 30.8` turns
* script: `400 / 23 ≈ 17.4` turns

That is a real gap, but it is closer to **1.8x** than **3x**.

Important consequence: **starting bank does not create the separation**. It only scales match length. The real discrimination comes from:

* fail penalty vs flat decay
* solver accuracy gap
* any extra executioner rule

If you wanted a raw **2x** survival gap from penalty math alone with flat decay still at 8, you would need a miss penalty closer to **32**, not 20.

So my read is: **400/20 is serviceable, but not mathematically sharp enough by itself**. You want the statistical executioner.

### “4 fails in last 6” is too punitive

Using a simple iid binomial model:

For a legitimate LLM with `p = 0.75` solve rate, the probability of failing at least 4 out of any 6 is:

`Pr[X ≥ 4], X ~ Binomial(6, 0.25) = 3.76%`

That sounds moderate, but overlapping windows make it ugly:

* within 20 defended turns, false auto-loss is about **22.7%**
* within 30 defended turns, false auto-loss is about **33.9%**

So a real 75% solver gets executed about one-third of the time in a 30-turn match. That is far too harsh.

For a stronger 80% solver, it is still about:

* **11.7%** false auto-loss by 20 turns
* **18.2%** by 30 turns

So yes: **4 of 6 is too punitive**.

### Better threshold: **9 fails in the last 14 completed NCC guesses**

This is a much better drop-in boundary.

For a 75% solver:

* false auto-loss by 20 defended guesses: about **0.68%**
* false auto-loss by 30 defended guesses: about **1.39%**

For an 80% solver:

* by 20: about **0.13%**
* by 30: about **0.28%**

For a blind 25% solver:

* caught by 20 defended guesses: about **96.7%**
* caught by 30 defended guesses: about **99.7%**

That is a much healthier operating point.

A slightly more aggressive alternative is **8 of last 12**:

* 75% solver false auto-loss by 30: about **2.11%**
* blind script caught by 20: about **96.9%**

So:

* **9/14** = better fairness
* **8/12** = slightly harsher, slightly earlier

I would ship **9/14**.

### Very important implementation detail

The fail-window should count only **completed NCC guesses**.

Do **not** feed these into the binomial executioner:

* nullified NCCs
* network timeouts
* empty/missed submissions due transport issues

Those should be punished by the **clock**, not by the **comprehension executioner**.

Otherwise you are measuring infrastructure reliability, not reading comprehension.

### Cheap on-chain implementation

A 14-turn rolling window is trivial on-chain:

* `uint16 failBitmap`
* `uint8 failCount`

On each completed defense:

* shift left 1 bit
* OR in `1` if wrong, `0` if correct
* mask to 14 bits
* update `failCount` by adding new bit and subtracting dropped bit

Then:

* if `completedGuesses >= 14` and `failCount >= 9`, auto-settle

That is O(1), branch-light, and cheap.

---

## Recommended package

I would deploy this bundle together:

1. **Contract-derived 4-word candidate set** from `turnSeed`
2. **3-word visible battle tag** from the same seed
3. **Commit preimage includes `turnSeed`**
4. **2–3 nullify tokens** per player, with a **burned author bond** around 10 blocks
5. Replace **4/6** with **9/14 completed NCC failures**
6. Keep timeouts/liveness on the chess clock, not in the binomial executioner

That combination does three useful things at once:

* unreadable garbage stops being the clean EV-maximizing attack
* cross-battle replay becomes invalid by construction
* scripts with sustained 25% solve rates still get removed quickly, while real LLMs almost never false-trigger

If you want, I can turn this into contract-level state variables and transition rules next.

[1]: https://github.com/bitcoin/bips/blob/master/bip-0039/english.txt "bips/bip-0039/english.txt at master · bitcoin/bips · GitHub"
[2]: https://docs.openzeppelin.com/contracts/5.x/api/utils/cryptography "Cryptography | OpenZeppelin Docs"
[3]: https://eips.ethereum.org/EIPS/eip-712 "EIP-712: Typed structured data hashing and signing"

