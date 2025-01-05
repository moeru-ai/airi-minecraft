import type { Bot } from 'mineflayer'
import type { ComponentContext } from '../bot'
import { useLogg } from '@guiiai/logg'

const logger = useLogg('echo').useGlobalConfig()

export function createEchoComponent(botInstance: Bot): ComponentContext {
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
