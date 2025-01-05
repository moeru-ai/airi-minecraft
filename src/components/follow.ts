import type { Bot } from 'mineflayer'
import type { ComponentLifecycle } from '../bot'
import { useLogg } from '@guiiai/logg'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'

export function createFollowComponent(bot: Bot): ComponentLifecycle {
  const RANGE_GOAL = 2 // get within this radius of the player

  const logger = useLogg('follow').useGlobalConfig()
  logger.log('Loading follow plugin')

  bot.loadPlugin(pathfinder)

  let defaultMove: Movements
  let following: string | null = null

  const followPlayer = () => {
    if (!following)
      return

    const target = bot.players[following]?.entity
    if (!target) {
      bot.chat('I lost sight of you!')
      following = null
      return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    bot.pathfinder.setMovements(defaultMove)
    bot.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
  }

  const onChat = (username: string, message: string) => {
    if (username === bot.username)
      return

    if (message === 'follow') {
      following = username
      logger.withFields({ username }).log('Starting to follow player')
      followPlayer()
    }
    else if (message === 'stop') {
      following = null
      logger.log('Stopping follow')
      bot.pathfinder.stop()
    }
  }

  bot.once('spawn', () => {
    defaultMove = new Movements(bot)
    bot.on('chat', onChat)

    // Continuously update path to follow player
    const followInterval = setInterval(() => {
      if (following)
        followPlayer()
    }, 1000)

    bot.once('end', () => {
      clearInterval(followInterval)
    })
  })

  return {
    cleanup: () => {
      bot.removeListener('chat', onChat)
    },
  }
}
