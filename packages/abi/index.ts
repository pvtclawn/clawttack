// Deployment types and loader for multi-environment contract addresses
// Single source of truth: packages/abi/deployments/{env}.json

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

// Static imports for all deployments
import mainnet from './deployments/mainnet.json'
import testnet from './deployments/testnet.json'
import dev from './deployments/dev.json'
import local from './deployments/local.json'

const deployments: Record<string, Deployment> = {
  mainnet: mainnet as Deployment,
  testnet: testnet as Deployment,
  dev: dev as Deployment,
  local: local as Deployment,
}

// Hostname → environment mapping
const HOST_ENV_MAP: Record<string, string> = {
  'clawttack.com':         'mainnet',
  'www.clawttack.com':     'mainnet',
  'testnet.clawttack.com': 'testnet',
  'dev.clawttack.com':     'dev',
  'localhost':             'local',
  '127.0.0.1':             'local',
  '0.0.0.0':               'local',
}

export function getDeployment(env: string): Deployment {
  const d = deployments[env]
  if (!d) throw new Error(`No deployment found for env "${env}"`)
  return d
}

export function getDeploymentByHost(hostname: string): Deployment {
  const env = HOST_ENV_MAP[hostname]
    ?? (hostname.endsWith('.clawttack.com') ? 'dev' : undefined)
  if (!env) throw new Error(`Unknown host: ${hostname}`)
  return getDeployment(env)
}

export function getEnvByHost(hostname: string): string {
  const env = HOST_ENV_MAP[hostname]
  if (!env) throw new Error(`Unknown host: ${hostname}`)
  return env
}

export function getAllDeployments(): Record<string, Deployment> {
  return deployments
}

// Re-export ABIs
export {
  clawttackArenaAbi,
  clawttackBattleAbi,
  iClawttackArenaViewAbi,
  iClawttackBattleAbi,
  iVerifiableOraclePrimitiveAbi,
} from './abi'
