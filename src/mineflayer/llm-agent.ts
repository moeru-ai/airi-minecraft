import type { Neuri } from 'neuri'
import type { MineflayerPlugin } from '../libs/mineflayer/plugin'

import { useLogg } from '@guiiai/logg'
import { assistant, system, user } from 'neuri/openai'
import { formBotChat } from '../libs/mineflayer/message'
import { genActionAgentPrompt } from '../prompts/agent'

export function LLMAgent(options: { agent: () => Promise<Neuri> }): MineflayerPlugin {
  return {
    async created(bot) {
      const agent = await options.agent()

      const logger = useLogg('aichat').useGlobalConfig()
      logger.log('Loading aichat plugin')

      bot.memory.chatHistory.push(system(genActionAgentPrompt(bot)))

      // todo: get system message
      const onChat = formBotChat(bot.username, async (username, message) => {
        logger.withFields({ username, message }).log('Chat message received')

        bot.memory.chatHistory.push(user(`${username}: ${message}`))

        const content = await agent.handleStateless([...bot.memory.chatHistory], async (c) => {
          logger.log('Generate response')

          try {
            const completion = await c.reroute('action', c.messages, { model: 'openai/gpt-4o-mini' }) || { error: { message: 'Unknown error' } }

            logger.withFields({ completion }).log('Completion')

            if (!completion || 'error' in completion) {
              logger.withFields(c).error('Completion')
              return
              // throw new Error(completion?.error?.message ?? 'Unknown error')
            }

            const content = await completion?.firstContent()
            bot.memory.chatHistory.push(assistant(content))

            return content
          }
          catch (e) {
            logger.errorWithError('Generate response error', e)
          }
        })

        if (content) {
          logger.withFields({ content }).log('Bot response')
          bot.bot.chat(content)
        }
      })

      bot.bot.on('chat', onChat)
    },
  }
}
