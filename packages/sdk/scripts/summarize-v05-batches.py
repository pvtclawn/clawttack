#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
RESULTS_DIR = ROOT / 'battle-results'
CHECKPOINTS_DIR = RESULTS_DIR / 'checkpoints'
SUMMARIES_DIR = RESULTS_DIR / 'summaries'

KNOWN_MECHANICS = [
    'first-turn-submit',
    'multi-turn',
    'active-poison',
    'settlement',
]


def load_text(path: Path) -> str:
    return path.read_text(encoding='utf-8') if path.exists() else ''


def load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding='utf-8'))


def batch_key(path: Path) -> str:
    return path.stem


def parse_log(log_text: str) -> dict[str, Any]:
    summary: dict[str, Any] = {
        'battleId': None,
        'battleAddress': None,
        'clawnAgentId': None,
        'clawnAddress': None,
        'clawnJrAgentId': None,
        'clawnJrAddress': None,
        'firstMoverA': None,
        'accepted': False,
        'errorLine': None,
        'templatesSeen': [],
    }

    if match := re.search(r'Clawn:\s+id=(\d+),\s+addr=(0x[a-fA-F0-9]{40})', log_text):
        summary['clawnAgentId'] = int(match.group(1))
        summary['clawnAddress'] = match.group(2)
    if match := re.search(r'ClawnJr:\s+id=(\d+),\s+addr=(0x[a-fA-F0-9]{40})', log_text):
        summary['clawnJrAgentId'] = int(match.group(1))
        summary['clawnJrAddress'] = match.group(2)
    if match := re.search(r'Created battle #(\d+) at (0x[a-fA-F0-9]{40})', log_text):
        summary['battleId'] = int(match.group(1))
        summary['battleAddress'] = match.group(2)
    if match := re.search(r'first mover A=(true|false)', log_text):
        summary['firstMoverA'] = match.group(1) == 'true'

    summary['accepted'] = 'Accepted battle' in log_text
    summary['templatesSeen'] = re.findall(r'template=([a-z]+)', log_text)

    error_lines = [
        line.strip() for line in log_text.splitlines()
        if '❌' in line or 'error:' in line.lower() or 'failed:' in line.lower()
    ]
    if error_lines:
        summary['errorLine'] = error_lines[-1]

    return summary


def stage_from_summary(log_summary: dict[str, Any], checkpoint: dict[str, Any] | None) -> str:
    turns = len((checkpoint or {}).get('results', []))
    if turns >= 2:
        return 'multi-turn'
    if turns >= 1:
        return 'turn-submit'
    if log_summary.get('accepted'):
        return 'accept'
    if log_summary.get('battleId') is not None:
        return 'create'
    if log_summary.get('clawnAgentId') is not None:
        return 'bootstrap'
    return 'unknown'


def summarize_checkpoint(checkpoint: dict[str, Any] | None) -> dict[str, Any]:
    results = (checkpoint or {}).get('results', [])
    turns_mined = len(results)
    tx_hashes = [row.get('txHash') for row in results if row.get('txHash')]
    first = results[0] if results else None
    last = results[-1] if results else None
    return {
        'turnsMined': turns_mined,
        'txHashes': tx_hashes,
        'firstTxHash': tx_hashes[0] if tx_hashes else None,
        'lastTxHash': tx_hashes[-1] if tx_hashes else None,
        'bankAStart': first.get('bankA') if first else None,
        'bankBStart': first.get('bankB') if first else None,
        'bankAEnd': last.get('bankA') if last else None,
        'bankBEnd': last.get('bankB') if last else None,
        'lastTurn': checkpoint.get('lastTurn') if checkpoint else None,
    }


def observed_mechanics(per_battle: dict[str, Any], log_text: str) -> list[str]:
    observed: list[str] = []
    if per_battle['turnsMined'] >= 1:
        observed.append('first-turn-submit')
    if per_battle['turnsMined'] >= 2:
        observed.append('multi-turn')
    if 'poisonMode: active' in log_text or 'poisonMode=active' in log_text:
        observed.append('active-poison')
    if 'settled' in log_text.lower() or 'resulttype' in log_text.lower() or '🏁 stop: phase=' in log_text:
        observed.append('settlement')
    return sorted(set(observed))


def build_per_battle(log_path: Path, checkpoint_path: Path | None) -> dict[str, Any]:
    log_text = load_text(log_path)
    log_summary = parse_log(log_text)
    checkpoint = load_json(checkpoint_path) if checkpoint_path else None
    cp_summary = summarize_checkpoint(checkpoint)
    stage = stage_from_summary(log_summary, checkpoint)
    observed = observed_mechanics(cp_summary, log_text)

    out = {
        'batchKey': batch_key(log_path),
        'logPath': str(log_path.relative_to(ROOT)),
        'checkpointPath': str(checkpoint_path.relative_to(ROOT)) if checkpoint_path else None,
        'battleId': log_summary['battleId'],
        'battleAddress': log_summary['battleAddress'],
        'identityPair': 'PrivateClawn vs PrivateClawnJr',
        'clawnAgentId': log_summary['clawnAgentId'],
        'clawnAddress': log_summary['clawnAddress'],
        'clawnJrAgentId': log_summary['clawnJrAgentId'],
        'clawnJrAddress': log_summary['clawnJrAddress'],
        'firstMoverA': log_summary['firstMoverA'],
        'deepestStageReached': stage,
        'turnsMined': cp_summary['turnsMined'],
        'txHashes': cp_summary['txHashes'],
        'firstTxHash': cp_summary['firstTxHash'],
        'lastTxHash': cp_summary['lastTxHash'],
        'bankAStart': cp_summary['bankAStart'],
        'bankBStart': cp_summary['bankBStart'],
        'bankAEnd': cp_summary['bankAEnd'],
        'bankBEnd': cp_summary['bankBEnd'],
        'templatesSeen': sorted(set(log_summary['templatesSeen'])),
        'accepted': log_summary['accepted'],
        'failureClass': log_summary['errorLine'],
        'observedMechanics': observed,
        'unobservedMechanics': [m for m in KNOWN_MECHANICS if m not in observed],
    }
    return out


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def write_markdown(path: Path, per_battle: dict[str, Any]) -> None:
    lines = [
        f"# {per_battle['batchKey']}",
        '',
        f"- battle: `{per_battle['battleId']}` @ `{per_battle['battleAddress']}`",
        f"- identities: {per_battle['identityPair']}",
        f"- agents: clawn={per_battle['clawnAgentId']} / jr={per_battle['clawnJrAgentId']}",
        f"- first mover A: `{per_battle['firstMoverA']}`",
        f"- deepest stage: `{per_battle['deepestStageReached']}`",
        f"- turns mined: `{per_battle['turnsMined']}`",
        f"- txs: `{len(per_battle['txHashes'])}`",
        f"- bank delta: A `{per_battle['bankAStart']}` -> `{per_battle['bankAEnd']}`, B `{per_battle['bankBStart']}` -> `{per_battle['bankBEnd']}`",
        f"- observed mechanics: {', '.join(per_battle['observedMechanics']) or 'none'}",
        f"- unobserved mechanics: {', '.join(per_battle['unobservedMechanics']) or 'none'}",
        f"- failure/result note: {per_battle['failureClass'] or 'none'}",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def aggregate(per_battles: list[dict[str, Any]]) -> dict[str, Any]:
    stage_counts = Counter(b['deepestStageReached'] for b in per_battles)
    failure_counts = Counter((b['failureClass'] or 'none') for b in per_battles)
    observed = sorted({m for b in per_battles for m in b['observedMechanics']})
    return {
        'battleCount': len(per_battles),
        'stageHistogram': dict(stage_counts),
        'failureHistogram': dict(failure_counts),
        'turnsMinedPerBattle': [b['turnsMined'] for b in per_battles],
        'battleIds': [b['battleId'] for b in per_battles],
        'firstMoversA': [b['firstMoverA'] for b in per_battles],
        'identityPairs': sorted({b['identityPair'] for b in per_battles}),
        'observedMechanics': observed,
        'unobservedMechanics': [m for m in KNOWN_MECHANICS if m not in observed],
        'notableAnomalies': [b['failureClass'] for b in per_battles if b['failureClass']],
    }


def write_aggregate_markdown(path: Path, agg: dict[str, Any]) -> None:
    lines = [
        '# batch-summary',
        '',
        f"- battle count: `{agg['battleCount']}`",
        f"- stage histogram: `{agg['stageHistogram']}`",
        f"- failure histogram: `{agg['failureHistogram']}`",
        f"- turns mined per battle: `{agg['turnsMinedPerBattle']}`",
        f"- observed mechanics: {', '.join(agg['observedMechanics']) or 'none'}",
        f"- unobserved mechanics: {', '.join(agg['unobservedMechanics']) or 'none'}",
        f"- notable anomalies: {', '.join(agg['notableAnomalies']) or 'none'}",
        '',
        '> This batch is exploratory evidence, not a verdict.',
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description='Summarize v05 battle batch artifacts into concise per-battle and aggregate summaries.')
    parser.add_argument('--limit', type=int, default=5, help='How many latest batch logs to summarize (default: 5)')
    args = parser.parse_args()

    logs = sorted(RESULTS_DIR.glob('batch-*.log'), key=lambda p: p.stat().st_mtime)
    logs = logs[-args.limit:]
    if not logs:
        raise SystemExit('No batch logs found to summarize')

    per_battles: list[dict[str, Any]] = []
    per_dir = SUMMARIES_DIR / 'per-battle'
    agg_dir = SUMMARIES_DIR / 'aggregate'

    for log_path in logs:
        checkpoint_path = CHECKPOINTS_DIR / f'{log_path.stem}.json'
        per_battle = build_per_battle(log_path, checkpoint_path if checkpoint_path.exists() else None)
        per_battles.append(per_battle)
        write_json(per_dir / f'{log_path.stem}.json', per_battle)
        write_markdown(per_dir / f'{log_path.stem}.md', per_battle)

    agg = aggregate(per_battles)
    write_json(agg_dir / 'latest.json', agg)
    write_aggregate_markdown(agg_dir / 'latest.md', agg)

    print(f'Wrote {len(per_battles)} per-battle summaries to {per_dir}')
    print(f'Wrote aggregate summary to {agg_dir / "latest.json"}')


if __name__ == '__main__':
    main()
