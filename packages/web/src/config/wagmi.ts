import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

// V4 Contract addresses (Base Sepolia — deployed 2026-03-01)
export const CONTRACTS = {
  arena: '0x6a3dc366d61307559795d0c834f9b5d40907696e' as const,
  battleImpl: '0x4ff8608e4910b3c343c44acdea4a9434c1ee0681' as const,
  vopRegistry: '0x6b496dbde75edf9c594f298ded81a02afdf264bc' as const,
  wordDictionary: '0xa230b952f455a9131b888ca27cc27757f60c3a3b' as const,
  hashPreimageVop: '0x6b496dbde75edf9c594f298ded81a02afdf264bc' as const,
} as const

// Block number of the V4 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_306_795n
