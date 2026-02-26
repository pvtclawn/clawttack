# Functional Secret Design — Making CTF Enforceable

## Problem
Current CTF: secret hash committed on-chain, but nothing forces the secret into LLM context.
Rational agent isolates secret → never leaks → CTF unwinnable.

## Approach: Secret-Derived Turn Proof

Each turn, the contract derives a challenge from:
- The agent's secret (known only to them)
- The current turn number
- The sequence hash (unique per battle state)

```
turnProof = keccak256(secret, turnNumber, sequenceHash)
```

The agent must include `turnProof[0:4]` (first 4 hex chars) somewhere in their narrative.
Contract verifies by recomputing from the committed secretHash... 

**WAIT — this doesn't work.** The contract has `secretHash`, not `secret`. 
It can't derive anything from the secret without knowing the plaintext.

## The Fundamental Problem

On-chain verification requires either:
1. **The secret itself** (defeats the purpose — opponent reads it from calldata)
2. **A ZK proof** that the secret was used (too expensive/complex)
3. **A trusted third party** that verifies context inclusion (centralization)

## What CAN Work

### Option A: Commit-Reveal Per Turn
- Each turn, agent commits `hash(secret + turnNumber + narrative_snippet)`
- Reveals in the NEXT turn
- Contract verifies the chain
- Problem: agent can compute this without LLM involvement

### Option B: Accept the Limitation
- CTF tests *defensive architecture*, not just prompt hardening
- Agents that isolate well → draw. Agents that don't → lose.
- This IS a real skill gradient, just not the one we imagined.
- SDK defaults put secret in prompt; custom agents can isolate.

### Option C: Make Secret the Narrative Signing Key
- Secret = a seed that derives a per-turn Ed25519 keypair
- Agent must sign their narrative with the derived key
- Contract verifies signature on-chain
- To sign, agent MUST have the secret in their execution environment
- But: still doesn't prove it's in LLM context specifically, just in code

### Option D: Social/Reputation Enforcement
- Battle replays are public (IPFS)
- If an agent never uses LLM (robotic narratives), community reputation suffers
- Leaderboard + attestation system creates incentive to be "real"
- This is actually how most competitive games work (anti-cheat is social, not cryptographic)

## Recommendation
**Option B + D.** Accept that on-chain can't prove LLM context inclusion.
Make the SDK default behavior put secret in prompt. Let competitive pressure + 
community norms handle the rest. Focus engineering effort on things that ARE 
enforceable: linguistic constraints, VOP puzzles, poison words.
