#!/usr/bin/env python3
import json, os, re, secrets, subprocess, time, csv
from pathlib import Path

ROOT = Path('/home/clawn/.openclaw/workspace/projects/clawttack')
SDK_DIR = ROOT / 'packages' / 'sdk'
RESULTS_DIR = ROOT / 'battle-results'
CHECKPOINTS = RESULTS_DIR / 'checkpoints'
CHECKPOINTS.mkdir(parents=True, exist_ok=True)

ARENA = os.environ.get('CLAWTTACK_ARENA', '0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3')
RPC = os.environ.get('CLAWTTACK_RPC', 'https://sepolia.base.org')
DICT = os.environ.get('CLAWTTACK_DICT', '0xb5b37571476aA9c32EF64d90C8aeb8FA13f40931')
COUNT = int(os.environ.get('GAUNTLET_COUNT', '10'))

CAST = os.path.expanduser('~/.foundry/bin/cast')
secrets_data = json.load(open(os.path.expanduser('~/.config/pvtclawn/secrets.json')))
WALLET_PW = secrets_data['WALLET_PASSWORD']
OPP_KEY = open('/tmp/v42_opponent_key').read().strip()
OPP_ADDR = subprocess.run([os.path.expanduser('~/.foundry/bin/cast'), 'wallet', 'address', '--private-key', OPP_KEY], capture_output=True, text=True, timeout=10).stdout.strip()

summary_csv = RESULTS_DIR / 'v1-gauntlet-summary.csv'
new_file = not summary_csv.exists()


def run(cmd, timeout=60, cwd=None, env=None):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=cwd, env=env)


def cast_send(to, sig, args, account=True, value=None, timeout=90):
    cmd = [CAST, 'send', to, sig] + args + ['--rpc-url', RPC]
    if account:
        cmd += ['--account', 'clawn', '--password', WALLET_PW]
    else:
        cmd += ['--private-key', OPP_KEY]
    if value:
        cmd += ['--value', value]
    return run(cmd, timeout=timeout)


def cast_call(to, sig, args=None):
    args = args or []
    cmd = [CAST, 'call', to, sig] + args + ['--rpc-url', RPC]
    r = run(cmd, timeout=20)
    return r.stdout.strip() if r.returncode == 0 else ''


def extract_address(text):
    m = re.findall(r'0x[a-fA-F0-9]{40}', text)
    return m[0] if m else None


def battle_summary_from_checkpoint(cp_path):
    d = json.load(open(cp_path))
    rs = d.get('results', [])
    a = [r for r in rs if r.get('agent') == 'A' and r.get('turn', 0) > 0]
    b = [r for r in rs if r.get('agent') == 'B' and r.get('turn', 0) > 0]
    ac = sum(1 for r in a if r.get('nccGuessCorrect'))
    bc = sum(1 for r in b if r.get('nccGuessCorrect'))
    last = rs[-1] if rs else {}
    return {
        'turns': len(rs),
        'a_ncc': f"{ac}/{len(a)}",
        'b_ncc': f"{bc}/{len(b)}",
        'a_pct': (100.0 * ac / len(a)) if a else 0.0,
        'b_pct': (100.0 * bc / len(b)) if b else 0.0,
        'bankA': last.get('bankA', ''),
        'bankB': last.get('bankB', ''),
        'gas': sum(int(r.get('gas', 0)) for r in rs),
    }


with open(summary_csv, 'a', newline='') as f:
    w = csv.DictWriter(f, fieldnames=['ts','battle','turns','a_ncc','b_ncc','a_pct','b_pct','bankA','bankB','gas'])
    if new_file:
        w.writeheader()

    for i in range(COUNT):
        print(f"\n=== Gauntlet battle {i+1}/{COUNT} ===", flush=True)

        before_raw = cast_call(ARENA, 'battlesCount()(uint256)')
        before = int(before_raw or '0')

        secret_a = '0x' + secrets.token_hex(32)
        create = cast_send(
            ARENA,
            'createBattleV4(uint256,(uint256,uint32,uint256,uint8,bool),bytes32)',
            ['1', '(1000000000000000,15,2,2,true)', secret_a],
            account=True,
            value='0.001ether',
            timeout=120,
        )
        if create.returncode != 0:
            print('create failed:', create.stderr[:200], flush=True)
            continue
        if 'status               1 (success)' not in create.stdout:
            print('create tx failed (status!=1)', flush=True)
            continue

        # Prefer log-object address fields emitted in tx logs (clone address)
        battle = None
        log_addrs = re.findall(r'"address":"(0x[a-fA-F0-9]{40})"', create.stdout + create.stderr)
        for a in log_addrs:
            if a.lower() != ARENA.lower() and a.lower() != '0x0000000000000000000000000000000000000000':
                battle = a
                break
        if not battle:
            after_raw = cast_call(ARENA, 'battlesCount()(uint256)')
            after = int(after_raw or '0')
            battle_id = str(after if after > before else before)
            battle = cast_call(ARENA, 'battles(uint256)(address)', [battle_id])
        if not battle or battle.lower() == '0x0000000000000000000000000000000000000000':
            print('cannot resolve new battle addr', flush=True)
            continue
        print('battle:', battle, flush=True)

        # Ensure opponent wallet has enough ETH for stake+gas
        bal = run([CAST, 'balance', OPP_ADDR, '--rpc-url', RPC, '--ether'], timeout=20)
        try:
            eth = float((bal.stdout or '0').strip() or '0')
        except Exception:
            eth = 0.0
        if eth < 0.003:
            _fund = run([CAST, 'send', OPP_ADDR, '--value', '0.02ether', '--rpc-url', RPC, '--account', 'clawn', '--password', WALLET_PW], timeout=120)
            if _fund.returncode != 0 and 'nonce too low' in ((_fund.stderr or _fund.stdout).lower()):
                time.sleep(2)
                _fund = run([CAST, 'send', OPP_ADDR, '--value', '0.02ether', '--rpc-url', RPC, '--account', 'clawn', '--password', WALLET_PW], timeout=120)
            if _fund.returncode != 0:
                print('funding failed:', (_fund.stderr or _fund.stdout)[:200], flush=True)
                continue

        secret_b = '0x' + secrets.token_hex(32)
        accept = cast_send(
            battle,
            'acceptBattle(uint256,bytes32)',
            ['2', secret_b],
            account=False,
            value='0.001ether',
            timeout=120,
        )
        if accept.returncode != 0 or 'status               1 (success)' not in accept.stdout:
            print('accept failed:', (accept.stderr or accept.stdout)[:200], flush=True)
            continue

        phase = cast_call(battle, 'phase()(uint8)')
        if phase.strip() != '1':
            print(f'battle not active after accept (phase={phase})', flush=True)
            continue

        env = os.environ.copy()
        cp_path = CHECKPOINTS / f'v1-gauntlet-{battle.lower()}.json'
        env.update({
            'CLAWTTACK_BATTLE': battle,
            'CLAWTTACK_OPPONENT_PRIVATE_KEY': OPP_KEY,
            'CLAWTTACK_RPC': RPC,
            'CLAWTTACK_DICT': DICT,
            'CLAWTTACK_CHECKPOINT_PATH': str(cp_path),
            'CLAWTTACK_SEED': str(5000 + i),
            'WALLET_PASSWORD': WALLET_PW,
        })
        r = run(['bun', 'run', 'scripts/battle-loop.ts'], timeout=900, cwd=str(SDK_DIR), env=env)
        if r.returncode != 0:
            print('loop failed code', r.returncode, flush=True)
            print((r.stdout + r.stderr)[-300:], flush=True)
            continue

        if cp_path.exists():
            s = battle_summary_from_checkpoint(cp_path)
        else:
            # Fallback: derive from result artifact when checkpoint wasn't produced
            result_path = RESULTS_DIR / f"{battle.lower()}.json"
            if result_path.exists():
                d = json.load(open(result_path))
                s = {
                    'turns': d.get('turnsPlayed', 0),
                    'a_ncc': '0/0',
                    'b_ncc': '0/0',
                    'a_pct': 0.0,
                    'b_pct': 0.0,
                    'bankA': d.get('finalBankA', ''),
                    'bankB': d.get('finalBankB', ''),
                    'gas': d.get('totalGasUsed', 0),
                }
            else:
                print('missing checkpoint summary', flush=True)
                print((r.stdout + r.stderr)[-400:], flush=True)
                continue
        row = {
            'ts': int(time.time()),
            'battle': battle,
            **s,
        }
        w.writerow(row)
        f.flush()
        print('done:', row, flush=True)

print('\nGauntlet chunk complete.', flush=True)
