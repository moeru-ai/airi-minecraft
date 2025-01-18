import type { MineflayerPlugin } from '../libs/mineflayer/plugin'
import { useLogg } from '@guiiai/logg'

export function Status(): MineflayerPlugin {
  return {
    created(bot) {
      const logger = useLogg('status').useGlobalConfig()
      logger.log('Loading status component')

      bot.onCommand('status', () => {
        logger.log('Status command received')
        const status = bot.status.toOneLiner()
        bot.bot.chat(status)
      })
    },
  }
}
