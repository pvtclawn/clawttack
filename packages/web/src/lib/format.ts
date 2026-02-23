// Known agent names — will be replaced by on-chain registry/ENS lookup
const KNOWN_AGENTS: Record<string, string> = {
  '0xec6cd01f6fdeaec192b88eb7b62f5e72d65719af': 'PrivateClawn',
  '0xd1033447b9a7297bdc91265eed761fbe5a3b8961': 'ClawnJr',
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
