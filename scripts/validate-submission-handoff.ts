#!/usr/bin/env bun
import { readFileSync } from 'node:fs';

const shortPath = process.argv[2] ?? 'docs/SYNTHESIS-SUBMISSION-SHORT-DRAFT.md';
const longPath = process.argv[3] ?? 'docs/SYNTHESIS-SUBMISSION-LONG-DRAFT.md';

const shortText = readFileSync(shortPath, 'utf-8');
const longText = readFileSync(longPath, 'utf-8');

function collectCommits(text: string): string[] {
  const matches = [...text.matchAll(/`([0-9a-f]{7,40})`/gi)].map(m => m[1]);
  return [...new Set(matches)];
}

function hasCaveatLine(text: string): boolean {
  return /Caveats:\s*/i.test(text);
}

function hasImplicationLine(text: string): boolean {
  return /Implication:/i.test(text) || /evidence\s*->\s*implication/i.test(text);
}

const shortCommits = collectCommits(shortText);
const longCommits = collectCommits(longText);
const sharedCommits = shortCommits.filter(c => longCommits.includes(c));

const checks = {
  shortHasCaveats: hasCaveatLine(shortText),
  longHasCaveatSection: /Caveat impact table/i.test(longText),
  shortHasProofPointer: /Proof:/i.test(shortText),
  longHasProofBlocks: /Proof blocks/i.test(longText),
  longHasImplicationLine: hasImplicationLine(longText),
  sharedCommitCount: sharedCommits.length,
};

const failed: string[] = [];
if (!checks.shortHasCaveats) failed.push('SHORT_MISSING_CAVEATS_LINE');
if (!checks.longHasCaveatSection) failed.push('LONG_MISSING_CAVEAT_SECTION');
if (!checks.shortHasProofPointer) failed.push('SHORT_MISSING_PROOF_POINTER');
if (!checks.longHasProofBlocks) failed.push('LONG_MISSING_PROOF_BLOCKS');
if (!checks.longHasImplicationLine) failed.push('LONG_MISSING_IMPLICATION_LINE');
if (checks.sharedCommitCount === 0) failed.push('NO_SHARED_COMMIT_POINTERS');

const out = {
  status: failed.length === 0 ? 'pass' : 'fail',
  failed,
  checks,
  sharedCommits,
  inputs: { shortPath, longPath },
};

console.log(JSON.stringify(out, null, 2));
if (failed.length) process.exit(2);
