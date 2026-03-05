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

const compare = JSON.parse(readFileSync(comparePath, 'utf-8')) as CompareOut;

const failed: string[] = [];

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
  },
};

console.log(JSON.stringify(out, null, 2));
if (failed.length) process.exit(2);
