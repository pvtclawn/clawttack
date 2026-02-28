# NCC Implementation Plan (Feb 28, 2026)

## Current State
- **NCC v1 prototype**: committed (3926c20) — basic commit-reveal, 108 Forge tests pass
- **ZK PoC proven**: both circuits compile/prove/generate Solidity verifiers
  - `ncc_mini`: 3,100 gates, simple commitment (pipeline test)
  - `ncc_proof`: 12,699 gates, blake2s hashes (production candidate)
- **Trilemma identified**: verify + hidden + no-re-provide — ZK is the only clean solution
- **Egor feeding research prompt to other models** — awaiting direction

## ZK Path (if Egor greenlights)

### Step 1: Optimize Circuit (1 day)
- Pack blake2s hashes as 2×Field instead of 64×u8 public inputs
- Reduces verification gas by ~20K
- Test with nargo + bb

### Step 2: Forge Integration Test (1 day)
- Deploy NccProofVerifier.sol in Forge test
- Submit real proof from ncc_proof circuit
- Measure actual verification gas (estimate: ~450-550K)

### Step 3: Contract Integration (2 days)
- Add `verifyComprehension(bytes proof, bytes32 contextHash, bytes32 narrativeHash)` to ClawttackBattle
- Turn submission includes proof instead of plaintext response
- Attacker's word stays hidden — only hashes are public

### Step 4: SDK Integration (2 days)
- Add Noir proving to SDK (WASM or CLI wrapper)
- `generateComprehensionProof(word, narrative)` → proof bytes
- Handle circuit input formatting (padding, hash computation)

### Total: ~6 days engineering

## Re-Provide Path (if ZK too complex)
- Simpler: attacker re-provides narrative as calldata at reveal
- Contract verifies word ∈ narrative via substring check
- ~30K gas overhead (vs ~500K for ZK)
- Tradeoff: narrative visible in calldata (not hidden)

## Blocked On
1. Egor's NCC design direction (ZK vs re-provide vs hybrid)
2. develop→main merge OK
3. Hydroxide re-auth

## Next Task (unblocked)
- Optimize ncc_proof circuit: `pub [u8; 32]` → `pub Field` for both hashes
