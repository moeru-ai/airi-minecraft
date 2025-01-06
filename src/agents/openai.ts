import type { BotContext } from 'src/bot'
import { useLogg } from '@guiiai/logg'
import { tool } from 'xsai'

import { createQueryAgentBotContext, queryList } from './queries'

// Types
interface AgentBotContext {
  readonly agents: Set<Agent | Promise<Agent>>
}

// State management
const agents = new Set<Agent | Promise<Agent>>()

const logger = useLogg('openai').useGlobalConfig()

// Agent initialization
// export async function initAgent(): Promise<Neuri> {
//   logger.log('Initializing agent')
//   let n = neuri()

//   agents.add(initQueryAgent())

//   agents.forEach(agent => n = n.agent(agent))

//   return n.build({
//     provider: {
//       apiKey: openaiConfig.apiKey,
//       baseURL: openaiConfig.baseUrl,
//     },
//   })
// }

// export async function initQueryAgent(): Promise<Agent> {
//   logger.log('Initializing query agent')
//   let queryAgent = agent('query')

//   queryList.forEach((query) => {
//     queryAgent = queryAgent.tool(
//       query.name,
//       query.schema,
//       query.perform,
//       { description: query.description },
//     )
//   })

//   return queryAgent.build()
// }

export async function initAgent(ctx: BotContext) {
  logger.log('Initializing agent')

  initQueryAgent(ctx)
}

export function initQueryAgent(ctx: BotContext) {
  logger.log('Initializing query agent')
  const agentBotContext = createQueryAgentBotContext(ctx.bot)

  const tools = []

  for (const query of queryList) {
    tools.push(
      tool({
        name: query.name,
        description: query.description,
        execute: query.perform(agentBotContext),
        parameters: query.schema as never,
      }),
    )
  }

  return tools
}
