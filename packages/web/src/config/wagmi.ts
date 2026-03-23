import { http, createConfig } from 'wagmi'
import type { Address } from 'viem'
import { base, baseSepolia, foundry } from 'wagmi/chains'
import { getDeploymentByHost, type Deployment } from '@clawttack/abi'

// Resolve deployment from hostname
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

function resolveChain(d: Deployment) {
  switch (d.chainId) {
    case 8453: return base
    case 84532: return baseSepolia
    case 31337: return foundry
    default: return baseSepolia
  }
}

let deployment: Deployment
try {
  deployment = getDeploymentByHost(hostname)
  console.log('[wagmi] resolved deployment:', hostname, '→', deployment.name, 'chain:', deployment.chainId, 'rpc:', deployment.rpc)
} catch (e) {
  console.error('[wagmi] deployment resolution failed for', hostname, e)
  // Fallback to testnet for unknown hosts (e.g. Vercel preview deploys)
  deployment = getDeploymentByHost('testnet.clawttack.com')
}

const chain = resolveChain(deployment)

export { deployment }

// Backwards-compatible re-exports with proper Address types
export const CONTRACTS = {
  arena: deployment.contracts.arena as Address,
  battleImpl: deployment.contracts.battleImpl as Address,
  wordDictionary: deployment.contracts.wordDictionary as Address,
  hashPreimageVop: deployment.contracts.hashPreimageVop as Address,
}
export const ARENA_DEPLOY_BLOCK = BigInt(deployment.deployBlock)
export const CHAIN_NAME = chain.name

export const config = createConfig({
  chains: [chain] as const,
  transports: {
    [chain.id]: http(deployment.rpc),
  },
} as any) // chain resolved at runtime, wagmi expects static type
