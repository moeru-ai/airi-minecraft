import type { Agent, Neuri } from 'neuri'
import type { Mineflayer } from '../libs/mineflayer'

import { useLogg } from '@guiiai/logg'
import { neuri } from 'neuri'

import { createActionNeuriAgent } from '../agents/action/llm-handler'
import { createChatNeuriAgent } from '../agents/chat/llm'
import { createPlanningNeuriAgent } from '../agents/planning/llm-handler'
import { openaiConfig } from './config'

let neuriAgent: Neuri | undefined
const agents = new Set<Agent | Promise<Agent>>()

const logger = useLogg('neuri').useGlobalConfig()

export async function createNeuriAgent(mineflayer: Mineflayer): Promise<Neuri> {
  logger.log('Initializing neuri agent')
  let n = neuri()

  agents.add(createPlanningNeuriAgent())
  agents.add(createActionNeuriAgent(mineflayer))
  agents.add(createChatNeuriAgent())

  agents.forEach(agent => n = n.agent(agent))

  neuriAgent = await n.build({
    provider: {
      apiKey: openaiConfig.apiKey,
      baseURL: openaiConfig.baseUrl,
    },
  })

  return neuriAgent
}

export function useNeuriAgent(): Neuri {
  if (!neuriAgent) {
    throw new Error('Agent not initialized')
  }
  return neuriAgent
}
