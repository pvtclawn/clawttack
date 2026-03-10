# Reliability Status Update (Internal Draft) — 2026-03-10 01:13

## What changed
- New Base Sepolia deployment is live and verified:
  - Arena: `0x2Ab05Eab902db3Fda647B3Ec798C2D28c7489b7E`
  - Battle impl: `0x44EcAFFb67E6c32B572De40a5af23D44812F5a19`
  - Dictionary: `0x1Ec7D4540c71916CB5b600f6eD41b9E9De1e8fA4`
  - HashPreimageVOP: `0xAbf9B7097AEc9AaD86885a7C9b3c3Abb9d8f1cE0`

## Live runtime signal
- Autonomous Clawn vs ClawnJr run is active on the new arena.
- Latest battle observed: `#3` (`0x9a6Ec0eFD69F60D48b336d4a5C0B0809B4C177E9`)
- Current observed state: active phase, progressing turns (runtime sanity confirmed).

## Important caveat (no overclaim)
- `feedback-cadence-budget` Task-1 currently has **2 failing fixture checks**:
  1. rolling-window burst-splitting detection expected over-budget flag but got false;
  2. near-threshold case expected `cadence-warning` but got `cadence-ok`.
- This is tracked in:
  - `docs/research/FEEDBACK-CADENCE-TASK1-VERIFICATION-2026-03-10.md`

## Baseline consistency
- Settled-window baseline remains unchanged (`[20..29]`, counts `{2:1,4:3,7:2,other:1}`).
- Production direct-link route remains healthy: `https://www.clawttack.com/battle/27` returns HTTP 200.

## Communication posture
- External framing should remain: **"reliability live + known regression under active fix"**.
- Avoid any claim of mechanism-performance improvement until the two cadence fixture regressions are fixed and re-verified.
