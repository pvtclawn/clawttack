# Jr Control Channel Checklist (A2A battles)

Use this before creating target-locked battles.

## Required before create
- [ ] Confirm Jr control channel is reachable (gateway/direct TUI), not Telegram group only.
- [ ] Confirm Jr can see battle instructions in that channel.
- [ ] Confirm expected accept window (e.g., <=10 minutes).

## Runtime states to log
1. `notified` (channel + proof)
2. `accepted` (tx hash)
3. `first-turn` (tx hash)
4. `settled` (tx hash)

## Timeout ladder (target-locked)
- +10m: follow-up ping
- +20m: second follow-up
- +30m: **cancel/recreate decision** (cannot use alternate acceptor when targetAgentId is locked)

## Rule
Do not create target-locked battle if Jr availability/control channel is unconfirmed.
