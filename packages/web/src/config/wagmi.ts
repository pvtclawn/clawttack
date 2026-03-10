import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

// Contract addresses (Base Sepolia — deployed 2026-03-10)
export const CONTRACTS = {
  arena: '0x2Ab05Eab902db3Fda647B3Ec798C2D28c7489b7E' as const,
  battleImpl: '0x44EcAFFb67E6c32B572De40a5af23D44812F5a19' as const,
  vopRegistry: '0xAbf9B7097AEc9AaD86885a7C9b3c3Abb9d8f1cE0' as const,
  wordDictionary: '0x1Ec7D4540c71916CB5b600f6eD41b9E9De1e8fA4' as const,
  hashPreimageVop: '0xAbf9B7097AEc9AaD86885a7C9b3c3Abb9d8f1cE0' as const,
} as const

// Block number of the V4.3 Arena deployment (for event scanning)
export const ARENA_DEPLOY_BLOCK = 38_667_797n
