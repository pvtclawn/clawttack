// Quick E2E: two SDK clients register, matchmake, and fight
import { ClawttackClient } from '../packages/sdk/src/client.ts';
import { startRelayServer } from '../packages/relay/src/http.ts';
import { RelayServer } from '../packages/relay/src/server.ts';
import { AgentRegistry } from '../packages/relay/src/agent-registry.ts';
import { Matchmaker } from '../packages/relay/src/matchmaker.ts';

const relay = new RelayServer();
const agentRegistry = new AgentRegistry();
const matchmaker = new Matchmaker(relay, { maxTurns: 4, secrets: ['test secret alpha beta'] });

const PORT = 18787;
startRelayServer(relay, { port: PORT, host: '0.0.0.0', agentRegistry, matchmaker });

// Two test wallets
const KEY_A = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const KEY_B = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';

const clientA = new ClawttackClient({ relayUrl: `http://localhost:${PORT}`, privateKey: KEY_A, name: 'AlphaBot' });
const clientB = new ClawttackClient({ relayUrl: `http://localhost:${PORT}`, privateKey: KEY_B, name: 'BetaBot' });

// 1. Register both
console.log('1. Registering agents...');
const regA = await clientA.register('AlphaBot');
console.log(`   AlphaBot registered, key: ${regA.apiKey.slice(0, 8)}...`);
const regB = await clientB.register('BetaBot');
console.log(`   BetaBot registered, key: ${regB.apiKey.slice(0, 8)}...`);

// 2. Both join matchmaking (one will trigger match)
console.log('2. Joining matchmaking...');
const [matchA, matchB] = await Promise.all([
  clientA.findMatch('injection-ctf', 500, 5000),
  clientB.findMatch('injection-ctf', 500, 5000),
]);

console.log(`3. Match found!`);
console.log(`   Battle: ${(matchA || matchB).battleId.slice(0, 8)}...`);
console.log(`   Agents: ${(matchA || matchB).agents.map(a => a.name).join(' vs ')}`);

// 4. Verify battle exists on relay
const battles = relay.listBattles();
console.log(`4. Relay has ${battles.length} battle(s)`);
console.log(`   State: ${battles[0]?.state}`);
console.log(`   Scenario: ${battles[0]?.scenarioId}`);

// 5. Sign a turn
const signed = await clientA.signTurn('Hello from Alpha!', 1);
console.log(`5. Signed turn: sig=${signed.signature.slice(0, 16)}...`);

console.log('\n✅ Full SDK E2E flow verified!');
matchmaker.destroy();
process.exit(0);
