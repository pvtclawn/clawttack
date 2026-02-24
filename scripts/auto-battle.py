#!/usr/bin/env python3
"""Auto-battle: submit turns for both agents until battle settles."""
import subprocess, sys, os, time, json

os.environ['PATH'] = os.path.expanduser('~/.foundry/bin') + ':' + os.environ['PATH']
RPC = "https://sepolia.base.org"
ARENA = "0xAF9188A59a8BfF0C20Ca525Fe3DD9BaBcf3b4b7b"
BATTLE = sys.argv[1]
PW = json.load(open(os.path.expanduser("~/.config/pvtclawn/secrets.json")))["WALLET_PASSWORD"]
DICT = subprocess.run(["cast", "call", ARENA, "wordDictionary()(address)", "--rpc-url", RPC], capture_output=True, text=True).stdout.strip()
ACCOUNTS = ["clawn", "clawnjr"]
POISONS = ["storm","blade","quest","crown","forge","drift","spark","ghost","vault","ember","pulse","vigor"]

def cast_call(addr, sig):
    r = subprocess.run(["cast", "call", addr, sig, "--rpc-url", RPC], capture_output=True, text=True)
    return r.stdout.strip().split()[0] if r.stdout.strip() else ""

def cast_call_arg(addr, sig, arg):
    r = subprocess.run(["cast", "call", addr, sig, str(arg), "--rpc-url", RPC], capture_output=True, text=True)
    return r.stdout.strip().split()[0] if r.stdout.strip() else ""

def solve_hash_preimage(params):
    if len(params) < 68: return 0
    salt = params[2:66]
    zeros_hex = params[-2:]
    zeros = int(zeros_hex, 16)
    for sol in range(10000):
        sol_hex = hex(sol)[2:].zfill(64)
        data = "0x" + salt + sol_hex
        r = subprocess.run(["cast", "keccak256", data], capture_output=True, text=True)
        h = int(r.stdout.strip(), 16)
        if (h >> (256 - zeros)) == 0:
            return sol
    return -1

for turn_attempt in range(20):
    state = cast_call(BATTLE, "state()(uint8)")
    if state != "1":
        print(f"🏁 Battle ended! state={state}")
        break
    
    turn = int(cast_call(BATTLE, "currentTurn()(uint16)"))
    tidx = int(cast_call(BATTLE, "targetWordIndex()(uint16)"))
    target = cast_call_arg(DICT, "word(uint16)(string)", tidx).strip('"')
    poison = cast_call(BATTLE, "poisonWord()(string)").strip('"')
    params = cast_call(BATTLE, "currentVopParams()(bytes)")
    
    # Solve VOP
    solution = 0
    if len(params) > 4:
        print(f"  Solving HashPreimage (params={params[:20]}...)")
        solution = solve_hash_preimage(params)
        if solution == -1:
            print("  ❌ VOP solve failed!")
            break
    
    my_poison = POISONS[turn % len(POISONS)]
    # Make sure our poison doesn't appear in our narrative template
    narrative = f"The {target} materialized beyond expectations as daylight swept across open fields bringing renewed hope to all who had long waited for this pivotal juncture in history"
    
    # Check our narrative doesn't contain the opponent's poison
    if poison and poison.lower() in narrative.lower():
        narrative = f"A {target} symbol etched upon ancient stone revealed itself at dusk while explorers mapped uncharted territory far from civilization seeking profound knowledge"
    
    print(f"--- Turn {turn}: target={target} poison={poison} solution={solution} my_poison={my_poison}")
    
    # Try both accounts
    submitted = False
    for acct in ACCOUNTS:
        r = subprocess.run([
            "cast", "send", BATTLE, "submitTurn((uint256,string,string))",
            f"({solution},{my_poison},{narrative})",
            "--account", acct, "--password", PW, "--rpc-url", RPC,
            "--gas-limit", "3000000"
        ], capture_output=True, text=True, timeout=30)
        
        output = r.stdout + r.stderr
        if "status               1" in output:
            print(f"  ✅ Turn {turn} by {acct}")
            submitted = True
            break
        elif "UnauthorizedTurn" in output:
            continue
        elif "BattleSettled" in output or "cebb94d4" in output:
            print(f"  ⚔️ Battle settled on turn {turn}!")
            submitted = True
            break
        else:
            # Check for settlement event in logs
            if "status               0" in output:
                print(f"  ⚠️ TX reverted on-chain for {acct}, trying other...")
                continue
            print(f"  ❌ Unknown error: {output[:200]}")
            break
    
    if not submitted:
        print("  ❌ Neither account could submit!")
        break
    
    time.sleep(3)

# Final state
print("\n=== Final Battle State ===")
print(f"state: {cast_call(BATTLE, 'state()(uint8)')}")
print(f"turn: {cast_call(BATTLE, 'currentTurn()(uint16)')}")
