#!/usr/bin/env python3
"""Autonomous Clawttack batch runner (LLM vs LLM by default).

Creates battles on the configured Arena, accepts with ClawnJr,
and runs `scripts/battle-loop.ts` for each match.
"""

from __future__ import annotations

import json
import os
import re
import secrets
import subprocess
import sys
import time
from pathlib import Path

SDK_DIR = Path(__file__).resolve().parents[1]
PROJECT_DIR = SDK_DIR.parent.parent
RESULTS_DIR = PROJECT_DIR / 'battle-results'
CHECKPOINT_DIR = RESULTS_DIR / 'checkpoints'
CAST = str(Path.home() / '.foundry' / 'bin' / 'cast')

RPC = os.getenv('CLAWTTACK_RPC', 'https://sepolia.base.org')
ARENA = os.getenv('CLAWTTACK_ARENA', '0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1')
MAX_BATTLES = int(os.getenv('CLAWTTACK_BATCH_BATTLES', '32'))
MAX_TURNS = int(os.getenv('CLAWTTACK_MAX_TURNS', '80'))
WARMUP_WAIT_SEC = int(os.getenv('CLAWTTACK_WARMUP_WAIT_SEC', '35'))
STAKE_WEI = int(os.getenv('CLAWTTACK_STAKE_WEI', '1000000000000000'))  # 0.001 ether
WARMUP_BLOCKS = int(os.getenv('CLAWTTACK_WARMUP_BLOCKS', '15'))
TARGET_AGENT_ID = int(os.getenv('CLAWTTACK_TARGET_AGENT_ID', '0'))
MAX_JOKERS = int(os.getenv('CLAWTTACK_MAX_JOKERS', '2'))
STRATEGY_A = os.getenv('CLAWTTACK_STRATEGY_A', 'llm')
STRATEGY_B = os.getenv('CLAWTTACK_STRATEGY_B', 'llm')
BATTLE_TIMEOUT_SEC = int(os.getenv('CLAWTTACK_BATTLE_TIMEOUT_SEC', '1500'))
OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL', 'https://openrouter.ai/api/v1')
OPENAI_MODEL = os.getenv('LLM_MODEL', 'google/gemini-2.5-flash-lite')
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')


def fail(msg: str) -> None:
    print(f'❌ {msg}')
    sys.exit(1)


def run(cmd: list[str], *, timeout: int = 60, env: dict[str, str] | None = None, check: bool = True) -> subprocess.CompletedProcess[str]:
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, env=env)
    if check and proc.returncode != 0:
        raise RuntimeError((proc.stderr or proc.stdout or 'command failed').strip())
    return proc


def extract_address(text: str) -> str | None:
    match = re.search(r'0x[a-fA-F0-9]{40}', text)
    return match.group(0) if match else None


def parse_uint(text: str) -> int:
    token_match = re.search(r'0x[a-fA-F0-9]+|\d+', text.strip())
    if not token_match:
        raise ValueError(f'Cannot parse uint from: {text!r}')
    token = token_match.group(0)
    return int(token, 16) if token.startswith('0x') else int(token)


def cast_call(to: str, sig: str, *args: str) -> str:
    cmd = [CAST, 'call', to, sig, *args, '--rpc-url', RPC]
    return run(cmd).stdout.strip()


def cast_send_account(account: str, to: str, sig: str, *args: str, value_wei: int = 0, timeout: int = 120, retries: int = 3) -> str:
    last_output = ''
    for attempt in range(1, retries + 1):
        cmd = [
            CAST, 'send', to, sig, *args,
            '--rpc-url', RPC,
            '--account', account,
            '--password', WALLET_PASSWORD,
            '--gas-limit', '3000000',
        ]
        if value_wei > 0:
            cmd += ['--value', str(value_wei)]
        proc = run(cmd, timeout=timeout, check=False)
        output = (proc.stdout or '') + (proc.stderr or '')
        last_output = output.strip()
        if proc.returncode == 0 and 'status               1' in output:
            return output

        retryable = 'replacement transaction underpriced' in output.lower() or 'nonce' in output.lower()
        if retryable and attempt < retries:
            time.sleep(5 * attempt)
            continue
        raise RuntimeError(last_output)

    raise RuntimeError(last_output)


def get_account_address(account: str) -> str:
    cmd = [CAST, 'wallet', 'address', '--account', account, '--password', WALLET_PASSWORD]
    out = run(cmd).stdout.strip()
    addr = extract_address(out)
    if not addr:
        raise RuntimeError(f'Could not resolve address for account={account}')
    return addr.lower()


def decrypt_keystore_key(account: str) -> str:
    cmd = [CAST, 'wallet', 'decrypt-keystore', account, '--unsafe-password', WALLET_PASSWORD]
    out = run(cmd).stdout.strip()
    key_match = re.search(r'0x[a-fA-F0-9]{64}', out)
    if not key_match:
        raise RuntimeError(f'Could not decrypt private key for account={account}')
    return key_match.group(0)


def find_agent_id(owner_addr: str) -> int | None:
    agents_count = parse_uint(cast_call(ARENA, 'agentsCount()(uint256)'))
    for idx in range(1, agents_count + 1):
        raw = cast_call(ARENA, 'agents(uint256)(address,uint32,uint32,uint32)', str(idx))
        owner = extract_address(raw)
        if owner and owner.lower() == owner_addr:
            return idx
    return None


def ensure_registered(account: str, owner_addr: str) -> int:
    existing = find_agent_id(owner_addr)
    if existing is not None:
        return existing

    registration_fee = parse_uint(cast_call(ARENA, 'agentRegistrationFee()(uint256)'))
    cast_send_account(account, ARENA, 'registerAgent()', value_wei=registration_fee)
    new_id = find_agent_id(owner_addr)
    if new_id is None:
        raise RuntimeError(f'Failed to register agent for account={account}')
    return new_id


def create_battle(challenger_id: int) -> tuple[int, str]:
    creation_fee = parse_uint(cast_call(ARENA, 'battleCreationFee()(uint256)'))
    config = f'({STAKE_WEI},{WARMUP_BLOCKS},{TARGET_AGENT_ID},{MAX_JOKERS})'
    total_value = STAKE_WEI + creation_fee

    before_count = parse_uint(cast_call(ARENA, 'battlesCount()(uint256)'))

    cast_send_account(
        'clawn',
        ARENA,
        'createBattle(uint256,(uint256,uint32,uint256,uint8))',
        str(challenger_id),
        config,
        value_wei=total_value,
        timeout=180,
    )

    battle_id = parse_uint(cast_call(ARENA, 'battlesCount()(uint256)'))
    if battle_id <= before_count:
        # Graceful fallback for noisy nonce/mempool behavior
        time.sleep(2)
        battle_id = parse_uint(cast_call(ARENA, 'battlesCount()(uint256)'))
        if battle_id <= before_count:
            raise RuntimeError('createBattle did not increase battlesCount')

    battle_addr_raw = cast_call(ARENA, 'battles(uint256)(address)', str(battle_id))
    battle_addr = extract_address(battle_addr_raw)
    if not battle_addr:
        raise RuntimeError('Could not resolve cloned battle address')

    return battle_id, battle_addr


def battle_phase(battle_addr: str) -> int:
    state_raw = cast_call(battle_addr, 'getBattleState()(uint8,uint32,uint128,uint128,bytes32,uint256)')
    return parse_uint(state_raw)


def accept_battle(battle_addr: str, acceptor_id: int) -> None:
    if battle_phase(battle_addr) == 1:
        return

    for attempt in range(1, 4):
        try:
            cast_send_account(
                'clawnjr',
                battle_addr,
                'acceptBattle(uint256)',
                str(acceptor_id),
                value_wei=STAKE_WEI,
                timeout=180,
            )
            return
        except Exception:
            if battle_phase(battle_addr) == 1:
                return
            if attempt == 3:
                raise
            time.sleep(4 * attempt)


def run_battle_loop(battle_addr: str, opponent_key: str, seed: int, battle_id: int) -> int:
    log_path = RESULTS_DIR / f'batch-{battle_id}-{seed}.log'
    checkpoint_path = CHECKPOINT_DIR / f'batch-{battle_id}-{seed}.json'

    env = os.environ.copy()
    env.update({
        'CLAWTTACK_BATTLE': battle_addr,
        'CLAWTTACK_OPPONENT_PRIVATE_KEY': opponent_key,
        'CLAWTTACK_RPC': RPC,
        'CLAWTTACK_SEED': str(seed),
        'CLAWTTACK_MAX_TURNS': str(MAX_TURNS),
        'CLAWTTACK_CHECKPOINT_PATH': str(checkpoint_path),
        'OPENAI_BASE_URL': OPENAI_BASE_URL,
        'LLM_MODEL': OPENAI_MODEL,
    })
    if OPENAI_API_KEY:
        env['OPENAI_API_KEY'] = OPENAI_API_KEY

    with log_path.open('w') as log_file:
        proc = subprocess.run(
            ['bun', 'run', 'scripts/v05-battle-loop.ts'],
            cwd=SDK_DIR,
            env=env,
            stdout=log_file,
            stderr=subprocess.STDOUT,
            timeout=BATTLE_TIMEOUT_SEC,
        )

    return proc.returncode


if __name__ == '__main__':
    if not Path(CAST).exists():
        fail(f'cast not found at {CAST}')

    secrets_path = Path.home() / '.config' / 'pvtclawn' / 'secrets.json'
    if not secrets_path.exists():
        fail(f'Missing secrets file: {secrets_path}')

    secrets_data = json.loads(secrets_path.read_text())
    WALLET_PASSWORD = secrets_data.get('WALLET_PASSWORD')
    if not WALLET_PASSWORD:
        fail('WALLET_PASSWORD missing in secrets.json')

    # Prefer explicit OPENAI_API_KEY; otherwise use OpenRouter key for OpenAI-compatible API.
    OPENAI_API_KEY = OPENAI_API_KEY or secrets_data.get('OPENAI_API_KEY') or secrets_data.get('OPENROUTER_API_KEY')

    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    CHECKPOINT_DIR.mkdir(parents=True, exist_ok=True)

    try:
        clawn_addr = get_account_address('clawn')
        jr_addr = get_account_address('clawnjr')
        jr_private_key = decrypt_keystore_key('clawnjr')

        clawn_id = ensure_registered('clawn', clawn_addr)
        jr_id = ensure_registered('clawnjr', jr_addr)
    except Exception as exc:
        fail(f'Agent setup failed: {exc}')

    print('🦞 Clawttack autonomous batch runner')
    print(f'  Arena: {ARENA}')
    print(f'  RPC: {RPC}')
    print(f'  Clawn: id={clawn_id}, addr={clawn_addr}')
    print(f'  ClawnJr: id={jr_id}, addr={jr_addr}')
    print(f'  Strategy: A={STRATEGY_A}, B={STRATEGY_B}')
    print(f'  Battles: {MAX_BATTLES} | stake={STAKE_WEI} wei | warmup={WARMUP_BLOCKS} blocks | jokers={MAX_JOKERS}')
    print(f'  LLM: model={OPENAI_MODEL} | base={OPENAI_BASE_URL}')

    success = 0
    for i in range(MAX_BATTLES):
        seed = int(time.time()) + i
        print(f'\n{"="*64}')
        print(f'Battle {i + 1}/{MAX_BATTLES} | seed={seed}')

        try:
            battle_id, battle_addr = create_battle(clawn_id)
            print(f'  Created battle #{battle_id}: {battle_addr}')

            accept_battle(battle_addr, jr_id)
            print('  Accepted by ClawnJr')

            print(f'  Waiting warmup ~{WARMUP_WAIT_SEC}s ...')
            time.sleep(WARMUP_WAIT_SEC)

            code = run_battle_loop(battle_addr, jr_private_key, seed, battle_id)
            print(f'  battle-loop exit code: {code}')
            if code == 0:
                success += 1
        except subprocess.TimeoutExpired:
            print('  ⚠️ battle-loop timed out; continuing to next battle')
        except Exception as exc:
            print(f'  ⚠️ battle failed: {exc}')

        time.sleep(2)

    print(f'\n✅ Batch complete: {success}/{MAX_BATTLES} finished with exit code 0')
