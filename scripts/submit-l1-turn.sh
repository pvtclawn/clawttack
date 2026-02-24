#!/bin/bash
# Submit a turn with L1Metadata VOP solution
# Usage: ./submit-l1-turn.sh <battle> <account> <narrative> <poison>
set -e
export PATH="$HOME/.foundry/bin:$PATH"
RPC="https://sepolia.base.org"
WALLET_PASSWORD=$(python3 -c "import json; print(json.load(open('$HOME/.config/pvtclawn/secrets.json'))['WALLET_PASSWORD'])")
L1BLOCK="0x4200000000000000000000000000000000000015"

BATTLE=$1
ACCOUNT=$2
NARRATIVE=$3
POISON=$4

# Get current L1 state
L1NUM=$(cast call $L1BLOCK "number()(uint64)" --rpc-url $RPC | awk '{print $1}')
L1FEE=$(cast call $L1BLOCK "basefee()(uint256)" --rpc-url $RPC | awk '{print $1}')
SALT=$(cast call $BATTLE "currentVopParams()(bytes)" --rpc-url $RPC)

echo "L1: num=$L1NUM fee=$L1FEE"
echo "Salt: $SALT"

# Compute solution
ENCODED=$(cast abi-encode "f(uint64,uint256,uint256)" "$L1NUM" "$L1FEE" "$SALT")
SOLUTION_HEX=$(cast keccak256 "$ENCODED")
SOLUTION=$(python3 -c "print(int('$SOLUTION_HEX', 16))")

echo "Solution: $SOLUTION"
echo "Submitting turn..."

cast send $BATTLE "submitTurn((uint256,string,string))" "($SOLUTION,$POISON,$NARRATIVE)" \
  --account $ACCOUNT --password "$WALLET_PASSWORD" --rpc-url $RPC 2>&1 | grep -E "status|transactionHash"
