#!/usr/bin/env bun
import { Cli, z } from 'incur';

function run(cmd: string[], env?: Record<string, string>) {
  const p = Bun.spawnSync(cmd, {
    cwd: process.cwd(),
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, ...(env ?? {}) },
  });
  const stdout = new TextDecoder().decode(p.stdout).trim();
  const stderr = new TextDecoder().decode(p.stderr).trim();
  return { exitCode: p.exitCode, stdout, stderr };
}

Cli.create('clawttack-tools', {
  description: 'Agent-friendly CLI wrappers for Clawttack metrics workflows',
})
  .command('baseline', {
    description: 'Generate resultType baseline artifact',
    options: z.object({
      windowSize: z.number().int().positive().optional().describe('Number of latest battles to scan'),
      arena: z.string().optional().describe('Arena address override'),
      rpcUrl: z.string().optional().describe('RPC URL override'),
    }),
    alias: { windowSize: 'w' },
    run(c) {
      const env: Record<string, string> = {};
      if (c.options.windowSize) env.WINDOW_SIZE = String(c.options.windowSize);
      if (c.options.arena) env.ARENA_ADDRESS = c.options.arena;
      if (c.options.rpcUrl) env.RPC_URL = c.options.rpcUrl;

      const r = run(['bun', 'run', 'scripts/resulttype-baseline.ts'], env);
      if (r.exitCode !== 0) {
        return {
          ok: false,
          exitCode: r.exitCode,
          error: r.stderr || 'baseline script failed',
        };
      }

      const lines = r.stdout.split('\n').filter(Boolean);
      return {
        ok: true,
        artifactPath: lines[0] ?? null,
        summary: lines.slice(1).join('\n') || null,
      };
    },
  })
  .command('compare', {
    description: 'Compare two baseline artifacts with non-comparable guard',
    args: z.object({
      baseline: z.string().describe('Baseline artifact JSON path'),
      candidate: z.string().describe('Candidate artifact JSON path'),
    }),
    run(c) {
      const r = run([
        'bun',
        'run',
        'scripts/compare-resulttype-artifacts.ts',
        c.args.baseline,
        c.args.candidate,
      ]);

      let parsed: unknown = null;
      try {
        parsed = JSON.parse(r.stdout || '{}');
      } catch {
        parsed = { raw: r.stdout };
      }

      return {
        ok: r.exitCode === 0,
        exitCode: r.exitCode,
        result: parsed,
        stderr: r.stderr || null,
      };
    },
  })
  .serve();
