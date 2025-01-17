import type { Neuri } from 'neuri'
import type { Mineflayer } from '../../libs/mineflayer'
import type { MineflayerPlugin } from '../../libs/mineflayer/plugin'
import { useLogg } from '@guiiai/logg'
import { PlanningAgentImpl } from '.'
import { ActionAgentImpl } from '../action'

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

      // 直接创建 action agent
      const actionAgent = new ActionAgentImpl({
        id: 'action',
        type: 'action',
      })
      await actionAgent.init()

      // 创建并初始化 planning agent
      const planningAgent = new PlanningAgentImpl({
        id: 'planning',
        type: 'planning',
        llm: {
          agent: options.agent,
          model: options.model,
        },
      })
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
