// packages/relay/src/persistence.ts — Simple JSON file persistence for battle logs
//
// Saves completed battle logs to disk so they survive relay restarts.
// Active battles remain in-memory only (ephemeral by design).
// This is NOT a database — just crash-recovery for battle records.

import * as fs from 'fs';
import * as path from 'path';
import type { RelayBattle } from '@clawttack/protocol';

export interface PersistenceConfig {
  /** Directory to store battle logs */
  dataDir: string;
  /** Also save to web public dir for serving */
  webPublicDir?: string;
}

export class BattlePersistence {
  private config: PersistenceConfig;

  constructor(config: PersistenceConfig) {
    this.config = config;
    // Ensure directories exist
    fs.mkdirSync(config.dataDir, { recursive: true });
    if (config.webPublicDir) {
      fs.mkdirSync(config.webPublicDir, { recursive: true });
    }
  }

  /** Save a completed battle (strips sensitive scenarioData) */
  save(battle: RelayBattle): string {
    // Strip sensitive data (e.g., plaintext secrets) before persisting
    const sanitized = {
      ...battle,
      scenarioData: {},
      // Metadata for transparency & trust (see reading-notes/2026-02-17--trust-in-ai.md)
      _meta: {
        platform: 'clawttack',
        version: '0.1.0',
        generatedBy: 'ai',
        relay: 'centralized',
        signatures: 'ecdsa-secp256k1',
        savedAt: new Date().toISOString(),
      },
    };
    const filePath = path.join(this.config.dataDir, `${battle.id}.json`);
    const data = JSON.stringify(sanitized, null, 2);
    fs.writeFileSync(filePath, data);

    // Also copy to web public dir if configured
    if (this.config.webPublicDir) {
      const webPath = path.join(this.config.webPublicDir, `${battle.id}.json`);
      fs.writeFileSync(webPath, data);
    }

    return filePath;
  }

  /** Load a battle by ID */
  load(battleId: string): RelayBattle | null {
    const filePath = path.join(this.config.dataDir, `${battleId}.json`);
    try {
      const data = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(data) as RelayBattle;
    } catch {
      return null;
    }
  }

  /** List all saved battle IDs */
  list(): string[] {
    try {
      return fs.readdirSync(this.config.dataDir)
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch {
      return [];
    }
  }

  /** Count saved battles */
  get count(): number {
    return this.list().length;
  }
}
