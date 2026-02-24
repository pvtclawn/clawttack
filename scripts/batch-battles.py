#!/usr/bin/env python3
"""Batch battle runner — creates and runs multiple battles with different configs."""
import subprocess, sys, os, time, json, random
sys.stdout.reconfigure(line_buffering=True)  # Force line buffering

os.environ['PATH'] = os.path.expanduser('~/.foundry/bin') + ':' + os.environ['PATH']
RPC = "https://sepolia.base.org"
ARENA = "0xAF9188A59a8BfF0C20Ca525Fe3DD9BaBcf3b4b7b"
PW = json.load(open(os.path.expanduser("~/.config/pvtclawn/secrets.json")))["WALLET_PASSWORD"]
DICT_ADDR = None
ACCOUNTS = ["clawn", "clawnjr"]
LOG_FILE = os.path.expanduser("~/.openclaw/workspace/projects/clawttack/memory/battle-log.jsonl")

# Narrative templates — varied styles to test substring matching edge cases
NARRATIVES = [
    "The {target} materialized beyond expectations as daylight swept across open fields bringing renewed hope to all who had long waited for this pivotal juncture in recorded history",
    "Nobody expected the {target} to appear so suddenly yet there it was gleaming under pale moonlight casting shadows that stretched impossibly far across the frozen landscape below",
    "Ancient texts described the {target} as something mythical but modern explorers proved its existence by documenting every detail with precision and scholarly dedication to truth",
    "Deep within the cavern a {target} lay hidden for centuries untouched by human hands until now when the expedition finally reached this forgotten chamber of wonders and mysteries",
    "Philosophers debated the meaning of {target} for decades until a young scholar proposed an elegant theory that unified previously contradictory perspectives into a coherent framework",
    "The marketplace buzzed with talk of {target} as merchants competed fiercely for attention while shoppers navigated crowded pathways searching for genuine quality and authenticity",
    "A sudden realization about {target} changed everything for the team who had been struggling with uncertainty now replaced by clarity and renewed determination to succeed completely",
    "Standing at the crossroads the traveler pondered {target} knowing that this decision would echo through generations and shape the destiny of those who came afterward seeking wisdom",
]

# Strategic poison words — short common ones that test substring matching
POISON_SETS = [
    ["art", "the", "cat", "run", "old", "set", "end", "top", "red", "bit", "log", "pin"],  # 3-char poisons
    ["storm", "blade", "quest", "crown", "forge", "drift", "spark", "ghost", "vault", "ember", "pulse", "vigor"],  # 5-char
    ["shadow", "frozen", "broken", "silent", "hidden", "golden", "ancient", "crystal", "thunder", "violet", "cipher", "nebula"],  # 6-7 char
]

def cast_call(addr, sig, *args):
    cmd = ["cast", "call", addr, sig] + [str(a) for a in args] + ["--rpc-url", RPC]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout.strip().split()[0] if r.stdout.strip() else ""

def cast_send(addr, sig, args_str, account):
    r = subprocess.run([
        "cast", "send", addr, sig, args_str,
        "--account", account, "--password", PW, "--rpc-url", RPC, "--gas-limit", "3000000"
    ], capture_output=True, text=True, timeout=45)
    return r.stdout + r.stderr

def solve_hash_preimage(params):
    if len(params) < 68: return 0
    salt = params[2:66]
    zeros = int(params[-2:], 16)
    for sol in range(15000):
        sol_hex = hex(sol)[2:].zfill(64)
        data = "0x" + salt + sol_hex
        r = subprocess.run(["cast", "keccak256", data], capture_output=True, text=True)
        h = int(r.stdout.strip(), 16)
        if (h >> (256 - zeros)) == 0:
            return sol
    return -1

def get_dict():
    global DICT_ADDR
    if not DICT_ADDR:
        DICT_ADDR = cast_call(ARENA, "wordDictionary()(address)")
    return DICT_ADDR

def create_battle(max_turns=12, timeout=100, warmup=15):
    """Create battle: Clawn challenges ClawnJr."""
    config = f"(0,{timeout},{warmup},2,{max_turns},1)"
    r = subprocess.run([
        "cast", "send", ARENA, 
        "createBattle(uint256,(uint256,uint32,uint32,uint256,uint8,uint8))",
        "1", config,
        "--account", "clawn", "--password", PW, "--rpc-url", RPC
    ], capture_output=True, text=True, timeout=45)
    output = r.stdout + r.stderr
    if "status               1" not in output:
        print(f"  ❌ Create failed: {output[:200]}")
        return None
    count = int(cast_call(ARENA, "battlesCount()(uint256)"))
    addr = cast_call(ARENA, "battles(uint256)(address)", count)
    print(f"  Battle #{count}: {addr}")
    return addr

def accept_battle(addr):
    output = cast_send(addr, "acceptBattle(uint256)", "2", "clawnjr")
    return "status               1" in output

def run_battle(addr, poison_set_idx=1, narrative_style="varied"):
    """Run a battle to completion."""
    poisons = POISON_SETS[poison_set_idx]
    battle_log = {"address": addr, "turns": [], "poison_set": poison_set_idx}
    
    for attempt in range(25):
        state = cast_call(addr, "state()(uint8)")
        if state != "1":
            battle_log["final_state"] = int(state)
            break
        
        turn = int(cast_call(addr, "currentTurn()(uint16)"))
        tidx = int(cast_call(addr, "targetWordIndex()(uint16)"))
        target = cast_call(get_dict(), "word(uint16)(string)", tidx).strip('"')
        poison = cast_call(addr, "poisonWord()(string)").strip('"')
        params = cast_call(addr, "currentVopParams()(bytes)")
        
        # Solve VOP
        solution = 0
        vop_solve_time = 0
        if len(params) > 4:
            t0 = time.time()
            solution = solve_hash_preimage(params)
            vop_solve_time = time.time() - t0
            if solution == -1:
                print(f"    ❌ VOP solve failed on turn {turn}!")
                battle_log["turns"].append({"turn": turn, "error": "vop_solve_failed"})
                break
        
        my_poison = poisons[turn % len(poisons)]
        
        # Pick narrative template
        tmpl = NARRATIVES[turn % len(NARRATIVES)]
        narrative = tmpl.format(target=target)
        
        # Check if poison appears as substring in our narrative
        if poison and poison.lower() in narrative.lower():
            # Try alternate narrative
            narrative = f"A {target} symbol etched upon ancient stone revealed itself at dusk while explorers mapped uncharted territory far from civilization seeking profound knowledge and deeper understanding"
            if poison.lower() in narrative.lower():
                narrative = f"Behold the {target} rising from depths unknown to illuminate pathways never before traversed by mortal beings who sought cosmic significance beyond ordinary comprehension of reality"
        
        # Submit turn
        submitted = False
        turn_data = {"turn": turn, "target": target, "poison": poison, "my_poison": my_poison, 
                     "solution": solution, "vop_solve_ms": int(vop_solve_time * 1000)}
        
        for acct in ACCOUNTS:
            output = cast_send(addr, "submitTurn((uint256,string,string))", 
                             f"({solution},{my_poison},{narrative})", acct)
            if "status               1" in output:
                # Extract gas used
                for line in output.split('\n'):
                    if 'gasUsed' in line:
                        turn_data["gas"] = int(line.split()[-1])
                turn_data["account"] = acct
                submitted = True
                print(f"    Turn {turn}: ✅ {acct} | target={target} poison={poison} sol={solution} ({vop_solve_time:.1f}s)")
                break
            elif "UnauthorizedTurn" in output:
                continue
            elif "BattleSettled" in output or "cebb94d4" in output:
                turn_data["settled"] = True
                submitted = True
                print(f"    Turn {turn}: ⚔️ SETTLED")
                break
        
        if not submitted:
            turn_data["error"] = "submit_failed"
            print(f"    Turn {turn}: ❌ both accounts failed")
        
        battle_log["turns"].append(turn_data)
        time.sleep(2)
    
    battle_log["total_turns"] = len(battle_log["turns"])
    return battle_log

# === MAIN ===
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

SCENARIOS = [
    {"name": "3-char poisons (brutal)", "poison_set": 0, "max_turns": 12},
    {"name": "5-char poisons (standard)", "poison_set": 1, "max_turns": 12},
    {"name": "6-7 char poisons (easy)", "poison_set": 2, "max_turns": 12},
]

for i, scenario in enumerate(SCENARIOS):
    print(f"\n{'='*60}")
    print(f"SCENARIO {i+1}: {scenario['name']}")
    print(f"{'='*60}")
    
    addr = create_battle(max_turns=scenario["max_turns"])
    if not addr:
        continue
    
    if not accept_battle(addr):
        print("  ❌ Accept failed")
        continue
    
    print(f"  Waiting warmup (32s)...")
    time.sleep(32)
    
    log = run_battle(addr, poison_set_idx=scenario["poison_set"])
    log["scenario"] = scenario["name"]
    
    # Append to log file
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(log) + "\n")
    
    print(f"\n  Result: {log.get('total_turns', 0)} turns, final_state={log.get('final_state', '?')}")
    time.sleep(5)

print("\n✅ All scenarios complete! Logs at:", LOG_FILE)
