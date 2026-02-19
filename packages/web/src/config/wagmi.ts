import { http, createConfig } from 'wagmi'
import { baseSepolia } from 'wagmi/chains'

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http('https://sepolia.base.org'),
  },
})

// Contract addresses (Base Sepolia — canonical)
export const CONTRACTS = {
  registry: '0xeee01a6846C896efb1a43442434F1A51BF87d3aA' as const,
  arena: '0x977E674Bb5f351dcd1065B83A4547631BA6b5E03' as const,
  injectionCTF: '0x3D160303816ed14F05EA8784Ef9e021a02B747C4' as const,
} as const
