import type { Bot } from 'mineflayer'
import type { ComponentLifecycle } from '../bot'
import { useLogg } from '@guiiai/logg'

const logger = useLogg('echo').useGlobalConfig()

export function createEchoComponent(bot: Bot): ComponentLifecycle {
  const onChat = (username: string, message: string) => {
    if (username === bot.username)
      return

    logger.withFields({ username, message }).log('Chat message received')
    bot.chat(message)
  }

  bot.on('chat', onChat)

  return {
    cleanup: () => {
      bot.removeListener('chat', onChat)
    },
  }
}
