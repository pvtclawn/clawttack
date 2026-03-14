import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

// Contract addresses (Base Sepolia — deployed 2026-03-14, VOP overhaul)
export const CONTRACTS = {
  arena: '0x40E9aC266B8b7F703BeD694592121EF32d796935' as const,
  battleImpl: '0x11EB617966e9d4CB46004cb940ab87433349580f' as const,
  vopRegistry: '0x35c44b67c8c3FC828d58898953538A74A0F004c3' as const,
  wordDictionary: '0x2cEB1934e69c66c013212981EFd5773AD0Fc1dE6' as const,
  hashPreimageVop: '0x35c44b67c8c3FC828d58898953538A74A0F004c3' as const,
} as const

// Block number of the v0 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_868_288n
