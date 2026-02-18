#!/usr/bin/env bun
/**
 * Backfill _analysis into existing battle JSON files.
 * Safe to run multiple times — skips files that already have _analysis.
 */

import * as fs from 'fs';
import * as path from 'path';
import { analyzeBattle } from '../packages/relay/src/analysis.ts';
import type { RelayBattle } from '../packages/protocol/src/index.ts';

const BATTLES_DIR = path.join(import.meta.dir, '../packages/web/public/battles');

const files = fs.readdirSync(BATTLES_DIR).filter(f => f.endsWith('.json'));
let updated = 0;
let skipped = 0;

for (const file of files) {
  const filePath = path.join(BATTLES_DIR, file);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  if (raw._analysis && raw._analysis.agents?.[0]?.role !== 'unknown') {
    skipped++;
    continue;
  }

  if (!raw.turns || raw.turns.length === 0) {
    skipped++;
    continue;
  }

  // Build roles map from agents array (battle JSONs store role per agent)
  const roles: Record<string, string> = raw.roles ?? {};
  if (Object.keys(roles).length === 0 && raw.agents) {
    for (const agent of raw.agents) {
      if (agent.address && agent.role) {
        roles[agent.address] = agent.role;
      }
    }
  }

  // Build a minimal RelayBattle for analysis
  const battle: RelayBattle = {
    id: raw.id ?? raw.battleId ?? file.replace('.json', ''),
    scenarioId: raw.scenarioId ?? 'injection-ctf',
    agents: raw.agents ?? [],
    turns: raw.turns ?? [],
    state: 'ended',
    maxTurns: raw.maxTurns ?? 20,
    activeAgentIndex: 0,
    commitment: raw.commitment ?? '',
    scenarioData: {},
    roles,
    createdAt: raw.createdAt ?? 0,
  };

  const analysis = analyzeBattle(battle);
  raw._analysis = analysis;

  // Also add _meta if missing
  if (!raw._meta) {
    raw._meta = {
      platform: 'clawttack',
      version: '0.1.0',
      generatedBy: 'ai',
      relay: 'centralized',
      signatures: 'ecdsa-secp256k1',
      savedAt: new Date().toISOString(),
      backfilled: true,
    };
  }

  fs.writeFileSync(filePath, JSON.stringify(raw, null, 2));
  updated++;
  console.log(`✅ ${file} — ${analysis.agents.map(a => a.tactics.join(',')).join(' vs ')}`);
}

console.log(`\nDone: ${updated} updated, ${skipped} skipped (${files.length} total)`);
