#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
RESULTS_DIR = ROOT / 'battle-results'
CHECKPOINTS_DIR = RESULTS_DIR / 'checkpoints'
SUMMARIES_DIR = RESULTS_DIR / 'summaries'

KNOWN_MECHANICS = [
    'first-turn-submit',
    'multi-turn',
    'active-poison',
    'settlement',
]

DEFAULT_CONTROL_LABEL = 'baseline-same-regime'
DEFAULT_INTERVENTION_LABEL = 'same-regime'
LATER_TURN_THRESHOLD = 3


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
        'settledHint': False,
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
    summary['settledHint'] = any(token in log_text.lower() for token in ('settled', 'winner', 'resulttype'))

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


def observed_mechanics(per_battle: dict[str, Any], log_text: str, log_summary: dict[str, Any]) -> list[str]:
    observed: list[str] = []
    if per_battle['turnsMined'] >= 1:
        observed.append('first-turn-submit')
    if per_battle['turnsMined'] >= 2:
        observed.append('multi-turn')
    if 'poisonMode: active' in log_text or 'poisonMode=active' in log_text or 'poisonMode\": \"active\"' in log_text:
        observed.append('active-poison')
    if log_summary.get('settledHint'):
        observed.append('settlement')
    return sorted(set(observed))


def build_per_battle(
    log_path: Path,
    checkpoint_path: Path | None,
    *,
    control_label: str,
    intervention_label: str,
) -> dict[str, Any]:
    log_text = load_text(log_path)
    log_summary = parse_log(log_text)
    checkpoint = load_json(checkpoint_path) if checkpoint_path else None
    cp_summary = summarize_checkpoint(checkpoint)
    stage = stage_from_summary(log_summary, checkpoint)

    out = {
        'batchKey': batch_key(log_path),
        'logPath': str(log_path.relative_to(ROOT)),
        'checkpointPath': str(checkpoint_path.relative_to(ROOT)) if checkpoint_path else None,
        'controlLabel': control_label,
        'interventionLabel': intervention_label,
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
    }
    observed = observed_mechanics(out, log_text, log_summary)
    out['observedMechanics'] = observed
    out['unobservedMechanics'] = [m for m in KNOWN_MECHANICS if m not in observed]
    out['settled'] = 'settlement' in observed
    out['unsettled'] = not out['settled']
    out['sharedRegimeMetrics'] = {
        'identityPair': out['identityPair'],
        'firstMoverA': out['firstMoverA'],
        'deepestStageReached': out['deepestStageReached'],
        'accepted': out['accepted'],
        'turnsMined': out['turnsMined'],
        'failureClass': out['failureClass'] or 'none',
    }
    out['interventionTargetMetrics'] = {
        'laterTurnReached': out['turnsMined'] >= LATER_TURN_THRESHOLD,
        'settlementObserved': out['settled'],
        'activePoisonObserved': 'active-poison' in out['observedMechanics'],
        'observedMechanics': out['observedMechanics'],
        'unobservedMechanics': out['unobservedMechanics'],
    }
    return out


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def write_markdown(path: Path, per_battle: dict[str, Any]) -> None:
    shared = per_battle['sharedRegimeMetrics']
    target = per_battle['interventionTargetMetrics']
    lines = [
        f"# {per_battle['batchKey']}",
        '',
        f"- control label: `{per_battle['controlLabel']}`",
        f"- intervention label: `{per_battle['interventionLabel']}`",
        f"- battle: `{per_battle['battleId']}` @ `{per_battle['battleAddress']}`",
        f"- identities: {per_battle['identityPair']}",
        f"- agents: clawn={per_battle['clawnAgentId']} / jr={per_battle['clawnJrAgentId']}",
        f"- settled: `{per_battle['settled']}` | unsettled: `{per_battle['unsettled']}`",
        f"- txs: `{len(per_battle['txHashes'])}`",
        f"- bank delta: A `{per_battle['bankAStart']}` -> `{per_battle['bankAEnd']}`, B `{per_battle['bankBStart']}` -> `{per_battle['bankBEnd']}`",
        '',
        '## shared-regime metrics',
        f"- first mover A: `{shared['firstMoverA']}`",
        f"- deepest stage: `{shared['deepestStageReached']}`",
        f"- accepted: `{shared['accepted']}`",
        f"- turns mined: `{shared['turnsMined']}`",
        f"- failure/result note: {shared['failureClass']}",
        '',
        '## intervention-target metrics',
        f"- later-turn reached: `{target['laterTurnReached']}`",
        f"- settlement observed: `{target['settlementObserved']}`",
        f"- active-poison observed: `{target['activePoisonObserved']}`",
        f"- observed mechanics: {', '.join(target['observedMechanics']) or 'none'}",
        f"- unobserved mechanics: {', '.join(target['unobservedMechanics']) or 'none'}",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def aggregate(per_battles: list[dict[str, Any]]) -> dict[str, Any]:
    stage_counts = Counter(b['deepestStageReached'] for b in per_battles)
    failure_counts = Counter((b['failureClass'] or 'none') for b in per_battles)
    observed = sorted({m for b in per_battles for m in b['observedMechanics']})
    control_label = per_battles[0]['controlLabel'] if per_battles else DEFAULT_CONTROL_LABEL
    intervention_label = per_battles[0]['interventionLabel'] if per_battles else DEFAULT_INTERVENTION_LABEL
    turns_mined = [b['turnsMined'] for b in per_battles]
    first_movers = [b['firstMoverA'] for b in per_battles]
    shared_regime_metrics = {
        'battleCount': len(per_battles),
        'stageHistogram': dict(stage_counts),
        'failureHistogram': dict(failure_counts),
        'turnsMinedPerBattle': turns_mined,
        'firstMoversA': first_movers,
        'identityPairs': sorted({b['identityPair'] for b in per_battles}),
        'acceptedBattleCount': sum(1 for b in per_battles if b['accepted']),
    }
    intervention_target_metrics = {
        'laterTurnBattleCount': sum(1 for b in per_battles if b['interventionTargetMetrics']['laterTurnReached']),
        'activePoisonBattleCount': sum(1 for b in per_battles if b['interventionTargetMetrics']['activePoisonObserved']),
        'settlementObservedCount': sum(1 for b in per_battles if b['interventionTargetMetrics']['settlementObserved']),
        'observedMechanics': observed,
        'unobservedMechanics': [m for m in KNOWN_MECHANICS if m not in observed],
    }
    return {
        'controlLabel': control_label,
        'interventionLabel': intervention_label,
        'battleCount': len(per_battles),
        'stageHistogram': dict(stage_counts),
        'failureHistogram': dict(failure_counts),
        'turnsMinedPerBattle': turns_mined,
        'battleIds': [b['battleId'] for b in per_battles],
        'firstMoversA': first_movers,
        'identityPairs': sorted({b['identityPair'] for b in per_battles}),
        'observedMechanics': observed,
        'unobservedMechanics': [m for m in KNOWN_MECHANICS if m not in observed],
        'notableAnomalies': [b['failureClass'] for b in per_battles if b['failureClass']],
        'unsettledBattleCount': sum(1 for b in per_battles if b['unsettled']),
        'settledBattleCount': sum(1 for b in per_battles if b['settled']),
        'sharedRegimeMetrics': shared_regime_metrics,
        'interventionTargetMetrics': intervention_target_metrics,
    }


def compare_aggregates(previous: dict[str, Any] | None, current: dict[str, Any]) -> dict[str, Any]:
    if previous is None:
        return {
            'hasPrevious': False,
            'note': 'No previous aggregate snapshot available for comparison.'
        }
    previous_shared = previous.get('sharedRegimeMetrics', {})
    current_shared = current.get('sharedRegimeMetrics', {})
    previous_target = previous.get('interventionTargetMetrics', {})
    current_target = current.get('interventionTargetMetrics', {})
    return {
        'hasPrevious': True,
        'previousControlLabel': previous.get('controlLabel'),
        'currentControlLabel': current.get('controlLabel'),
        'previousInterventionLabel': previous.get('interventionLabel'),
        'currentInterventionLabel': current.get('interventionLabel'),
        'previousBattleCount': previous.get('battleCount'),
        'currentBattleCount': current.get('battleCount'),
        'previousStageHistogram': previous.get('stageHistogram', {}),
        'currentStageHistogram': current.get('stageHistogram', {}),
        'previousFailureHistogram': previous.get('failureHistogram', {}),
        'currentFailureHistogram': current.get('failureHistogram', {}),
        'previousObservedMechanics': previous.get('observedMechanics', []),
        'currentObservedMechanics': current.get('observedMechanics', []),
        'newlyObservedMechanics': sorted(set(current.get('observedMechanics', [])) - set(previous.get('observedMechanics', []))),
        'stillUnobservedMechanics': current.get('unobservedMechanics', []),
        'previousUnsettledBattleCount': previous.get('unsettledBattleCount'),
        'currentUnsettledBattleCount': current.get('unsettledBattleCount'),
        'previousBattleIds': previous.get('battleIds', []),
        'currentBattleIds': current.get('battleIds', []),
        'previousSharedRegimeMetrics': previous_shared,
        'currentSharedRegimeMetrics': current_shared,
        'previousInterventionTargetMetrics': previous_target,
        'currentInterventionTargetMetrics': current_target,
    }


def write_aggregate_markdown(path: Path, agg: dict[str, Any], comparison: dict[str, Any]) -> None:
    shared = agg['sharedRegimeMetrics']
    target = agg['interventionTargetMetrics']
    lines = [
        '# batch-summary',
        '',
        f"- control label: `{agg['controlLabel']}`",
        f"- intervention label: `{agg['interventionLabel']}`",
        f"- battle count: `{agg['battleCount']}`",
        f"- settled vs unsettled: `{agg['settledBattleCount']}` settled / `{agg['unsettledBattleCount']}` unsettled",
        f"- notable anomalies: {', '.join(agg['notableAnomalies']) or 'none'}",
        '',
        '## shared-regime metrics',
        f"- stage histogram: `{shared['stageHistogram']}`",
        f"- failure histogram: `{shared['failureHistogram']}`",
        f"- turns mined per battle: `{shared['turnsMinedPerBattle']}`",
        f"- first movers A: `{shared['firstMoversA']}`",
        f"- accepted battle count: `{shared['acceptedBattleCount']}`",
        '',
        '## intervention-target metrics',
        f"- later-turn battle count: `{target['laterTurnBattleCount']}`",
        f"- active-poison battle count: `{target['activePoisonBattleCount']}`",
        f"- settlement observed count: `{target['settlementObservedCount']}`",
        f"- observed mechanics: {', '.join(target['observedMechanics']) or 'none'}",
        f"- unobserved mechanics: {', '.join(target['unobservedMechanics']) or 'none'}",
        '',
        '## comparison',
    ]
    if comparison.get('hasPrevious'):
        lines.extend([
            f"- previous control/intervention: `{comparison['previousControlLabel']}` / `{comparison['previousInterventionLabel']}`",
            f"- current control/intervention: `{comparison['currentControlLabel']}` / `{comparison['currentInterventionLabel']}`",
            f"- previous battle count: `{comparison['previousBattleCount']}`",
            f"- current battle count: `{comparison['currentBattleCount']}`",
            f"- previous shared metrics: `{comparison['previousSharedRegimeMetrics']}`",
            f"- current shared metrics: `{comparison['currentSharedRegimeMetrics']}`",
            f"- previous intervention-target metrics: `{comparison['previousInterventionTargetMetrics']}`",
            f"- current intervention-target metrics: `{comparison['currentInterventionTargetMetrics']}`",
            f"- previous unsettled: `{comparison['previousUnsettledBattleCount']}`",
            f"- current unsettled: `{comparison['currentUnsettledBattleCount']}`",
            f"- newly observed mechanics: {', '.join(comparison['newlyObservedMechanics']) or 'none'}",
            f"- still unobserved mechanics: {', '.join(comparison['stillUnobservedMechanics']) or 'none'}",
        ])
    else:
        lines.append(f"- {comparison['note']}")
    lines.extend([
        '',
        '> This batch is exploratory evidence, not a verdict.',
    ])
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def main() -> None:
    parser = argparse.ArgumentParser(description='Summarize v05 battle batch artifacts into concise per-battle and aggregate summaries.')
    parser.add_argument('--limit', type=int, default=5, help='How many latest batch logs to summarize (default: 5)')
    parser.add_argument('--control-label', default=DEFAULT_CONTROL_LABEL, help='Human-readable label for the baseline/control regime.')
    parser.add_argument('--intervention-label', default=DEFAULT_INTERVENTION_LABEL, help='Human-readable label for the current intervention regime.')
    args = parser.parse_args()

    logs = sorted(RESULTS_DIR.glob('batch-*.log'), key=lambda p: p.stat().st_mtime)
    logs = logs[-args.limit:]
    if not logs:
        raise SystemExit('No batch logs found to summarize')

    per_battles: list[dict[str, Any]] = []
    per_dir = SUMMARIES_DIR / 'per-battle'
    agg_dir = SUMMARIES_DIR / 'aggregate'

    previous_aggregate = load_json(agg_dir / 'latest.json')

    for log_path in logs:
        checkpoint_path = CHECKPOINTS_DIR / f'{log_path.stem}.json'
        per_battle = build_per_battle(
            log_path,
            checkpoint_path if checkpoint_path.exists() else None,
            control_label=args.control_label,
            intervention_label=args.intervention_label,
        )
        per_battles.append(per_battle)
        write_json(per_dir / f'{log_path.stem}.json', per_battle)
        write_markdown(per_dir / f'{log_path.stem}.md', per_battle)

    agg = aggregate(per_battles)
    comparison = compare_aggregates(previous_aggregate, agg)
    write_json(agg_dir / 'latest.json', agg)
    write_json(agg_dir / 'comparison-latest.json', comparison)
    write_aggregate_markdown(agg_dir / 'latest.md', agg, comparison)

    print(f'Wrote {len(per_battles)} per-battle summaries to {per_dir}')
    print(f'Wrote aggregate summary to {agg_dir / "latest.json"}')
    print(f'Wrote comparison summary to {agg_dir / "comparison-latest.json"}')


if __name__ == '__main__':
    main()
