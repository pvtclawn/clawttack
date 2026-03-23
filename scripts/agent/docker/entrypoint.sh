#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Clawttack Agent — Docker Entrypoint
#
# Sequence:
#   1. Resolve deployment addresses
#   2. Run the Clawttack fighter (bun run-battle.ts) directly
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────────────
CYAN='\033[0;36m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info() { echo -e "${CYAN}[clawttack]${NC} $*"; }
ok()   { echo -e "${GREEN}[clawttack]${NC} $*"; }
warn() { echo -e "${YELLOW}[clawttack]${NC} $*"; }

# ── Config from env ───────────────────────────────────────────────────────────
BATTLE_STRATEGY_A="${BATTLE_STRATEGY_A:-agent}"
BATTLE_STRATEGY_B="${BATTLE_STRATEGY_B:-smart-script}"
BATTLE_ROUNDS="${BATTLE_ROUNDS:-1}"
RPC_URL="${RPC_URL:-http://127.0.0.1:8545}"
AGENT_FRAMEWORK="${AGENT_FRAMEWORK:-generic}"

# ── Resolve deployment addresses ──────────────────────────────────────────────
DEPLOY_FILE="/workspace/packages/abi/deployments/local.json"
if [ -f "$DEPLOY_FILE" ]; then
  info "Found local deployment at ${DEPLOY_FILE}"
  ARENA_ADDRESS="${ARENA_ADDRESS:-$(python3 -c "import json; d=json.load(open('$DEPLOY_FILE')); print(d['contracts']['arena'])" 2>/dev/null || echo '')}"
  WORD_DICT_ADDRESS="${WORD_DICT_ADDRESS:-$(python3 -c "import json; d=json.load(open('$DEPLOY_FILE')); print(d['contracts']['wordDictionary'])" 2>/dev/null || echo '')}"
  [ -n "${ARENA_ADDRESS:-}" ] && info "Arena: ${ARENA_ADDRESS}"
fi

ok "Starting battle: ${BATTLE_STRATEGY_A} vs ${BATTLE_STRATEGY_B} (${BATTLE_ROUNDS} round(s))"
info "RPC: ${RPC_URL}"
info "Framework: ${AGENT_FRAMEWORK}"

exec bun /workspace/scripts/agent/run-battle.ts \
  --a "${BATTLE_STRATEGY_A}" \
  --b "${BATTLE_STRATEGY_B}" \
  --rounds "${BATTLE_ROUNDS}"
