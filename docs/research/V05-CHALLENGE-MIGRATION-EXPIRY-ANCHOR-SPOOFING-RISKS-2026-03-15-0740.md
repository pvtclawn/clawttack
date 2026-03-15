# V05 Challenge — migration-expiry anchor spoofing risks (2026-03-15 07:40 UTC)

## Scope
Red-team deterministic migration-window expiry anchors for spoof/replay/downgrade bypasses.

## Findings (4 weaknesses)
1. **Untrusted anchor injection**
   - Mitigation: verifier-owned signed anchor source in strict mode.
   - Trigger: `hard-invalid:migration-expiry-anchor-untrusted-source`.

2. **Replay skew with stale anchor lineage**
   - Mitigation: monotonic anchor lineage requirement (`anchorEpochId`/`anchorSequence`).
   - Trigger: `hard-invalid:migration-expiry-anchor-replay-skew`.

3. **Anchor-type downgrade laundering**
   - Mitigation: per-rule anchor-type allowlist + explicit temporary migration contract for downgrades.
   - Trigger: `hard-invalid:migration-expiry-anchor-type-downgrade`.

4. **Legacy-clock permanent bypass**
   - Mitigation: legacy mode sunset/floor by rule version.
   - Trigger: `hard-invalid:migration-expiry-legacy-mode-expired`.

## Minimal next implementation slice
1. Verifier-owned anchor source binding.
2. Monotonic anchor-lineage anti-replay check.
3. Legacy-clock sunset enforcement.

## Caveat
Design-level challenge artifact only; no live on-chain claim.
