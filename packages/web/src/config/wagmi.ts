import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

// V3 Contract addresses (Base Sepolia — deployed 2026-02-23)
export const CONTRACTS = {
  arena: '0x6045d9b8Ab1583AD4cEb600c0E8d515E9922d2eB' as const,
  battleImpl: '0x915f31eaaCC40F0c9A14D9A79eAE45a6baEaa342' as const,
  vopRegistry: '0x6045d9b8Ab1583AD4cEb600c0E8d515E9922d2eB' as const,
  wordDictionary: '0xa5bAC96F55e46563D0B0b57694E7Ac7Bc7DA25eC' as const,
  hashPreimageVop: '0xE75bE6a420bEAdCd722C57C44ac16AeF14a4012C' as const,
} as const

// Block number of the V3 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_060_000n
