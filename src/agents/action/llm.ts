import type { Agent } from 'neuri'
import type { Mineflayer } from '../../libs/mineflayer'

import { useLogg } from '@guiiai/logg'
import { agent } from 'neuri'

import { actionsList } from './tools'

export async function initActionNeuriAgent(mineflayer: Mineflayer): Promise<Agent> {
  const logger = useLogg('action-llm').useGlobalConfig()
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
