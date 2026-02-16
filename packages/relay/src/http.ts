// src/relay/http.ts — HTTP + WebSocket server for Clawttack relay
//
// Exposes:
//   POST /api/battles          — create a battle
//   GET  /api/battles          — list battles
//   GET  /api/battles/:id      — get battle details
//   WS   /ws/battle/:id        — join as agent or spectator
//   GET  /api/battles/:id/log  — export verified battle log (for IPFS / self-settlement)
//   GET  /health               — health check

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { ServerWebSocket } from 'bun';
import { exportBattleLog, verifyBattleLog } from '@clawttack/protocol';
import type { RelayAgent } from '@clawttack/protocol';
import { RelayServer } from './server.ts';

/** Connection state attached to each WebSocket */
interface WsData {
  role: 'agent' | 'spectator';
  battleId: string;
  agentAddress?: string;
}

/** Configuration for the HTTP relay */
export interface RelayHttpConfig {
  port: number;
  host?: string;
  apiKey?: string; // Optional API key for battle creation
}

/** Create and start the full relay HTTP + WS server */
export function createRelayApp(relay: RelayServer, config: RelayHttpConfig) {
  const app = new Hono();

  // CORS for web UI
  app.use('*', cors());

  // Health check
  app.get('/health', (c) =>
    c.json({ status: 'ok', version: '0.2.0', uptime: process.uptime() }),
  );

  // Create a battle
  app.post('/api/battles', async (c) => {
    // Optional API key auth
    if (config.apiKey) {
      const auth = c.req.header('Authorization');
      if (auth !== `Bearer ${config.apiKey}`) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
    }

    const body = await c.req.json<{
      id?: string;
      scenarioId: string;
      agents: Array<{ address: string; name: string }>;
      maxTurns?: number;
      commitment: string;
      scenarioData?: Record<string, unknown>;
      roles: Record<string, string>;
    }>();

    if (!body.scenarioId || !body.agents || !body.commitment || !body.roles) {
      return c.json({ error: 'Missing required fields: scenarioId, agents, commitment, roles' }, 400);
    }

    if (body.agents.length < 2) {
      return c.json({ error: 'At least 2 agents required' }, 400);
    }

    const battleId = body.id ?? crypto.randomUUID();

    try {
      const battle = relay.createBattle({
        id: battleId,
        scenarioId: body.scenarioId,
        agents: body.agents.map(
          (a): RelayAgent => ({ address: a.address, name: a.name, connected: false }),
        ),
        maxTurns: body.maxTurns ?? 20,
        commitment: body.commitment,
        scenarioData: body.scenarioData ?? {},
        roles: body.roles,
      });

      return c.json({
        battleId: battle.id,
        wsUrl: `/ws/battle/${battle.id}`,
        state: battle.state,
      }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return c.json({ error: message }, 409);
    }
  });

  // List battles
  app.get('/api/battles', (c) => {
    const battles = relay.listBattles().map((b) => ({
      id: b.id,
      scenarioId: b.scenarioId,
      state: b.state,
      agents: b.agents.map((a) => ({
        address: a.address,
        name: a.name,
        connected: a.connected,
      })),
      turnCount: b.turns.length,
      maxTurns: b.maxTurns,
      createdAt: b.createdAt,
      startedAt: b.startedAt,
      endedAt: b.endedAt,
    }));

    return c.json({ battles });
  });

  // Get battle details
  app.get('/api/battles/:id', (c) => {
    const battle = relay.getBattle(c.req.param('id'));
    if (!battle) {
      return c.json({ error: 'Battle not found' }, 404);
    }

    return c.json({
      id: battle.id,
      scenarioId: battle.scenarioId,
      state: battle.state,
      agents: battle.agents.map((a) => ({
        address: a.address,
        name: a.name,
        connected: a.connected,
        role: battle.roles[a.address],
      })),
      turns: battle.turns.map((t) => ({
        agentAddress: t.agentAddress,
        message: t.message,
        turnNumber: t.turnNumber,
        timestamp: t.timestamp,
        role: t.role,
        // Signature included for verification
        signature: t.signature,
      })),
      maxTurns: battle.maxTurns,
      commitment: battle.commitment,
      outcome: battle.outcome,
      ipfsCid: battle.ipfsCid,
      createdAt: battle.createdAt,
      startedAt: battle.startedAt,
      endedAt: battle.endedAt,
    });
  });

  // Export verified battle log (for IPFS upload / self-settlement)
  app.get('/api/battles/:id/log', (c) => {
    const battle = relay.getBattle(c.req.param('id'));
    if (!battle) {
      return c.json({ error: 'Battle not found' }, 404);
    }
    if (battle.state !== 'ended') {
      return c.json({ error: 'Battle has not ended yet' }, 400);
    }

    try {
      const log = exportBattleLog(battle);
      const verification = verifyBattleLog(log);
      return c.json({
        log,
        verification: {
          valid: verification.valid,
          errors: verification.errors,
          warnings: verification.warnings,
          merkleRoot: verification.merkleRoot,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Export failed';
      return c.json({ error: message }, 500);
    }
  });

  return app;
}

/** Start the Bun server with HTTP (Hono) + WebSocket upgrade */
export function startRelayServer(relay: RelayServer, config: RelayHttpConfig) {
  const app = createRelayApp(relay, config);

  const server = Bun.serve<WsData>({
    port: config.port,
    hostname: config.host ?? '0.0.0.0',

    // HTTP handler via Hono
    async fetch(req, server) {
      const url = new URL(req.url);

      // WebSocket upgrade for /ws/battle/:id
      const wsMatch = url.pathname.match(/^\/ws\/battle\/([^/]+)$/);
      if (wsMatch && req.headers.get('upgrade')?.toLowerCase() === 'websocket') {
        const battleId = wsMatch[1]!;
        const role = url.searchParams.get('role') === 'spectator' ? 'spectator' : 'agent';

        const battle = relay.getBattle(battleId);
        if (!battle) {
          return new Response('Battle not found', { status: 404 });
        }

        const upgraded = server.upgrade(req, {
          data: { role, battleId } as WsData,
        });

        if (!upgraded) {
          return new Response('WebSocket upgrade failed', { status: 500 });
        }
        return undefined;
      }

      // Regular HTTP via Hono
      return app.fetch(req);
    },

    websocket: {
      open(ws) {
        relay.handleOpen(ws as any);
      },
      message(ws, message) {
        const raw = typeof message === 'string' ? message : message.toString();
        relay.handleMessage(ws as any, raw);
      },
      close(ws) {
        relay.handleClose(ws as any);
      },
    },
  });

  console.log(`🏟️  Clawttack relay listening on ${server.hostname}:${server.port}`);
  return server;
}
