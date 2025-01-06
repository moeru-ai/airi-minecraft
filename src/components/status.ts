import type { BotContext, ComponentLifecycle } from '../composables/bot'
import { useLogg } from '@guiiai/logg'
import { registerCommand } from '../composables/command'

const status = new Map<string, string>()

export function getStatusToString(ctx: BotContext): string {
  return Array.from(getStatus(ctx).entries()).map(([key, value]) => `${key}: ${value}`).join('\n')
}

export function getStatus(ctx: BotContext): Map<string, string> {
  const pos = ctx.bot.entity.position
  const weather = ctx.bot.isRaining ? 'Rain' : ctx.bot.thunderState ? 'Thunderstorm' : 'Clear'
  const timeOfDay = ctx.bot.time.timeOfDay < 6000
    ? 'Morning'
    : ctx.bot.time.timeOfDay < 12000 ? 'Afternoon' : 'Night'

  status.set('position', `x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}`)
  status.set('health', `${Math.round(ctx.bot.health)} / 20`)
  status.set('weather', weather)
  status.set('timeOfDay', timeOfDay)

  return status
}

export function createStatusComponent(ctx: BotContext): ComponentLifecycle {
  const logger = useLogg('status').useGlobalConfig()
  logger.log('Loading status component')

  registerCommand('status', () => {
    logger.log('Status command received')
    const status = getStatusToString(ctx)
    ctx.bot.chat(status)
  })

  return {
    cleanup: () => {
      // Commands are cleaned up automatically
    },
  }
}
