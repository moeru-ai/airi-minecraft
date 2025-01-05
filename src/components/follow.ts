import type { ComponentLifecycle, Context } from '../ctx.bot'
import { useLogg } from '@guiiai/logg'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'

export function createFollowComponent(ctx: Context): ComponentLifecycle {
  const RANGE_GOAL = 2 // get within this radius of the player

  const logger = useLogg('follow').useGlobalConfig()
  logger.log('Loading follow plugin')

  ctx.bot.loadPlugin(pathfinder)

  let defaultMove: Movements
  let following: string | null = null

  const followPlayer = () => {
    if (!following)
      return

    const target = ctx.bot.players[following]?.entity
    if (!target) {
      ctx.bot.chat('I lost sight of you!')
      following = null
      return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    ctx.bot.pathfinder.setMovements(defaultMove)
    ctx.bot.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
  }

  const onChat = (username: string, message: string) => {
    if (username === ctx.bot.username)
      return

    if (message === 'follow') {
      following = username
      logger.withFields({ username }).log('Starting to follow player')
      followPlayer()
    }
    else if (message === 'stop') {
      following = null
      logger.log('Stopping follow')
      ctx.bot.pathfinder.stop()
    }
  }

  ctx.bot.once('spawn', () => {
    defaultMove = new Movements(ctx.bot)
    ctx.bot.on('chat', onChat)

    // Continuously update path to follow player
    const followInterval = setInterval(() => {
      if (following)
        followPlayer()
    }, 1000)

    ctx.bot.once('end', () => {
      clearInterval(followInterval)
    })
  })

  return {
    cleanup: () => {
      ctx.bot.removeListener('chat', onChat)
    },
  }
}
