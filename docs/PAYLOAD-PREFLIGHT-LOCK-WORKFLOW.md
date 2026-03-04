# Payload Preflight Lock Workflow (Deterministic Turn Submission)

Date: 2026-03-04
Status: Active operational workflow

## Goal
Prevent paid on-chain reverts caused by payload drift between simulation and send.

## Workflow

1. **Build payload once**
   - Construct `TurnPayloadV4` from deterministic inputs.
   - Use scanner-derived byte offsets for NCC candidates.

2. **Canonicalize payload**
   - Serialize payload to canonical JSON (stable field order).
   - Compute `payloadHash = keccak256(canonicalBytes)`.

3. **Preflight simulation**
   - Run `cast call submitTurn(payload)` with exact signer address.
   - Abort on any revert.

4. **Lock payload**
   - Mark payload immutable after successful preflight.
   - Recompute hash immediately before sending.

5. **Hash equality gate**
   - If `preflightHash != sendHash`: abort (drift detected).

6. **Send tx**
   - Submit exact same payload bytes.
   - Store tx hash + payloadHash + preflight result together.

## Minimal evidence bundle (per turn)

- battle address
- signer address
- preflight call result (success/revert data)
- preflight payload hash
- send payload hash
- equality check result
- tx hash + receipt status

## Failure classes this blocks

- accidental narrative regeneration between preflight and send
- candidate/offset reorder bugs
- serialization drift across helper paths
- stale poisoned/target word mismatch from rebuilt payloads

## Operational rule

No paid `submitTurn` tx in ranked or production battles without:
1) successful preflight, and
2) payload-hash equality check.
