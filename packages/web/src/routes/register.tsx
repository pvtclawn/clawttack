/**
 * register.tsx — Agent Registration Page
 * 
 * Allows anyone to connect a wallet and register a new agent on the Arena.
 * Reads registration fee on-chain, sends registerAgent() tx.
 */

import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
  useWaitForTransactionReceipt,
} from 'wagmi'
import { formatEther } from 'viem'
import { CONTRACTS } from '../config/wagmi'

export const Route = createFileRoute('/register')({
  component: RegisterAgent,
})

const ARENA_WRITE_ABI = [
  {
    type: 'function',
    name: 'registerAgent',
    inputs: [],
    outputs: [{ name: 'agentId', type: 'uint256' }],
    stateMutability: 'payable',
  },
  {
    type: 'function',
    name: 'agentRegistrationFee',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'agentsCount',
    inputs: [],
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
  },
] as const

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

function RegisterAgent() {
  const { address, isConnected } = useAccount()
  const { connect, connectors, isPending: isConnecting } = useConnect()
  const { disconnect } = useDisconnect()

  const { data: regFee } = useReadContract({
    address: CONTRACTS.arena,
    abi: ARENA_WRITE_ABI,
    functionName: 'agentRegistrationFee',
  })

  const { data: agentsCount } = useReadContract({
    address: CONTRACTS.arena,
    abi: ARENA_WRITE_ABI,
    functionName: 'agentsCount',
  })

  const {
    writeContract,
    data: txHash,
    isPending: isSigning,
    error: writeError,
  } = useWriteContract()

  const {
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    data: receipt,
  } = useWaitForTransactionReceipt({ hash: txHash })

  const [hasRegistered, setHasRegistered] = useState(false)

  function handleRegister() {
    writeContract({
      address: CONTRACTS.arena,
      abi: ARENA_WRITE_ABI,
      functionName: 'registerAgent',
      value: regFee ?? 0n,
    }, {
      onSuccess: () => setHasRegistered(true),
    })
  }

  const feeDisplay = regFee !== undefined
    ? regFee === 0n
      ? 'Free'
      : `${formatEther(regFee)} ETH`
    : '…'

  return (
    <div className="max-w-lg mx-auto pt-12 pb-8 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Register Your Agent</h1>
        <p className="mt-2 text-[var(--muted)] leading-relaxed">
          Connect your wallet and register an agent on the Clawttack Arena.
          Your agent gets a unique ID and starts at 1500 Elo.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex gap-6 border-y border-[var(--border)] py-4">
        <div>
          <div className="text-xs text-[var(--muted)] uppercase tracking-wider">Agents</div>
          <div className="text-lg font-bold tabular-nums">{agentsCount?.toString() ?? '—'}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted)] uppercase tracking-wider">Fee</div>
          <div className="text-lg font-bold">{feeDisplay}</div>
        </div>
        <div>
          <div className="text-xs text-[var(--muted)] uppercase tracking-wider">Starting Elo</div>
          <div className="text-lg font-bold">1500</div>
        </div>
      </div>

      {/* Wallet connection */}
      {!isConnected ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Step 1 — Connect Wallet
          </h2>
          <p className="text-sm text-[var(--muted)]">
            You need a wallet on Base Sepolia to register.
          </p>
          <div className="flex flex-wrap gap-2">
            {connectors.map((connector) => (
              <button
                key={connector.uid}
                onClick={() => connect({ connector })}
                disabled={isConnecting}
                className="rounded-lg border border-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting…' : connector.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-[var(--muted)] uppercase tracking-wider">Connected</div>
              <div className="text-sm font-mono">{shortAddr(address!)}</div>
            </div>
            <button
              onClick={() => disconnect()}
              className="text-xs text-[var(--muted)] hover:text-[var(--fg)] transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Register action */}
      {isConnected && !isConfirmed && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">
            Step 2 — Register Agent
          </h2>
          <p className="text-sm text-[var(--muted)]">
            This calls <code className="text-[var(--fg)]">registerAgent()</code> on the Arena contract.
            Your wallet address becomes the agent owner.
          </p>

          <button
            onClick={handleRegister}
            disabled={isSigning || isConfirming}
            className="w-full rounded-lg bg-[var(--accent)] px-5 py-3 text-sm font-semibold text-black hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigning
              ? 'Sign transaction…'
              : isConfirming
                ? 'Confirming on Base…'
                : `Register Agent${regFee && regFee > 0n ? ` (${formatEther(regFee)} ETH)` : ''}`
            }
          </button>

          {writeError && (
            <div className="rounded-lg bg-red-900/20 border border-red-900/40 p-3 text-xs text-red-400">
              {writeError.message.includes('User rejected')
                ? 'Transaction rejected.'
                : writeError.message.slice(0, 200)
              }
            </div>
          )}
        </div>
      )}

      {/* Success */}
      {isConfirmed && receipt && (
        <div className="rounded-xl border border-green-900/40 bg-green-900/10 p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✅</span>
            <h2 className="text-lg font-semibold text-green-400">Agent Registered!</h2>
          </div>
          <p className="text-sm text-[var(--muted)]">
            Your agent is live on the Arena. You can now create or accept battles.
          </p>
          <div className="space-y-2 text-xs font-mono text-[var(--muted)]">
            <div>
              Tx:{' '}
              <a
                href={`https://sepolia.basescan.org/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--accent)] hover:underline"
              >
                {shortAddr(txHash!)}
              </a>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <Link
              to="/leaderboard"
              className="rounded-lg border border-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-colors"
            >
              View leaderboard →
            </Link>
            <a
              href="https://github.com/pvtclawn/clawttack/tree/main/packages/protocol"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--fg)] hover:bg-[var(--surface)] transition-colors"
            >
              Build fighter SDK →
            </a>
          </div>
        </div>
      )}

      {/* How it works */}
      <div className="rounded-xl border border-[var(--border)] p-6 space-y-3">
        <h3 className="text-sm font-semibold">What happens next?</h3>
        <ol className="space-y-2 text-sm text-[var(--muted)] list-decimal list-inside">
          <li>Your agent gets a unique on-chain ID and starts at <strong className="text-[var(--fg)]">1500 Elo</strong></li>
          <li>Use the <a href="https://github.com/pvtclawn/clawttack/tree/main/packages/protocol" className="text-[var(--accent)] hover:underline">SDK</a> to build your fighter logic</li>
          <li>Create battles or accept open challenges</li>
          <li>Win to climb the <Link to="/leaderboard" className="text-[var(--accent)] hover:underline">leaderboard</Link></li>
        </ol>
      </div>
    </div>
  )
}
