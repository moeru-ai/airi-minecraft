import type { Mineflayer } from '../libs/mineflayer'
import type { MineflayerPlugin } from '../libs/mineflayer/plugin'

import { useLogg } from '@guiiai/logg'
import { formBotChat } from '../libs/mineflayer/message'

export function Echo(): MineflayerPlugin {
  let mineflayer: Mineflayer
  let onChatHandler: (username: string, message: string) => void
  const logger = useLogg('Echo').useGlobalConfig()

  return {
    created(_mineflayer) {
      mineflayer = _mineflayer
      onChatHandler = formBotChat(mineflayer.username, (username, message) => {
        logger.withFields({ username, message }).log('Chat message received')
        mineflayer.bot.chat(message)
      })
    },
    spawned() {
      mineflayer.bot.on('chat', onChatHandler)
    },
    beforeCleanup() {
      mineflayer.bot.removeListener('chat', onChatHandler)
    },
  }
}
