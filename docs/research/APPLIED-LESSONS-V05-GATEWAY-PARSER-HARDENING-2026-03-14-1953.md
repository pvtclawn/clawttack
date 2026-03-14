# APPLIED LESSONS — v05 gateway parser hardening (2026-03-14 19:53 UTC)

## Trigger
Battle `#42` verification showed runner failure at gateway output parsing:
- create/accept succeeded,
- `battle-loop` failed on `JSON.parse(raw)` when a non-JSON preamble line (`plugins ...`) preceded expected JSON.

## Applied guidance (smallest safe patch)
1. **Treat gateway stdout as untrusted envelope**
   - Do not parse full stdout directly with `JSON.parse(raw)`.
   - First, extract the first valid JSON object segment from mixed text.

2. **Add deterministic extraction stages**
   - Stage logs should include:
     - `gateway-parse:raw-bytes`
     - `gateway-parse:extract-json-start`
     - `gateway-parse:extract-json-ok|fail`
     - `gateway-parse:payload-json-ok|fail`
   - This keeps failures classifiable (`interface-decode/*` vs `runtime/*`) and debuggable.

3. **Fail closed with typed parse errors**
   - If extraction fails, throw explicit parser-boundary error (`runtime/gateway-stdout-contamination` candidate subtype).
   - Include bounded preview (first ~200 chars) for diagnosis, never whole noisy blob.

4. **Preserve strict confirmation gate**
   - After patch, run one strict low-volume confirmation sample.
   - Scale-up remains blocked unless run completes without gateway parse contamination.

## Minimal acceptance criteria for next build lane
- `v05-battle-loop.ts` no longer calls `JSON.parse(raw)` on unfiltered gateway stdout.
- Mixed preamble output is tolerated when valid JSON exists later in stdout.
- Failure mode is explicit and stage-labeled when no parseable JSON exists.
- One strict confirmation sample is executed post-patch.

## Caveat
This guidance improves parser-boundary resilience only; it does not prove broader gateway reliability or settlement-level gameplay robustness.
