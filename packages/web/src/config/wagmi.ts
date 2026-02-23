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
  arena: '0x771e0f0d30b56f5f83e2b9d452ca4b995a38f22e' as const,
  vopRegistry: '0x36da2af2f36549be53703cc0c55df822c2fe27b1' as const,
  wordDictionary: '0xe675b676b31adf0eaa408c43830382168ab21d38' as const,
} as const
