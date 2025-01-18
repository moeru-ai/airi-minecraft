import type { Agent, Neuri } from 'neuri'
import type { Mineflayer } from '../libs/mineflayer'

import { useLogg } from '@guiiai/logg'
import { agent, neuri } from 'neuri'

import { openaiConfig } from '../composables/config'
import { actionsList } from './actions'

let neuriAgent: Neuri | undefined
const agents = new Set<Agent | Promise<Agent>>()

const logger = useLogg('openai').useGlobalConfig()

export async function initAgent(mineflayer: Mineflayer): Promise<Neuri> {
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

export async function initActionAgent(mineflayer: Mineflayer): Promise<Agent> {
  logger.log('Initializing action agent')
  let actionAgent = agent('action')

  Object.values(actionsList).forEach((action) => {
    actionAgent = actionAgent.tool(
      action.name,
      action.schema,
      async ({ parameters }) => {
        logger.withFields({ name: action.name, parameters }).log('Calling action')
        mineflayer.memory.actions.push(action)
        const fn = action.perform(mineflayer)
        return await fn(...Object.values(parameters))
      },
      { description: action.description },
    )
  })

  return actionAgent.build()
}
