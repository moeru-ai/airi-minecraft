import type { BotContext, ComponentLifecycle } from '@/composables/bot'
import { registerCommand } from '@/composables/command'
import { useLogg } from '@guiiai/logg'

export function createStatusComponent(ctx: BotContext): ComponentLifecycle {
  const logger = useLogg('status').useGlobalConfig()
  logger.log('Loading status component')

  const handleStatus = () => {
    const pos = ctx.bot.entity.position
    const weather = ctx.bot.isRaining ? 'Rain' : ctx.bot.thunderState ? 'Thunderstorm' : 'Clear'
    const timeOfDay = ctx.bot.time.timeOfDay < 6000
      ? 'Morning'
      : ctx.bot.time.timeOfDay < 12000 ? 'Afternoon' : 'Night'

    ctx.bot.chat(`Status:
Position: x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}
Health: ${Math.round(ctx.bot.health)} / 20
Hunger: ${Math.round(ctx.bot.food)} / 20
Weather: ${weather}
Time: ${timeOfDay}`)
  }

  registerCommand('status', () => {
    logger.log('Status command received')
    handleStatus()
  })

  return {
    cleanup: () => {
      // Commands are cleaned up automatically
    },
  }
}
