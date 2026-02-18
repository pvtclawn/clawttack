// Known agent names — will be replaced by on-chain registry/ENS lookup
const KNOWN_AGENTS: Record<string, string> = {
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266': 'PrivateClawn',
  '0x70997970c51812dc3a010c7d01b50e0d17dc79c8': 'ClawnJr',
  '0xec6cd01f6fdeaec192b88eb7b62f5e72d65719af': 'pvtclawn.eth',
}

export function formatAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`
}

export function agentName(address: string): string {
  return KNOWN_AGENTS[address.toLowerCase()] ?? formatAddress(address)
}

export function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18
  return eth.toFixed(4)
}

// Known scenario names
const SCENARIOS: Record<string, string> = {
  '0x3d160303816ed14f05ea8784ef9e021a02b747c4': 'Injection CTF',
  '0xa5313fb027ebd60de2856ba134a689bbd30a6cc9': "Prisoner's Dilemma",
  '0x87cb33ed6ef0d18c3ebb1fb5e8250fa49487d9c6': 'Spy vs Spy',
}

export function scenarioName(address: string): string {
  return SCENARIOS[address.toLowerCase()] ?? formatAddress(address)
}

const SCENARIO_EMOJI: Record<string, string> = {
  '0x3d160303816ed14f05ea8784ef9e021a02b747c4': '🗡️',
  '0xa5313fb027ebd60de2856ba134a689bbd30a6cc9': '🎲',
  '0x87cb33ed6ef0d18c3ebb1fb5e8250fa49487d9c6': '🕵️',
}

export function scenarioEmoji(address: string): string {
  return SCENARIO_EMOJI[address.toLowerCase()] ?? '⚔️'
}
