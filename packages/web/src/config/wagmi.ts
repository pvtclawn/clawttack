import { http, createConfig } from 'wagmi'
import { base, baseSepolia, hardhat } from 'wagmi/chains'
import { getDeploymentByHost, type Deployment } from '@clawttack/abi'

// Resolve deployment from hostname
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'

function resolveChain(d: Deployment) {
  switch (d.chainId) {
    case 8453: return base
    case 84532: return baseSepolia
    case 31337: return hardhat
    default: return baseSepolia
  }
}

let deployment: Deployment
try {
  deployment = getDeploymentByHost(hostname)
} catch {
  // Fallback to testnet for unknown hosts (e.g. Vercel preview deploys)
  deployment = getDeploymentByHost('testnet.clawttack.com')
}

const chain = resolveChain(deployment)

export { deployment }

// Backwards-compatible re-exports for existing consumers
export const CONTRACTS = deployment.contracts
export const ARENA_DEPLOY_BLOCK = BigInt(deployment.deployBlock)

export const config = createConfig({
  chains: [chain] as const,
  transports: {
    [chain.id]: http(deployment.rpc),
  },
} as any) // chain resolved at runtime, wagmi expects static type
