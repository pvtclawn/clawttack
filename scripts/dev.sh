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
echo -e "${GREEN}[1/4]${NC} Starting Anvil..."
if lsof -i:8545 &>/dev/null; then
    echo "  Anvil already running on :8545"
else
    ANVIL_ARGS="--silent"
    if [[ "${1:-}" == "--fast" ]]; then
        ANVIL_ARGS="$ANVIL_ARGS"
        echo "  Anvil started in fast mode (instant mining)"
    else
        ANVIL_ARGS="$ANVIL_ARGS --block-time 2"
        echo "  Anvil started (block-time: 2s)"
    fi
    anvil $ANVIL_ARGS &
    ANVIL_PID=$!
    sleep 1
fi

# 2. Deploy contracts
echo -e "${GREEN}[2/4]${NC} Deploying contracts..."
DEPLOY_OUTPUT=$(cd "$CONTRACTS_DIR" && forge script script/Deploy.s.sol:DeployV0 \
    --rpc-url http://127.0.0.1:8545 \
    --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
    --broadcast 2>&1)

# Deploy Multicall3 (viem requires it for batched reads in the UI)
echo -e "${GREEN}[3/4]${NC} Deploying Multicall3..."
MC3_ADDR="0xcA11bde05977b3631167028862bE2a173976CA11"
MC3_CODE=$(cast code "$MC3_ADDR" --rpc-url http://127.0.0.1:8545 2>/dev/null || echo "0x")
if [ "$MC3_CODE" = "0x" ]; then
    # Deploy a minimal Multicall3 and copy its bytecode to the deterministic address
    MC3_TX=$(cast send --rpc-url http://127.0.0.1:8545 \
        --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
        --create '0x608080604052346015576103f4908161001a8239f35b5f80fdfe60806040526004361015610011575f80fd5b5f3560e01c80630f28c97d1461005d57806342cbb15c1461003f576382ad56cb1461003a575f80fd5b610101565b34610059575f366003190112610059576020604051438152f35b5f80fd5b34610059575f366003190112610059574260805260206080f35b602081016020825282518091526040820191602060408360051b8301019401925f915b8383106100a957505050505090565b90919293946020806060600193603f1986820301875282808b5180511515845201516040828401528051918291826040860152018484015e5f828201840152601f01601f19160101970195949190910192019061009a565b60203660031901126100595760043567ffffffffffffffff811161005957366023820112156100595780600401359067ffffffffffffffff8211610059576024810190602436918460051b0101116100595761015c82610277565b905f5b83811061017857604051806101748582610077565b0390f35b61018281846102f4565b51602061019083878661030d565b916101d45f8061019f8661032f565b816101ad6040890189610343565b91906101be60405180948193610376565b03925af16101ca610383565b8385015215158252565b5191013517156101e65760010161015f565b6308c379a05f52602060045260176024527f4d756c746963616c6c333a2063616c6c206661696c656400000000000000000060445260645ffd5b634e487b7160e01b5f52604160045260245ffd5b6040519190601f01601f1916820167ffffffffffffffff81118382101761025a57604052565b610220565b67ffffffffffffffff811161025a5760051b60200190565b906102896102848361025f565b610234565b828152809261029a601f199161025f565b015f5b8181106102a957505050565b60405190604082019180831067ffffffffffffffff84111761025a576020926040525f81526060838201528282860101520161029d565b634e487b7160e01b5f52603260045260245ffd5b80518210156103085760209160051b010190565b6102e0565b91908110156103085760051b81013590605e1981360301821215610059570190565b356001600160a01b03811681036100595790565b903590601e1981360301821215610059570180359067ffffffffffffffff82116100595760200191813603831361005957565b908092918237015f815290565b3d156103b9573d9067ffffffffffffffff821161025a576103ad601f8301601f1916602001610234565b9182523d5f602084013e565b60609056fea2646970667358221220ab2e964673c2e243f5cbe71bea6fb789585be8b32304ebbae2484c7faafef44b64736f6c63430008220033' 2>&1)
    MC3_DEPLOYED=$(echo "$MC3_TX" | grep 'contractAddress' | awk '{print $NF}')
    MC3_RUNTIME=$(cast code "$MC3_DEPLOYED" --rpc-url http://127.0.0.1:8545)
    cast rpc anvil_setCode "$MC3_ADDR" "$MC3_RUNTIME" --rpc-url http://127.0.0.1:8545 >/dev/null 2>&1
    echo "  Multicall3 deployed at $MC3_ADDR"
else
    echo "  Multicall3 already deployed"
fi

# 3. Parse addresses and write local.json
echo -e "${GREEN}[4/4]${NC} Updating $DEPLOY_JSON..."

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
