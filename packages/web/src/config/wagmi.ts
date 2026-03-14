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
  arena: '0x16297349997ec5076190C57FF241946129fa1B26' as const,
  battleImpl: '0xA5472B58B9Ee5e8D0b05e00B4Ad39Ef8D8aDCAb3' as const,
  vopRegistry: '0x2CDFb927D6263048B860A64474859b029E0990D3' as const,
  wordDictionary: '0x97296fD2837274077884b100652A04C9673dbd57' as const,
  hashPreimageVop: '0x2CDFb927D6263048B860A64474859b029E0990D3' as const,
} as const

// Block number of the v0 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_876_612n
