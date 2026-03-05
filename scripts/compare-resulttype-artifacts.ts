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

type CompareResult = {
  status: 'comparable' | 'non_comparable';
  reasonCodes: string[];
  summary?: {
    baselineSettled: number;
    candidateSettled: number;
    resultTypeDelta: Record<string, number>;
  };
};

function load(path: string): Artifact {
  return JSON.parse(readFileSync(path, 'utf-8')) as Artifact;
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

  return {
    status: 'comparable',
    reasonCodes,
    summary: {
      baselineSettled: baseline.settled ?? 0,
      candidateSettled: candidate.settled ?? 0,
      resultTypeDelta,
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
