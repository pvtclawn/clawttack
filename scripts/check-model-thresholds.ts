#!/usr/bin/env bun
import { readFileSync } from 'node:fs';

type CompareOut = {
  status?: string;
  reasonCodes?: string[];
  summary?: {
    evidenceQualityStatus?: string;
    headlineAllowed?: boolean;
  };
};

const comparePath = process.argv[2] ?? '/tmp/compare-output.json';
const declaredMinSample = Number(process.argv[3] ?? 1);
const observedSample = Number(process.argv[4] ?? 1);
const requestedEnvelopeVersion = process.argv[5] ?? 'v1';
const artifactEnvelopeVersion = process.argv[6] ?? requestedEnvelopeVersion;

// Comma-separated version policy lists (no silent fallback by default)
const activeVersions = new Set((process.env.ACTIVE_ENVELOPE_VERSIONS ?? 'v1').split(',').map(v => v.trim()).filter(Boolean));
const deprecatedVersions = new Set((process.env.DEPRECATED_ENVELOPE_VERSIONS ?? '').split(',').map(v => v.trim()).filter(Boolean));

const compare = JSON.parse(readFileSync(comparePath, 'utf-8')) as CompareOut;

const failed: string[] = [];

function getVersionStatus(version: string): 'active' | 'deprecated' | 'unsupported' {
  if (activeVersions.has(version)) return 'active';
  if (deprecatedVersions.has(version)) return 'deprecated';
  return 'unsupported';
}

const requestedVersionStatus = getVersionStatus(requestedEnvelopeVersion);
const artifactVersionStatus = getVersionStatus(artifactEnvelopeVersion);

// T2 governance: version mismatch fail
if (requestedEnvelopeVersion !== artifactEnvelopeVersion) {
  failed.push('ENVELOPE_VERSION_MISMATCH');
}

// T2 governance: no silent fallback default
if (requestedVersionStatus === 'unsupported') {
  failed.push('ENVELOPE_VERSION_UNAVAILABLE_NO_FALLBACK');
}

// T1 comparability precondition
if (compare.status !== 'comparable') {
  failed.push('PRECONDITION_COMPARABLE_REQUIRED');
}

// T1 sample check
if (observedSample < declaredMinSample) {
  failed.push('SAMPLE_BELOW_MIN');
}

// Narrative gate binding to reject codes/status
const hasReject = failed.length > 0 || (compare.reasonCodes?.length ?? 0) > 0;
const headlineAllowed = Boolean(compare.summary?.headlineAllowed);
if (hasReject && headlineAllowed) {
  failed.push('NARRATIVE_GATE_VIOLATION');
}

const out = {
  status: failed.length === 0 ? 'pass' : 'fail',
  failed,
  inputs: {
    comparePath,
    declaredMinSample,
    observedSample,
    requestedEnvelopeVersion,
    artifactEnvelopeVersion,
  },
  envelope: {
    requestedVersionStatus,
    artifactVersionStatus,
    activeVersions: [...activeVersions],
    deprecatedVersions: [...deprecatedVersions],
  },
};

console.log(JSON.stringify(out, null, 2));
if (failed.length) process.exit(2);
