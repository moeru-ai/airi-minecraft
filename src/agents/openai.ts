import type { Agent, Neuri } from 'neuri'
import { useLogg } from '@guiiai/logg'
import { agent, neuri } from 'neuri'
import { openaiConfig } from '../composables/config'
import { queryList } from './query'

const agents = new Set<Agent | Promise<Agent>>()

const logger = useLogg('openai').useGlobalConfig()

export async function initAgent(): Promise<Neuri> {
  logger.log('Initializing agent')
  let n = neuri()

  agents.add(initQueryAgent())

  agents.forEach(agent => n = n.agent(agent))

  return n.build({
    provider: {
      apiKey: openaiConfig.apiKey,
      baseURL: openaiConfig.baseUrl,
    },
  })
}

export async function initQueryAgent(): Promise<Agent> {
  logger.log('Initializing query agent')
  let queryAgent = agent('query')

  queryList.forEach((query) => {
    queryAgent = queryAgent.tool(
      query.name,
      query.schema,
      query.perform,
      { description: query.description },
    )
  })

  return queryAgent.build()
}
