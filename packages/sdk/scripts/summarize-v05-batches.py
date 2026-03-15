#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
RESULTS_DIR = ROOT / 'battle-results'
CHECKPOINTS_DIR = RESULTS_DIR / 'checkpoints'
METADATA_DIR = RESULTS_DIR / 'metadata'
SUMMARIES_DIR = RESULTS_DIR / 'summaries'

KNOWN_MECHANICS = [
    'first-turn-submit',
    'multi-turn',
    'active-poison',
    'settlement',
]

WARNING_CLASS_ORDER = [
    'label-control-blank',
    'label-intervention-blank',
    'label-collapse',
    'max-turns-mismatch',
]

COMPARABILITY_REASON_ORDER = [
    'missing-baseline',
    'strict-violation',
    'guardrail-failure',
    'runconfig-drift-outside-allowed-variable',
]

DEFAULT_CONTROL_LABEL = 'baseline-same-regime'
DEFAULT_INTERVENTION_LABEL = 'same-regime'
LATER_TURN_THRESHOLD = 3
WORD_RE = re.compile(r"[A-Za-z']+")
KNOWN_FALLBACK_PHRASES = [
    'Sequence remains coherent.',
    'Timing stays aligned.',
    'Route pressure is contained.',
    'Signal path remains stable.',
]
KNOWN_TEMPLATE_MARKERS = [
    'ledger marks',
    'chain keeps',
    'relay holds firm',
]
MIN_SCENE_WORDS = 8
LOW_UNIQUE_RATIO_THRESHOLD = 0.55
PROPER_BATTLE_REASON_PRIORITY_PREFIXES = [
    'source-of-move-unknown:',
    'execution-outcome:',
    'gameplay-outcome:',
    'insufficient-live-turn-evidence',
    'proper-battle-rubric-pending',
]
HARD_INVALID_TRIGGER_PRIORITY_PREFIXES = [
    'hard-invalid:source-of-move-unknown:',
    'hard-invalid:provenance-mismatch:',
    'hard-invalid:failure-class-derivation-mismatch:',
    'hard-invalid:closure-key-classification-downgrade:',
    'hard-invalid:anchor-transition-carryover-scope-mismatch:',
    'hard-invalid:transition-ledger-compaction-replay-guard-missing',
    'hard-invalid:migration-expiry-anchor-untrusted-source',
    'hard-invalid:safety-envelope-fingerprint-version-mismatch:',
    'hard-invalid:timing-window-profile-mismatch',
    'hard-invalid:timeout-allowance-aggregate-exceeded',
    'hard-invalid:severe-transcript-quality-failure',
    'hard-invalid:severe-execution-ambiguity:',
    'hard-invalid:pre-submit-collapse',
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


def classify_failure(error_line: str | None) -> str:
    if not error_line:
        return 'none'

    line = error_line.lower()

    # Interface/ABI decode failures
    if 'pendingvop' in line:
        return 'interface-decode/pending-vop'
    if 'pendingncc' in line:
        return 'interface-decode/pending-ncc'
    if 'bad_data' in line or 'could not decode result data' in line or 'decode' in line:
        return 'interface-decode/generic'

    # Runtime subtypes (keep deterministic + conservative)
    if any(token in line for token in (
        'candidate encoding failed',
        'turn construction',
        'turn-construction',
        'narrative validation',
        'template failed',
    )):
        return 'runtime/turn-construction'

    if any(token in line for token in (
        'estimategas',
        'estimate gas',
        'gas estimation',
    )):
        return 'runtime/submit-estimation'

    if any(token in line for token in (
        'submitturn',
        'send transaction',
        'transaction failed',
        'tx failed',
        'replacement transaction underpriced',
        'nonce too low',
    )):
        return 'runtime/submit-transaction'

    if any(token in line for token in (
        'checkpoint',
        'battle state',
        'state probe',
        'phase=',
        'currentturn=',
        'banka=',
        'bankb=',
    )):
        return 'runtime/checkpoint-or-state'

    return 'runtime/generic'


def normalize_source_of_move(metadata: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    raw = (metadata or {}).get('sourceOfMove') if isinstance(metadata, dict) else None
    out: dict[str, dict[str, Any]] = {}
    for side in ('A', 'B'):
        value = raw.get(side) if isinstance(raw, dict) else None
        if not isinstance(value, dict):
            out[side] = {
                'kind': 'unknown',
                'strategy': None,
                'agentName': None,
            }
            continue
        out[side] = {
            'kind': value.get('kind') or 'unknown',
            'strategy': value.get('strategy'),
            'agentName': value.get('agentName'),
        }
    return out


def expected_kind_for_strategy(strategy: Any) -> str | None:
    if not isinstance(strategy, str):
        return None
    normalized = strategy.strip().lower()
    if not normalized:
        return None
    if normalized in {'script', 'local-script'}:
        return 'local-script'
    if normalized in {'gateway', 'gateway-agent'}:
        return 'gateway-agent'
    if normalized in {'docker', 'docker-agent'}:
        return 'docker-agent'
    return None


def extract_reported_failure_class(metadata: dict[str, Any] | None) -> str | None:
    if not isinstance(metadata, dict):
        return None
    direct = metadata.get('failureClass')
    if isinstance(direct, str) and direct.strip():
        return direct.strip()
    timing_ctx = metadata.get('timingWindowCalibrationContext')
    if isinstance(timing_ctx, dict):
        nested = timing_ctx.get('failureClass')
        if isinstance(nested, str) and nested.strip():
            return nested.strip()
    return None


def normalize_authenticity_evidence_sources(
    *,
    metadata: dict[str, Any] | None,
    turns_mined: int,
    battle_id_present: bool,
) -> list[str]:
    explicit = (metadata or {}).get('authenticityEvidenceSources') if isinstance(metadata, dict) else None
    if isinstance(explicit, list):
        normalized: list[str] = []
        for item in explicit:
            if isinstance(item, str) and item.strip():
                value = item.strip()
                if value not in normalized:
                    normalized.append(value)
        if normalized:
            return normalized

    inferred = ['metadata.sourceOfMove']
    if turns_mined > 0:
        inferred.append('checkpoint.results')
    if battle_id_present:
        inferred.append('log.battle-created')
    return inferred


def normalize_numeric_map(raw: Any) -> dict[str, int]:
    if not isinstance(raw, dict):
        return {}
    out: dict[str, int] = {}
    for key, value in raw.items():
        if not isinstance(key, str) or not key.strip():
            continue
        if isinstance(value, (int, float)):
            out[key.strip()] = int(value)
    return out


def compute_decision_determinism_fingerprint(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=True)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def normalize_key_classification_policy(raw: Any) -> dict[str, list[str]]:
    if not isinstance(raw, dict):
        raw = {}

    def _normalized_list(value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        out: list[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                token = item.strip()
                if token not in out:
                    out.append(token)
        return sorted(out)

    return {
        'requiredCoreEvidenceKeys': _normalized_list(raw.get('requiredCoreEvidenceKeys')),
        'optionalEvidenceKeys': _normalized_list(raw.get('optionalEvidenceKeys')),
    }


def compute_key_classification_policy_hash(policy: dict[str, list[str]]) -> str:
    canonical = json.dumps(policy, sort_keys=True, separators=(',', ':'), ensure_ascii=True)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def compute_anchor_transition_carryover_scope_digest(payload: dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, separators=(',', ':'), ensure_ascii=True)
    return hashlib.sha256(canonical.encode('utf-8')).hexdigest()


def evaluate_authenticity_model_quality(
    *,
    source_of_move: dict[str, dict[str, Any]],
    evidence_sources: list[str],
    metadata: dict[str, Any] | None,
) -> dict[str, Any]:
    required_fields = ('kind', 'strategy')
    required_present = all(
        all(source_of_move.get(side, {}).get(field) not in (None, '') for field in required_fields)
        for side in ('A', 'B')
    )
    evidence_source_count = len(evidence_sources)
    independent_source_present = any(not source.startswith('metadata.') for source in evidence_sources)

    profile_window_raw = (metadata or {}).get('authenticityFreshnessWindowMsProfile')
    reported_window_raw = (metadata or {}).get('evidenceFreshnessWindowMs')
    profile_window_ms = int(profile_window_raw) if isinstance(profile_window_raw, (int, float)) else 300000
    reported_window_ms = (
        int(reported_window_raw)
        if isinstance(reported_window_raw, (int, float))
        else profile_window_ms
    )
    freshness_window_profile_match = reported_window_ms == profile_window_ms

    timeout_budget = normalize_numeric_map((metadata or {}).get('timeoutSubtypeAllowanceBudget'))
    timeout_used = normalize_numeric_map((metadata or {}).get('timeoutSubtypeAllowanceUsed'))
    aggregate_budget = sum(timeout_budget.values())
    aggregate_used = sum(timeout_used.values())
    aggregate_allowance_within_cap = aggregate_used <= aggregate_budget if aggregate_budget > 0 else True

    mode_profile = (metadata or {}).get('battleMode') if isinstance((metadata or {}).get('battleMode'), str) else 'unknown-mode'
    rule_version = (metadata or {}).get('ruleVersion') if isinstance((metadata or {}).get('ruleVersion'), str) else 'v0'
    rule_hash = (metadata or {}).get('ruleHash') if isinstance((metadata or {}).get('ruleHash'), str) else 'rule-default'
    mode_profile_hash = hashlib.sha256(mode_profile.encode('utf-8')).hexdigest()[:16]

    policy = normalize_key_classification_policy((metadata or {}).get('closureKeyClassificationPolicy'))
    expected_policy_hash = compute_key_classification_policy_hash(policy)
    manifest = (metadata or {}).get('evidenceClosureManifest') if isinstance((metadata or {}).get('evidenceClosureManifest'), dict) else {}
    reported_policy_hash = manifest.get('closureKeyClassificationPolicyHash') if isinstance(manifest.get('closureKeyClassificationPolicyHash'), str) else None
    key_classification_policy_hash_match = (reported_policy_hash == expected_policy_hash) if reported_policy_hash else True

    fingerprint_payload = {
        'ruleVersion': rule_version,
        'ruleHash': rule_hash,
        'modeProfileHash': mode_profile_hash,
        'evidenceSources': sorted(evidence_sources),
        'timeoutSubtypeAllowanceBudgetAggregate': aggregate_budget,
        'timeoutSubtypeAllowanceUsedAggregate': aggregate_used,
    }
    computed_fingerprint = compute_decision_determinism_fingerprint(fingerprint_payload)

    safety_envelope = (metadata or {}).get('timeoutCapSafetyEnvelope') if isinstance((metadata or {}).get('timeoutCapSafetyEnvelope'), dict) else {}
    reported_fingerprint = safety_envelope.get('decisionDeterminismFingerprint') if isinstance(safety_envelope.get('decisionDeterminismFingerprint'), str) else None
    fingerprint_version_match = (reported_fingerprint == computed_fingerprint) if reported_fingerprint else True

    migration_mode = (metadata or {}).get('policyMigrationEvaluationMode')
    migration_mode_normalized = migration_mode.strip().lower() if isinstance(migration_mode, str) and migration_mode.strip() else 'legacy-clock'
    anchor_source = (metadata or {}).get('policyMigrationEvaluationAnchorSource')
    anchor_source_normalized = anchor_source.strip().lower() if isinstance(anchor_source, str) and anchor_source.strip() else 'unknown'
    migration_anchor_source_trusted = (
        True
        if migration_mode_normalized != 'strict-anchor'
        else anchor_source_normalized in {'verifier', 'verifier-signed'}
    )

    carryover_manifest = (metadata or {}).get('anchorTransitionCarryoverManifest')
    if not isinstance(carryover_manifest, dict):
        carryover_manifest = {}
    from_epoch = int((metadata or {}).get('anchorTransitionFromEpoch')) if isinstance((metadata or {}).get('anchorTransitionFromEpoch'), (int, float)) else 0
    to_epoch = int((metadata or {}).get('anchorTransitionToEpoch')) if isinstance((metadata or {}).get('anchorTransitionToEpoch'), (int, float)) else 0
    carryover_scope_payload = {
        'ruleVersion': rule_version,
        'modeProfileHash': mode_profile_hash,
        'fromEpoch': from_epoch,
        'toEpoch': to_epoch,
        'requiredLineageManifestHash': compute_decision_determinism_fingerprint(carryover_manifest),
    }
    expected_carryover_scope_digest = compute_anchor_transition_carryover_scope_digest(carryover_scope_payload)
    reported_carryover_scope_digest = (
        (metadata or {}).get('anchorTransitionCarryoverDigest')
        if isinstance((metadata or {}).get('anchorTransitionCarryoverDigest'), str)
        else None
    )
    carryover_scope_digest_match = (
        reported_carryover_scope_digest == expected_carryover_scope_digest
        if reported_carryover_scope_digest
        else True
    )

    transition_ledger_state = (
        (metadata or {}).get('transitionLedgerState')
        if isinstance((metadata or {}).get('transitionLedgerState'), str)
        else None
    )
    if isinstance(transition_ledger_state, str):
        transition_ledger_state = transition_ledger_state.strip().lower()
    transition_ledger_replay_guard_hash = (
        (metadata or {}).get('transitionLedgerReplayGuardHash')
        if isinstance((metadata or {}).get('transitionLedgerReplayGuardHash'), str)
        else None
    )
    transition_ledger_replay_guard_present = bool(
        isinstance(transition_ledger_replay_guard_hash, str) and transition_ledger_replay_guard_hash.strip()
    )
    transition_ledger_replay_guard_required = transition_ledger_state == 'compacted-tombstone'
    transition_ledger_replay_guard_invariant_satisfied = (
        transition_ledger_replay_guard_present if transition_ledger_replay_guard_required else True
    )

    completeness_satisfied = (
        required_present
        and evidence_source_count >= 2
        and independent_source_present
        and freshness_window_profile_match
        and aggregate_allowance_within_cap
        and key_classification_policy_hash_match
        and migration_anchor_source_trusted
        and carryover_scope_digest_match
        and transition_ledger_replay_guard_invariant_satisfied
        and fingerprint_version_match
    )
    correctness_satisfied = True
    fails_closed = not (correctness_satisfied and completeness_satisfied)

    return {
        'requiredFields': list(required_fields),
        'requiredFieldsPresent': required_present,
        'evidenceSources': evidence_sources,
        'evidenceSourceCount': evidence_source_count,
        'independentSourcePresent': independent_source_present,
        'authenticityFreshnessWindowMsProfile': profile_window_ms,
        'evidenceFreshnessWindowMsReported': reported_window_ms,
        'freshnessWindowProfileMatch': freshness_window_profile_match,
        'timeoutSubtypeAllowanceBudget': timeout_budget,
        'timeoutSubtypeAllowanceUsed': timeout_used,
        'timeoutSubtypeAllowanceBudgetAggregate': aggregate_budget,
        'timeoutSubtypeAllowanceUsedAggregate': aggregate_used,
        'aggregateAllowanceWithinCap': aggregate_allowance_within_cap,
        'ruleVersion': rule_version,
        'ruleHash': rule_hash,
        'modeProfile': mode_profile,
        'modeProfileHash': mode_profile_hash,
        'closureKeyClassificationPolicy': policy,
        'closureKeyClassificationPolicyHashExpected': expected_policy_hash,
        'closureKeyClassificationPolicyHashReported': reported_policy_hash,
        'closureKeyClassificationPolicyHashMatch': key_classification_policy_hash_match,
        'policyMigrationEvaluationMode': migration_mode_normalized,
        'policyMigrationEvaluationAnchorSource': anchor_source_normalized,
        'migrationAnchorSourceTrusted': migration_anchor_source_trusted,
        'anchorTransitionFromEpoch': from_epoch,
        'anchorTransitionToEpoch': to_epoch,
        'anchorTransitionCarryoverScopeDigestExpected': expected_carryover_scope_digest,
        'anchorTransitionCarryoverScopeDigestReported': reported_carryover_scope_digest,
        'anchorTransitionCarryoverScopeDigestMatch': carryover_scope_digest_match,
        'transitionLedgerState': transition_ledger_state,
        'transitionLedgerReplayGuardHash': transition_ledger_replay_guard_hash,
        'transitionLedgerReplayGuardRequired': transition_ledger_replay_guard_required,
        'transitionLedgerReplayGuardInvariantSatisfied': transition_ledger_replay_guard_invariant_satisfied,
        'decisionDeterminismFingerprint': computed_fingerprint,
        'reportedDecisionDeterminismFingerprint': reported_fingerprint,
        'fingerprintVersionMatch': fingerprint_version_match,
        'correctnessSatisfied': correctness_satisfied,
        'completenessSatisfied': completeness_satisfied,
        'failsClosed': fails_closed,
    }


def classify_execution_outcome(
    *,
    log_text: str,
    failure_class: str,
    metadata: dict[str, Any] | None,
    turns_mined: int,
) -> str:
    metadata_outcome = (metadata or {}).get('executionOutcome')
    if isinstance(metadata_outcome, str) and metadata_outcome.strip():
        normalized = metadata_outcome.strip().lower()
        if normalized == 'started':
            return 'supervisor-interrupted' if turns_mined > 0 else 'unknown'
        return normalized

    if 'sigterm' in log_text.lower():
        return 'sigterm'
    if 'timed out' in log_text.lower() or 'timeout' in log_text.lower():
        return 'timeout'
    if failure_class != 'none':
        return 'runner-error'
    if '✅ v05 loop complete' in log_text:
        return 'clean-exit'
    if turns_mined > 0:
        return 'supervisor-interrupted'
    return 'unknown'


def classify_gameplay_outcome(
    *,
    log_summary: dict[str, Any],
    turns_mined: int,
    execution_outcome: str,
) -> str:
    if log_summary.get('settledHint'):
        return 'terminal'
    if turns_mined <= 0 and execution_outcome in {'runner-error', 'timeout', 'sigterm'}:
        return 'pre-submit-failure'
    if turns_mined > 0 and execution_outcome in {'supervisor-interrupted', 'timeout', 'sigterm'}:
        return 'mid-battle-interrupted'
    if turns_mined > 0:
        return 'non-terminal'
    return 'unknown'


def evaluate_proper_battle_contract(
    *,
    execution_outcome: str,
    gameplay_outcome: str,
    source_of_move: dict[str, dict[str, Any]],
    turns_mined: int,
) -> tuple[bool, list[str]]:
    reasons: list[str] = []
    if execution_outcome != 'clean-exit':
        reasons.append(f'execution-outcome:{execution_outcome}')
    if gameplay_outcome != 'terminal':
        reasons.append(f'gameplay-outcome:{gameplay_outcome}')
    if turns_mined < 2:
        reasons.append('insufficient-live-turn-evidence')
    for side in ('A', 'B'):
        side_kind = source_of_move.get(side, {}).get('kind')
        if side_kind == 'unknown':
            reasons.append(f'source-of-move-unknown:{side}')
    if not reasons:
        reasons.append('proper-battle-rubric-pending')
    return False, reasons


def reason_priority_index(reason: str, priority_prefixes: list[str]) -> tuple[int, str]:
    for index, prefix in enumerate(priority_prefixes):
        if reason.startswith(prefix):
            return index, reason
    return len(priority_prefixes), reason



def sort_reasons_by_priority(reasons: list[str], priority_prefixes: list[str]) -> list[str]:
    return sorted(reasons, key=lambda reason: reason_priority_index(reason, priority_prefixes))



def select_top_reason(reasons: list[str], priority_prefixes: list[str]) -> str | None:
    ordered = sort_reasons_by_priority(reasons, priority_prefixes)
    return ordered[0] if ordered else None



def evaluate_hard_invalid_triggers(
    *,
    execution_outcome: str,
    gameplay_outcome: str,
    source_of_move: dict[str, dict[str, Any]],
    turns_mined: int,
    transcript_quality_failure_reasons: list[str],
    authenticity_model_quality: dict[str, Any],
    failure_class: str,
    reported_failure_class: str | None,
) -> list[str]:
    triggers: list[str] = []

    for side in ('A', 'B'):
        side_payload = source_of_move.get(side, {})
        side_kind = side_payload.get('kind')
        if side_kind == 'unknown':
            triggers.append(f'hard-invalid:source-of-move-unknown:{side}')
            continue

        expected_kind = expected_kind_for_strategy(side_payload.get('strategy'))
        if expected_kind and side_kind != expected_kind:
            triggers.append(
                f'hard-invalid:provenance-mismatch:{side}:expected-{expected_kind}:got-{side_kind}'
            )

    if isinstance(reported_failure_class, str) and reported_failure_class.strip():
        normalized_reported = reported_failure_class.strip().lower()
        normalized_derived = (failure_class or 'none').strip().lower()
        if normalized_reported != normalized_derived:
            triggers.append(
                f'hard-invalid:failure-class-derivation-mismatch:derived-{normalized_derived}:reported-{normalized_reported}'
            )

    if not authenticity_model_quality.get('closureKeyClassificationPolicyHashMatch', True):
        expected_policy_hash = authenticity_model_quality.get('closureKeyClassificationPolicyHashExpected')
        reported_policy_hash = authenticity_model_quality.get('closureKeyClassificationPolicyHashReported')
        triggers.append(
            f'hard-invalid:closure-key-classification-downgrade:expected-{expected_policy_hash}:reported-{reported_policy_hash}'
        )

    if not authenticity_model_quality.get('anchorTransitionCarryoverScopeDigestMatch', True):
        expected_digest = authenticity_model_quality.get('anchorTransitionCarryoverScopeDigestExpected')
        reported_digest = authenticity_model_quality.get('anchorTransitionCarryoverScopeDigestReported')
        triggers.append(
            f'hard-invalid:anchor-transition-carryover-scope-mismatch:expected-{expected_digest}:reported-{reported_digest}'
        )

    if not authenticity_model_quality.get('transitionLedgerReplayGuardInvariantSatisfied', True):
        state = authenticity_model_quality.get('transitionLedgerState')
        reported_hash = authenticity_model_quality.get('transitionLedgerReplayGuardHash')
        triggers.append(
            f'hard-invalid:transition-ledger-compaction-replay-guard-missing:state-{state}:hash-{reported_hash}'
        )

    if not authenticity_model_quality.get('migrationAnchorSourceTrusted', True):
        migration_mode = authenticity_model_quality.get('policyMigrationEvaluationMode')
        anchor_source = authenticity_model_quality.get('policyMigrationEvaluationAnchorSource')
        triggers.append(
            f'hard-invalid:migration-expiry-anchor-untrusted-source:mode-{migration_mode}:source-{anchor_source}'
        )

    if not authenticity_model_quality.get('fingerprintVersionMatch', True):
        rule_version = authenticity_model_quality.get('ruleVersion')
        rule_hash = authenticity_model_quality.get('ruleHash')
        computed = authenticity_model_quality.get('decisionDeterminismFingerprint')
        reported = authenticity_model_quality.get('reportedDecisionDeterminismFingerprint')
        triggers.append(
            f'hard-invalid:safety-envelope-fingerprint-version-mismatch:rule-{rule_version}:{rule_hash}:computed-{computed}:reported-{reported}'
        )

    if not authenticity_model_quality.get('freshnessWindowProfileMatch', True):
        expected_window = authenticity_model_quality.get('authenticityFreshnessWindowMsProfile')
        reported_window = authenticity_model_quality.get('evidenceFreshnessWindowMsReported')
        triggers.append(
            f'hard-invalid:timing-window-profile-mismatch:expected-{expected_window}:got-{reported_window}'
        )

    if not authenticity_model_quality.get('aggregateAllowanceWithinCap', True):
        aggregate_budget = authenticity_model_quality.get('timeoutSubtypeAllowanceBudgetAggregate')
        aggregate_used = authenticity_model_quality.get('timeoutSubtypeAllowanceUsedAggregate')
        triggers.append(
            f'hard-invalid:timeout-allowance-aggregate-exceeded:budget-{aggregate_budget}:used-{aggregate_used}'
        )

    if gameplay_outcome == 'pre-submit-failure' or (turns_mined == 0 and execution_outcome in {'runner-error', 'timeout', 'sigterm', 'unknown'}):
        triggers.append('hard-invalid:pre-submit-collapse')

    if execution_outcome in {'timeout', 'sigterm', 'unknown'}:
        triggers.append(f'hard-invalid:severe-execution-ambiguity:{execution_outcome}')
    elif execution_outcome == 'supervisor-interrupted' and turns_mined < 2:
        triggers.append('hard-invalid:severe-execution-ambiguity:supervisor-interrupted-insufficient-evidence')

    failure_reason_set = set(transcript_quality_failure_reasons)
    if {
        'repetition-risk-elevated',
        'fallback-masquerade-risk',
    }.issubset(failure_reason_set):
        triggers.append('hard-invalid:severe-transcript-quality-failure')

    deduped: list[str] = []
    for trigger in triggers:
        if trigger not in deduped:
            deduped.append(trigger)
    return deduped


def word_tokens(text: str) -> list[str]:
    return [token.lower() for token in WORD_RE.findall(text)]


def extract_narrative_samples(checkpoint: dict[str, Any] | None) -> dict[str, str]:
    raw = (checkpoint or {}).get('lastNarrativeByAgent')
    if not isinstance(raw, dict):
        return {}
    out: dict[str, str] = {}
    for side in ('A', 'B'):
        value = raw.get(side)
        if isinstance(value, str) and value.strip():
            out[side] = value.strip()
    return out


def unique_token_ratio(text: str) -> float:
    tokens = word_tokens(text)
    if not tokens:
        return 0.0
    return len(set(tokens)) / len(tokens)


def evaluate_transcript_quality(*, checkpoint: dict[str, Any] | None, log_text: str) -> dict[str, Any]:
    narrative_samples = extract_narrative_samples(checkpoint)
    sample_values = list(narrative_samples.values())
    normalized_samples = [' '.join(word_tokens(text)) for text in sample_values]
    fallback_phrase_detected = any(
        phrase.lower() in text.lower()
        for text in sample_values
        for phrase in KNOWN_FALLBACK_PHRASES
    )
    template_marker_detected = any(
        marker.lower() in text.lower()
        for text in sample_values
        for marker in KNOWN_TEMPLATE_MARKERS
    )
    repeated_sample_detected = len(normalized_samples) >= 2 and len(set(normalized_samples)) < len(normalized_samples)
    low_unique_ratio_detected = any(
        len(word_tokens(text)) >= MIN_SCENE_WORDS and unique_token_ratio(text) < LOW_UNIQUE_RATIO_THRESHOLD
        for text in sample_values
    )
    scene_coherence_hint = bool(sample_values) and all(
        len(word_tokens(text)) >= MIN_SCENE_WORDS and any(ch in text for ch in '.!?,;:')
        for text in sample_values
    )
    repetition_risk = 'elevated' if any(
        [fallback_phrase_detected, repeated_sample_detected, low_unique_ratio_detected]
    ) else 'low'
    fallback_masquerade_risk = fallback_phrase_detected or template_marker_detected

    failure_reasons: list[str] = []
    if not sample_values:
        failure_reasons.append('no-narrative-samples')
    if sample_values and not scene_coherence_hint:
        failure_reasons.append('scene-coherence-weak')
    if repetition_risk == 'elevated':
        failure_reasons.append('repetition-risk-elevated')
    if fallback_masquerade_risk:
        failure_reasons.append('fallback-masquerade-risk')

    return {
        'narrativeSamples': narrative_samples,
        'narrativeSampleCount': len(sample_values),
        'constraintSignalsVisible': bool(sample_values),
        'repetitionRisk': repetition_risk,
        'sceneCoherenceHint': scene_coherence_hint,
        'fallbackMasqueradeRisk': fallback_masquerade_risk,
        'failureReasons': failure_reasons,
        'signals': {
            'fallbackPhraseDetected': fallback_phrase_detected,
            'templateMarkerDetected': template_marker_detected,
            'repeatedSampleDetected': repeated_sample_detected,
            'lowUniqueRatioDetected': low_unique_ratio_detected,
            'logHasTemplateMarkers': bool(re.search(r'template=[a-z]+', log_text)),
        },
    }


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
        'narrativeSamples': extract_narrative_samples(checkpoint),
    }



def governed_block_display_tier(*, counts_as_proper_battle: bool, forced_verdict_tier: str | None) -> str:
    if counts_as_proper_battle:
        return 'proper-battle'
    if forced_verdict_tier == 'invalid-for-proper-battle':
        return 'non-credit / invalid'
    return 'non-credit / exploratory'



def governed_block_raw_tier(*, counts_as_proper_battle: bool, forced_verdict_tier: str | None) -> str:
    if counts_as_proper_battle:
        return 'proper-battle'
    if forced_verdict_tier:
        return forced_verdict_tier
    return 'non-credit-unclassified'



def build_governed_verdict_block(
    *,
    counts_as_proper_battle: bool,
    forced_verdict_tier: str | None,
    top_claim_limiting_reason: str | None,
    top_claim_limiting_reason_source: str | None,
) -> dict[str, Any]:
    displayed_tier = governed_block_display_tier(
        counts_as_proper_battle=counts_as_proper_battle,
        forced_verdict_tier=forced_verdict_tier,
    )
    raw_tier = governed_block_raw_tier(
        counts_as_proper_battle=counts_as_proper_battle,
        forced_verdict_tier=forced_verdict_tier,
    )
    credit_status = 'credit' if counts_as_proper_battle else 'non-credit'
    field_order = [
        'displayedTier',
        'rawTier',
        'creditStatus',
        'adjacentReason',
    ]
    return {
        'scopeVersion': 'v1',
        'sectionKey': 'governed-verdict-block',
        'fieldOrder': field_order,
        'primaryLabelField': 'displayedTier',
        'displayedTier': displayed_tier,
        'rawTier': raw_tier,
        'rawTierRole': 'audit-only',
        'creditStatus': credit_status,
        'adjacentReason': top_claim_limiting_reason,
        'adjacentReasonSource': top_claim_limiting_reason_source,
        'followUpInterpretationInsideBlockAllowed': False,
        'postBlockInterpretationAllowed': True,
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
    max_turns_configured: int,
) -> dict[str, Any]:
    log_text = load_text(log_path)
    log_summary = parse_log(log_text)
    checkpoint = load_json(checkpoint_path) if checkpoint_path else None
    metadata_path = METADATA_DIR / f'{log_path.stem}.json'
    metadata = load_json(metadata_path)
    cp_summary = summarize_checkpoint(checkpoint)
    stage = stage_from_summary(log_summary, checkpoint)

    failure_detail = log_summary['errorLine']
    failure_class = classify_failure(failure_detail)
    reported_failure_class = extract_reported_failure_class(metadata)
    source_of_move = normalize_source_of_move(metadata)
    evidence_sources = normalize_authenticity_evidence_sources(
        metadata=metadata,
        turns_mined=cp_summary['turnsMined'],
        battle_id_present=log_summary.get('battleId') is not None,
    )
    authenticity_model_quality = evaluate_authenticity_model_quality(
        source_of_move=source_of_move,
        evidence_sources=evidence_sources,
        metadata=metadata,
    )

    execution_outcome = classify_execution_outcome(
        log_text=log_text,
        failure_class=failure_class,
        metadata=metadata,
        turns_mined=cp_summary['turnsMined'],
    )
    gameplay_outcome = classify_gameplay_outcome(
        log_summary=log_summary,
        turns_mined=cp_summary['turnsMined'],
        execution_outcome=execution_outcome,
    )
    counts_as_proper_battle, proper_battle_reasons = evaluate_proper_battle_contract(
        execution_outcome=execution_outcome,
        gameplay_outcome=gameplay_outcome,
        source_of_move=source_of_move,
        turns_mined=cp_summary['turnsMined'],
    )
    transcript_quality = evaluate_transcript_quality(
        checkpoint=checkpoint,
        log_text=log_text,
    )
    hard_invalid_triggers = evaluate_hard_invalid_triggers(
        execution_outcome=execution_outcome,
        gameplay_outcome=gameplay_outcome,
        source_of_move=source_of_move,
        turns_mined=cp_summary['turnsMined'],
        transcript_quality_failure_reasons=transcript_quality['failureReasons'],
        authenticity_model_quality=authenticity_model_quality,
        failure_class=failure_class,
        reported_failure_class=reported_failure_class,
    )
    ordered_proper_battle_reasons = sort_reasons_by_priority(
        proper_battle_reasons,
        PROPER_BATTLE_REASON_PRIORITY_PREFIXES,
    )
    ordered_hard_invalid_triggers = sort_reasons_by_priority(
        hard_invalid_triggers,
        HARD_INVALID_TRIGGER_PRIORITY_PREFIXES,
    )
    top_proper_battle_reason = select_top_reason(
        ordered_proper_battle_reasons,
        PROPER_BATTLE_REASON_PRIORITY_PREFIXES,
    )
    top_hard_invalid_trigger = select_top_reason(
        ordered_hard_invalid_triggers,
        HARD_INVALID_TRIGGER_PRIORITY_PREFIXES,
    )
    top_claim_limiting_reason = top_hard_invalid_trigger or top_proper_battle_reason
    top_claim_limiting_reason_source = (
        'hard-invalid-trigger' if top_hard_invalid_trigger
        else 'proper-battle-reason' if top_proper_battle_reason
        else None
    )
    forced_verdict_tier = 'invalid-for-proper-battle' if ordered_hard_invalid_triggers else None
    governed_verdict_block = build_governed_verdict_block(
        counts_as_proper_battle=counts_as_proper_battle,
        forced_verdict_tier=forced_verdict_tier,
        top_claim_limiting_reason=top_claim_limiting_reason,
        top_claim_limiting_reason_source=top_claim_limiting_reason_source,
    )

    out = {
        'batchKey': batch_key(log_path),
        'logPath': str(log_path.relative_to(ROOT)),
        'checkpointPath': str(checkpoint_path.relative_to(ROOT)) if checkpoint_path else None,
        'metadataPath': str(metadata_path.relative_to(ROOT)) if metadata_path.exists() else None,
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
        'executionOutcome': execution_outcome,
        'gameplayOutcome': gameplay_outcome,
        'sourceOfMove': source_of_move,
        'authenticityModelQuality': authenticity_model_quality,
        'transcriptQuality': transcript_quality,
        'transcriptQualityFailureReasons': transcript_quality['failureReasons'],
        'hardInvalidTriggers': ordered_hard_invalid_triggers,
        'topHardInvalidTrigger': top_hard_invalid_trigger,
        'invalidForProperBattle': bool(ordered_hard_invalid_triggers),
        'forcedVerdictTier': forced_verdict_tier,
        'governedVerdictBlock': governed_verdict_block,
        'countsAsProperBattle': counts_as_proper_battle,
        'properBattleReasons': ordered_proper_battle_reasons,
        'topProperBattleReason': top_proper_battle_reason,
        'topClaimLimitingReason': top_claim_limiting_reason,
        'topClaimLimitingReasonSource': top_claim_limiting_reason_source,
        'failureClass': failure_class,
        'reportedFailureClass': reported_failure_class,
        'failureDetail': failure_detail,
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
    turns_mined = out['turnsMined']
    budget_used = turns_mined >= max_turns_configured
    turns_remaining = max(max_turns_configured - turns_mined, 0)
    out['interventionTargetMetrics'] = {
        'laterTurnReached': turns_mined >= LATER_TURN_THRESHOLD,
        'settlementObserved': out['settled'],
        'activePoisonObserved': 'active-poison' in out['observedMechanics'],
        'maxTurnsConfigured': max_turns_configured,
        'turnsMined': turns_mined,
        'turnBudgetUsed': budget_used,
        'turnBudgetUnused': not budget_used,
        'turnsRemainingToCap': turns_remaining,
        'turnBudgetUsageRatio': (turns_mined / max_turns_configured) if max_turns_configured > 0 else None,
        'observedMechanics': out['observedMechanics'],
        'unobservedMechanics': out['unobservedMechanics'],
    }
    return out


def write_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')


def extract_markdown_section(markdown_text: str, heading: str, next_heading: str | None = None) -> str:
    try:
        start = markdown_text.index(heading)
    except ValueError:
        return ''
    end = len(markdown_text)
    if next_heading:
        try:
            end = markdown_text.index(next_heading, start + len(heading))
        except ValueError:
            end = len(markdown_text)
    return markdown_text[start:end].strip()


def evaluate_governed_block_surface_parity(
    governed_block: dict[str, Any],
    markdown_text: str,
) -> dict[str, Any]:
    section = extract_markdown_section(markdown_text, '## governed verdict block', '## classification contract')
    field_order_line = f"- field order: {', '.join(governed_block['fieldOrder'])}"
    primary_line = f"- primary label field: `{governed_block['primaryLabelField']}`"
    displayed_line = f"- displayed tier: `{governed_block['displayedTier']}`"
    raw_line = f"- raw tier: `{governed_block['rawTier']}` ({governed_block['rawTierRole']})"
    section_present = bool(section)
    displayed_index = section.find(displayed_line) if section_present else -1
    raw_index = section.find(raw_line) if section_present else -1
    checks = {
        'sectionPresent': section_present,
        'fieldOrderAligned': field_order_line in section,
        'primaryLabelAligned': primary_line in section,
        'displayedTierRendered': displayed_line in section,
        'rawTierRendered': raw_line in section,
        'displayedTierBeforeRawTier': displayed_index != -1 and raw_index != -1 and displayed_index < raw_index,
        'rawTierMarkedAuditOnly': '(audit-only)' in raw_line,
    }
    return {
        'scope': 'current-artifact-surfaces:json+markdown',
        'status': 'aligned' if all(checks.values()) else 'mismatch',
        'checks': checks,
        'sectionHeading': '## governed verdict block',
    }


def write_markdown(path: Path, per_battle: dict[str, Any]) -> None:
    shared = per_battle['sharedRegimeMetrics']
    target = per_battle['interventionTargetMetrics']
    governed = per_battle['governedVerdictBlock']
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
        '## governed verdict block',
        f"- scope version: `{governed['scopeVersion']}`",
        f"- section key: `{governed['sectionKey']}`",
        f"- field order: {', '.join(governed['fieldOrder'])}",
        f"- primary label field: `{governed['primaryLabelField']}`",
        f"- displayed tier: `{governed['displayedTier']}`",
        f"- raw tier: `{governed['rawTier']}` ({governed['rawTierRole']})",
        f"- credit status: `{governed['creditStatus']}`",
        f"- adjacent reason: `{governed['adjacentReason']}` ({governed['adjacentReasonSource']})",
        f"- follow-up interpretation inside block allowed: `{governed['followUpInterpretationInsideBlockAllowed']}`",
        f"- post-block interpretation allowed: `{governed['postBlockInterpretationAllowed']}`",
        '',
        '## classification contract',
        f"- execution outcome: `{per_battle['executionOutcome']}`",
        f"- gameplay outcome: `{per_battle['gameplayOutcome']}`",
        f"- source of move A: `{per_battle['sourceOfMove']['A']['kind']}` (strategy `{per_battle['sourceOfMove']['A']['strategy']}` agent `{per_battle['sourceOfMove']['A']['agentName']}`)",
        f"- source of move B: `{per_battle['sourceOfMove']['B']['kind']}` (strategy `{per_battle['sourceOfMove']['B']['strategy']}` agent `{per_battle['sourceOfMove']['B']['agentName']}`)",
        f"- authenticity model quality: correctness=`{per_battle['authenticityModelQuality']['correctnessSatisfied']}` completeness=`{per_battle['authenticityModelQuality']['completenessSatisfied']}` freshnessWindowProfileMatch=`{per_battle['authenticityModelQuality']['freshnessWindowProfileMatch']}` closurePolicyHashMatch=`{per_battle['authenticityModelQuality']['closureKeyClassificationPolicyHashMatch']}` migrationAnchorSourceTrusted=`{per_battle['authenticityModelQuality']['migrationAnchorSourceTrusted']}` carryoverScopeDigestMatch=`{per_battle['authenticityModelQuality']['anchorTransitionCarryoverScopeDigestMatch']}` replayGuardInvariantSatisfied=`{per_battle['authenticityModelQuality']['transitionLedgerReplayGuardInvariantSatisfied']}` fingerprintVersionMatch=`{per_battle['authenticityModelQuality']['fingerprintVersionMatch']}` failsClosed=`{per_battle['authenticityModelQuality']['failsClosed']}`",
        f"- authenticity evidence sources: {', '.join(per_battle['authenticityModelQuality']['evidenceSources'])}",
        f"- timeout allowance aggregate: used=`{per_battle['authenticityModelQuality']['timeoutSubtypeAllowanceUsedAggregate']}` budget=`{per_battle['authenticityModelQuality']['timeoutSubtypeAllowanceBudgetAggregate']}` withinCap=`{per_battle['authenticityModelQuality']['aggregateAllowanceWithinCap']}`",
        f"- counts as proper battle: `{per_battle['countsAsProperBattle']}`",
        f"- proper battle reasons: {', '.join(per_battle['properBattleReasons']) if per_battle['properBattleReasons'] else 'none'}",
        f"- top proper battle reason: `{per_battle['topProperBattleReason']}`",
        f"- invalid for proper battle: `{per_battle['invalidForProperBattle']}`",
        f"- forced verdict tier: `{per_battle['forcedVerdictTier']}`",
        f"- hard invalid triggers: {', '.join(per_battle['hardInvalidTriggers']) if per_battle['hardInvalidTriggers'] else 'none'}",
        f"- top hard invalid trigger: `{per_battle['topHardInvalidTrigger']}`",
        f"- top claim-limiting reason: `{per_battle['topClaimLimitingReason']}` ({per_battle['topClaimLimitingReasonSource']})",
        '',
        '## transcript-quality checks',
        f"- narrative sample count: `{per_battle['transcriptQuality']['narrativeSampleCount']}`",
        f"- constraint signals visible: `{per_battle['transcriptQuality']['constraintSignalsVisible']}`",
        f"- scene coherence hint: `{per_battle['transcriptQuality']['sceneCoherenceHint']}`",
        f"- repetition risk: `{per_battle['transcriptQuality']['repetitionRisk']}`",
        f"- fallback masquerade risk: `{per_battle['transcriptQuality']['fallbackMasqueradeRisk']}`",
        f"- transcript-quality failure reasons: {', '.join(per_battle['transcriptQualityFailureReasons']) if per_battle['transcriptQualityFailureReasons'] else 'none'}",
        '',
        '## shared-regime metrics',
        f"- first mover A: `{shared['firstMoverA']}`",
        f"- deepest stage: `{shared['deepestStageReached']}`",
        f"- accepted: `{shared['accepted']}`",
        f"- turns mined: `{shared['turnsMined']}`",
        f"- failure class: {shared['failureClass']}",
        f"- failure detail: {per_battle['failureDetail'] or 'none'}",
        '',
        '## intervention-target metrics',
        f"- later-turn reached: `{target['laterTurnReached']}`",
        f"- settlement observed: `{target['settlementObserved']}`",
        f"- active-poison observed: `{target['activePoisonObserved']}`",
        f"- max turns configured: `{target['maxTurnsConfigured']}`",
        f"- turn budget used: `{target['turnBudgetUsed']}` | unused: `{target['turnBudgetUnused']}`",
        f"- turns remaining to cap: `{target['turnsRemainingToCap']}`",
        f"- turn budget usage ratio: `{target['turnBudgetUsageRatio']}`",
        f"- observed mechanics: {', '.join(target['observedMechanics']) or 'none'}",
        f"- unobserved mechanics: {', '.join(target['unobservedMechanics']) or 'none'}",
    ]
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def _normalize_label(value: str | None) -> str:
    return (value or '').strip().lower()


def aggregate(per_battles: list[dict[str, Any]], *, strict_mode: bool = False) -> dict[str, Any]:
    stage_counts = Counter(b['deepestStageReached'] for b in per_battles)
    failure_counts = Counter((b['failureClass'] or 'none') for b in per_battles)
    observed = sorted({m for b in per_battles for m in b['observedMechanics']})
    control_label = per_battles[0]['controlLabel'] if per_battles else DEFAULT_CONTROL_LABEL
    intervention_label = per_battles[0]['interventionLabel'] if per_battles else DEFAULT_INTERVENTION_LABEL
    turns_mined = [b['turnsMined'] for b in per_battles]
    first_movers = [b['firstMoverA'] for b in per_battles]
    intervention_scope_battle_count = len(per_battles)
    turn_budget_used_count = sum(
        1 for b in per_battles if b['interventionTargetMetrics']['turnBudgetUsed']
    )
    turn_budget_unused_count = sum(
        1 for b in per_battles if b['interventionTargetMetrics']['turnBudgetUnused']
    )
    shared_regime_metrics = {
        'battleCount': len(per_battles),
        'stageHistogram': dict(stage_counts),
        'failureHistogram': dict(failure_counts),
        'turnsMinedPerBattle': turns_mined,
        'firstMoversA': first_movers,
        'identityPairs': sorted({b['identityPair'] for b in per_battles}),
        'acceptedBattleCount': sum(1 for b in per_battles if b['accepted']),
    }
    unsettled_battle_count = sum(1 for b in per_battles if b['unsettled'])
    first_mover_a_count = sum(1 for b in per_battles if b['firstMoverA'] is True)
    intervention_target_metrics = {
        'battleCount': intervention_scope_battle_count,
        'turnBudgetRatioDenominator': 'interventionTargetMetrics.battleCount',
        'turnBudgetUsedCount': turn_budget_used_count,
        'turnBudgetUnusedCount': turn_budget_unused_count,
        'turnBudgetUsedRatio': (
            turn_budget_used_count / intervention_scope_battle_count
            if intervention_scope_battle_count > 0
            else None
        ),
        'laterTurnBattleCount': sum(1 for b in per_battles if b['interventionTargetMetrics']['laterTurnReached']),
        'activePoisonBattleCount': sum(1 for b in per_battles if b['interventionTargetMetrics']['activePoisonObserved']),
        'settlementObservedCount': sum(1 for b in per_battles if b['interventionTargetMetrics']['settlementObserved']),
        'pairedEvidenceScope': 'interventionTargetMetrics',
        'pairedEvidenceDenominator': 'interventionTargetMetrics.battleCount',
        'sampleSize': intervention_scope_battle_count,
        'unsettledShare': (
            unsettled_battle_count / intervention_scope_battle_count
            if intervention_scope_battle_count > 0
            else None
        ),
        'firstMoverAShare': (
            first_mover_a_count / intervention_scope_battle_count
            if intervention_scope_battle_count > 0
            else None
        ),
        'exploratoryOnly': intervention_scope_battle_count < 10,
        'observedMechanics': observed,
        'unobservedMechanics': [m for m in KNOWN_MECHANICS if m not in observed],
    }

    warning_messages: dict[str, str] = {}
    control_norm = _normalize_label(control_label)
    intervention_norm = _normalize_label(intervention_label)
    label_hygiene_ok = bool(control_norm) and bool(intervention_norm) and control_norm != intervention_norm
    if not control_norm:
        warning_messages['label-control-blank'] = 'label-hygiene: control label is blank after normalization'
    if not intervention_norm:
        warning_messages['label-intervention-blank'] = 'label-hygiene: intervention label is blank after normalization'
    if control_norm and intervention_norm and control_norm == intervention_norm:
        warning_messages['label-collapse'] = 'label-hygiene: control and intervention labels collapse to same normalized value'

    observed_max_turns_values = sorted({
        b['interventionTargetMetrics'].get('maxTurnsConfigured')
        for b in per_battles
        if b.get('interventionTargetMetrics', {}).get('maxTurnsConfigured') is not None
    })
    max_turns_comparable = len(observed_max_turns_values) <= 1
    if not max_turns_comparable:
        warning_messages['max-turns-mismatch'] = (
            'max-turns-comparability: mixed maxTurnsConfigured values observed '
            f'({observed_max_turns_values})'
        )

    warnings = [warning_messages[key] for key in WARNING_CLASS_ORDER if key in warning_messages]
    contamination_counters = {
        'labelControlBlankCount': 1 if 'label-control-blank' in warning_messages else 0,
        'labelInterventionBlankCount': 1 if 'label-intervention-blank' in warning_messages else 0,
        'labelCollapseCount': 1 if 'label-collapse' in warning_messages else 0,
        'maxTurnsMismatchCount': 1 if 'max-turns-mismatch' in warning_messages else 0,
    }

    strict_violations = list(warnings)

    run_config = {
        'controlLabel': control_label,
        'interventionLabel': intervention_label,
        'interventionVariable': 'maxTurnsConfigured',
        'observedInterventionValues': observed_max_turns_values,
        'battleCount': len(per_battles),
    }
    run_config_fingerprint = hashlib.sha256(
        json.dumps(run_config, sort_keys=True, separators=(',', ':')).encode('utf-8')
    ).hexdigest()
    single_variable_intervention_guardrail = {
        'ok': len(observed_max_turns_values) == 1,
        'interventionVariable': 'maxTurnsConfigured',
        'observedValues': observed_max_turns_values,
    }

    return {
        'controlLabel': control_label,
        'interventionLabel': intervention_label,
        'runConfig': run_config,
        'runConfigFingerprint': run_config_fingerprint,
        'singleVariableInterventionGuardrail': single_variable_intervention_guardrail,
        'strictMode': strict_mode,
        'strictViolationCount': len(strict_violations),
        'strictViolations': strict_violations,
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
        'labelHygieneOk': label_hygiene_ok,
        'maxTurnsComparable': max_turns_comparable,
        'warnings': warnings,
        'contaminationCounters': contamination_counters,
    }


def _comparable_run_config_shape(run_config: dict[str, Any] | None) -> dict[str, Any]:
    rc = dict(run_config or {})
    rc.pop('observedInterventionValues', None)
    return rc


def compare_aggregates(previous: dict[str, Any] | None, current: dict[str, Any]) -> dict[str, Any]:
    if previous is None:
        return {
            'hasPrevious': False,
            'comparable': False,
            'comparabilityReasons': ['missing-baseline'],
            'note': 'No previous aggregate snapshot available for comparison.'
        }
    previous_shared = previous.get('sharedRegimeMetrics', {})
    current_shared = current.get('sharedRegimeMetrics', {})
    previous_target = previous.get('interventionTargetMetrics', {})
    current_target = current.get('interventionTargetMetrics', {})

    reasons: dict[str, str] = {}
    previous_fingerprint = previous.get('runConfigFingerprint')
    current_fingerprint = current.get('runConfigFingerprint')
    previous_strict_violations = previous.get('strictViolationCount', 0)
    current_strict_violations = current.get('strictViolationCount', 0)

    if previous_strict_violations > 0 or current_strict_violations > 0:
        reasons['strict-violation'] = (
            'strict-violation: previous/current strict violations '
            f'({previous_strict_violations}/{current_strict_violations})'
        )

    previous_guardrails_ok = bool(
        previous.get('labelHygieneOk')
        and previous.get('maxTurnsComparable')
        and previous.get('singleVariableInterventionGuardrail', {}).get('ok')
    )
    current_guardrails_ok = bool(
        current.get('labelHygieneOk')
        and current.get('maxTurnsComparable')
        and current.get('singleVariableInterventionGuardrail', {}).get('ok')
    )
    if not previous_guardrails_ok or not current_guardrails_ok:
        reasons['guardrail-failure'] = (
            'guardrail-failure: previous/current guardrails '
            f'({previous_guardrails_ok}/{current_guardrails_ok})'
        )

    previous_rc_shape = _comparable_run_config_shape(previous.get('runConfig'))
    current_rc_shape = _comparable_run_config_shape(current.get('runConfig'))
    runconfig_shape_comparable = previous_rc_shape == current_rc_shape
    if not runconfig_shape_comparable:
        reasons['runconfig-drift-outside-allowed-variable'] = (
            'runconfig-drift-outside-allowed-variable: runConfig changed '
            'outside allowed intervention variable (observedInterventionValues)'
        )

    comparable = len(reasons) == 0
    comparability_reasons = [
        reasons[key]
        for key in COMPARABILITY_REASON_ORDER
        if key in reasons
    ]

    return {
        'hasPrevious': True,
        'comparable': comparable,
        'comparabilityReasons': comparability_reasons,
        'previousControlLabel': previous.get('controlLabel'),
        'currentControlLabel': current.get('controlLabel'),
        'previousInterventionLabel': previous.get('interventionLabel'),
        'currentInterventionLabel': current.get('interventionLabel'),
        'previousRunConfigFingerprint': previous_fingerprint,
        'currentRunConfigFingerprint': current_fingerprint,
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
        'previousGuardrailsOk': previous_guardrails_ok,
        'currentGuardrailsOk': current_guardrails_ok,
        'runConfigShapeComparable': runconfig_shape_comparable,
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
        f"- intervention-scope battle count: `{target['battleCount']}`",
        f"- turn-budget used count: `{target['turnBudgetUsedCount']}`",
        f"- turn-budget unused count: `{target['turnBudgetUnusedCount']}`",
        f"- turn-budget used ratio: `{target['turnBudgetUsedRatio']}` (denominator: `{target['turnBudgetRatioDenominator']}`)",
        f"- paired evidence scope: `{target['pairedEvidenceScope']}`",
        f"- paired evidence denominator: `{target['pairedEvidenceDenominator']}`",
        f"- paired evidence sample size: `{target['sampleSize']}`",
        f"- unsettled share: `{target['unsettledShare']}`",
        f"- first mover A share: `{target['firstMoverAShare']}`",
        f"- exploratory only: `{target['exploratoryOnly']}`",
        f"- later-turn battle count: `{target['laterTurnBattleCount']}`",
        f"- active-poison battle count: `{target['activePoisonBattleCount']}`",
        f"- settlement observed count: `{target['settlementObservedCount']}`",
        f"- observed mechanics: {', '.join(target['observedMechanics']) or 'none'}",
        f"- unobserved mechanics: {', '.join(target['unobservedMechanics']) or 'none'}",
        '',
        '## guardrails',
        f"- strict mode: `{agg['strictMode']}`",
        f"- strict violation count: `{agg['strictViolationCount']}`",
        f"- strict violations: {', '.join(agg['strictViolations']) if agg['strictViolations'] else 'none'}",
        f"- label hygiene ok: `{agg['labelHygieneOk']}`",
        f"- max turns comparable: `{agg['maxTurnsComparable']}`",
        f"- single-variable intervention guardrail: `{agg['singleVariableInterventionGuardrail']['ok']}` for `{agg['singleVariableInterventionGuardrail']['interventionVariable']}` values `{agg['singleVariableInterventionGuardrail']['observedValues']}`",
        f"- run-config fingerprint: `{agg['runConfigFingerprint']}`",
        f"- warnings: {', '.join(agg['warnings']) if agg['warnings'] else 'none'}",
        f"- contamination counters: `{agg['contaminationCounters']}`",
        '',
        '## comparison',
    ]
    if comparison.get('hasPrevious'):
        lines.extend([
            f"- comparable: `{comparison['comparable']}`",
            f"- comparability reasons: {', '.join(comparison['comparabilityReasons']) if comparison['comparabilityReasons'] else 'none'}",
            f"- previous control/intervention: `{comparison['previousControlLabel']}` / `{comparison['previousInterventionLabel']}`",
            f"- current control/intervention: `{comparison['currentControlLabel']}` / `{comparison['currentInterventionLabel']}`",
            f"- previous run-config fingerprint: `{comparison['previousRunConfigFingerprint']}`",
            f"- current run-config fingerprint: `{comparison['currentRunConfigFingerprint']}`",
            f"- run-config shape comparable: `{comparison['runConfigShapeComparable']}`",
            f"- previous guardrails ok: `{comparison['previousGuardrailsOk']}`",
            f"- current guardrails ok: `{comparison['currentGuardrailsOk']}`",
        ])
        if comparison.get('comparable'):
            lines.extend([
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
            lines.extend([
                '- non-evaluative mode: comparison is not reliable for interpretive metrics.',
                '- evaluative deltas are intentionally suppressed until comparability is restored.',
            ])
    else:
        lines.append(f"- {comparison['note']}")
    lines.extend([
        '',
        '> This batch is exploratory evidence, not a verdict.',
    ])
    if target.get('exploratoryOnly'):
        lines.append(
            f"> Tiny-sample caveat: sample size is `{target.get('sampleSize')}` (denominator `{target.get('pairedEvidenceDenominator')}`); treat all intervention metrics as directional only."
        )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text('\n'.join(lines) + '\n', encoding='utf-8')


def _mock_per_battle(*, control_label: str, intervention_label: str, max_turns_configured: int) -> dict[str, Any]:
    return {
        'controlLabel': control_label,
        'interventionLabel': intervention_label,
        'deepestStageReached': 'multi-turn',
        'failureClass': None,
        'observedMechanics': ['first-turn-submit', 'multi-turn'],
        'turnsMined': 3,
        'battleId': 1,
        'firstMoverA': True,
        'identityPair': 'PrivateClawn vs PrivateClawnJr',
        'accepted': True,
        'unsettled': True,
        'settled': False,
        'interventionTargetMetrics': {
            'laterTurnReached': True,
            'activePoisonObserved': False,
            'settlementObserved': False,
            'maxTurnsConfigured': max_turns_configured,
            'turnBudgetUsed': False,
            'turnBudgetUnused': True,
        },
    }


def run_strict_injection_harness() -> dict[str, Any]:
    cases: list[dict[str, Any]] = []

    case_label_collapse = aggregate(
        [
            _mock_per_battle(control_label='same-label', intervention_label='same-label', max_turns_configured=80)
        ],
        strict_mode=True,
    )
    expected_label = {
        'label-hygiene: control and intervention labels collapse to same normalized value'
    }
    actual_label = set(case_label_collapse['strictViolations'])
    if actual_label != expected_label:
        raise SystemExit(
            'Strict injection case failed (label-collapse): '
            f'expected={sorted(expected_label)} actual={sorted(actual_label)}'
        )
    cases.append({
        'case': 'label-collapse',
        'expectedStrictViolations': sorted(expected_label),
        'actualStrictViolations': sorted(actual_label),
        'strictViolationCount': case_label_collapse['strictViolationCount'],
    })

    case_max_turns = aggregate(
        [
            _mock_per_battle(control_label='baseline', intervention_label='intervention', max_turns_configured=80),
            _mock_per_battle(control_label='baseline', intervention_label='intervention', max_turns_configured=120),
        ],
        strict_mode=True,
    )
    expected_max_turns = {
        'max-turns-comparability: mixed maxTurnsConfigured values observed ([80, 120])'
    }
    actual_max_turns = set(case_max_turns['strictViolations'])
    if actual_max_turns != expected_max_turns:
        raise SystemExit(
            'Strict injection case failed (max-turns-mismatch): '
            f'expected={sorted(expected_max_turns)} actual={sorted(actual_max_turns)}'
        )
    cases.append({
        'case': 'max-turns-mismatch',
        'expectedStrictViolations': sorted(expected_max_turns),
        'actualStrictViolations': sorted(actual_max_turns),
        'strictViolationCount': case_max_turns['strictViolationCount'],
    })

    case_combined = aggregate(
        [
            _mock_per_battle(control_label='same-label', intervention_label='same-label', max_turns_configured=80),
            _mock_per_battle(control_label='same-label', intervention_label='same-label', max_turns_configured=120),
        ],
        strict_mode=True,
    )
    expected_combined = {
        'label-hygiene: control and intervention labels collapse to same normalized value',
        'max-turns-comparability: mixed maxTurnsConfigured values observed ([80, 120])',
    }
    actual_combined = set(case_combined['strictViolations'])
    if actual_combined != expected_combined:
        raise SystemExit(
            'Strict injection case failed (combined): '
            f'expected={sorted(expected_combined)} actual={sorted(actual_combined)}'
        )
    cases.append({
        'case': 'combined',
        'expectedStrictViolations': sorted(expected_combined),
        'actualStrictViolations': sorted(actual_combined),
        'strictViolationCount': case_combined['strictViolationCount'],
    })

    return {
        'status': 'ok',
        'cases': cases,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description='Summarize v05 battle batch artifacts into concise per-battle and aggregate summaries.')
    parser.add_argument('--limit', type=int, default=5, help='How many latest batch logs to summarize (default: 5)')
    parser.add_argument('--control-label', default=DEFAULT_CONTROL_LABEL, help='Human-readable label for the baseline/control regime.')
    parser.add_argument('--intervention-label', default=DEFAULT_INTERVENTION_LABEL, help='Human-readable label for the current intervention regime.')
    parser.add_argument('--max-turns-configured', type=int, default=80, help='Configured max turns budget for the summarized batch runs (default: 80).')
    parser.add_argument('--strict', action='store_true', help='Fail with non-zero exit code when guardrail violations are present (after writing diagnostics).')
    parser.add_argument('--self-test-strict-injections', action='store_true', help='Run deterministic strict-injection coverage checks (label collapse, max-turn mismatch, combined) and exit.')
    args = parser.parse_args()

    if args.self_test_strict_injections:
        print(json.dumps(run_strict_injection_harness(), indent=2))
        return

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
            max_turns_configured=args.max_turns_configured,
        )
        per_battles.append(per_battle)
        write_json(per_dir / f'{log_path.stem}.json', per_battle)
        write_markdown(per_dir / f'{log_path.stem}.md', per_battle)

    agg = aggregate(per_battles, strict_mode=args.strict)
    comparison = compare_aggregates(previous_aggregate, agg)
    write_json(agg_dir / 'latest.json', agg)
    write_json(agg_dir / 'comparison-latest.json', comparison)
    write_aggregate_markdown(agg_dir / 'latest.md', agg, comparison)

    print(f'Wrote {len(per_battles)} per-battle summaries to {per_dir}')
    print(f'Wrote aggregate summary to {agg_dir / "latest.json"}')
    print(f'Wrote comparison summary to {agg_dir / "comparison-latest.json"}')

    if args.strict and agg['strictViolationCount'] > 0:
        print(
            f"Strict mode failed with {agg['strictViolationCount']} violation(s): "
            + '; '.join(agg['strictViolations'])
        )
        raise SystemExit(2)


if __name__ == '__main__':
    main()
