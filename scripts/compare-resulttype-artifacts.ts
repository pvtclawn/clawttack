#!/usr/bin/env bun
import { readFileSync } from 'node:fs';

type EvidenceStatus = 'success' | 'degraded_success' | 'insufficient_evidence' | string;

type Artifact = {
  generatedAt?: string;
  evidence_quality?: { status?: EvidenceStatus; caveats?: string[] };
  attacker_model?: { class?: string; capabilities?: string[] };
  assumption_breaks?: string[];
  resultTypeCounts?: Record<string, number>;
  settled?: number;
};

const PLACEHOLDER_TOKENS = new Set(['n/a', 'na', 'unknown', 'tbd', 'none', '-']);
const MAX_CAVEATS_FOR_IMPROVED = Number(process.env.MAX_CAVEATS_FOR_IMPROVED ?? 0);

type CompareResult = {
  status: 'comparable' | 'non_comparable';
  reasonCodes: string[];
  summary?: {
    baselineSettled: number;
    candidateSettled: number;
    resultTypeDelta: Record<string, number>;
    evidenceQualityStatus: string;
    caveatCount: number;
    headlineAllowed: boolean;
  };
};

function load(path: string): Artifact {
  return JSON.parse(readFileSync(path, 'utf-8')) as Artifact;
}

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_TOKENS.has(value.trim().toLowerCase());
}

function hasPlaceholderMetadata(a: Artifact): boolean {
  const cls = a.attacker_model?.class ?? '';
  if (cls && isPlaceholder(cls)) return true;

  for (const cap of a.attacker_model?.capabilities ?? []) {
    if (isPlaceholder(cap)) return true;
  }

  for (const ab of a.assumption_breaks ?? []) {
    if (isPlaceholder(ab)) return true;
  }

  return false;
}

function isComplete(a: Artifact): boolean {
  return Boolean(
    a.evidence_quality?.status &&
      a.attacker_model?.class &&
      Array.isArray(a.attacker_model?.capabilities) && a.attacker_model!.capabilities!.length > 0 &&
      Array.isArray(a.assumption_breaks) && a.assumption_breaks.length > 0,
  );
}

function compare(baseline: Artifact, candidate: Artifact): CompareResult {
  const reasonCodes: string[] = [];

  if (!isComplete(baseline) || !isComplete(candidate)) {
    reasonCodes.push('METADATA_INCOMPLETE');
  }

  if (hasPlaceholderMetadata(baseline) || hasPlaceholderMetadata(candidate)) {
    reasonCodes.push('METADATA_PLACEHOLDER');
  }

  if (baseline.attacker_model?.class !== candidate.attacker_model?.class) {
    reasonCodes.push('ATTACKER_MODEL_MISMATCH');
  }

  if (baseline.evidence_quality?.status !== candidate.evidence_quality?.status) {
    reasonCodes.push('EVIDENCE_QUALITY_MISMATCH');
  }

  if (reasonCodes.length > 0) {
    return { status: 'non_comparable', reasonCodes };
  }

  const keys = new Set<string>([
    ...Object.keys(baseline.resultTypeCounts ?? {}),
    ...Object.keys(candidate.resultTypeCounts ?? {}),
  ]);

  const resultTypeDelta: Record<string, number> = {};
  for (const k of keys) {
    const b = baseline.resultTypeCounts?.[k] ?? 0;
    const c = candidate.resultTypeCounts?.[k] ?? 0;
    resultTypeDelta[k] = c - b;
  }

  const evidenceQualityStatus = String(candidate.evidence_quality?.status ?? 'unknown');
  const caveatCount = candidate.evidence_quality?.caveats?.length ?? 0;
  const headlineAllowed = evidenceQualityStatus === 'success' && caveatCount <= MAX_CAVEATS_FOR_IMPROVED;

  return {
    status: 'comparable',
    reasonCodes,
    summary: {
      baselineSettled: baseline.settled ?? 0,
      candidateSettled: candidate.settled ?? 0,
      resultTypeDelta,
      evidenceQualityStatus,
      caveatCount,
      headlineAllowed,
    },
  };
}

function main() {
  const baselinePath = process.argv[2];
  const candidatePath = process.argv[3];

  if (!baselinePath || !candidatePath) {
    console.error('Usage: bun run scripts/compare-resulttype-artifacts.ts <baseline.json> <candidate.json>');
    process.exit(1);
  }

  const baseline = load(baselinePath);
  const candidate = load(candidatePath);
  const out = compare(baseline, candidate);

  console.log(JSON.stringify(out, null, 2));

  if (out.status === 'non_comparable') {
    process.exit(2);
  }
}

main();
