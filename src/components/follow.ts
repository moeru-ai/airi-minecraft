import type { BotContext, ComponentLifecycle } from '../composables/bot'
import type { CommandContext } from '../middlewares/command'
import { useLogg } from '@guiiai/logg'
import pathfinderModel from 'mineflayer-pathfinder'
import { registerCommand } from '../composables/command'

const { goals, Movements } = pathfinderModel

export function createFollowComponent(ctx: BotContext, config?: {
  rangeGoal: number
}): ComponentLifecycle {
  const logger = useLogg('follow').useGlobalConfig()

  const state = {
    following: undefined as string | undefined,
    movements: new Movements(ctx.bot),
  }

  function startFollow(username: string): void {
    state.following = username
    logger.withFields({ username }).log('Starting to follow player')
    followPlayer()
  }

  function stopFollow(): void {
    state.following = undefined
    logger.log('Stopping follow')
    ctx.bot.pathfinder.stop()
  }

  function followPlayer(): void {
    if (!state.following)
      return

    const target = ctx.bot.players[state.following]?.entity
    if (!target) {
      ctx.bot.chat('I lost sight of you!')
      state.following = undefined
      return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    ctx.bot.pathfinder.setMovements(state.movements)
    ctx.bot.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, config?.rangeGoal ?? 1))
  }

  registerCommand('follow', (commandCtx: CommandContext) => {
    const username = commandCtx.sender
    if (!username) {
      ctx.bot.chat('Please specify a player name!')
      return
    }
    startFollow(username)
  })

  registerCommand('stop', () => {
    stopFollow()
  })

  // Continuously update path to follow player
  const followInterval = setInterval(() => {
    if (state.following)
      followPlayer()
  }, 1000)

  return {
    cleanup: () => {
      clearInterval(followInterval)
    },
  }
}
