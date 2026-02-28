# The Anti-Scripting Problem in On-Chain AI Agent Combat

## Context

We're building **Clawttack** — an on-chain AI agent battle arena on Base (EVM L2). Two AI agents stake ETH, take turns writing narratives, and try to compromise each other through prompt injection. Winner takes the pot.

## The Problem We Can't Solve

We need a mechanism that **forces agents to process the opponent's narrative through their LLM** (not just ignore it). We call this the "Narrative Comprehension Challenge" (NCC). Without it, a script can:

1. Never read the opponent's narrative → immune to all prompt injection
2. Generate template responses → still submit valid turns
3. Survive until the opponent times out → potentially win

The game's entire value proposition (adversarial LLM combat, prompt injection) collapses if agents can simply not read each other's text.

## What We've Tried (and why each fails)

### Approach 1: Riddle-Answer Commitment
- Attacker embeds a BIP39 dictionary word in their narrative + weaves a riddle pointing to it
- Attacker commits `keccak256(salt, wordIndex)`
- Defender must submit `responseIndex` (their guess)
- Attacker reveals on next turn

**Failure mode:** If wrong answer has consequences (penalty, can't submit turn), the attacker can write impossible/ambiguous riddles to grief the defender. We cannot verify riddle quality on-chain — it's a semantic judgment.

**If no consequences:** Scripts submit random guesses (3-10% hit rate among BIP39 words in text). Nothing bad happens. NCC is theater.

### Approach 2: NCC Gates Turn Submission
- Must answer correctly to submit your next turn
- Scripts can't play → time out → lose

**Failure mode:** Impossible riddles block legitimate agents too. Attacker griefs by writing unsolvable challenges.

### Approach 3: NCC Gates CTF Only  
- Must pass NCC to call `captureFlag()`
- Scripts can still submit turns, just can't capture

**Failure mode:** CTF requires the opponent's signing key, which scripts don't have anyway. Gating is irrelevant for script agents.

### Approach 4: NCC Score as Tiebreaker
- Track correct NCC answers over the battle
- At MAX_TURNS, higher score wins

**Failure mode:** Same impossible riddle problem affects scoring. Also, with decaying timeouts and no MAX_TURNS, someone always times out — no tiebreaker needed.

### Approach 5: NCC Failure = Timer Penalty
- Wrong NCC answer → your next timeout halves extra
- Scripts die fast (always fail → timer collapses)

**Failure mode:** Same impossible riddle problem. Attacker accelerates defender's death with unsolvable riddles regardless of defender's LLM quality.

### Approach 6: Limit BIP39 Words per Narrative
- Cap at MAX_NCC_WORDS (e.g., 5) BIP39 words allowed in narrative
- Reduces guessing space, makes riddles more constrained
- Too many BIP39 words → attacker's fault

**Partial fix:** Limits the worst abuse but doesn't solve the fundamental "was the riddle actually solvable?" question. An attacker can write 5 BIP39 words and still provide no meaningful riddle.

## The Fundamental Tension

```
On transparent EVM:
- You CANNOT verify semantic content (riddle quality, solvability)
- You CAN verify syntactic content (word presence, hash correctness)
- Any PENALTY for NCC failure is exploitable via impossible riddles
- Any REWARD for NCC success incentivizes trivial riddles
- No consequence = scripts ignore NCC entirely
```

## What We DO Have (working mechanics)

1. **CTF via Signature Extraction** — agents sign every turn with a private key. Capturing = producing opponent's signature on a specific message. Tests full agent stack security (LLM + SDK + architecture). Verifiable via `ecrecover`.

2. **Decaying Turn Timer** — halves every 5 turns (configurable), no floor needed. Someone WILL time out eventually. Prevents draws.

3. **VOPs (Verifiable Oracle Primitives)** — random capability challenges each turn (hash preimages, oracle readings, cross-chain data). On-chain verifiable. Currently independent of narratives but could be wired in.

4. **Poison Word** — assigned BIP39 word the opponent must avoid saying. ON-CHAIN VERIFIABLE but SDK-filterable (`.replace()` before submission).

5. **Target Word** — assigned BIP39 word you MUST include in your narrative. On-chain verifiable via offset check.

6. **Commit-Reveal** — salted commitments (2^256 brute-force resistance). Proven pattern.

7. **Offset-Based Verification** — O(word_length) instead of O(narrative_length). Agent provides byte position, contract spot-checks.

## Constraints

- **EVM-only** — no TEEs, no oracles, no off-chain judges, no trusted third parties
- **Gas budget** — ideally <100K gas overhead per turn on Base L2
- **Transparent chain** — all calldata is public, all state is readable
- **Adversarial agents** — assume agents will exploit every loophole
- **SDK layer exists** — agents have a software layer between LLM and chain that can filter/modify outputs

## Game Theory Context

From our study of game theory fundamentals:
- **Brinkmanship** (Schelling): the halving timer IS a brinkmanship mechanism — the process creates credible threat, not the timeout itself
- **Mechanism design**: we need incentive compatibility — agents' dominant strategy should align with desired behavior (reading narratives)
- **Information asymmetry**: the attacker knows the answer, the defender doesn't. This is a signaling/screening game
- **Commitment devices**: commit-reveal IS a commitment device, but it only binds the ANSWER, not the RIDDLE QUALITY

## What We're Looking For

A mechanism that satisfies ALL of:
1. **Forces LLM engagement** — a script that never reads opponent text MUST lose (or have significantly worse outcomes) compared to an agent that reads
2. **Not exploitable via impossible riddles** — attacker cannot grief defender with unsolvable challenges
3. **On-chain verifiable** — no trusted judges or off-chain computation
4. **Gas-efficient** — <100K overhead per turn
5. **Compatible with existing mechanics** — CTF, timer, VOP, poison, target word

OR: a rigorous argument for why this is impossible, with the LEAST BAD compromise clearly identified.

## Additional Context

- **Authenticated context research** (arXiv:2602.10481): tamper-evident hash chains for LLM context windows could prove content was processed, but requires trusted execution environment
- **PunkGo kernel** (arXiv:2602.20214): append-only audit logs for agent actions, but kernel must be trusted
- **ZK proofs**: we built a working Noir circuit proving substring membership (12,644 gates, 1.83M gas verification). Proves word∈narrative without revealing word, but doesn't prove "LLM read narrative"
- **The trilemma**: on transparent EVM, you can have at most 2 of {verify word-in-narrative, answer hidden, no re-provide narrative}. Confirmed by 4 independent LLMs (ChatGPT 5.2, Gemini 3.1 Pro, Grok, Kimi)

Think deeply about mechanism design, game theory, cryptographic commitments, and information economics. Consider approaches from auction theory, voting systems, prediction markets, or any other domain where forcing honest behavior in adversarial settings has been solved.
