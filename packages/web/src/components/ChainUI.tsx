import { useState } from 'react'
import { formatAddress, agentName, hasKnownName, explorerUrl, copyToClipboard } from '../lib/format'

/** Displays an address with explorer link + copy button */
export function AddressLink({
  address,
  type = 'address',
  className = '',
}: {
  address: string
  type?: 'address' | 'tx'
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  if (!address || address === '0x0000000000000000000000000000000000000000') {
    return <span className="text-[var(--muted)]">—</span>
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (await copyToClipboard(address)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs ${className}`}>
      <a
        href={explorerUrl(type, address)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent)] hover:underline"
        title={address}
      >
        {formatAddress(address)}
      </a>
      <button
        onClick={handleCopy}
        className="opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
        title={copied ? 'Copied!' : 'Copy to clipboard'}
      >
        {copied ? '✓' : '📋'}
      </button>
    </span>
  )
}

/** Displays an agent: known name or linked address, with copy */
export function AgentDisplay({
  address,
  agentId,
  className = '',
  showId = false,
}: {
  address: string
  agentId?: bigint | number
  className?: string
  showId?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const known = hasKnownName(address)
  const name = agentName(address)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (await copyToClipboard(address)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <a
        href={explorerUrl('address', address)}
        target="_blank"
        rel="noopener noreferrer"
        className={`hover:underline ${known ? 'font-medium text-[var(--fg)]' : 'font-mono text-xs text-[var(--accent)]'}`}
        title={address}
      >
        {name}
      </a>
      {showId && agentId !== undefined && (
        <span className="text-[10px] text-[var(--muted)]">#{agentId.toString()}</span>
      )}
      <button
        onClick={handleCopy}
        className="text-[10px] opacity-30 hover:opacity-100 transition-opacity cursor-pointer"
        title={copied ? 'Copied!' : 'Copy address'}
      >
        {copied ? '✓' : '📋'}
      </button>
    </span>
  )
}

/** Displays a tx hash with link + copy */
export function TxLink({
  hash,
  label,
  className = '',
}: {
  hash: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (await copyToClipboard(hash)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }
  }

  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      <a
        href={explorerUrl('tx', hash)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--accent)] hover:underline text-xs"
        title={hash}
      >
        {label ?? `${hash.slice(0, 10)}…`}
      </a>
      <button
        onClick={handleCopy}
        className="text-[10px] opacity-30 hover:opacity-100 transition-opacity cursor-pointer"
        title={copied ? 'Copied!' : 'Copy tx hash'}
      >
        {copied ? '✓' : '📋'}
      </button>
    </span>
  )
}

/** Pulsing skeleton indicator for "thinking" state */
export function ThinkingSkeleton({
  label = 'Thinking...',
  className = '',
}: {
  label?: string
  className?: string
}) {
  return (
    <div className={`animate-pulse rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-4 ${className}`}>
      <div className="flex items-center gap-3">
        <div className="h-3 w-3 rounded-full bg-yellow-500/60 animate-ping" />
        <span className="text-sm text-[var(--muted)] italic">{label}</span>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-3/4 rounded bg-[var(--border)]" />
        <div className="h-3 w-1/2 rounded bg-[var(--border)]" />
      </div>
    </div>
  )
}
