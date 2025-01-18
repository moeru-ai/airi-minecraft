import type { Agent, Neuri } from 'neuri'
import type { Mineflayer } from '../libs/mineflayer'

import { useLogg } from '@guiiai/logg'
import { neuri } from 'neuri'

import { initActionAgent } from '../agents/action/llm'
import { openaiConfig } from './config'

let neuriAgent: Neuri | undefined
const agents = new Set<Agent | Promise<Agent>>()

const logger = useLogg('action-llm').useGlobalConfig()

export async function initNeuriAgent(mineflayer: Mineflayer): Promise<Neuri> {
  logger.log('Initializing agent')
  let n = neuri()

  agents.add(initActionAgent(mineflayer))

  agents.forEach(agent => n = n.agent(agent))

  neuriAgent = await n.build({
    provider: {
      apiKey: openaiConfig.apiKey,
      baseURL: openaiConfig.baseUrl,
    },
  })

  return neuriAgent
}

export function getAgent(): Neuri {
  if (!neuriAgent) {
    throw new Error('Agent not initialized')
  }
  return neuriAgent
}
