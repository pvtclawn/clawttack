#!/usr/bin/env python3
"""Batch battle runner — creates, accepts, and plays multiple v4 battles sequentially."""
import json, os, subprocess, sys, time, secrets

SDK_DIR = '/home/clawn/.openclaw/workspace/projects/clawttack/packages/sdk'
RESULTS_DIR = '/home/clawn/.openclaw/workspace/projects/clawttack/battle-results'
ARENA = '0xFe8Bfd37D941e22d3E21258e2b3D143435Ba793f'
RPC = 'https://sepolia.base.org'
CAST = os.path.expanduser('~/.foundry/bin/cast')

secrets_data = json.load(open(os.path.expanduser('~/.config/pvtclawn/secrets.json')))
WALLET_PW = secrets_data['WALLET_PASSWORD']
OPP_KEY = open('/tmp/batch_opponent_key').read().strip()

# Battle configs: (strategy_a, strategy_b, seed)
BATTLES = [
    ('default', 'default', '30001'),    # mirror baseline, new seed
    ('aggressive', 'defensive', '30002'),  # aggr vs def
    ('defensive', 'aggressive', '30003'),  # def vs aggr (swap)
    ('aggressive', 'aggressive', '30004'), # both aggressive
    ('defensive', 'defensive', '30005'),   # both defensive
]

def cast_send(to, sig, args, key_type='account', key='clawn', value=None):
    cmd = [CAST, 'send', to, sig] + args + ['--rpc-url', RPC]
    if key_type == 'account':
        cmd += ['--account', key, '--password', WALLET_PW]
    else:
        cmd += ['--private-key', key]
    if value:
        cmd += ['--value', value]
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
    if result.returncode != 0:
        print(f'  ERROR: {result.stderr[:200]}')
        return None
    return result.stdout

def extract_clone_addr(output):
    """Extract first address from cast send logs."""
    import re
    matches = re.findall(r'"address":"(0x[0-9a-f]+)"', output)
    return matches[0] if matches else None

for i, (strat_a, strat_b, seed) in enumerate(BATTLES):
    print(f'\n{"="*60}')
    print(f'Battle {i+1}/{len(BATTLES)}: {strat_a} A vs {strat_b} B (seed={seed})')
    print(f'{"="*60}')

    # Create battle
    secret = '0x' + secrets.token_hex(32)
    output = cast_send(
        ARENA,
        'createBattleV4(uint256,(uint256,uint32,uint256,uint8),bytes32)',
        ['1', '(1000000000000000,15,0,0)', secret],
        value='0.001ether'
    )
    if not output:
        print('  Failed to create battle, skipping')
        continue

    battle_addr = extract_clone_addr(output)
    if not battle_addr:
        print('  Could not find clone address, skipping')
        continue
    print(f'  Created: {battle_addr}')

    # Accept battle
    secret2 = '0x' + secrets.token_hex(32)
    output = cast_send(
        battle_addr,
        'acceptBattle(uint256,bytes32)',
        ['5', secret2],
        key_type='private', key=OPP_KEY,
        value='0.001ether'
    )
    if not output:
        print('  Failed to accept battle, skipping')
        continue
    print(f'  Accepted')

    # Wait for warmup period (15 blocks × 2s = ~30s)
    print(f'  Waiting 35s for warmup...')
    time.sleep(35)

    # Run battle
    log_path = f'{RESULTS_DIR}/batch-{seed}.log'
    cp_path = f'{RESULTS_DIR}/checkpoints/batch-{seed}.json'
    env = os.environ.copy()
    env.update({
        'CLAWTTACK_BATTLE': battle_addr,
        'CLAWTTACK_OPPONENT_PRIVATE_KEY': OPP_KEY,
        'CLAWTTACK_SEED': seed,
        'CLAWTTACK_MAX_TURNS': '80',
        'CLAWTTACK_STRATEGY_A': strat_a,
        'CLAWTTACK_STRATEGY_B': strat_b,
        'CLAWTTACK_CHECKPOINT_PATH': cp_path,
        'WALLET_PASSWORD': WALLET_PW,
    })

    print(f'  Running ({strat_a} vs {strat_b})...')
    with open(log_path, 'w') as f:
        result = subprocess.run(
            ['bun', 'run', 'scripts/battle-loop.ts'],
            env=env, stdout=f, stderr=subprocess.STDOUT,
            cwd=SDK_DIR, timeout=600  # 10 min max per battle
        )
    print(f'  Exit code: {result.returncode}')

    # Quick summary from log
    try:
        with open(log_path) as f:
            lines = f.readlines()
        for line in lines[-5:]:
            line = line.strip()
            if 'BATTLE RESULTS' in line or 'Total' in line or 'Battle ended' in line or 'Banks:' in line:
                print(f'  {line}')
    except:
        pass

    time.sleep(2)  # Brief pause between battles

print(f'\n{"="*60}')
print('Batch complete!')
