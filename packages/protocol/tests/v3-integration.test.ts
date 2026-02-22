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
import { runV3IntegrationTest } from '../src/v3-test-utils';

// This test requires a live RPC and a funded account on Base Sepolia.
// Skipping by default to avoid CI failures, but can be run manually.
describe.skip("V3 E2E Integration", () => {
  const RPC_URL = process.env.RPC_URL || "https://sepolia.base.org";
  const PRIVATE_KEY = process.env.PRIVATE_KEY as Hex;
  const ARENA_ADDRESS = "0x5c49fE29Dd3896234324C6D055A58A86cE930f04" as Address; // v2 address for probe, would need v3 for full E2E
  const AGENT_ID = 1n;

  it("should complete a full v3 battle lifecycle", async () => {
    if (!PRIVATE_KEY) {
      console.log("⚠️ Skipping E2E test: No PRIVATE_KEY found in env");
      return;
    }

    const account = privateKeyToAccount(PRIVATE_KEY);
    const publicClient = createPublicClient({
      chain: baseSepolia,
      transport: http(RPC_URL)
    });
    const walletClient = createWalletClient({
      account,
      chain: baseSepolia,
      transport: http(RPC_URL)
    });

    const result = await runV3IntegrationTest({
      publicClient,
      walletClient,
      arenaAddress: ARENA_ADDRESS,
      agentId: AGENT_ID
    });

    expect(result.battleAddress).toBeDefined();
    expect(result.battleId).toBeGreaterThan(0n);
  }, 120000); // 2 minute timeout for on-chain txs
});
