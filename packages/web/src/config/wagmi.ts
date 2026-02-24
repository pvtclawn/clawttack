import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

// V3.2 Contract addresses (Base Sepolia — deployed 2026-02-24)
export const CONTRACTS = {
  arena: '0xAF9188A59a8BfF0C20Ca525Fe3DD9BaBcf3b4b7b' as const,
  battleImpl: '0xBB6ee11AbBB5A2C0C71ceC6A0B64aB85A8f7bf35' as const,
  vopRegistry: '0xAF9188A59a8BfF0C20Ca525Fe3DD9BaBcf3b4b7b' as const,
  wordDictionary: '0x70dfeE9a3c5b4d530F048cb5AF8573C1F451A0A2' as const,
  hashPreimageVop: '0x365b620d8C3938317608180350994722E6638bAd' as const,
  l1MetadataVop: '0xDBB1442E119363DAc8EB08E8dF893eb7E7cb75FE' as const,
  twapOracleVop: '0x5Dbd7f45777BA0b7017955517F09e06F0D7B2cA5' as const,
  crossChainSyncVop: '0xE0Cf493580F2c6B93258EC0Df022A6eb8a543D6E' as const,
} as const

// Block number of the V3.2 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_083_503n
