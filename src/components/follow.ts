import type { BotContext, ComponentLifecycle } from '@/composables/bot'
import type { CommandContext } from '@/middlewares/command'
import { registerCommand } from '@/composables/command'
import { useLogg } from '@guiiai/logg'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'

interface FollowContext {
  following: string | null
  movements: Movements
}

export function createFollowComponent(ctx: BotContext): ComponentLifecycle {
  const RANGE_GOAL = 1 // get within this radius of the player
  const logger = useLogg('follow').useGlobalConfig()

  ctx.bot.loadPlugin(pathfinder)

  const state: FollowContext = {
    following: null,
    movements: new Movements(ctx.bot),
  }

  function startFollow(username: string): void {
    state.following = username
    logger.withFields({ username }).log('Starting to follow player')
    followPlayer()
  }

  function stopFollow(): void {
    state.following = null
    logger.log('Stopping follow')
    ctx.bot.pathfinder.stop()
  }

  function followPlayer(): void {
    if (!state.following)
      return

    const target = ctx.bot.players[state.following]?.entity
    if (!target) {
      ctx.bot.chat('I lost sight of you!')
      state.following = null
      return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    ctx.bot.pathfinder.setMovements(state.movements)
    ctx.bot.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
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
