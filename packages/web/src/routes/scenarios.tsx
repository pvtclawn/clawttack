import { createFileRoute } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

const client = createPublicClient({
  chain: baseSepolia,
  transport: http('https://sepolia.base.org'),
})

const SCENARIO_ABI = [
  { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'description', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' },
  { type: 'function', name: 'playerCount', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' },
  { type: 'function', name: 'maxTurns', inputs: [], outputs: [{ type: 'uint16' }], stateMutability: 'view' },
] as const

interface ScenarioInfo {
  address: `0x${string}`
  name: string
  description: string
  playerCount: number
  maxTurns: number
  type: 'asymmetric' | 'symmetric'
  emoji: string
}

const KNOWN_SCENARIOS: Array<{ address: `0x${string}`; type: 'asymmetric' | 'symmetric'; emoji: string }> = [
  { address: '0x3D160303816ed14F05EA8784Ef9e021a02B747C4', type: 'asymmetric', emoji: '🗡️' },
  { address: '0xa5313FB027eBD60dE2856bA134A689bbd30a6CC9', type: 'symmetric', emoji: '🎲' },
]

export const Route = createFileRoute('/scenarios')({
  component: ScenariosPage,
})

function useScenarios() {
  return useQuery({
    queryKey: ['scenarios'],
    queryFn: async (): Promise<ScenarioInfo[]> => {
      const results = await Promise.all(
        KNOWN_SCENARIOS.map(async (s) => {
          const [name, description, playerCount, maxTurns] = await Promise.all([
            client.readContract({ address: s.address, abi: SCENARIO_ABI, functionName: 'name' }),
            client.readContract({ address: s.address, abi: SCENARIO_ABI, functionName: 'description' }),
            client.readContract({ address: s.address, abi: SCENARIO_ABI, functionName: 'playerCount' }),
            client.readContract({ address: s.address, abi: SCENARIO_ABI, functionName: 'maxTurns' }),
          ])
          return {
            address: s.address,
            name: name as string,
            description: description as string,
            playerCount: Number(playerCount),
            maxTurns: Number(maxTurns),
            type: s.type,
            emoji: s.emoji,
          }
        }),
      )
      return results
    },
    staleTime: 300_000, // 5 min cache
  })
}

function ScenariosPage() {
  const { data: scenarios, isLoading } = useScenarios()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Scenarios</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pluggable smart contracts that define battle rules. Anyone can deploy a custom scenario.
        </p>
      </div>

      {isLoading && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[var(--muted)]">
          ⏳ Reading scenario contracts from Base Sepolia...
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {scenarios?.map((s) => (
          <div
            key={s.address}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4"
          >
            <div className="flex items-center gap-3">
              <span className="text-3xl">{s.emoji}</span>
              <div>
                <h2 className="text-lg font-semibold">{s.name}</h2>
                <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                  s.type === 'symmetric'
                    ? 'bg-blue-900/50 text-blue-400'
                    : 'bg-purple-900/50 text-purple-400'
                }`}>
                  {s.type}
                </span>
              </div>
            </div>

            <p className="text-sm text-[var(--muted)] leading-relaxed">{s.description}</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--bg)] p-3">
                <div className="text-lg font-bold text-[var(--accent)]">{s.playerCount}</div>
                <div className="text-xs text-[var(--muted)]">Players</div>
              </div>
              <div className="rounded-lg bg-[var(--bg)] p-3">
                <div className="text-lg font-bold text-[var(--accent)]">{s.maxTurns}</div>
                <div className="text-xs text-[var(--muted)]">Max Turns</div>
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-3">
              <a
                href={`https://sepolia.basescan.org/address/${s.address}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[var(--accent)] hover:underline font-mono"
              >
                {s.address.slice(0, 10)}…{s.address.slice(-8)} ↗
              </a>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-6 text-center">
        <div className="text-2xl mb-2">🔧</div>
        <h3 className="font-semibold mb-1">Build Your Own</h3>
        <p className="text-sm text-[var(--muted)]">
          Deploy a contract implementing{' '}
          <a
            href="https://github.com/pvtclawn/clawttack/blob/main/packages/contracts/src/IScenario.sol"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            IScenario
          </a>
          {' '}to create a custom battle scenario.
        </p>
      </div>
    </div>
  )
}
