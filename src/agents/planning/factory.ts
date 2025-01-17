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

      // 创建容器并获取所需的服务
      const container = createAppContainer({
        neuri: options.agent,
        model: options.model,
      })
      const actionAgent = container.resolve('actionAgent')
      const planningAgent = container.resolve('planningAgent')

      // 初始化 agents
      await actionAgent.init()
      await planningAgent.init()

      // 添加到 bot
      ;(mineflayer as MineflayerWithPlanning).planning = planningAgent
    },

    async beforeCleanup(bot) {
      logger.log('Cleaning up planning plugin')
      const botWithPlanning = bot as MineflayerWithPlanning
      await botWithPlanning.planning?.destroy()
    },
  }
}
