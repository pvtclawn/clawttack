#!/usr/bin/env bun

function parseSet(raw: string): string[] {
  return raw.split(',').map(v => v.trim()).filter(Boolean).sort();
}

const active = parseSet(process.env.ACTIVE_ENVELOPE_VERSIONS ?? 'v1');
const deprecated = parseSet(process.env.DEPRECATED_ENVELOPE_VERSIONS ?? '');

const expectedActive = parseSet(process.env.EXPECTED_ACTIVE_ENVELOPE_VERSIONS ?? active.join(','));
const expectedDeprecated = parseSet(process.env.EXPECTED_DEPRECATED_ENVELOPE_VERSIONS ?? deprecated.join(','));

const failed: string[] = [];
if (JSON.stringify(active) !== JSON.stringify(expectedActive)) {
  failed.push('ACTIVE_VERSION_SET_MISMATCH');
}
if (JSON.stringify(deprecated) !== JSON.stringify(expectedDeprecated)) {
  failed.push('DEPRECATED_VERSION_SET_MISMATCH');
}

const out = {
  status: failed.length === 0 ? 'pass' : 'fail',
  failed,
  effective: { active, deprecated },
  expected: { active: expectedActive, deprecated: expectedDeprecated },
};

console.log(JSON.stringify(out, null, 2));
if (failed.length) process.exit(2);
