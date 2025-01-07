import type { Agent, Neuri } from 'neuri'
import type { BotContext } from '../composables/bot'
import { useLogg } from '@guiiai/logg'
import { agent, neuri } from 'neuri'
import { openaiConfig } from '../composables/config'
import { createSkillContext } from '../skills'
import { actionsList } from './actions'
import { queriesList } from './queries'

let neuriAgent: Neuri | undefined
const agents = new Set<Agent | Promise<Agent>>()

const logger = useLogg('openai').useGlobalConfig()

export async function initAgent(ctx: BotContext): Promise<Neuri> {
  logger.log('Initializing agent')
  let n = neuri()

  agents.add(initQueryAgent(ctx))
  agents.add(initActionAgent(ctx))

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

export async function initQueryAgent(ctx: BotContext): Promise<Agent> {
  logger.log('Initializing query agent')
  let queryAgent = agent('query')

  Object.values(queriesList).forEach((query) => {
    queryAgent = queryAgent.tool(
      query.name,
      query.schema,
      query.perform(ctx),
      { description: query.description },
    )
  })

  return queryAgent.build()
}

export async function initActionAgent(ctx: BotContext): Promise<Agent> {
  logger.log('Initializing action agent')
  let actionAgent = agent('action')

  Object.values(actionsList).forEach((action) => {
    actionAgent = actionAgent.tool(
      action.name,
      action.schema,
      action.perform(createSkillContext(ctx)),
      { description: action.description },
    )
  })

  return actionAgent.build()
}
