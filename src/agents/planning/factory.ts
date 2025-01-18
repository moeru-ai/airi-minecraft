import type { Neuri } from 'neuri'
import type { Mineflayer } from '../../libs/mineflayer'
import type { MineflayerPlugin } from '../../libs/mineflayer/plugin'

import { useLogg } from '@guiiai/logg'

import { createAppContainer } from '../../container'

interface PlanningPluginOptions {
  agent: Neuri
  model?: string
}

interface MineflayerWithPlanning extends Mineflayer {
  planning: any
}

const logger = useLogg('planning-factory').useGlobalConfig()

export function PlanningPlugin(options: PlanningPluginOptions): MineflayerPlugin {
  return {
    async created(mineflayer: Mineflayer) {
      logger.log('Initializing planning plugin')

      // Get the container
      const container = createAppContainer({
        neuri: options.agent,
        model: options.model,
      })
      const actionAgent = container.resolve('actionAgent')
      const planningAgent = container.resolve('planningAgent')

      // Initialize agents
      await actionAgent.init()
      await planningAgent.init()

      // Add to bot
      ;(mineflayer as MineflayerWithPlanning).planning = planningAgent
    },

    async beforeCleanup(bot) {
      logger.log('Cleaning up planning plugin')
      const botWithPlanning = bot as MineflayerWithPlanning
      await botWithPlanning.planning?.destroy()
    },
  }
}
