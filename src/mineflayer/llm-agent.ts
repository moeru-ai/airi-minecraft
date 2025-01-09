import type { Client } from '@proj-airi/server-sdk'
import type { Neuri, NeuriContext } from 'neuri'
import type { ChatCompletion } from 'neuri/openai'
import type { PlanningAgent } from '../libs/mineflayer/interfaces/agents'
import type { MineflayerPlugin } from '../libs/mineflayer/plugin'
import { useLogg } from '@guiiai/logg'
import { assistant, system, user } from 'neuri/openai'

import { PlanningPlugin } from '../agents/planning/factory'
import { formBotChat } from '../libs/mineflayer/message'
import { genActionAgentPrompt, genStatusPrompt } from '../prompts/agent'
import { toRetriable } from '../utils/reliability'

interface LLMAgentOptions {
  agent: Neuri
  airiClient: Client
}

async function handleLLMCompletion(context: NeuriContext, bot: any, logger: any): Promise<string> {
  const completion = await context.reroute('action', context.messages, {
    model: 'openai/gpt-4o-mini',
  }) as ChatCompletion | { error: { message: string } } & ChatCompletion

  if (!completion || 'error' in completion) {
    logger.withFields({ completion }).error('Completion')
    logger.withFields({ messages: context.messages }).log('messages')
    throw new Error(completion?.error?.message ?? 'Unknown error')
  }

  const content = await completion.firstContent()
  logger.withFields({ usage: completion.usage, content }).log('output')

  bot.memory.chatHistory.push(assistant(content))
  return content
}

async function handleChatMessage(username: string, message: string, bot: any, agent: Neuri, logger: any): Promise<void> {
  logger.withFields({ username, message }).log('Chat message received')
  bot.memory.chatHistory.push(user(`${username}: ${message}`))

  const statusPrompt = await genStatusPrompt(bot)
  const retryHandler = toRetriable<NeuriContext, string>(
    3,
    1000,
    ctx => handleLLMCompletion(ctx, bot, logger),
  )

  const content = await agent.handleStateless(
    [...bot.memory.chatHistory, system(statusPrompt)],
    async (c: NeuriContext) => {
      logger.log('thinking...')
      return retryHandler(c)
    },
  )

  if (content) {
    logger.withFields({ content }).log('responded')
    bot.bot.chat(content)
  }
}

async function handleVoiceInput(event: any, bot: any, agent: Neuri, logger: any): Promise<void> {
  logger
    .withFields({
      user: event.data.discord?.guildMember,
      message: event.data.transcription,
    })
    .log('Chat message received')

  const statusPrompt = await genStatusPrompt(bot)
  bot.memory.chatHistory.push(system(statusPrompt))
  bot.memory.chatHistory.push(user(`NekoMeowww: ${event.data.transcription}`))

  try {
    const planningAgent = bot.planning as PlanningAgent
    const plan = await planningAgent.createPlan(event.data.transcription)
    logger.withFields({ plan }).log('Plan created')

    await planningAgent.executePlan(plan)
    logger.log('Plan executed successfully')

    const retryHandler = toRetriable<NeuriContext, string>(
      3,
      1000,
      ctx => handleLLMCompletion(ctx, bot, logger),
    )

    const content = await agent.handleStateless(
      [...bot.memory.chatHistory, system(statusPrompt)],
      async (c: NeuriContext) => {
        logger.log('thinking...')
        return retryHandler(c)
      },
    )

    if (content) {
      logger.withFields({ content }).log('responded')
      bot.bot.chat(content)
    }
  }
  catch (error) {
    logger.withError(error).error('Failed to process message')
    bot.bot.chat(
      `Sorry, I encountered an error: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    )
  }
}

export function LLMAgent(options: LLMAgentOptions): MineflayerPlugin {
  return {
    async created(bot) {
      const agent = options.agent
      const logger = useLogg('LLMAgent').useGlobalConfig()

      const planningPlugin = PlanningPlugin({
        agent: options.agent,
        model: 'openai/gpt-4o-mini',
      })
      await planningPlugin.created!(bot)

      bot.memory.chatHistory.push(system(genActionAgentPrompt(bot)))

      const onChat = formBotChat(bot.username, (username, message) =>
        handleChatMessage(username, message, bot, agent, logger))

      options.airiClient.onEvent('input:text:voice', event =>
        handleVoiceInput(event, bot, agent, logger))

      bot.bot.on('chat', onChat)
    },

    async beforeCleanup(bot) {
      bot.bot.removeAllListeners('chat')
    },
  }
}
