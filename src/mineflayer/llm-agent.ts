import type { Client } from '@proj-airi/server-sdk'
import type { Neuri, NeuriContext } from 'neuri'
import type { MineflayerPlugin } from '../libs/mineflayer/plugin'
import { useLogg } from '@guiiai/logg'
import { system, user } from 'neuri/openai'

import { formBotChat } from '../libs/mineflayer/message'
import { genActionAgentPrompt, genStatusPrompt } from '../prompts/agent'
import { toRetriable } from '../utils/reliability'

export function LLMAgent(options: { agent: Neuri, airiClient: Client }): MineflayerPlugin {
  return {
    async created(bot) {
      const agent = options.agent

      const logger = useLogg('LLMAgent').useGlobalConfig()

      bot.memory.chatHistory.push(system(genActionAgentPrompt(bot)))

      // todo: get system message
      const onChat = formBotChat(bot.username, async (username, message) => {
        logger.withFields({ username, message }).log('Chat message received')

        const statusPrompt = await genStatusPrompt(bot)
        bot.memory.chatHistory.push(system(statusPrompt))
        bot.memory.chatHistory.push(user(`${username}: ${message}`))

        const content = await agent.handleStateless([...bot.memory.chatHistory], async (c: NeuriContext) => {
          logger.log('thinking...')

          const handleCompletion = async (c: NeuriContext): Promise<string> => {
            const completion = await c.reroute('action', c.messages, { model: 'openai/gpt-4o-mini' }) || { error: { message: 'Unknown error' } }
            if (!completion || 'error' in completion) {
              logger.withFields(c).error('Completion')
              logger.withFields({ messages: c.messages }).log('messages')
              throw new Error(completion?.error?.message ?? 'Unknown error')
            }

            const content = await completion?.firstContent()
            logger.withFields({ usage: completion.usage, content }).log('output')
            bot.memory.chatHistory.push(...c.messages)

            return content
          }

          const retirableHandler = toRetriable<NeuriContext, string>(
            3, // retryLimit
            1000, // delayInterval in ms
            handleCompletion,
          )

          return await retirableHandler(c)
        })

        if (content) {
          logger.withFields({ content }).log('responded')
          bot.bot.chat(content)
        }
      })

      options.airiClient.onEvent('input:text:voice', async (event) => {
        logger.withFields({ user: event.data.discord?.guildMember, message: event.data.transcription }).log('Chat message received')

        const statusPrompt = await genStatusPrompt(bot)
        bot.memory.chatHistory.push(system(statusPrompt))
        bot.memory.chatHistory.push(user(`${'NekoMeowww'}: ${event.data.transcription}`))

        // logger.withFields({ chatHistory: bot.memory.chatHistory }).log('chatHistory')
        logger.withFields({ statusPrompt }).log('statusPrompt')

        const content = await agent.handleStateless([...bot.memory.chatHistory], async (c) => {
          logger.log('thinking...')

          const handleCompletion = async (c: NeuriContext): Promise<string> => {
            const completion = await c.reroute('action', c.messages, { model: 'openai/gpt-4o-mini' }) || { error: { message: 'Unknown error' } }
            if (!completion || 'error' in completion) {
              logger.withFields(c).error('Completion')
              logger.withFields({ messages: c.messages }).log('messages')
              throw new Error(completion?.error?.message ?? 'Unknown error')
            }

            const content = await completion?.firstContent()
            logger.withFields({ usage: completion.usage, content }).log('output')
            bot.memory.chatHistory.push(...c.messages)

            return content
          }

          const retirableHandler = toRetriable<NeuriContext, string>(
            3, // retryLimit
            1000, // delayInterval in ms
            handleCompletion,
          )

          return await retirableHandler(c)
        })

        if (content) {
          logger.withFields({ content }).log('responded')
          bot.bot.chat(content)
        }
      })

      bot.bot.on('chat', onChat)
    },
  }
}
