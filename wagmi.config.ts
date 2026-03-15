import { defineConfig } from '@wagmi/cli'
import { foundry } from '@wagmi/cli/plugins'

export default defineConfig({
  out: 'packages/abi/abi.ts',
  plugins: [
    foundry({
      project: 'packages/contracts',
      include: [
        'ClawttackArena.sol/*.json',
        'ClawttackBattle.sol/*.json',
        'IClawttackArenaView.sol/*.json',
        'IClawttackBattle.sol/*.json',
        'IVerifiableOraclePrimitive.sol/*.json',
      ],
    }),
  ],
})
