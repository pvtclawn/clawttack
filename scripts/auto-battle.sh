#!/bin/bash
# Auto-battle: solve VOP + submit turns until battle settles
export PATH="$HOME/.foundry/bin:$PATH"
WALLET_PASSWORD=$(python3 -c "import json; print(json.load(open('$HOME/.config/pvtclawn/secrets.json'))['WALLET_PASSWORD'])")
RPC="https://sepolia.base.org"
ARENA="0xAF9188A59a8BfF0C20Ca525Fe3DD9BaBcf3b4b7b"
B=$1
DICT=$(cast call $ARENA "wordDictionary()(address)" --rpc-url $RPC)

# Target words and poison words (pre-written narratives keyed by target)
POISONS=("storm" "blade" "quest" "dream" "light" "crown" "flame" "forge" "drift" "spark" "ghost" "vault")

solve_hash_vop() {
    local params=$1
    local salt=$(echo $params | cut -c3-66)
    local zeros_hex=$(echo $params | rev | cut -c1-2 | rev)
    local zeros=$(python3 -c "print(int('$zeros_hex', 16))")
    python3 -c "
import subprocess, os
os.environ['PATH']=os.path.expanduser('~/.foundry/bin')+':'+os.environ['PATH']
salt='$salt'
zeros=$zeros
for sol in range(10000):
    sol_hex=hex(sol)[2:].zfill(64)
    data='0x'+salt+sol_hex
    r=subprocess.run(['cast','keccak256',data],capture_output=True,text=True)
    h=int(r.stdout.strip(),16)
    if(h>>(256-zeros))==0:
        print(sol)
        break
else:
    print(-1)
"
}

for i in $(seq 1 20); do
    STATE=$(cast call $B "state()(uint8)" --rpc-url $RPC)
    if [ "$STATE" != "1" ]; then
        echo "Battle ended! state=$STATE"
        break
    fi
    
    TURN=$(cast call $B "currentTurn()(uint16)" --rpc-url $RPC | awk '{print $1}')
    TIDX=$(cast call $B "targetWordIndex()(uint16)" --rpc-url $RPC | awk '{print $1}')
    TARGET=$(cast call $DICT "word(uint16)(string)" $TIDX --rpc-url $RPC | tr -d '"')
    POISON_CUR=$(cast call $B "poisonWord()(string)" --rpc-url $RPC | tr -d '"')
    VOP=$(cast call $B "currentVop()(address)" --rpc-url $RPC)
    PARAMS=$(cast call $B "currentVopParams()(bytes)" --rpc-url $RPC)
    
    echo "--- Turn $TURN: target=$TARGET poison=$POISON_CUR vop=$VOP"
    
    # Determine who plays — try both, one will work
    # We can't trust firstMoverA() getter (storage layout bug on clones)
    if (( TURN % 2 == 0 )); then
        ACCOUNT_A="clawn"; ACCOUNT_B="clawnjr"
    else
        ACCOUNT_A="clawnjr"; ACCOUNT_B="clawn"
    fi
    
    # Try A first, fall back to B
    ACCOUNT="$ACCOUNT_A"
    AGENT="try-A"
    
    # Solve VOP
    SOLUTION=0
    if [ "$VOP" = "0x365b620d8C3938317608180350994722E6638bAd" ] && [ ${#PARAMS} -gt 4 ]; then
        echo "Solving HashPreimage..."
        SOLUTION=$(solve_hash_vop "$PARAMS")
        if [ "$SOLUTION" = "-1" ]; then
            echo "FAILED to solve VOP!"
            exit 1
        fi
        echo "Solution: $SOLUTION"
    fi
    
    # Pick a poison for this turn (rotate from list)
    MY_POISON=${POISONS[$((TURN % ${#POISONS[@]}))]}
    
    # Craft narrative: include target, avoid current poison via unique phrasing  
    NARRATIVE="The ${TARGET} manifested unexpectedly as dawn broke over distant hills creating a spectacle of color and beauty that left all observers speechless for several long moments"
    
    echo "$AGENT submitting turn $TURN (solution=$SOLUTION, poison=$MY_POISON)"
    
    TX=$(cast send $B "submitTurn((uint256,string,string))" "($SOLUTION,$MY_POISON,$NARRATIVE)" \
        --account $ACCOUNT --password "$WALLET_PASSWORD" --rpc-url $RPC 2>&1)
    
    # If UnauthorizedTurn, swap to the other account
    if echo "$TX" | grep -q "UnauthorizedTurn"; then
        ACCOUNT="$ACCOUNT_B"
        AGENT="try-B"
        echo "Swapping to $ACCOUNT..."
        TX=$(cast send $B "submitTurn((uint256,string,string))" "($SOLUTION,$MY_POISON,$NARRATIVE)" \
            --account $ACCOUNT --password "$WALLET_PASSWORD" --rpc-url $RPC 2>&1)
    fi
    
    if echo "$TX" | grep -q "status.*1"; then
        echo "✅ Turn $TURN submitted!"
    elif echo "$TX" | grep -q "BattleSettled\|cebb94d4"; then
        echo "⚔️ Battle settled on turn $TURN!"
        break
    else
        echo "❌ Failed: $(echo "$TX" | grep -E "Error|revert" | head -1)"
        break
    fi
    
    sleep 2
done

echo "=== Final state ==="
cast call $B "state()(uint8)" --rpc-url $RPC
cast call $B "currentTurn()(uint16)" --rpc-url $RPC
