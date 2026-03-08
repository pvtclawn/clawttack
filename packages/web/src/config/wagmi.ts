import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

// Contract addresses (Base Sepolia — deployed 2026-03-02)
export const CONTRACTS = {
  arena: '0xe090C149A5990E1F7F3C32faf0beA05F9a5ebdA3' as const,
  battleImpl: '0xaB7eA23fd7FA9DfbBec4353602aAE54584EA48C4' as const,
  vopRegistry: '0x1bc2b2008A2C605a8Fff5E3e4D8a32EE924b8352' as const,
  wordDictionary: '0xb5b37571476aA9c32EF64d90C8aeb8FA13f40931' as const,
  hashPreimageVop: '0x1bc2b2008A2C605a8Fff5E3e4D8a32EE924b8352' as const,
} as const

// Block number of the V4.2 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_334_774n
