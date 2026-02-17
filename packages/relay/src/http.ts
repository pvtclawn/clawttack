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
import { RateLimiter } from './rate-limiter.ts';
import { AgentRegistry, registrationMessage } from './agent-registry.ts';
import { Matchmaker } from './matchmaker.ts';

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
  agentRegistry?: AgentRegistry; // Optional agent registration
  matchmaker?: Matchmaker; // Optional matchmaking
  /** Max battle creations per minute per key/IP (default: 10) */
  createRateLimit?: number;
  /** Max turn submissions per minute per agent (default: 30) */
  turnRateLimit?: number;
}

/** Create and start the full relay HTTP + WS server */
export function createRelayApp(relay: RelayServer, config: RelayHttpConfig) {
  const app = new Hono();

  // Rate limiters
  const createLimiter = new RateLimiter(config.createRateLimit ?? 10, (config.createRateLimit ?? 10) / 60);
  const turnLimiter = new RateLimiter(config.turnRateLimit ?? 30, (config.turnRateLimit ?? 30) / 60);

  // CORS for web UI
  app.use('*', cors());

  // Health check
  app.get('/health', (c) =>
    c.json({ status: 'ok', version: '0.3.0', uptime: process.uptime() }),
  );

  // Relay stats (public, no auth needed)
  app.get('/api/stats', (c) => {
    const battles = relay.listBattles();
    const active = battles.filter(b => b.state === 'active').length;
    const waiting = battles.filter(b => b.state === 'waiting').length;
    const ended = battles.filter(b => b.state === 'ended').length;
    const totalTurns = battles.reduce((sum, b) => sum + b.turns.length, 0);

    return c.json({
      uptime: process.uptime(),
      battles: { active, waiting, ended, total: battles.length },
      totalTurns,
      version: '0.3.0',
    });
  });

  // --- Agent Registration ---

  if (config.agentRegistry) {
    const registry = config.agentRegistry;

    // Get registration challenge message
    app.get('/api/agents/challenge', (c) => {
      const address = c.req.query('address');
      if (!address) return c.json({ error: 'Missing address query parameter' }, 400);
      return c.json({ message: registrationMessage(address) });
    });

    // Register an agent
    app.post('/api/agents/register', async (c) => {
      const body = await c.req.json<{
        address: string;
        name: string;
        signature: string;
      }>();

      if (!body.address || !body.name || !body.signature) {
        return c.json({ error: 'Missing required fields: address, name, signature' }, 400);
      }

      if (body.name.length > 32) {
        return c.json({ error: 'Name must be 32 characters or less' }, 400);
      }

      try {
        const agent = registry.register(body.address, body.name, body.signature);
        return c.json({
          address: agent.address,
          name: agent.name,
          apiKey: agent.apiKey,
          registeredAt: agent.registeredAt,
        }, 201);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Registration failed';
        return c.json({ error: message }, 400);
      }
    });

    // List registered agents (public, no API keys)
    app.get('/api/agents', (c) => {
      return c.json({ agents: registry.list() });
    });

    // Get a specific agent (public info)
    app.get('/api/agents/:address', (c) => {
      const agent = registry.getByAddress(c.req.param('address'));
      if (!agent) return c.json({ error: 'Agent not found' }, 404);
      const { apiKey: _, ...publicInfo } = agent;
      return c.json(publicInfo);
    });
  }

  // --- Matchmaking ---

  if (config.matchmaker) {
    const mm = config.matchmaker;

    // Join matchmaking queue (requires registered API key)
    app.post('/api/matchmaking/join', async (c) => {
      // Auth: require registered agent API key
      if (config.agentRegistry) {
        const auth = c.req.header('Authorization');
        const apiKey = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
        const agentAddr = apiKey ? config.agentRegistry.validateKey(apiKey) : null;
        if (!agentAddr) {
          return c.json({ error: 'Valid agent API key required. Register at POST /api/agents/register' }, 401);
        }
      }

      const body = await c.req.json<{
        address: string;
        name: string;
        scenarioId: string;
      }>();

      if (!body.address || !body.name || !body.scenarioId) {
        return c.json({ error: 'Missing required fields: address, name, scenarioId' }, 400);
      }

      const result = mm.join(body.scenarioId, body.address, body.name);
      return c.json(result, result.match ? 201 : 200);
    });

    // Leave matchmaking queue
    app.post('/api/matchmaking/leave', async (c) => {
      const body = await c.req.json<{ address: string }>();
      if (!body.address) return c.json({ error: 'Missing address' }, 400);
      const left = mm.leave(body.address);
      return c.json({ left });
    });

    // Queue status
    app.get('/api/matchmaking/status', (c) => {
      return c.json(mm.status());
    });
  }

  // Create a battle
  app.post('/api/battles', async (c) => {
    // Optional API key auth
    if (config.apiKey) {
      const auth = c.req.header('Authorization');
      if (auth !== `Bearer ${config.apiKey}`) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
    }

    // Rate limit by API key or IP
    const rateLimitKey = c.req.header('Authorization') ?? c.req.header('x-forwarded-for') ?? 'anonymous';
    if (!createLimiter.consume(rateLimitKey)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
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

  // Register agent via HTTP (no WebSocket needed)
  app.post('/api/battles/:id/register', async (c) => {
    const battleId = c.req.param('id');
    const body = await c.req.json<{ agentAddress: string }>();
    if (!body.agentAddress) {
      return c.json({ error: 'Missing agentAddress' }, 400);
    }
    const result = relay.registerAgentHttp(battleId, body.agentAddress);
    if (!result.ok) {
      return c.json({ error: result.error }, 400);
    }
    return c.json({ ok: true });
  });

  // Poll for turn status
  app.get('/api/battles/:id/turn', (c) => {
    const battleId = c.req.param('id');
    const agentAddress = c.req.query('agent');
    if (!agentAddress) {
      return c.json({ error: 'Missing ?agent= query parameter' }, 400);
    }
    const status = relay.getTurnStatus(battleId, agentAddress);
    if (!status) {
      return c.json({ error: 'Battle not found' }, 404);
    }
    return c.json(status);
  });

  // Submit a signed turn via HTTP
  app.post('/api/battles/:id/turn', async (c) => {
    const battleId = c.req.param('id');
    const body = await c.req.json<{
      agentAddress: string;
      message: string;
      turnNumber: number;
      timestamp: number;
      signature: string;
    }>();

    if (!body.agentAddress || !body.message || !body.turnNumber || !body.timestamp || !body.signature) {
      return c.json({ error: 'Missing required fields' }, 400);
    }

    // Rate limit by agent address
    if (!turnLimiter.consume(body.agentAddress)) {
      return c.json({ error: 'Rate limit exceeded' }, 429);
    }

    const result = await relay.submitTurnHttp(battleId, body);
    if (!result.ok) {
      return c.json({ error: result.error }, 400);
    }
    return c.json({ ok: true });
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
