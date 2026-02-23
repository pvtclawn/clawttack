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
  arena: '0x20ea35CE95a47d2A56451190a306431945413c67' as const,
  battleImpl: '0x4c7B846487CD46f5320eE49b6DE3F46eC4457CdB' as const,
  vopRegistry: '0x42A1E4B3e4e9FF283a7791d1f0E079E6752Aa22F' as const,
  wordDictionary: '0x9F305eD62cfFC68422d4eACF580b4B571D483596' as const,
  hashPreimageVop: '0x648Cab200c3F47E316a48E0D9b2Dc73d6F627899' as const,
} as const

// Block number of the V3 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_055_000n
