#!/usr/bin/env bash
# Local dev environment: Anvil + deploy + update local.json
set -euo pipefail

CONTRACTS_DIR="packages/contracts"
DEPLOY_JSON="packages/abi/deployments/local.json"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🦞 Clawttack Local Dev${NC}"
echo ""

# 1. Start Anvil
echo -e "${GREEN}[1/3]${NC} Starting Anvil..."
if lsof -i:8545 &>/dev/null; then
    echo "  Anvil already running on :8545"
else
    anvil --block-time 2 --silent &
    ANVIL_PID=$!
    echo "  Anvil started (PID: $ANVIL_PID, block-time: 2s)"
    sleep 1
fi

# 2. Deploy contracts
echo -e "${GREEN}[2/3]${NC} Deploying contracts..."
DEPLOY_OUTPUT=$(cd "$CONTRACTS_DIR" && forge script script/Deploy.s.sol:DeployV0 \
    --rpc-url http://127.0.0.1:8545 \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
    --broadcast 2>&1)

# 3. Parse addresses and write local.json
echo -e "${GREEN}[3/3]${NC} Updating $DEPLOY_JSON..."

ARENA=$(echo "$DEPLOY_OUTPUT" | grep "ClawttackArena:" | awk '{print $NF}')
BATTLE_IMPL=$(echo "$DEPLOY_OUTPUT" | grep "ClawttackBattle (impl):" | awk '{print $NF}')
WORD_DICT=$(echo "$DEPLOY_OUTPUT" | grep "BIP39Words:" | awk '{print $NF}')
HASH_VOP=$(echo "$DEPLOY_OUTPUT" | grep "VOP\[0\]" | awk '{print $NF}')

# Get current block number
DEPLOY_BLOCK=$(cast block-number --rpc-url http://127.0.0.1:8545 2>/dev/null || echo "0")

cat > "$DEPLOY_JSON" <<EOF
{
  "chainId": 31337,
  "name": "local",
  "rpc": "http://127.0.0.1:8545",
  "contracts": {
    "arena": "$ARENA",
    "battleImpl": "$BATTLE_IMPL",
    "wordDictionary": "$WORD_DICT",
    "hashPreimageVop": "$HASH_VOP"
  },
  "deployBlock": $DEPLOY_BLOCK
}
EOF

echo ""
echo -e "${GREEN}✅ Local environment ready!${NC}"
echo "  Arena:       $ARENA"
echo "  Battle Impl: $BATTLE_IMPL"
echo "  Word Dict:   $WORD_DICT"
echo "  Hash VOP:    $HASH_VOP"
echo "  Deploy Block: $DEPLOY_BLOCK"
echo ""
echo "  RPC: http://127.0.0.1:8545"
echo "  Account[0]: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (10000 ETH)"
echo "  Account[1]: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (10000 ETH)"
echo ""
echo "  Next: bun run e2e"
