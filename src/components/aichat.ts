import type { BotContext, ComponentLifecycle } from 'src/composables/bot'
import { useLogg } from '@guiiai/logg'
import { assistant, type Message, messages, system, user } from 'neuri/openai'
import { getAgent } from '../agents/openai'
import { formBotChat } from '../middlewares/chat'
import { genActionAgentPrompt } from '../prompts/agent'

export function createAiChatComponent(ctx: BotContext): ComponentLifecycle {
  const logger = useLogg('aichat').useGlobalConfig()
  logger.log('Loading aichat plugin')

  const historyMessage: Message[] = []
  historyMessage.push(system(genActionAgentPrompt(ctx)))

  const onChat = formBotChat(ctx, async (username, message) => {
    logger.withFields({ username, message }).log('Chat message received')

    historyMessage.push(user(`${username}: ${message}`))

    const agent = getAgent()
    const content = await agent.handleStateless(messages(...historyMessage), async (c) => {
      logger.log('Generate response')

      try {
        const completion = await c.reroute('action', c.messages, { model: 'openai/gpt-4o-mini' }) || { error: { message: 'Unknown error' } }

        logger.withFields({ completion }).log('Completion')

        if (!completion || 'error' in completion) {
          logger.withFields(c).error('Completion')
          throw new Error(completion?.error?.message ?? 'Unknown error')
        }

        const content = await completion?.firstContent()
        historyMessage.push(assistant(content))

        return content
      }
      catch (e) {
        logger.errorWithError('Generate response error', e)
      }
    })

    if (content) {
      logger.withFields({ content }).log('Bot response')
      ctx.bot.chat(content)
    }
  })

  ctx.bot.on('chat', onChat)

  return {
    cleanup: () => {
      ctx.bot.removeListener('chat', onChat)
    },
  }
}
