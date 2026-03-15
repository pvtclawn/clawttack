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
            payload = self._build_per_battle_with_tmp(
                root=Path(tmp),
                log_text=log_text,
                checkpoint=checkpoint,
                metadata=metadata,
            )
            return payload['per_battle']

    def _build_per_battle_with_tmp(
        self,
        *,
        root: Path,
        log_text: str,
        checkpoint: dict,
        metadata: dict,
    ) -> dict:
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
            per_battle = MODULE.build_per_battle(
                log_path,
                checkpoint_path,
                control_label='baseline',
                intervention_label='resumed-agent',
                max_turns_configured=120,
            )
            return {
                'per_battle': per_battle,
                'root': root,
                'results': results,
                'checkpoints': checkpoints,
                'metadata_dir': metadata_dir,
                'summaries': summaries,
                'log_path': log_path,
                'checkpoint_path': checkpoint_path,
                'metadata_path': metadata_path,
            }
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
                'lastNarrativeByAgent': {
                    'A': 'Another storm pressed against the safehouse glass as I checked the relay map and marked the forged route before dawn.',
                    'B': 'At the airport gate we traced the courier handoff and caught the fake manifest before the decoy inspector could leave.',
                },
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
        self.assertTrue(per_battle['transcriptQuality']['constraintSignalsVisible'])
        self.assertTrue(per_battle['transcriptQuality']['sceneCoherenceHint'])
        self.assertEqual(per_battle['transcriptQualityFailureReasons'], [])
        self.assertFalse(per_battle['invalidForProperBattle'])
        self.assertEqual(per_battle['hardInvalidTriggers'], [])
        self.assertIsNone(per_battle['forcedVerdictTier'])
        self.assertFalse(per_battle['countsAsProperBattle'])
        self.assertEqual(per_battle['topProperBattleReason'], 'execution-outcome:supervisor-interrupted')
        self.assertEqual(per_battle['topClaimLimitingReason'], 'execution-outcome:supervisor-interrupted')
        self.assertEqual(per_battle['topClaimLimitingReasonSource'], 'proper-battle-reason')
        self.assertEqual(per_battle['governedVerdictBlock']['primaryLabelField'], 'displayedTier')
        self.assertEqual(per_battle['governedVerdictBlock']['displayedTier'], 'non-credit / exploratory')
        self.assertEqual(per_battle['governedVerdictBlock']['rawTier'], 'non-credit-unclassified')
        self.assertEqual(per_battle['governedVerdictBlock']['rawTierRole'], 'audit-only')
        self.assertEqual(per_battle['governedVerdictBlock']['creditStatus'], 'non-credit')
        self.assertEqual(per_battle['governedVerdictBlock']['adjacentReason'], 'execution-outcome:supervisor-interrupted')
        self.assertFalse(per_battle['governedVerdictBlock']['followUpInterpretationInsideBlockAllowed'])
        self.assertIn('execution-outcome:supervisor-interrupted', per_battle['properBattleReasons'])
        self.assertIn('gameplay-outcome:mid-battle-interrupted', per_battle['properBattleReasons'])

    def test_terminal_clean_run_stays_fail_closed_until_rubric_lands(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\nwinner: PrivateClawn\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xdef',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'Beneath the warehouse crane I caught the switched crate and tagged the false timestamp before the watchers could react.',
                    'B': 'Our runner slipped past the checkpoint and exposed the forged customs seal while the harbor lights cut through the rain.',
                },
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
        self.assertTrue(per_battle['transcriptQuality']['sceneCoherenceHint'])
        self.assertEqual(per_battle['transcriptQuality']['repetitionRisk'], 'low')
        self.assertEqual(per_battle['transcriptQualityFailureReasons'], [])
        self.assertFalse(per_battle['invalidForProperBattle'])
        self.assertEqual(per_battle['hardInvalidTriggers'], [])
        self.assertIsNone(per_battle['forcedVerdictTier'])
        self.assertFalse(per_battle['countsAsProperBattle'])
        self.assertEqual(per_battle['topProperBattleReason'], 'proper-battle-rubric-pending')
        self.assertEqual(per_battle['topClaimLimitingReason'], 'proper-battle-rubric-pending')
        self.assertEqual(per_battle['properBattleReasons'], ['proper-battle-rubric-pending'])

    def test_template_like_boilerplate_surfaces_explicit_transcript_quality_failures(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\ntemplate=relay\ntemplate=relay\n''',
            checkpoint={
                'battle': '0xghi',
                'lastTurn': 1,
                'lastNarrativeByAgent': {
                    'A': 'relay holds firm. Sequence remains coherent. relay holds firm. Sequence remains coherent.',
                    'B': 'relay holds firm. Sequence remains coherent. relay holds firm. Sequence remains coherent.',
                },
                'results': [
                    {'txHash': '0x' + '6' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '7' * 64, 'bankA': '370', 'bankB': '400'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                },
            },
        )

        self.assertTrue(per_battle['transcriptQuality']['constraintSignalsVisible'])
        self.assertEqual(per_battle['transcriptQuality']['repetitionRisk'], 'elevated')
        self.assertTrue(per_battle['transcriptQuality']['fallbackMasqueradeRisk'])
        self.assertTrue(per_battle['transcriptQuality']['signals']['fallbackPhraseDetected'])
        self.assertTrue(per_battle['transcriptQuality']['signals']['templateMarkerDetected'])
        self.assertTrue(per_battle['transcriptQuality']['signals']['repeatedSampleDetected'])
        self.assertIn('repetition-risk-elevated', per_battle['transcriptQualityFailureReasons'])
        self.assertIn('fallback-masquerade-risk', per_battle['transcriptQualityFailureReasons'])
        self.assertTrue(per_battle['invalidForProperBattle'])
        self.assertEqual(per_battle['forcedVerdictTier'], 'invalid-for-proper-battle')
        self.assertIn('hard-invalid:severe-transcript-quality-failure', per_battle['hardInvalidTriggers'])
        self.assertEqual(per_battle['topHardInvalidTrigger'], 'hard-invalid:severe-transcript-quality-failure')
        self.assertEqual(per_battle['topClaimLimitingReason'], 'hard-invalid:severe-transcript-quality-failure')
        self.assertEqual(per_battle['topClaimLimitingReasonSource'], 'hard-invalid-trigger')
        self.assertEqual(per_battle['governedVerdictBlock']['displayedTier'], 'non-credit / invalid')
        self.assertEqual(per_battle['governedVerdictBlock']['rawTier'], 'invalid-for-proper-battle')
        self.assertEqual(per_battle['governedVerdictBlock']['rawTierRole'], 'audit-only')

    def test_unknown_source_of_move_priority_beats_other_invalid_reasons(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\ntemplate=relay\n''',
            checkpoint={
                'battle': '0xjkl',
                'lastTurn': 1,
                'lastNarrativeByAgent': {
                    'A': 'relay holds firm. Sequence remains coherent. relay holds firm. Sequence remains coherent.',
                    'B': 'relay holds firm. Sequence remains coherent. relay holds firm. Sequence remains coherent.',
                },
                'results': [
                    {'txHash': '0x' + '8' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '9' * 64, 'bankA': '370', 'bankB': '400'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'sourceOfMove': {
                    'A': {'kind': 'unknown', 'strategy': None, 'agentName': None},
                    'B': {'kind': 'local-script', 'strategy': 'script', 'agentName': None},
                },
            },
        )

        self.assertTrue(per_battle['invalidForProperBattle'])
        self.assertEqual(per_battle['forcedVerdictTier'], 'invalid-for-proper-battle')
        self.assertIn('hard-invalid:source-of-move-unknown:A', per_battle['hardInvalidTriggers'])
        self.assertIn('hard-invalid:severe-transcript-quality-failure', per_battle['hardInvalidTriggers'])
        self.assertEqual(per_battle['topHardInvalidTrigger'], 'hard-invalid:source-of-move-unknown:A')
        self.assertEqual(per_battle['topClaimLimitingReason'], 'hard-invalid:source-of-move-unknown:A')
        self.assertEqual(per_battle['topClaimLimitingReasonSource'], 'hard-invalid-trigger')

    def test_markdown_renders_governed_verdict_block_section(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            payload = self._build_per_battle_with_tmp(
                root=Path(tmp),
                log_text='''\n🎮 turn=0 side=A bankA=400 bankB=400\n🎮 turn=1 side=B bankA=370 bankB=400\n''',
                checkpoint={
                    'battle': '0xabc',
                    'lastTurn': 1,
                    'lastNarrativeByAgent': {
                        'A': 'Another storm pressed against the safehouse glass as I checked the relay map and marked the forged route before dawn.',
                        'B': 'At the airport gate we traced the courier handoff and caught the fake manifest before the decoy inspector could leave.',
                    },
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
            md_path = payload['summaries'] / 'governed-block.md'
            MODULE.write_markdown(md_path, payload['per_battle'])
            md_text = md_path.read_text(encoding='utf-8')
            parity = MODULE.evaluate_governed_block_surface_parity(
                payload['per_battle']['governedVerdictBlock'],
                md_text,
            )

        self.assertIn('## governed verdict block', md_text)
        self.assertIn('- field order: displayedTier, rawTier, creditStatus, adjacentReason', md_text)
        self.assertIn('- primary label field: `displayedTier`', md_text)
        self.assertIn('- displayed tier: `non-credit / exploratory`', md_text)
        self.assertIn('- raw tier: `non-credit-unclassified` (audit-only)', md_text)
        self.assertIn('- adjacent reason: `execution-outcome:supervisor-interrupted` (proper-battle-reason)', md_text)
        self.assertIn('- follow-up interpretation inside block allowed: `False`', md_text)
        self.assertEqual(parity['scope'], 'current-artifact-surfaces:json+markdown')
        self.assertEqual(parity['status'], 'aligned')
        self.assertTrue(all(parity['checks'].values()))

    def test_surface_parity_check_handles_invalid_governed_block(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            payload = self._build_per_battle_with_tmp(
                root=Path(tmp),
                log_text='''\ntemplate=relay\n''',
                checkpoint={
                    'battle': '0xbbb',
                    'lastTurn': 1,
                    'lastNarrativeByAgent': {
                        'A': 'relay holds firm. Sequence remains coherent. relay holds firm. Sequence remains coherent.',
                        'B': 'relay holds firm. Sequence remains coherent. relay holds firm. Sequence remains coherent.',
                    },
                    'results': [
                        {'txHash': '0x' + '3' * 64, 'bankA': '400', 'bankB': '400'},
                        {'txHash': '0x' + '4' * 64, 'bankA': '370', 'bankB': '400'},
                    ],
                },
                metadata={
                    'executionOutcome': 'clean-exit',
                    'sourceOfMove': {
                        'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                        'B': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    },
                },
            )
            md_path = payload['summaries'] / 'governed-invalid.md'
            MODULE.write_markdown(md_path, payload['per_battle'])
            md_text = md_path.read_text(encoding='utf-8')
            parity = MODULE.evaluate_governed_block_surface_parity(
                payload['per_battle']['governedVerdictBlock'],
                md_text,
            )

        self.assertEqual(payload['per_battle']['governedVerdictBlock']['displayedTier'], 'non-credit / invalid')
        self.assertEqual(payload['per_battle']['governedVerdictBlock']['rawTier'], 'invalid-for-proper-battle')
        self.assertEqual(parity['status'], 'aligned')
        self.assertTrue(all(parity['checks'].values()))


if __name__ == '__main__':
    unittest.main()
