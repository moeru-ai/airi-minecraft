import type { MineflayerPlugin } from '../libs/mineflayer/plugin'

import { useLogg } from '@guiiai/logg'

import { ChatMessageHandler } from '../libs/mineflayer/message'

export function Echo(): MineflayerPlugin {
  const logger = useLogg('Echo').useGlobalConfig()

  return {
    spawned(mineflayer) {
      const onChatHandler = new ChatMessageHandler(mineflayer.username).handleChat((username, message) => {
        logger.withFields({ username, message }).log('Chat message received')
        mineflayer.bot.chat(message)
      })

      this.beforeCleanup = () => {
        mineflayer.bot.removeListener('chat', onChatHandler)
      }

      mineflayer.bot.on('chat', onChatHandler)
    },
  }
}
