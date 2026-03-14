import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

// Contract addresses (Base Sepolia — deployed 2026-03-14)
export const CONTRACTS = {
  arena: '0x38a9De026422634A84D0380FD2553Cb8a05C3Aa1' as const,
  battleImpl: '0x4037cc2adeda77D394cb75a26A5F2Cf0CB408A68' as const,
  vopRegistry: '0xC77b2656cE074a826dF3EEE93b92B5a56d64Ca5c' as const,
  wordDictionary: '0x5B0f5F0a72111D7402F97CA8ba52319A7A7Bf5F0' as const,
  hashPreimageVop: '0xC77b2656cE074a826dF3EEE93b92B5a56d64Ca5c' as const,
} as const

// Block number of the v0.5 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_840_367n
