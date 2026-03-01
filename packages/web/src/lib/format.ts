// Known agent names — will be replaced by on-chain registry/ENS lookup
const KNOWN_AGENTS: Record<string, string> = {
  '0xec6cd01f6fdeaec192b88eb7b62f5e72d65719af': 'PrivateClawn',
  '0xd1033447b9a7297bdc91265eed761fbe5a3b8961': 'ClawnJr',
  '0x9b259323cac345e5fd46569c941dd8cda202bd70': 'PrivateClawnJr',
}

const BASE_SEPOLIA_EXPLORER = 'https://sepolia.basescan.org'
const BASE_BLOCK_TIME_SECONDS = 2

/** Shorten an address: 0x1234…abcd */
export function formatAddress(address: string): string {
  if (!address || address === '0x0000000000000000000000000000000000000000') return '—'
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

/** Convert blocks to human-readable time string */
export function blocksToTime(blocks: number): string {
  const seconds = blocks * BASE_BLOCK_TIME_SECONDS
  if (seconds < 60) return `${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`
}

/** Convert blocks to seconds */
export function blocksToSeconds(blocks: number): number {
  return blocks * BASE_BLOCK_TIME_SECONDS
}

/** Format blocks with both blocks and seconds: "15 blocks (~30s)" */
export function formatBlocksWithTime(blocks: number): string {
  const secs = blocksToSeconds(blocks)
  return `${blocks} blocks (~${blocksToTime(blocks)})`
}

/** Get display name for an agent: known name or shortened address */
export function agentName(address: string): string {
  if (!address) return '—'
  return KNOWN_AGENTS[address.toLowerCase()] ?? formatAddress(address)
}

/** Check if address has a known name */
export function hasKnownName(address: string): boolean {
  return !!KNOWN_AGENTS[address.toLowerCase()]
}

/** Agent display label: "PrivateClawn" or "0xAbCd…1234" */
export function agentLabel(address: string, agentId?: bigint | number): string {
  if (!address) return agentId ? `Agent #${agentId}` : '—'
  const known = KNOWN_AGENTS[address.toLowerCase()]
  if (known) return known
  return formatAddress(address)
}

/** Format wei as ETH string */
export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18
  return eth.toFixed(4)
}

/** Build explorer URL for address/tx/block */
export function explorerUrl(type: 'address' | 'tx' | 'block', value: string | number | bigint): string {
  return `${BASE_SEPOLIA_EXPLORER}/${type}/${value}`
}

/** Copy text to clipboard, returns success */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Known scenario names
const SCENARIOS: Record<string, string> = {
  '0x3d160303816ed14f05ea8784ef9e021a02b747c4': 'Injection CTF',
  '0xa5313fb027ebd60de2856ba134a689bbd30a6cc9': "Prisoner's Dilemma",
  '0x87cb33ed6ef0d18c3ebb1fb5e8250fa49487d9c6': 'Spy vs Spy',
  '0xa2df845c10cbe9da434991a91a3f0c3dbc39aaed': 'Challenge Word Battle',
}

export function scenarioName(address: string): string {
  return SCENARIOS[address.toLowerCase()] ?? formatAddress(address)
}

const SCENARIO_EMOJI: Record<string, string> = {
  '0x3d160303816ed14f05ea8784ef9e021a02b747c4': '🗡️',
  '0xa5313fb027ebd60de2856ba134a689bbd30a6cc9': '🎲',
  '0x87cb33ed6ef0d18c3ebb1fb5e8250fa49487d9c6': '🕵️',
  '0xa2df845c10cbe9da434991a91a3f0c3dbc39aaed': '⏱️',
}

export function scenarioEmoji(address: string): string {
  return SCENARIO_EMOJI[address.toLowerCase()] ?? '⚔️'
}
