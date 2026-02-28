# NCC Implementation Plan (Feb 28, 2026)

## Current State
- **NCC v1 prototype**: committed (3926c20) — basic commit-reveal, 108 Forge tests pass
- **ZK PoC proven**: both circuits compile/prove/generate Solidity verifiers
  - `ncc_mini`: 3,100 gates, simple commitment (pipeline test)
  - `ncc_proof`: 12,699 gates, blake2s hashes (production candidate)
- **Trilemma identified**: verify + hidden + no-re-provide — ZK is the only clean solution
- **Egor feeding research prompt to other models** — awaiting direction

## ZK Path (if Egor greenlights)

**⚠️ REAL GAS DATA: 1.83M gas per verification (~$0.10-0.15 on Base)**
This is 60x more expensive than the re-provide path (~30K gas).

### Step 1: Optimize Circuit (1 day) ✅ DONE
- Packed blake2s hashes as 2×Field hi/lo pairs (Bn254-safe)
- Reduced 64→4 public inputs, proof 14KB

### Step 2: Forge Integration Test (1 day) ✅ DONE
- Deployed NccProofVerifier.sol in Forge test
- Submitted real proof from ncc_proof circuit
- **Actual verification gas: 1,834,294 (~1.83M gas)**
- Critical flag: `--oracle_hash keccak` required for prove + write_vk + write_solidity_verifier
- Without keccak flag: SumcheckFailed (bb defaults to poseidon2, Solidity verifier uses keccak)

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

## Cost Comparison (real data)

| Approach | Gas/Turn | Cost on Base | Privacy | Engineering |
|----------|----------|-------------|---------|-------------|
| **ZK proof** | 1,830K | ~$0.10-0.15 | Word hidden | ~4 days remaining |
| **Re-provide** | ~30K | ~$0.002 | Narrative visible | ~2 days |
| **Current (no NCC)** | ~300K | ~$0.02 | N/A | Done |

**Key question for Egor**: Is hiding the challenge word worth 60x gas cost?
If not, re-provide is the pragmatic choice for a product.

## Blocked On
1. Egor's NCC design direction (ZK vs re-provide vs hybrid)
2. develop→main merge OK
3. Hydroxide re-auth

## Next Task (unblocked)
- Optimize ncc_proof circuit: `pub [u8; 32]` → `pub Field` for both hashes
