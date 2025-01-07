import type { messages } from 'neuri/openai'
import type { BotContext, ComponentLifecycle } from 'src/composables/bot'
import { useLogg } from '@guiiai/logg'
import { assistant, system, user } from 'neuri/openai'
import { getAgent } from 'src/agents/openai'
import { formBotChat } from 'src/middlewares/chat'
import { genSystemBasicPrompt } from 'src/prompts/agent'

export function createAiChatComponent(ctx: BotContext): ComponentLifecycle {
  const logger = useLogg('aichat').useGlobalConfig()
  logger.log('Loading aichat plugin')

  const history: ReturnType<typeof messages> = []
  history.push(system(genSystemBasicPrompt('airi')))

  const onChat = formBotChat(ctx, async (username, message) => {
    logger.withFields({ username, message }).log('Chat message received')

    history.push(user(message))

    const agent = getAgent()
    const content = await agent.handle(history.concat(user(message)), async (c) => {
      logger.log('Generate response')

      try {
        const completion = await c.reroute('action', c.messages, { model: 'openai/gpt-4o-mini' })

        logger.withFields({ completion }).log('Completion')

        const content = await completion?.firstContent()
        if (content) {
          history.push(assistant(content))
        }

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
