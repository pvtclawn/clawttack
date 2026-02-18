#!/usr/bin/env bun
// scripts/waku-spectate.ts — Watch a live Clawttack battle via Waku P2P
//
// Usage:
//   bun run scripts/waku-spectate.ts <battleId> [--chat]
//
// Without --chat: read-only spectator (see turns as they happen)
// With --chat: can also send spectator messages

import { WakuTransport } from '../packages/sdk/src/waku-transport.ts';

const battleId = process.argv[2];
const chatMode = process.argv.includes('--chat');

if (!battleId) {
  console.error('Usage: bun run scripts/waku-spectate.ts <battleId> [--chat]');
  process.exit(1);
}

console.log(`🔭 Spectating battle: ${battleId}`);
console.log(`   Mode: ${chatMode ? '💬 Chat (can send messages)' : '👀 Watch only'}`);
console.log('   Connecting to Waku...\n');

const transport = new WakuTransport({ battleId });

// Listen for agent registrations
transport.on('registered', (data: any) => {
  console.log(`📋 Agent registered: ${data.address}`);
});

// Listen for battle start
transport.on('battleStarted', (data: any) => {
  console.log(`\n⚔️  BATTLE STARTED!`);
  console.log(`   ${data.agents?.[0] ?? '?'} vs ${data.agents?.[1] ?? '?'}\n`);
});

// Listen for turns
transport.on('turn', (turn: any) => {
  const time = new Date(turn.timestamp).toLocaleTimeString();
  const addr = turn.agentAddress?.slice(0, 10) ?? '?';
  const sig = turn.signature?.slice(0, 12) ?? 'unsigned';
  console.log(`\n┌─ Turn ${turn.turnNumber} │ ${addr}… │ ${time}`);
  console.log(`│  ${turn.message}`);
  console.log(`└─ sig: ${sig}…`);
});

// Listen for spectator messages
transport.on('spectatorMessage', (msg: any) => {
  const time = new Date(msg.timestamp).toLocaleTimeString();
  console.log(`  💬 [${msg.sender}] ${msg.message}  (${time})`);
});

// Listen for system events (forfeit, etc)
transport.on('system', (data: any) => {
  console.log(`\n⚡ System: ${JSON.stringify(data)}`);
});

// Listen for battle end
transport.on('battleEnded', (data: any) => {
  console.log(`\n🏁 BATTLE ENDED`);
  console.log(`   Winner: ${data.winner ?? 'Draw'}`);
  console.log(`   Reason: ${data.reason ?? 'unknown'}`);
  process.exit(0);
});

// Connect
await transport.connect();
console.log('✅ Connected to Waku. Waiting for battle activity...\n');

// Chat mode: read from stdin
if (chatMode) {
  console.log('Type a message and press Enter to chat as spectator.\n');

  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();

  (async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const line = decoder.decode(value).trim();
      if (line) {
        await transport.sendSpectatorMessage(line, 'spectator');
      }
    }
  })();
}

// Keep alive
await new Promise(() => {});
