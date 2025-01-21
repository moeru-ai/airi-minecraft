import type { Client } from '@proj-airi/server-sdk'
import type { Neuri, NeuriContext } from 'neuri'
import type { ChatCompletion } from 'neuri/openai'
import type { Mineflayer } from '../libs/mineflayer'
import type { ActionAgent, ChatAgent, PlanningAgent } from '../libs/mineflayer/base-agent'
import type { MineflayerPlugin } from '../libs/mineflayer/plugin'

import { useLogg } from '@guiiai/logg'
import { assistant, system, user } from 'neuri/openai'

import { generateActionAgentPrompt, generateStatusPrompt } from '../agents/prompt/llm-agent.plugin'
import { createAppContainer } from '../container'
import { ChatMessageHandler } from '../libs/mineflayer/message'
import { toRetriable } from '../utils/helper'

interface MineflayerWithAgents extends Mineflayer {
  planning: PlanningAgent
  action: ActionAgent
  chat: ChatAgent
}

interface LLMAgentOptions {
  agent: Neuri
  airiClient: Client
}

async function handleLLMCompletion(context: NeuriContext, bot: MineflayerWithAgents, logger: ReturnType<typeof useLogg>): Promise<string> {
  logger.log('rerouting...')

  const completion = await context.reroute('action', context.messages, {
    model: 'openai/gpt-4o-mini',
  }) as ChatCompletion | { error: { message: string } } & ChatCompletion

  if (!completion || 'error' in completion) {
    logger.withFields({ completion }).error('Completion')
    logger.withFields({ messages: context.messages }).log('messages')
    return completion?.error?.message ?? 'Unknown error'
  }

  const content = await completion.firstContent()
  logger.withFields({ usage: completion.usage, content }).log('output')

  bot.memory.chatHistory.push(assistant(content))
  return content
}

async function handleChatMessage(username: string, message: string, bot: MineflayerWithAgents, agent: Neuri, logger: ReturnType<typeof useLogg>): Promise<void> {
  logger.withFields({ username, message }).log('Chat message received')
  bot.memory.chatHistory.push(user(`${username}: ${message}`))

  logger.log('thinking...')

  try {
    // Create and execute plan
    const plan = await bot.planning.createPlan(message)
    logger.withFields({ plan }).log('Plan created')
    await bot.planning.executePlan(plan)
    logger.log('Plan executed successfully')

    // Generate response
    // TODO: use chat agent and conversion manager
    const statusPrompt = await generateStatusPrompt(bot)
    const content = await agent.handleStateless(
      [...bot.memory.chatHistory, system(statusPrompt)],
      async (c: NeuriContext) => {
        logger.log('handling response...')
        return toRetriable<NeuriContext, string>(
          3,
          1000,
          ctx => handleLLMCompletion(ctx, bot, logger),
          { onError: err => logger.withError(err).log('error occurred') },
        )(c)
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

async function handleVoiceInput(event: any, bot: MineflayerWithAgents, agent: Neuri, logger: ReturnType<typeof useLogg>): Promise<void> {
  logger
    .withFields({
      user: event.data.discord?.guildMember,
      message: event.data.transcription,
    })
    .log('Chat message received')

  const statusPrompt = await generateStatusPrompt(bot)
  bot.memory.chatHistory.push(system(statusPrompt))
  bot.memory.chatHistory.push(user(`NekoMeowww: ${event.data.transcription}`))

  try {
    // Create and execute plan
    const plan = await bot.planning.createPlan(event.data.transcription)
    logger.withFields({ plan }).log('Plan created')
    await bot.planning.executePlan(plan)
    logger.log('Plan executed successfully')

    // Generate response
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
      const logger = useLogg('LLMAgent').useGlobalConfig()

      // Create container and get required services
      const container = createAppContainer({
        neuri: options.agent,
        model: 'openai/gpt-4o-mini',
        maxHistoryLength: 50,
        idleTimeout: 5 * 60 * 1000,
      })

      const actionAgent = container.resolve('actionAgent')
      const planningAgent = container.resolve('planningAgent')
      const chatAgent = container.resolve('chatAgent')

      // Initialize agents
      await actionAgent.init()
      await planningAgent.init()
      await chatAgent.init()

      // Type conversion
      const botWithAgents = bot as unknown as MineflayerWithAgents
      botWithAgents.action = actionAgent
      botWithAgents.planning = planningAgent
      botWithAgents.chat = chatAgent

      // Initialize system prompt
      bot.memory.chatHistory.push(system(generateActionAgentPrompt(bot)))

      // Set message handling
      const onChat = new ChatMessageHandler(bot.username).handleChat((username, message) =>
        handleChatMessage(username, message, botWithAgents, options.agent, logger))

      options.airiClient.onEvent('input:text:voice', event =>
        handleVoiceInput(event, botWithAgents, options.agent, logger))

      bot.bot.on('chat', onChat)
    },

    async beforeCleanup(bot) {
      const botWithAgents = bot as unknown as MineflayerWithAgents
      await botWithAgents.action?.destroy()
      await botWithAgents.planning?.destroy()
      await botWithAgents.chat?.destroy()
      bot.bot.removeAllListeners('chat')
    },
  }
}
