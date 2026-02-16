// src/db/index.ts — SQLite database layer (bun:sqlite)

import { Database } from 'bun:sqlite';
import { mkdirSync } from 'fs';
import { dirname } from 'path';
import type { Agent, Battle, BattleOutcome, BattleState, BattleRole, Turn } from './types.ts';

export class ArenaDB {
  private db: Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.db.exec('PRAGMA foreign_keys = ON');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        telegram_user_id INTEGER NOT NULL UNIQUE,
        wallet TEXT,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0,
        elo INTEGER NOT NULL DEFAULT 1200,
        created_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS battles (
        id TEXT PRIMARY KEY,
        scenario_id TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'pending',
        telegram_chat_id INTEGER,
        max_turns INTEGER NOT NULL DEFAULT 20,
        current_turn INTEGER NOT NULL DEFAULT 0,
        active_agent_id TEXT,
        commitment TEXT,
        outcome_json TEXT,
        roles_json TEXT NOT NULL DEFAULT '{}',
        scenario_data_json TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        started_at INTEGER,
        ended_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS battle_agents (
        battle_id TEXT NOT NULL REFERENCES battles(id),
        agent_id TEXT NOT NULL REFERENCES agents(id),
        role TEXT,
        PRIMARY KEY (battle_id, agent_id)
      );

      CREATE TABLE IF NOT EXISTS turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        battle_id TEXT NOT NULL REFERENCES battles(id),
        agent_id TEXT NOT NULL,
        message TEXT NOT NULL,
        turn_number INTEGER NOT NULL,
        timestamp INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE INDEX IF NOT EXISTS idx_turns_battle ON turns(battle_id, turn_number);
      CREATE INDEX IF NOT EXISTS idx_battles_state ON battles(state);
      CREATE INDEX IF NOT EXISTS idx_agents_telegram ON agents(telegram_user_id);
    `);
  }

  // --- Agents ---

  upsertAgent(agent: Pick<Agent, 'id' | 'name' | 'telegramUserId' | 'wallet'>): void {
    this.db.prepare(`
      INSERT INTO agents (id, name, telegram_user_id, wallet)
      VALUES (?1, ?2, ?3, ?4)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        wallet = excluded.wallet
    `).run(agent.id, agent.name, agent.telegramUserId, agent.wallet ?? null);
  }

  getAgentByTelegramId(telegramUserId: number): Agent | null {
    const row = this.db.prepare(
      'SELECT * FROM agents WHERE telegram_user_id = ?1'
    ).get(telegramUserId) as AgentRow | null;
    return row ? this.rowToAgent(row) : null;
  }

  getAgent(id: string): Agent | null {
    const row = this.db.prepare(
      'SELECT * FROM agents WHERE id = ?1'
    ).get(id) as AgentRow | null;
    return row ? this.rowToAgent(row) : null;
  }

  getAgentElo(id: string): number {
    const row = this.db.prepare(
      'SELECT elo FROM agents WHERE id = ?1'
    ).get(id) as { elo: number } | null;
    return row?.elo ?? 1200;
  }

  getLeaderboard(limit = 20): (Agent & { wins: number; losses: number; draws: number; elo: number })[] {
    const rows = this.db.prepare(
      'SELECT * FROM agents ORDER BY elo DESC LIMIT ?1'
    ).all(limit) as AgentRow[];
    return rows.map(r => ({
      ...this.rowToAgent(r),
      wins: r.wins,
      losses: r.losses,
      draws: r.draws,
      elo: r.elo,
    }));
  }

  updateAgentRecord(agentId: string, result: 'win' | 'loss' | 'draw', newElo: number): void {
    const col = result === 'win' ? 'wins' : result === 'loss' ? 'losses' : 'draws';
    this.db.prepare(
      `UPDATE agents SET ${col} = ${col} + 1, elo = ?1 WHERE id = ?2`
    ).run(newElo, agentId);
  }

  // --- Battles ---

  createBattle(battle: {
    id: string;
    scenarioId: string;
    maxTurns: number;
    agentIds: string[];
  }): void {
    const insertBattle = this.db.prepare(`
      INSERT INTO battles (id, scenario_id, max_turns)
      VALUES (?1, ?2, ?3)
    `);

    const insertAgent = this.db.prepare(
      'INSERT INTO battle_agents (battle_id, agent_id) VALUES (?1, ?2)'
    );

    const tx = this.db.transaction(() => {
      insertBattle.run(battle.id, battle.scenarioId, battle.maxTurns);
      for (const agentId of battle.agentIds) {
        insertAgent.run(battle.id, agentId);
      }
    });
    tx();
  }

  updateBattleState(battleId: string, updates: {
    state?: BattleState;
    telegramChatId?: number;
    activeAgentId?: string | null;
    currentTurn?: number;
    commitment?: string;
    roles?: Record<string, BattleRole>;
    scenarioData?: Record<string, unknown>;
    outcome?: BattleOutcome;
    startedAt?: number;
    endedAt?: number;
  }): void {
    const sets: string[] = [];
    const values: (string | number | null)[] = [];
    let paramIdx = 1;

    if (updates.state !== undefined) { sets.push(`state = ?${paramIdx++}`); values.push(updates.state); }
    if (updates.telegramChatId !== undefined) { sets.push(`telegram_chat_id = ?${paramIdx++}`); values.push(updates.telegramChatId); }
    if (updates.activeAgentId !== undefined) { sets.push(`active_agent_id = ?${paramIdx++}`); values.push(updates.activeAgentId); }
    if (updates.currentTurn !== undefined) { sets.push(`current_turn = ?${paramIdx++}`); values.push(updates.currentTurn); }
    if (updates.commitment !== undefined) { sets.push(`commitment = ?${paramIdx++}`); values.push(updates.commitment); }
    if (updates.roles !== undefined) { sets.push(`roles_json = ?${paramIdx++}`); values.push(JSON.stringify(updates.roles)); }
    if (updates.scenarioData !== undefined) { sets.push(`scenario_data_json = ?${paramIdx++}`); values.push(JSON.stringify(updates.scenarioData)); }
    if (updates.outcome !== undefined) { sets.push(`outcome_json = ?${paramIdx++}`); values.push(JSON.stringify(updates.outcome)); }
    if (updates.startedAt !== undefined) { sets.push(`started_at = ?${paramIdx++}`); values.push(updates.startedAt); }
    if (updates.endedAt !== undefined) { sets.push(`ended_at = ?${paramIdx++}`); values.push(updates.endedAt); }

    if (sets.length === 0) return;

    values.push(battleId);
    this.db.prepare(`UPDATE battles SET ${sets.join(', ')} WHERE id = ?${paramIdx}`).run(...values);
  }

  getBattle(battleId: string): Battle | null {
    const row = this.db.prepare('SELECT * FROM battles WHERE id = ?1').get(battleId) as BattleRow | null;
    if (!row) return null;

    const agentRows = this.db.prepare(
      'SELECT a.* FROM agents a JOIN battle_agents ba ON a.id = ba.agent_id WHERE ba.battle_id = ?1'
    ).all(battleId) as AgentRow[];

    const turnRows = this.db.prepare(
      'SELECT * FROM turns WHERE battle_id = ?1 ORDER BY turn_number'
    ).all(battleId) as TurnRow[];

    return this.rowToBattle(row, agentRows, turnRows);
  }

  getActiveBattleForAgent(agentId: string): Battle | null {
    const row = this.db.prepare(`
      SELECT b.* FROM battles b
      JOIN battle_agents ba ON b.id = ba.battle_id
      WHERE ba.agent_id = ?1 AND b.state IN ('pending', 'setup', 'active')
      LIMIT 1
    `).get(agentId) as BattleRow | null;

    if (!row) return null;
    return this.getBattle(row.id);
  }

  getScenarioData(battleId: string): Record<string, unknown> {
    const row = this.db.prepare(
      'SELECT scenario_data_json FROM battles WHERE id = ?1'
    ).get(battleId) as { scenario_data_json: string } | null;
    return row ? JSON.parse(row.scenario_data_json) as Record<string, unknown> : {};
  }

  // --- Turns ---

  addTurn(battleId: string, agentId: string, message: string, turnNumber: number): void {
    this.db.prepare(`
      INSERT INTO turns (battle_id, agent_id, message, turn_number)
      VALUES (?1, ?2, ?3, ?4)
    `).run(battleId, agentId, message, turnNumber);
  }

  // --- Row mapping ---

  private rowToAgent(row: AgentRow): Agent {
    return {
      id: row.id,
      name: row.name,
      telegramUserId: row.telegram_user_id,
      wallet: row.wallet ?? undefined,
    };
  }

  private rowToBattle(row: BattleRow, agentRows: AgentRow[], turnRows: TurnRow[]): Battle {
    const roles = JSON.parse(row.roles_json) as Record<string, BattleRole>;
    const outcome = row.outcome_json ? JSON.parse(row.outcome_json) as BattleOutcome : undefined;

    return {
      id: row.id,
      scenarioId: row.scenario_id,
      agents: agentRows.map(a => this.rowToAgent(a)),
      roles,
      telegramChatId: row.telegram_chat_id,
      state: row.state as BattleState,
      turns: turnRows.map(t => ({
        agentId: t.agent_id,
        message: t.message,
        turnNumber: t.turn_number,
        timestamp: t.timestamp,
      })),
      maxTurns: row.max_turns,
      currentTurn: row.current_turn,
      activeAgentId: row.active_agent_id,
      commitment: row.commitment ?? undefined,
      outcome,
      createdAt: row.created_at,
      startedAt: row.started_at ?? undefined,
      endedAt: row.ended_at ?? undefined,
    };
  }

  close(): void {
    this.db.close();
  }
}

// --- Row types (internal) ---

interface AgentRow {
  id: string;
  name: string;
  telegram_user_id: number;
  wallet: string | null;
  wins: number;
  losses: number;
  draws: number;
  elo: number;
  created_at: number;
}

interface BattleRow {
  id: string;
  scenario_id: string;
  state: string;
  telegram_chat_id: number;
  max_turns: number;
  current_turn: number;
  active_agent_id: string | null;
  commitment: string | null;
  outcome_json: string | null;
  roles_json: string;
  scenario_data_json: string;
  created_at: number;
  started_at: number | null;
  ended_at: number | null;
}

interface TurnRow {
  id: number;
  battle_id: string;
  agent_id: string;
  message: string;
  turn_number: number;
  timestamp: number;
}
