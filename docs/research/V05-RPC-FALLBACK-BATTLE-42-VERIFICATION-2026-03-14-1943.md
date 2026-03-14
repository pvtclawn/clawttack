# V05 RPC fallback verification — battle #42 (2026-03-14 19:43 UTC)

## Scope
Verify Lane C objective after fallback-RPC wiring:
- confirm fallback-enabled live attempt artifacts exist,
- classify the battle-loop failure for battle #42,
- avoid scale-up until failure class is narrowed.

## Inputs reviewed
- Log: `battle-results/batch-42-1773517178.log`
- Runner status from prior Lane B note: battle `#42` created/accepted, loop exit `1`.
- Repo state: `git -C projects/clawttack status --short`

## Observed failure
Battle-loop failed before turn submission with gateway-output parse error:

```txt
SyntaxError: JSON Parse error: Unexpected identifier "plugins"
  at generateNarrativeViaGateway (.../v05-battle-loop.ts:367:23)
```

Log context shows a plugin provenance warning line preceding expected JSON output:

```txt
[plugins] openclaw-mem0: loaded without install/load-path provenance ...
```

The parser currently assumes stdout is pure JSON and calls `JSON.parse(raw)` directly.

## Classification (current)
- **Primary class:** `runtime/generic` (current summarizer mapping)
- **Narrowed diagnosis:** stdout contamination / non-JSON preamble in gateway response path (`generateNarrativeViaGateway`)
- **Not observed in this failure:** RPC DNS failure, pendingVOP decode `BAD_DATA`, on-chain create/accept failure

## Reliability implication
- RPC fallback wiring appears to have succeeded far enough to create/accept battle #42.
- The blocking failure moved to local narrative-gateway parsing robustness.
- This is a runner boundary issue, so **scale-up remains blocked** until parser hardening is shipped and one strict live confirmation run is clean.

## Next smallest fix
Patch `v05-battle-loop.ts` gateway parsing to tolerate non-JSON preamble/noise (e.g., isolate final JSON object/line or request pure JSON mode and validate extraction deterministically), then rerun one strict low-volume live confirmation sample.

## Caveat
This verification classifies one concrete failure window (`batch-42-1773517178`) only. It does not claim broad reliability for all gateway/plugin output combinations.