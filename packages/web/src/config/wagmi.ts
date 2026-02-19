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
  arena: '0xf7caed5eb794fa193c400efef40083acfaae184e' as const,
  injectionCTF: '0x3D160303816ed14F05EA8784Ef9e021a02B747C4' as const,
} as const
