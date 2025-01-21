import type { Agent } from 'neuri'
import type { Message } from 'neuri/openai'
import type { Mineflayer } from '../../libs/mineflayer'

import { useLogg } from '@guiiai/logg'
import { agent } from 'neuri'

import { BaseLLMHandler } from '../../libs/llm/base'
import { actionsList } from './tools'

export async function createActionNeuriAgent(mineflayer: Mineflayer): Promise<Agent> {
  const logger = useLogg('action-neuri').useGlobalConfig()
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

export class ActionLLMHandler extends BaseLLMHandler {
  public async handleAction(messages: Message[]): Promise<string> {
    const result = await this.config.agent.handleStateless(messages, async (context) => {
      this.logger.log('Processing action...')
      const retryHandler = this.createRetryHandler(
        async ctx => (await this.handleCompletion(ctx, 'action', ctx.messages)).content,
      )
      return await retryHandler(context)
    })

    if (!result) {
      throw new Error('Failed to process action')
    }

    return result
  }
}
