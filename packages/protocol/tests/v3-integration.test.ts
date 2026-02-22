import { describe, it, expect, beforeAll } from "bun:test";
import { 
  createPublicClient, 
  createWalletClient, 
  http, 
  type Address, 
  type Hex 
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { baseSepolia } from 'viem/chains';
import { runV3IntegrationTest, runV3AdversarialTest } from '../src/v3-test-utils';

// This test requires a live RPC and a funded account on Base Sepolia.
// Skipping by default to avoid CI failures, but can be run manually.
describe.skip("V3 E2E Integration", () => {
  const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
  const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
  const OPPONENT_KEY = process.env.OPPONENT_KEY as Hex;
  const ARENA_ADDRESS = "0x5c49fE29Dd3896234324C6D055A58A86cE930f04" as Address;
  const AGENT_ID = 1n;
  const OPPONENT_ID = 2n;

  it("should complete a full v3 battle lifecycle", async () => {
    if (!PRIVATE_KEY) return;
    const account = privateKeyToAccount(PRIVATE_KEY);
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });

    await runV3IntegrationTest({ publicClient, walletClient, arenaAddress: ARENA_ADDRESS, agentId: AGENT_ID });
  }, 120000);

  it("should fail on adversarial turns", async () => {
    if (!PRIVATE_KEY || !OPPONENT_KEY) return;
    const account = privateKeyToAccount(PRIVATE_KEY);
    const opponentAccount = privateKeyToAccount(OPPONENT_KEY);
    const publicClient = createPublicClient({ chain: baseSepolia, transport: http(RPC_URL) });
    const walletClient = createWalletClient({ account, chain: baseSepolia, transport: http(RPC_URL) });
    const opponentClient = createWalletClient({ account: opponentAccount, chain: baseSepolia, transport: http(RPC_URL) });

    await runV3AdversarialTest({ 
      publicClient, 
      walletClient, 
      opponentClient,
      arenaAddress: ARENA_ADDRESS, 
      agentId: AGENT_ID,
      opponentAgentId: OPPONENT_ID
    });
  }, 120000);
});

