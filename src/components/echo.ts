import type { Bot } from 'mineflayer'
import type { ComponentLifecycle } from '../bot'
import { useLogg } from '@guiiai/logg'

const logger = useLogg('echo').useGlobalConfig()

export function createEchoComponent(botInstance: Bot): ComponentLifecycle {
  const onChat = (username: string, message: string) => {
    if (username === botInstance.username)
      return

    logger.withFields({ username, message }).log('Chat message received')
    botInstance.chat(message)
  }

  botInstance.on('chat', onChat)

  return {
    cleanup: () => {
      botInstance.removeListener('chat', onChat)
    },
  }
}
