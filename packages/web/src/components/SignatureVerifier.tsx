// packages/web/src/components/SignatureVerifier.tsx
// Client-side ECDSA signature verification for battle turns
import { useState } from 'react'
import { ethers } from 'ethers'

interface Turn {
  agentAddress: string
  message: string
  turnNumber: number
  timestamp: number
  signature: string
}

interface VerificationResult {
  turnNumber: number
  valid: boolean
  recoveredAddress: string
  expectedAddress: string
}

/** Canonical turn hash — matches protocol + Solidity ecrecover */
function canonicalTurnHash(battleId: string, agentAddress: string, message: string, turnNumber: number, timestamp: number): string {
  const messageHash = ethers.keccak256(ethers.toUtf8Bytes(message))
  return ethers.solidityPackedKeccak256(
    ['bytes32', 'address', 'uint16', 'uint64', 'bytes32'],
    [
      ethers.zeroPadValue(ethers.toUtf8Bytes(battleId.slice(0, 32).padEnd(32, '\0')), 32),
      agentAddress,
      turnNumber,
      timestamp,
      messageHash,
    ],
  )
}

export function SignatureVerifier({ turns, battleId }: { turns: Turn[]; battleId: string }) {
  const [results, setResults] = useState<VerificationResult[] | null>(null)
  const [verifying, setVerifying] = useState(false)

  const verifyAll = async () => {
    setVerifying(true)
    const verified: VerificationResult[] = []

    for (const turn of turns) {
      try {
        const hash = canonicalTurnHash(battleId, turn.agentAddress, turn.message, turn.turnNumber, turn.timestamp)
        const recovered = ethers.verifyMessage(ethers.getBytes(hash), turn.signature).toLowerCase()
        verified.push({
          turnNumber: turn.turnNumber,
          valid: recovered === turn.agentAddress.toLowerCase(),
          recoveredAddress: recovered,
          expectedAddress: turn.agentAddress.toLowerCase(),
        })
      } catch {
        verified.push({
          turnNumber: turn.turnNumber,
          valid: false,
          recoveredAddress: '(verification failed)',
          expectedAddress: turn.agentAddress.toLowerCase(),
        })
      }
    }

    setResults(verified)
    setVerifying(false)
  }

  const allValid = results?.every((r) => r.valid) ?? false
  const invalidCount = results?.filter((r) => !r.valid).length ?? 0

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔐</span>
          <span className="text-sm font-medium">Signature Verification</span>
        </div>
        {!results ? (
          <button
            onClick={verifyAll}
            disabled={verifying}
            className="rounded-lg border border-[var(--border)] px-3 py-1 text-xs hover:bg-[var(--bg)] disabled:opacity-50"
          >
            {verifying ? '⏳ Verifying...' : '✓ Verify All Turns'}
          </button>
        ) : (
          <div className={`text-xs font-medium ${allValid ? 'text-green-400' : 'text-red-400'}`}>
            {allValid
              ? `✅ All ${results.length} turns verified`
              : `❌ ${invalidCount} invalid signature${invalidCount > 1 ? 's' : ''}`}
          </div>
        )}
      </div>

      {results && (
        <div className="mt-3 space-y-1">
          {results.map((r) => (
            <div
              key={r.turnNumber}
              className={`flex items-center gap-2 text-xs font-mono ${
                r.valid ? 'text-green-400/70' : 'text-red-400'
              }`}
            >
              <span>{r.valid ? '✓' : '✗'}</span>
              <span>Turn {r.turnNumber}</span>
              <span className="text-[var(--muted)]">
                {r.valid
                  ? r.recoveredAddress.slice(0, 10) + '…'
                  : `expected ${r.expectedAddress.slice(0, 10)}… got ${r.recoveredAddress.slice(0, 10)}…`}
              </span>
            </div>
          ))}
        </div>
      )}

      {!results && (
        <div className="mt-2 text-xs text-[var(--muted)]">
          Independently verify that every turn was signed by the claimed agent wallet. Runs entirely in your browser.
        </div>
      )}
    </div>
  )
}
