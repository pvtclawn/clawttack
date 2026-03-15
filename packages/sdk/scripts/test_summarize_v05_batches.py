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

    def test_provenance_mismatch_forces_invalid_tier_and_surfaces_trigger(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xpm1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked the relay hop and tagged the forged route before the checkpoint rotated.',
                    'B': 'I mirrored the handoff and rerouted the courier while the scanner logs rolled over.',
                },
                'results': [
                    {'txHash': '0x' + 'a' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + 'b' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + 'c' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'sourceOfMove': {
                    'A': {'kind': 'local-script', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        self.assertTrue(per_battle['invalidForProperBattle'])
        self.assertEqual(per_battle['forcedVerdictTier'], 'invalid-for-proper-battle')
        self.assertIn(
            'hard-invalid:provenance-mismatch:A:expected-gateway-agent:got-local-script',
            per_battle['hardInvalidTriggers'],
        )
        self.assertEqual(
            per_battle['topHardInvalidTrigger'],
            'hard-invalid:provenance-mismatch:A:expected-gateway-agent:got-local-script',
        )
        self.assertEqual(
            per_battle['topClaimLimitingReason'],
            'hard-invalid:provenance-mismatch:A:expected-gateway-agent:got-local-script',
        )

    def test_failure_class_derivation_mismatch_forces_hard_invalid_trigger(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n❌ Error: timed out waiting for gateway response\n''',
            checkpoint={
                'battle': '0xfc1',
                'lastTurn': 1,
                'lastNarrativeByAgent': {
                    'A': 'I watched the relay corridor and logged the dropped response before retry budget reset.',
                    'B': 'I mirrored the handoff path and tracked the timeout spike across channels.',
                },
                'results': [
                    {'txHash': '0x' + '7' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '8' * 64, 'bankA': '370', 'bankB': '400'},
                ],
            },
            metadata={
                'executionOutcome': 'timeout',
                'failureClass': 'none',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        self.assertEqual(per_battle['failureClass'], 'runtime/generic')
        self.assertEqual(per_battle['reportedFailureClass'], 'none')
        self.assertIn(
            'hard-invalid:failure-class-derivation-mismatch:derived-runtime/generic:reported-none',
            per_battle['hardInvalidTriggers'],
        )
        self.assertEqual(
            per_battle['topHardInvalidTrigger'],
            'hard-invalid:failure-class-derivation-mismatch:derived-runtime/generic:reported-none',
        )

    def test_failure_class_derivation_match_does_not_add_mismatch_trigger(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n❌ Error: timed out waiting for gateway response\n''',
            checkpoint={
                'battle': '0xfc2',
                'lastTurn': 1,
                'lastNarrativeByAgent': {
                    'A': 'I watched the relay corridor and logged the dropped response before retry budget reset.',
                    'B': 'I mirrored the handoff path and tracked the timeout spike across channels.',
                },
                'results': [
                    {'txHash': '0x' + '9' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + 'a' * 64, 'bankA': '370', 'bankB': '400'},
                ],
            },
            metadata={
                'executionOutcome': 'timeout',
                'failureClass': 'runtime/generic',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        self.assertEqual(per_battle['failureClass'], 'runtime/generic')
        self.assertEqual(per_battle['reportedFailureClass'], 'runtime/generic')
        self.assertFalse(
            any(t.startswith('hard-invalid:failure-class-derivation-mismatch:') for t in per_battle['hardInvalidTriggers'])
        )

    def test_anchor_transition_carryover_scope_mismatch_forces_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xat1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked epoch rollover lineage and flagged the forged carryover digest.',
                    'B': 'I mirrored transition scope checks and logged mismatch before settlement.',
                },
                'results': [
                    {'txHash': '0x' + '1' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '2' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '3' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'battleMode': 'agent-vs-script',
                'ruleVersion': 'v2',
                'anchorTransitionFromEpoch': 10,
                'anchorTransitionToEpoch': 11,
                'anchorTransitionCarryoverManifest': {'lastAcceptedEpoch': 10, 'lastAcceptedSequence': 77},
                'anchorTransitionCarryoverDigest': 'deadbeef',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertFalse(quality['anchorTransitionCarryoverScopeDigestMatch'])
        self.assertEqual(quality['anchorTransitionCarryoverScopeDigestReported'], 'deadbeef')
        self.assertIn(
            'hard-invalid:anchor-transition-carryover-scope-mismatch:',
            per_battle['topHardInvalidTrigger'],
        )

    def test_anchor_transition_carryover_scope_match_does_not_trigger_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xat2',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked epoch rollover lineage and validated carryover scope continuity.',
                    'B': 'I mirrored transition scope checks and confirmed deterministic digest parity.',
                },
                'results': [
                    {'txHash': '0x' + '4' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '5' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '6' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'battleMode': 'agent-vs-script',
                'ruleVersion': 'v2',
                'anchorTransitionFromEpoch': 10,
                'anchorTransitionToEpoch': 11,
                'anchorTransitionCarryoverManifest': {'lastAcceptedEpoch': 10, 'lastAcceptedSequence': 77},
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        expected = per_battle['authenticityModelQuality']['anchorTransitionCarryoverScopeDigestExpected']
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xat2b',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked epoch rollover lineage and validated carryover scope continuity.',
                    'B': 'I mirrored transition scope checks and confirmed deterministic digest parity.',
                },
                'results': [
                    {'txHash': '0x' + '7' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '8' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '9' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'battleMode': 'agent-vs-script',
                'ruleVersion': 'v2',
                'anchorTransitionFromEpoch': 10,
                'anchorTransitionToEpoch': 11,
                'anchorTransitionCarryoverManifest': {'lastAcceptedEpoch': 10, 'lastAcceptedSequence': 77},
                'anchorTransitionCarryoverDigest': expected,
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertTrue(quality['anchorTransitionCarryoverScopeDigestMatch'])
        self.assertFalse(
            any(t.startswith('hard-invalid:anchor-transition-carryover-scope-mismatch:') for t in per_battle['hardInvalidTriggers'])
        )

    def test_compacted_tombstone_missing_replay_guard_forces_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xtg1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked consumed transition ids and caught tombstone compaction missing guard identity.',
                    'B': 'I mirrored replay checks and logged the missing replay guard hash before verdict.',
                },
                'results': [
                    {'txHash': '0x' + '1' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '2' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '3' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'transitionLedgerState': 'compacted-tombstone',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertTrue(quality['transitionLedgerReplayGuardRequired'])
        self.assertFalse(quality['transitionLedgerReplayGuardInvariantSatisfied'])
        self.assertIn(
            'hard-invalid:transition-ledger-compaction-replay-guard-missing:state-compacted-tombstone:hash-None',
            per_battle['hardInvalidTriggers'],
        )
        self.assertEqual(
            per_battle['topHardInvalidTrigger'],
            'hard-invalid:transition-ledger-compaction-replay-guard-missing:state-compacted-tombstone:hash-None',
        )

    def test_compacted_tombstone_with_replay_guard_does_not_trigger_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xtg2',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked consumed transition ids and validated guard continuity post compaction.',
                    'B': 'I mirrored replay checks and confirmed tombstone replay guard persisted.',
                },
                'results': [
                    {'txHash': '0x' + '4' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '5' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '6' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'transitionLedgerState': 'compacted-tombstone',
                'transitionLedgerReplayGuardHash': '0xabc123',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertTrue(quality['transitionLedgerReplayGuardRequired'])
        self.assertTrue(quality['transitionLedgerReplayGuardInvariantSatisfied'])
        self.assertFalse(
            any(t.startswith('hard-invalid:transition-ledger-compaction-replay-guard-missing:') for t in per_battle['hardInvalidTriggers'])
        )

    def test_compaction_defer_budget_exhausted_forces_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xcd1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked deferred compaction retries and flagged budget exhaustion before handoff.',
                    'B': 'I mirrored backpressure counters and logged fail-safe defer overflow at relay.',
                },
                'results': [
                    {'txHash': '0x' + '1' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '2' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '3' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'transitionLedgerCompactionDeferredCount': 7,
                'transitionLedgerCompactionDeferBudget': 5,
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertFalse(quality['transitionLedgerCompactionDeferBudgetWithinCap'])
        self.assertEqual(quality['transitionLedgerCompactionDeferredCount'], 7)
        self.assertEqual(quality['transitionLedgerCompactionDeferBudget'], 5)
        self.assertIn(
            'hard-invalid:compaction-failsafe-defer-budget-exhausted:count-7:budget-5',
            per_battle['hardInvalidTriggers'],
        )
        self.assertEqual(
            per_battle['topHardInvalidTrigger'],
            'hard-invalid:compaction-failsafe-defer-budget-exhausted:count-7:budget-5',
        )

    def test_fairness_active_key_inflation_uses_dust_key_exclusion_and_claim_limiting_trigger(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xfa11',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I isolated the hot relay lane and ignored dust chatter before finalizing the queue.',
                    'B': 'I mirrored the defer ledger and exposed denominator padding before the checkpoint sealed.',
                },
                'results': [
                    {'txHash': '0x' + '7' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '8' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '9' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'fairnessModelActiveKeyMinContribution': 2,
                'fairnessModelDustInflationRatioThreshold': 0.60,
                'transitionLedgerKeyDeferredCounts': {
                    'hot-a': 5,
                    'hot-b': 4,
                    'dust-1': 1,
                    'dust-2': 1,
                    'dust-3': 1,
                    'dust-4': 1,
                },
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertEqual(quality['fairnessModelObservedKeyCount'], 6)
        self.assertEqual(quality['fairnessModelNonDustActiveKeyCount'], 2)
        self.assertEqual(quality['fairnessModelDustKeyCount'], 4)
        self.assertAlmostEqual(quality['fairnessModelDustKeyRatio'], 4 / 6)
        self.assertTrue(quality['fairnessModelActiveKeyInflationSuspected'])
        self.assertIn(
            'hard-invalid:fairness-active-key-inflation-suspected:observed-6:dust-4:ratio-0.6666666666666666:threshold-0.6',
            per_battle['hardInvalidTriggers'],
        )
        self.assertEqual(
            per_battle['topHardInvalidTrigger'],
            'hard-invalid:fairness-active-key-inflation-suspected:observed-6:dust-4:ratio-0.6666666666666666:threshold-0.6',
        )
        self.assertEqual(
            per_battle['topClaimLimitingReason'],
            'hard-invalid:fairness-active-key-inflation-suspected:observed-6:dust-4:ratio-0.6666666666666666:threshold-0.6',
        )
        self.assertEqual(per_battle['topClaimLimitingReasonSource'], 'hard-invalid-trigger')

    def test_compaction_defer_budget_within_cap_does_not_trigger_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xcd2',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked deferred compaction retries and confirmed budget headroom before handoff.',
                    'B': 'I mirrored backpressure counters and validated fail-safe defer bounds.',
                },
                'results': [
                    {'txHash': '0x' + '4' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '5' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '6' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'transitionLedgerCompactionDeferredCount': 3,
                'transitionLedgerCompactionDeferBudget': 5,
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertTrue(quality['transitionLedgerCompactionDeferBudgetWithinCap'])
        self.assertFalse(
            any(t.startswith('hard-invalid:compaction-failsafe-defer-budget-exhausted:') for t in per_battle['hardInvalidTriggers'])
        )

    def test_migration_anchor_untrusted_source_forces_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xma1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I traced migration anchors and caught an injected source before expiry check.',
                    'B': 'I mirrored the policy gate and logged untrusted anchor provenance in the ledger.',
                },
                'results': [
                    {'txHash': '0x' + 'a' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + 'b' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + 'c' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'policyMigrationEvaluationMode': 'strict-anchor',
                'policyMigrationEvaluationAnchorSource': 'producer',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertFalse(quality['migrationAnchorSourceTrusted'])
        self.assertEqual(quality['policyMigrationEvaluationMode'], 'strict-anchor')
        self.assertEqual(quality['policyMigrationEvaluationAnchorSource'], 'producer')
        self.assertIn(
            'hard-invalid:migration-expiry-anchor-untrusted-source:mode-strict-anchor:source-producer',
            per_battle['hardInvalidTriggers'],
        )
        self.assertEqual(
            per_battle['topHardInvalidTrigger'],
            'hard-invalid:migration-expiry-anchor-untrusted-source:mode-strict-anchor:source-producer',
        )

    def test_migration_anchor_trusted_source_does_not_trigger_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xma2',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I traced migration anchors and confirmed verifier-signed provenance for expiry.',
                    'B': 'I mirrored the policy gate and validated trusted anchor lineage.',
                },
                'results': [
                    {'txHash': '0x' + 'd' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + 'e' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + 'f' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'policyMigrationEvaluationMode': 'strict-anchor',
                'policyMigrationEvaluationAnchorSource': 'verifier-signed',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertTrue(quality['migrationAnchorSourceTrusted'])
        self.assertFalse(
            any(t.startswith('hard-invalid:migration-expiry-anchor-untrusted-source:') for t in per_battle['hardInvalidTriggers'])
        )

    def test_safety_envelope_fingerprint_version_mismatch_forces_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xsf1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I traced the timeout envelope and pinned the drift before rule handoff.',
                    'B': 'I mirrored the profile path and logged the replay attempt at the relay.',
                },
                'results': [
                    {'txHash': '0x' + 'b' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + 'c' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + 'd' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'battleMode': 'agent-vs-script',
                'ruleVersion': 'v1',
                'ruleHash': 'rule-abc',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'timeoutCapSafetyEnvelope': {
                    'decisionDeterminismFingerprint': 'deadbeef',
                },
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertFalse(quality['fingerprintVersionMatch'])
        self.assertEqual(quality['reportedDecisionDeterminismFingerprint'], 'deadbeef')
        self.assertIn(
            'hard-invalid:safety-envelope-fingerprint-version-mismatch:',
            per_battle['topHardInvalidTrigger'],
        )

    def test_safety_envelope_without_reported_fingerprint_does_not_trigger_mismatch(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xsf2',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I traced the timeout envelope and pinned the drift before rule handoff.',
                    'B': 'I mirrored the profile path and logged the replay attempt at the relay.',
                },
                'results': [
                    {'txHash': '0x' + 'e' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + 'f' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '1' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'battleMode': 'agent-vs-script',
                'ruleVersion': 'v1',
                'ruleHash': 'rule-abc',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertTrue(quality['fingerprintVersionMatch'])
        self.assertFalse(
            any(t.startswith('hard-invalid:safety-envelope-fingerprint-version-mismatch:') for t in per_battle['hardInvalidTriggers'])
        )

    def test_timing_window_profile_mismatch_forces_hard_invalid_trigger(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xtw1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked the relay corridor and marked the forged lane before dawn patrol shifted.',
                    'B': 'I mirrored the manifest handoff and rerouted the courier while scanners recalibrated.',
                },
                'results': [
                    {'txHash': '0x' + '0' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '1' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '2' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'authenticityFreshnessWindowMsProfile': 300000,
                'evidenceFreshnessWindowMs': 900000,
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertFalse(quality['freshnessWindowProfileMatch'])
        self.assertEqual(quality['authenticityFreshnessWindowMsProfile'], 300000)
        self.assertEqual(quality['evidenceFreshnessWindowMsReported'], 900000)
        self.assertIn(
            'hard-invalid:timing-window-profile-mismatch:expected-300000:got-900000',
            per_battle['hardInvalidTriggers'],
        )
        self.assertEqual(
            per_battle['topHardInvalidTrigger'],
            'hard-invalid:timing-window-profile-mismatch:expected-300000:got-900000',
        )

    def test_closure_policy_hash_mismatch_forces_hard_invalid_trigger(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xcp1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked provenance partitions and flagged the downgraded evidence set.',
                    'B': 'I mirrored closure manifest inputs and logged the policy drift attempt.',
                },
                'results': [
                    {'txHash': '0x' + '1' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '2' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '3' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'closureKeyClassificationPolicy': {
                    'requiredCoreEvidenceKeys': ['sourceOfMove.A.kind', 'sourceOfMove.B.kind'],
                    'optionalEvidenceKeys': ['checkpoint.results'],
                },
                'evidenceClosureManifest': {
                    'closureKeyClassificationPolicyHash': 'deadbeef',
                },
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertFalse(quality['closureKeyClassificationPolicyHashMatch'])
        self.assertEqual(quality['closureKeyClassificationPolicyHashReported'], 'deadbeef')
        self.assertIn(
            'hard-invalid:closure-key-classification-downgrade:',
            per_battle['topHardInvalidTrigger'],
        )

    def test_closure_policy_hash_match_does_not_trigger_hard_invalid(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xcp2',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked provenance partitions and confirmed stable required-core policy.',
                    'B': 'I mirrored closure manifest inputs and validated policy hash parity.',
                },
                'results': [
                    {'txHash': '0x' + '4' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '5' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '6' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'closureKeyClassificationPolicy': {
                    'requiredCoreEvidenceKeys': ['sourceOfMove.A.kind', 'sourceOfMove.B.kind'],
                    'optionalEvidenceKeys': ['checkpoint.results'],
                },
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertTrue(quality['closureKeyClassificationPolicyHashMatch'])
        self.assertFalse(
            any(t.startswith('hard-invalid:closure-key-classification-downgrade:') for t in per_battle['hardInvalidTriggers'])
        )

    def test_timeout_allowance_aggregate_exceeded_forces_hard_invalid_trigger(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xta1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked timeout bursts across sectors and tagged the overloaded route.',
                    'B': 'I mirrored retries and logged subtype churn while channels destabilized.',
                },
                'results': [
                    {'txHash': '0x' + '1' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '2' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '3' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'timeoutSubtypeAllowanceBudget': {
                    'runtime/timeout-response': 5,
                    'runtime/timeout-connect': 5,
                },
                'timeoutSubtypeAllowanceUsed': {
                    'runtime/timeout-response': 7,
                    'runtime/timeout-connect': 6,
                },
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertEqual(quality['timeoutSubtypeAllowanceBudgetAggregate'], 10)
        self.assertEqual(quality['timeoutSubtypeAllowanceUsedAggregate'], 13)
        self.assertFalse(quality['aggregateAllowanceWithinCap'])
        self.assertIn(
            'hard-invalid:timeout-allowance-aggregate-exceeded:budget-10:used-13',
            per_battle['hardInvalidTriggers'],
        )
        self.assertEqual(
            per_battle['topHardInvalidTrigger'],
            'hard-invalid:timeout-allowance-aggregate-exceeded:budget-10:used-13',
        )

    def test_timeout_allowance_aggregate_within_cap_does_not_trigger(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xta2',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I tracked timeout bursts across sectors and tagged the overloaded route.',
                    'B': 'I mirrored retries and logged subtype churn while channels destabilized.',
                },
                'results': [
                    {'txHash': '0x' + '4' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '5' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '6' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'timeoutSubtypeAllowanceBudget': {
                    'runtime/timeout-response': 6,
                    'runtime/timeout-connect': 6,
                },
                'timeoutSubtypeAllowanceUsed': {
                    'runtime/timeout-response': 4,
                    'runtime/timeout-connect': 5,
                },
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertEqual(quality['timeoutSubtypeAllowanceBudgetAggregate'], 12)
        self.assertEqual(quality['timeoutSubtypeAllowanceUsedAggregate'], 9)
        self.assertTrue(quality['aggregateAllowanceWithinCap'])
        self.assertFalse(
            any(t.startswith('hard-invalid:timeout-allowance-aggregate-exceeded:') for t in per_battle['hardInvalidTriggers'])
        )

    def test_authenticity_model_quality_fails_closed_for_single_source_evidence(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xaq1',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I traced the relay route and marked the forged waypoint before sunrise.',
                    'B': 'I mirrored the handoff and redirected the courier while scanners rotated.',
                },
                'results': [
                    {'txHash': '0x' + 'd' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + 'e' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + 'f' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'authenticityEvidenceSources': ['metadata.sourceOfMove'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertTrue(quality['requiredFieldsPresent'])
        self.assertEqual(quality['evidenceSourceCount'], 1)
        self.assertFalse(quality['independentSourcePresent'])
        self.assertFalse(quality['completenessSatisfied'])
        self.assertTrue(quality['failsClosed'])

    def test_authenticity_model_quality_passes_with_independent_multi_source_evidence(self) -> None:
        per_battle = self._build_per_battle(
            log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
            checkpoint={
                'battle': '0xaq2',
                'lastTurn': 2,
                'lastNarrativeByAgent': {
                    'A': 'I traced the relay route and marked the forged waypoint before sunrise.',
                    'B': 'I mirrored the handoff and redirected the courier while scanners rotated.',
                },
                'results': [
                    {'txHash': '0x' + '1' * 64, 'bankA': '400', 'bankB': '400'},
                    {'txHash': '0x' + '2' * 64, 'bankA': '370', 'bankB': '400'},
                    {'txHash': '0x' + '3' * 64, 'bankA': '340', 'bankB': '390'},
                ],
            },
            metadata={
                'executionOutcome': 'clean-exit',
                'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                'sourceOfMove': {
                    'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                    'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                },
            },
        )

        quality = per_battle['authenticityModelQuality']
        self.assertEqual(quality['evidenceSourceCount'], 2)
        self.assertTrue(quality['independentSourcePresent'])
        self.assertTrue(quality['completenessSatisfied'])
        self.assertFalse(quality['failsClosed'])

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

    def test_markdown_surfaces_fairness_active_key_inflation_trigger(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            payload = self._build_per_battle_with_tmp(
                root=Path(tmp),
                log_text='''\n✅ v05 loop complete. saved checkpoint=/tmp/x.json\n''',
                checkpoint={
                    'battle': '0xfa12',
                    'lastTurn': 2,
                    'lastNarrativeByAgent': {
                        'A': 'I isolated the hot relay lane and ignored dust chatter before finalizing the queue.',
                        'B': 'I mirrored the defer ledger and exposed denominator padding before the checkpoint sealed.',
                    },
                    'results': [
                        {'txHash': '0x' + 'a' * 64, 'bankA': '400', 'bankB': '400'},
                        {'txHash': '0x' + 'b' * 64, 'bankA': '370', 'bankB': '400'},
                        {'txHash': '0x' + 'c' * 64, 'bankA': '340', 'bankB': '390'},
                    ],
                },
                metadata={
                    'executionOutcome': 'clean-exit',
                    'fairnessModelActiveKeyMinContribution': 2,
                    'fairnessModelDustInflationRatioThreshold': 0.60,
                    'transitionLedgerKeyDeferredCounts': {
                        'hot-a': 5,
                        'hot-b': 4,
                        'dust-1': 1,
                        'dust-2': 1,
                        'dust-3': 1,
                        'dust-4': 1,
                    },
                    'authenticityEvidenceSources': ['metadata.sourceOfMove', 'checkpoint.results'],
                    'sourceOfMove': {
                        'A': {'kind': 'gateway-agent', 'strategy': 'gateway', 'agentName': 'fighter'},
                        'B': {'kind': 'docker-agent', 'strategy': 'docker-agent', 'agentName': 'clawnjr'},
                    },
                },
            )
            md_path = payload['summaries'] / 'fairness-active-key-inflation.md'
            MODULE.write_markdown(md_path, payload['per_battle'])
            md_text = md_path.read_text(encoding='utf-8')

        self.assertIn('activeKeyInflationSuspected=`True`', md_text)
        self.assertIn(
            '- top hard invalid trigger: `hard-invalid:fairness-active-key-inflation-suspected:observed-6:dust-4:ratio-0.6666666666666666:threshold-0.6`',
            md_text,
        )
        self.assertIn(
            '- top claim-limiting reason: `hard-invalid:fairness-active-key-inflation-suspected:observed-6:dust-4:ratio-0.6666666666666666:threshold-0.6` (hard-invalid-trigger)',
            md_text,
        )

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
