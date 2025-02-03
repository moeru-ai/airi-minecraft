import type { MineflayerPlugin } from '../../libs/mineflayer'
import type { LLMAgentOptions, MineflayerWithAgents } from './type'

import { useLogg } from '@guiiai/logg'
import { system } from 'neuri/openai'

import { generateActionAgentPrompt } from '../../agents/prompt/llm-agent.plugin'
import { openaiConfig } from '../../composables/config'
import { createAppContainer } from '../../container'
import { ChatMessageHandler } from '../../libs/mineflayer'
import { handleChatMessage } from './chat'
import { handleVoiceInput } from './voice'

export function LLMAgent(options: LLMAgentOptions): MineflayerPlugin {
  return {
    async created(bot) {
      const logger = useLogg('LLMAgent').useGlobalConfig()

      // Create container and get required services
      const container = createAppContainer({
        neuri: options.agent,
        model: openaiConfig.model,
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
