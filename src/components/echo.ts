import type { BotContext, ComponentLifecycle } from '../composables/bot'
import { useLogg } from '@guiiai/logg'
import { formBotChat } from '../middlewares/chat'

const logger = useLogg('echo').useGlobalConfig()

export function createEchoComponent(ctx: BotContext): ComponentLifecycle {
  const onChat = formBotChat(ctx, (username, message) => {
    logger.withFields({ username, message }).log('Chat message received')
    ctx.bot.chat(message)
  })

  ctx.bot.on('chat', onChat)

  return {
    cleanup: () => {
      ctx.bot.removeListener('chat', onChat)
    },
  }
}
