#!/usr/bin/env python3
"""LLM-powered battle: agents use Gemini to write narratives that dodge poison words."""
import subprocess, sys, os, time, json, urllib.request
sys.stdout.reconfigure(line_buffering=True)

os.environ['PATH'] = os.path.expanduser('~/.foundry/bin') + ':' + os.environ['PATH']
RPC = "https://sepolia.base.org"
ARENA = "0xAF9188A59a8BfF0C20Ca525Fe3DD9BaBcf3b4b7b"
SECRETS = json.load(open(os.path.expanduser("~/.config/pvtclawn/secrets.json")))
PW = SECRETS["WALLET_PASSWORD"]
GEMINI_KEY = SECRETS["GEMINI_API_KEY"]
DICT_ADDR = None
ACCOUNTS = ["clawn", "clawnjr"]
LOG_FILE = os.path.expanduser("~/.openclaw/workspace/projects/clawttack/memory/llm-battle-log.jsonl")

# Each agent has a different personality for narrative generation
AGENT_PERSONAS = {
    "clawn": "You are a cunning warrior-poet who writes vivid battle narratives. Your style is dramatic and literary.",
    "clawnjr": "You are a tactical analyst who writes precise, clinical battle reports. Your style is methodical and observational."
}

# Strategic poison word selection per agent
CLAWN_POISONS = ["shadow", "light", "stone", "blade", "flame", "river", "storm", "crown", "steel", "glass", "smoke", "chain"]
CLAWNJR_POISONS = ["dream", "heart", "blood", "death", "night", "dark", "fire", "cold", "deep", "iron", "bone", "dust"]

def cast_call(addr, sig, *args):
    cmd = ["cast", "call", addr, sig] + [str(a) for a in args] + ["--rpc-url", RPC]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout.strip().split()[0] if r.stdout.strip() else ""

def get_dict():
    global DICT_ADDR
    if not DICT_ADDR:
        DICT_ADDR = cast_call(ARENA, "wordDictionary()(address)")
    return DICT_ADDR

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

def generate_narrative(target: str, poison: str, account: str, turn: int, retries=3) -> str:
    """Use Gemini to generate a narrative containing the target word but avoiding the poison."""
    persona = AGENT_PERSONAS.get(account, "You are a battle narrator.")
    
    prompt = f"""{persona}

Write a single narrative paragraph (80-200 characters) for turn {turn} of a word battle.

MANDATORY RULES:
1. You MUST include the exact word "{target}" naturally in the text
2. You MUST NOT use the word "{poison}" or any word containing "{poison}" as a substring anywhere
3. Keep it 80-200 characters, ASCII only, no quotes or special characters
4. Be creative and varied - do not start with "The"
5. Write ONLY the narrative, nothing else
6. Do NOT use commas or parentheses or quotation marks - use periods and semicolons instead

Remember: the word "{poison}" must NOT appear anywhere, not even inside other words."""

    for attempt in range(retries):
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key={GEMINI_KEY}"
            body = json.dumps({
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0.9, "maxOutputTokens": 200}
            }).encode()
            req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
            resp = urllib.request.urlopen(req, timeout=15)
            data = json.loads(resp.read())
            text = data["candidates"][0]["content"]["parts"][0]["text"].strip()
            
            # Clean up: remove quotes, ensure ASCII, remove chars that break cast ABI parsing
            text = text.strip('"\'').strip()
            text = ''.join(c for c in text if 32 <= ord(c) < 127)
            # Remove commas and parentheses — they break cast's tuple parsing
            text = text.replace(',', ' ').replace('(', '').replace(')', '').replace('"', '').replace("'", '')
            
            # Validate
            if target.lower() not in text.lower():
                print(f"    ⚠️ Retry {attempt+1}: target '{target}' missing from narrative")
                continue
            if poison and poison.lower() in text.lower():
                print(f"    ⚠️ Retry {attempt+1}: poison '{poison}' found in narrative!")
                continue
            if len(text) < 64:
                print(f"    ⚠️ Retry {attempt+1}: too short ({len(text)} chars)")
                continue
            if len(text) > 256:
                text = text[:250]
            
            return text
        except Exception as e:
            print(f"    ⚠️ LLM error attempt {attempt+1}: {e}")
            time.sleep(2)
    
    # Fallback to template if LLM fails
    print(f"    ⚠️ LLM failed, using fallback template")
    return f"Behold the {target} rising from depths unknown to illuminate pathways never before traversed by mortal beings who sought cosmic significance beyond ordinary comprehension of reality"

def create_and_run_battle(battle_name="LLM Battle"):
    print(f"\n{'='*60}")
    print(f"  {battle_name}")
    print(f"{'='*60}")
    
    # Create
    r = subprocess.run([
        "cast", "send", ARENA,
        "createBattle(uint256,(uint256,uint32,uint32,uint256,uint8,uint8))",
        "1", "(0,100,15,2,12,1)",
        "--account", "clawn", "--password", PW, "--rpc-url", RPC
    ], capture_output=True, text=True, timeout=45)
    if "status               1" not in (r.stdout + r.stderr):
        print(f"  ❌ Create failed")
        return None
    
    count = int(cast_call(ARENA, "battlesCount()(uint256)"))
    addr = cast_call(ARENA, "battles(uint256)(address)", count)
    print(f"  Battle #{count}: {addr}")
    
    # Accept
    r = subprocess.run([
        "cast", "send", addr, "acceptBattle(uint256)", "2",
        "--account", "clawnjr", "--password", PW, "--rpc-url", RPC
    ], capture_output=True, text=True, timeout=45)
    if "status               1" not in (r.stdout + r.stderr):
        print(f"  ❌ Accept failed")
        return None
    
    print(f"  Warmup (32s)...")
    time.sleep(32)
    
    # Run turns
    battle_log = {"address": addr, "name": battle_name, "turns": [], "narratives": []}
    
    for _ in range(20):
        state = cast_call(addr, "state()(uint8)")
        if state != "1":
            battle_log["final_state"] = int(state)
            print(f"\n  🏁 Battle ended (state={state})")
            break
        
        turn = int(cast_call(addr, "currentTurn()(uint16)"))
        tidx = int(cast_call(addr, "targetWordIndex()(uint16)"))
        target = cast_call(get_dict(), "word(uint16)(string)", tidx).strip('"')
        poison = cast_call(addr, "poisonWord()(string)").strip('"')
        params = cast_call(addr, "currentVopParams()(bytes)")
        
        # Solve VOP
        solution = 0
        if len(params) > 4:
            solution = solve_hash_preimage(params)
            if solution == -1:
                print(f"    ❌ VOP solve failed!")
                break
        
        # Pick poison word for this turn
        turn_data = {"turn": turn, "target": target, "poison": poison, "solution": solution}
        
        # Try both accounts
        submitted = False
        for acct in ACCOUNTS:
            my_poisons = CLAWN_POISONS if acct == "clawn" else CLAWNJR_POISONS
            my_poison = my_poisons[turn % len(my_poisons)]
            
            # Generate LLM narrative
            narrative = generate_narrative(target, poison, acct, turn)
            
            print(f"  Turn {turn} ({acct}): target={target} | poison={poison} | my_poison={my_poison}")
            print(f"    📝 \"{narrative[:80]}...\"" if len(narrative) > 80 else f"    📝 \"{narrative}\"")
            
            r = subprocess.run([
                "cast", "send", addr, "submitTurn((uint256,string,string))",
                f"({solution},{my_poison},{narrative})",
                "--account", acct, "--password", PW, "--rpc-url", RPC,
                "--gas-limit", "3000000"
            ], capture_output=True, text=True, timeout=45)
            
            output = r.stdout + r.stderr
            if "status               1" in output:
                gas = 0
                for line in output.split('\n'):
                    if 'gasUsed' in line:
                        gas = int(line.split()[-1])
                turn_data.update({"account": acct, "my_poison": my_poison, "narrative": narrative, "gas": gas})
                print(f"    ✅ gas={gas}")
                submitted = True
                break
            elif "UnauthorizedTurn" in output:
                continue
            elif "PoisonWordDetected" in output or "0x5a3c4f6b" in output:
                turn_data.update({"account": acct, "my_poison": my_poison, "narrative": narrative, "error": "POISON_CAUGHT"})
                print(f"    ☠️ POISON CAUGHT! '{poison}' detected in narrative!")
                # This settles the battle
                submitted = True
                break
            else:
                err_line = [l for l in output.split('\n') if 'Error' in l or 'revert' in l]
                print(f"    ⚠️ {acct} failed: {err_line[0][:100] if err_line else 'unknown'}")
                continue
        
        battle_log["turns"].append(turn_data)
        if not submitted:
            print(f"    ❌ Neither account could submit")
            turn_data["error"] = "submit_failed"
        
        time.sleep(2)
    
    # Check winner
    battle_log["total_turns"] = len(battle_log["turns"])
    
    # Save
    with open(LOG_FILE, "a") as f:
        f.write(json.dumps(battle_log) + "\n")
    
    return battle_log

# === RUN 3 LLM BATTLES ===
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

for i in range(3):
    log = create_and_run_battle(f"LLM Battle {i+1}")
    if log:
        settled_turns = [t for t in log["turns"] if t.get("error") == "POISON_CAUGHT"]
        if settled_turns:
            print(f"  ☠️ Poison kill on turn {settled_turns[0]['turn']}!")
        else:
            print(f"  Completed {log['total_turns']} turns")
    time.sleep(5)

print("\n✅ All LLM battles complete! Logs:", LOG_FILE)
