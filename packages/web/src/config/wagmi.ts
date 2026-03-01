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
  arena: '0xFe8Bfd37D941e22d3E21258e2b3D143435Ba793f' as const,
  battleImpl: '0x729F5F1b14192a99cC49f09dcEBC67b228b7C06C' as const,
  vopRegistry: '0x3DCb3D2e0a2E7CDE27E5bA2CEeb40558C6aB5f30' as const,
  wordDictionary: '0x0818C963ac5e7caB5F50fBd0F8F4C7D7e6a09F18' as const,
  hashPreimageVop: '0x3DCb3D2e0a2E7CDE27E5bA2CEeb40558C6aB5f30' as const,
} as const

// Block number of the V4 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_284_000n
