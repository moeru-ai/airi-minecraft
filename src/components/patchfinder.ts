// This is an example that uses mineflayer-pathfinder to showcase how simple it is to walk to goals

import type { Bot } from 'mineflayer'
import type { ComponentLifecycle } from '../bot'
import { useLogg } from '@guiiai/logg'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'

export function createPathFinderComponent(bot: Bot): ComponentLifecycle {
  const RANGE_GOAL = 1 // get within this radius of the player

  const logger = useLogg('pathfinder').useGlobalConfig()
  logger.log('Loading pathfinder plugin')

  bot.loadPlugin(pathfinder)

  let defaultMove: Movements

  const onChat = (username: string, message: string) => {
    if (username === bot.username)
      return
    if (message !== 'come')
      return

    logger.withFields({ username, message }).log('Chat message received')
    const target = bot.players[username]?.entity
    if (!target) {
      bot.chat('I don\'t see you !')
      return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    bot.pathfinder.setMovements(defaultMove)
    bot.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
  }

  bot.once('spawn', () => {
    defaultMove = new Movements(bot)
    bot.on('chat', onChat)
  })

  return {
    cleanup: () => {
      bot.removeListener('chat', onChat)
    },
  }
}
