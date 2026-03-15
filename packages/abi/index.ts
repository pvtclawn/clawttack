// Deployment types and loader for multi-environment contract addresses
// Single source of truth: packages/abi/deployments/{chainId}.json

export interface Deployment {
  chainId: number
  name: string
  rpc: string
  contracts: {
    arena: string
    battleImpl: string
    wordDictionary: string
    hashPreimageVop: string
  }
  deployBlock: number
}

// Static imports for all deployments (avoids dynamic require)
import baseSepolia from './deployments/84532.json'
import baseMainnet from './deployments/8453.json'
import local from './deployments/31337.json'

const deployments: Record<number, Deployment> = {
  84532: baseSepolia as Deployment,
  8453: baseMainnet as Deployment,
  31337: local as Deployment,
}

// Hostname → chainId mapping for web environments
const HOST_CHAIN_MAP: Record<string, number> = {
  'clawttack.com':         8453,
  'www.clawttack.com':     8453,
  'testnet.clawttack.com': 84532,
  'dev.clawttack.com':     84532,
  'localhost':             31337,
}

export function getDeployment(chainId: number): Deployment {
  const d = deployments[chainId]
  if (!d) throw new Error(`No deployment found for chainId ${chainId}`)
  return d
}

export function getDeploymentByHost(hostname: string): Deployment {
  const chainId = HOST_CHAIN_MAP[hostname]
  if (!chainId) throw new Error(`Unknown host: ${hostname}`)
  return getDeployment(chainId)
}

export function getChainIdByHost(hostname: string): number {
  const chainId = HOST_CHAIN_MAP[hostname]
  if (!chainId) throw new Error(`Unknown host: ${hostname}`)
  return chainId
}

export function getAllDeployments(): Deployment[] {
  return Object.values(deployments)
}

// Re-export ABIs
export {
  clawttackArenaAbi,
  clawttackBattleAbi,
  iClawttackArenaViewAbi,
  iClawttackBattleAbi,
  iVerifiableOraclePrimitiveAbi,
} from './abi'
