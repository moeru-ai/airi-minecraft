import type { Neuri } from 'neuri'
import type { AgentType } from 'src/libs/mineflayer/interfaces/agents'
import type { PlanningAgentConfig } from '.'
import type { Mineflayer } from '../../libs/mineflayer'
import type { MineflayerPlugin } from '../../libs/mineflayer/plugin'
import { useLogg } from '@guiiai/logg'
import { AgentFactory, AgentRegistry } from '../../libs/mineflayer/core/agent-factory'

interface PlanningPluginOptions {
  agent: Neuri
  model?: string
}

interface MineflayerWithPlanning extends Mineflayer {
  planning: any
}

const logger = useLogg('planning-factory').useGlobalConfig()

async function initializeAgent(registry: AgentRegistry, id: string, type: string): Promise<void> {
  if (!registry.has(id)) {
    const agent = AgentFactory.createAgent({ id, type: type as AgentType })
    registry.register(agent)
    await agent.init()
  }
}

export function PlanningPlugin(options: PlanningPluginOptions): MineflayerPlugin {
  return {
    async created(mineflayer: Mineflayer) {
      logger.log('Initializing planning plugin')

      const registry = AgentRegistry.getInstance()

      // Initialize required agents
      await initializeAgent(registry, 'action-agent', 'action')
      await initializeAgent(registry, 'memory-agent', 'memory')

      // Create and initialize planning agent
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
      ;(mineflayer as MineflayerWithPlanning).planning = planningAgent
    },

    async beforeCleanup() {
      logger.log('Destroying planning plugin')
      await AgentRegistry.getInstance().destroy()
    },
  }
}
