from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path


SCRIPT_PATH = Path(__file__).with_name('summarize-v05-batches.py')
SPEC = importlib.util.spec_from_file_location('summarize_v05_batches', SCRIPT_PATH)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError(f'Could not load module from {SCRIPT_PATH}')
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class SummarizeV05BatchesClassificationTest(unittest.TestCase):
    def _build_per_battle(self, *, log_text: str, checkpoint: dict, metadata: dict) -> dict:
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            results = root / 'battle-results'
            checkpoints = results / 'checkpoints'
            metadata_dir = results / 'metadata'
            summaries = results / 'summaries'
            results.mkdir(parents=True, exist_ok=True)
            checkpoints.mkdir(parents=True, exist_ok=True)
            metadata_dir.mkdir(parents=True, exist_ok=True)
            summaries.mkdir(parents=True, exist_ok=True)

            log_path = results / 'batch-99-123.log'
            checkpoint_path = checkpoints / 'batch-99-123.json'
            metadata_path = metadata_dir / 'batch-99-123.json'
            log_path.write_text(log_text, encoding='utf-8')
            checkpoint_path.write_text(json.dumps(checkpoint), encoding='utf-8')
            metadata_path.write_text(json.dumps(metadata), encoding='utf-8')

            previous = (
                MODULE.ROOT,
                MODULE.RESULTS_DIR,
                MODULE.CHECKPOINTS_DIR,
                MODULE.METADATA_DIR,
                MODULE.SUMMARIES_DIR,
            )
            MODULE.ROOT = root
            MODULE.RESULTS_DIR = results
            MODULE.CHECKPOINTS_DIR = checkpoints
            MODULE.METADATA_DIR = metadata_dir
            MODULE.SUMMARIES_DIR = summaries
            try:
                return MODULE.build_per_battle(
                    log_path,
                    checkpoint_path,
                    control_label='baseline',
                    intervention_label='resumed-agent',
                    max_turns_configured=120,
                )
            finally:
                (
                    MODULE.ROOT,
                    MODULE.RESULTS_DIR,
                    MODULE.CHECKPOINTS_DIR,
                    MODULE.METADATA_DIR,
                    MODULE.SUMMARIES_DIR,
                ) = previous

    def test_interrupted_run_is_not_mislabeled_as_gameplay_success(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n🎮 turn=0 side=A bankA=400 bankB=400\n🎮 turn=1 side=B bankA=370 bankB=400\n''',
            checkpoint={
                'battle': '0xabc',
                'lastTurn': 1,
                'results': [
                    {'txHash': '0x' + '1' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '2' * 64, 'bankA': '370', 'bankB': '400'},
                ],
            },
            metadata={
                'executionOutcome': 'started',
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'local-script', 'strategy': 'script', 'agentName': None},
                },
            },
        )

        self.assertEqual(per_battle['executionOutcome'], 'supervisor-interrupted')
        self.assertEqual(per_battle['gameplayOutcome'], 'mid-battle-interrupted')
        self.assertEqual(per_battle['sourceOfMove']['A']['kind'], 'gateway-agent')
        self.assertEqual(per_battle['sourceOfMove']['B']['kind'], 'local-script')
        self.assertFalse(per_battle['countsAsProperBattle'])
        self.assertIn('execution-outcome:supervisor-interrupted', per_battle['properBattleReasons'])
        self.assertIn('gameplay-outcome:mid-battle-interrupted', per_battle['properBattleReasons'])

    def test_terminal_clean_run_stays_fail_closed_until_rubric_lands(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\nwinner: PrivateClawn\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xdef',
                'lastTurn': 2,
                'results': [
                    {'txHash': '0x' + '3' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '4' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '5' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        self.assertEqual(per_battle['executionOutcome'], 'clean-exit')
        self.assertEqual(per_battle['gameplayOutcome'], 'terminal')
        self.assertFalse(per_battle['countsAsProperBattle'])
        self.assertEqual(per_battle['properBattleReasons'], ['proper-battle-rubric-pending'])


if __name__ == '__main__':
    unittest.main()
