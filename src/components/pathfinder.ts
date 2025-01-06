import type { BotContext, ComponentLifecycle } from '@/composables/bot'
import type { CommandContext } from '@/middlewares/command'
import { registerCommand } from '@/composables/command'
import { useLogg } from '@guiiai/logg'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'

export function createPathFinderComponent(ctx: BotContext): ComponentLifecycle {
  const RANGE_GOAL = 1 // get within this radius of the player

  const logger = useLogg('pathfinder').useGlobalConfig()
  logger.log('Loading pathfinder plugin')

  ctx.bot.loadPlugin(pathfinder)

  let defaultMove: Movements

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
    ctx.bot.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
  }

  defaultMove = new Movements(ctx.bot)
  registerCommand('come', handleCome)

  return {
    cleanup: () => {
      // Commands are cleaned up automatically
    },
  }
}
