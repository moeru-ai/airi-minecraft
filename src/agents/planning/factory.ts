import type { Neuri } from 'neuri'
import type { PlanningAgentConfig } from '.'
import type { Mineflayer } from '../../libs/mineflayer'
import type { MineflayerPlugin } from '../../libs/mineflayer/plugin'
import { useLogg } from '@guiiai/logg'
import { AgentFactory, AgentRegistry } from '../../libs/mineflayer/core/agent-factory'

const logger = useLogg('planning-factory').useGlobalConfig()

interface PlanningPluginOptions {
  agent: Neuri
  model?: string
}

export function PlanningPlugin(options: PlanningPluginOptions): MineflayerPlugin {
  return {
    async created(bot: Mineflayer) {
      logger.log('Initializing planning plugin')

      // Create and register agents
      const registry = AgentRegistry.getInstance()

      // Create action agent if not exists
      if (!registry.has('action-agent')) {
        const actionAgent = AgentFactory.createAgent({
          id: 'action-agent',
          type: 'action',
        })
        registry.register(actionAgent)
        await actionAgent.init()
      }

      // Create memory agent if not exists
      if (!registry.has('memory-agent')) {
        const memoryAgent = AgentFactory.createAgent({
          id: 'memory-agent',
          type: 'memory',
        })
        registry.register(memoryAgent)
        await memoryAgent.init()
      }

      // Create planning agent
      const planningAgent = AgentFactory.createAgent({
        id: 'planning-agent',
        type: 'planning',
        llm: {
          agent: options.agent,
          model: options.model,
        },
      } as PlanningAgentConfig)

      registry.register(planningAgent)
      await planningAgent.init()

      // Add planning agent to bot
      bot.planning = planningAgent
    },

    async beforeCleanup() {
      logger.log('Destroying planning plugin')

      const registry = AgentRegistry.getInstance()
      await registry.destroy()

      // delete bot.planning
    },
  }
}
