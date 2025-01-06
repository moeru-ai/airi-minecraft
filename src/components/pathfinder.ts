import type { BotContext, ComponentLifecycle } from '@/composables/bot'
import type { CommandContext } from '@/middlewares/command'
import { registerCommand } from '@/composables/command'
import { useLogg } from '@guiiai/logg'
import pathfinderModel from 'mineflayer-pathfinder'

const { goals, Movements, pathfinder } = pathfinderModel

export function createPathFinderComponent(ctx: BotContext, config?: {
  rangeGoal: number
}): ComponentLifecycle {
  const logger = useLogg('pathfinder').useGlobalConfig()
  logger.log('Loading pathfinder plugin')

  ctx.bot.loadPlugin(pathfinder)

  let defaultMove: any

  const handleCome = (commandCtx: CommandContext) => {
    const username = commandCtx.sender
    if (!username) {
      ctx.bot.chat('Please specify a player name!')
      return
    }

    logger.withFields({ username }).log('Come command received')
    const target = ctx.bot.players[username]?.entity
    if (!target) {
      ctx.bot.chat('I don\'t see that player!')
      return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    ctx.bot.pathfinder.setMovements(defaultMove)
    ctx.bot.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, config?.rangeGoal ?? 1))
  }

  defaultMove = new Movements(ctx.bot)
  registerCommand('come', handleCome)

  return {
    cleanup: () => {
      // Commands are cleaned up automatically
    },
  }
}
