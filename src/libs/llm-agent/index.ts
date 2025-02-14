import type { MineflayerPlugin } from '../mineflayer'
import type { LLMAgentOptions, MineflayerWithAgents } from './types'

import { system } from 'neuri/openai'

import { config } from '../../composables/config'
import { useLogger } from '../../utils/logger'
import { ChatMessageHandler } from '../mineflayer'
import { createAgentContainer } from './container'
import { generateActionAgentPrompt } from './prompt'

/**
 * LLM Agent plugin for Mineflayer
 * Provides chat, planning, and action capabilities
 */
export function LLMAgent(options: LLMAgentOptions): MineflayerPlugin {
  return {
    async created(bot) {
      const logger = useLogger()

      // Create container and get required services
      const container = createAgentContainer({
        neuri: options.agent,
        model: config.openai.model,
      })

      const actionAgent = container.resolve('actionAgent')
      const planningAgent = container.resolve('planningAgent')
      const chatAgent = container.resolve('chatAgent')
      const llmGateway = container.resolve('llmGateway')

      // Initialize agents
      await actionAgent.init()
      await planningAgent.init()
      await chatAgent.init()

      // Type conversion
      const botWithAgents = bot as unknown as MineflayerWithAgents
      botWithAgents.action = actionAgent
      botWithAgents.planning = planningAgent
      botWithAgents.chat = chatAgent
      botWithAgents.llm = llmGateway

      // Initialize system prompt
      bot.memory.chatHistory.push(system(generateActionAgentPrompt(bot)))

      // Set message handling
      const onChat = new ChatMessageHandler(bot.username).handleChat(async (username, message) => {
        try {
          await chatAgent.processMessage(message, username)
        }
        catch (error) {
          logger.withError(error).error('Failed to process chat message')
        }
      })

      // Handle voice input
      options.airiClient.onEvent('input:text:voice', async (event) => {
        try {
          const sender = event.data.discord?.guildMember?.displayName ?? 'unknown'
          await chatAgent.processMessage(event.data.transcription, sender)
        }
        catch (error) {
          logger.withError(error).error('Failed to process voice input')
        }
      })

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
