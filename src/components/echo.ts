import type { ComponentLifecycle, Context } from '../bot'
import { useLogg } from '@guiiai/logg'

const logger = useLogg('echo').useGlobalConfig()

export function createEchoComponent(ctx: Context): ComponentLifecycle {
  const onChat = (username: string, message: string) => {
    if (username === ctx.bot.username)
      return

    logger.withFields({ username, message }).log('Chat message received')
    ctx.bot.chat(message)
  }

  ctx.bot.on('chat', onChat)

  return {
    cleanup: () => {
      ctx.bot.removeListener('chat', onChat)
    },
  }
}
