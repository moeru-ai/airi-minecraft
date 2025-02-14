import type { Neuri } from 'neuri'
import type { Logger } from '../../utils/logger'

import { useLogg } from '@guiiai/logg'
import { asClass, asFunction, createContainer, InjectionMode } from 'awilix'

import { ActionAgentImpl } from '../../agents/action'
import { ChatAgentImpl } from '../../agents/chat'
import { PlanningAgentImpl } from '../../agents/planning'
import { config } from '../../composables/config'
import { LLMGateway } from './gateway'

export interface ContainerServices {
  logger: Logger
  actionAgent: ActionAgentImpl
  planningAgent: PlanningAgentImpl
  chatAgent: ChatAgentImpl
  neuri: Neuri
  llmGateway: LLMGateway
}

export function createAgentContainer(options: {
  neuri: Neuri
  model?: string
}) {
  const container = createContainer<ContainerServices>({
    injectionMode: InjectionMode.PROXY,
    strict: true,
  })

  // Register services
  container.register({
    // Create independent logger for each agent
    logger: asFunction(() => useLogg('agent').useGlobalConfig()).singleton(),

    // Register neuri client
    neuri: asFunction(() => options.neuri).singleton(),

    // Register LLM Gateway
    llmGateway: asClass(LLMGateway)
      .singleton()
      .inject(() => ({
        agent: options.neuri,
        model: options.model ?? config.openai.model,
        retryLimit: 3,
        delayInterval: 1000,
        maxContextLength: 2000,
      })),

    // Register agents
    actionAgent: asClass(ActionAgentImpl)
      .singleton()
      .inject(() => ({
        id: 'action',
        type: 'action' as const,
      })),

    planningAgent: asClass(PlanningAgentImpl)
      .singleton()
      .inject(() => ({
        id: 'planning',
        type: 'planning' as const,
        llm: {
          agent: options.neuri,
          model: options.model ?? config.openai.model,
        },
      })),

    chatAgent: asClass(ChatAgentImpl)
      .singleton()
      .inject(() => ({
        id: 'chat',
        type: 'chat' as const,
        llmHandler: container.resolve('llmGateway'),
        maxHistoryLength: 50,
        idleTimeout: 5 * 60 * 1000,
        idleThreshold: 2 * 60 * 1000,
      })),
  })

  return container
}
