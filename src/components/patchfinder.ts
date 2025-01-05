// This is an example that uses mineflayer-pathfinder to showcase how simple it is to walk to goals

import type { Bot } from 'mineflayer'
import type { ComponentLifecycle } from '../bot'
import { useLogg } from '@guiiai/logg'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'

export function createPathFinderComponent(botInstance: Bot): ComponentLifecycle {
  const RANGE_GOAL = 1 // get within this radius of the player

  const logger = useLogg('pathfinder').useGlobalConfig()
  logger.log('Loading pathfinder plugin')

  botInstance.loadPlugin(pathfinder)

  let defaultMove: Movements

  const onChat = (username: string, message: string) => {
    if (username === botInstance.username)
      return
    if (message !== 'come')
      return

    logger.withFields({ username, message }).log('Chat message received')
    const target = botInstance.players[username]?.entity
    if (!target) {
      botInstance.chat('I don\'t see you !')
      return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    botInstance.pathfinder.setMovements(defaultMove)
    botInstance.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
  }

  botInstance.once('spawn', () => {
    logger.log('Spawning bot')
    defaultMove = new Movements(botInstance)
    botInstance.on('chat', onChat)
  })

  return {
    cleanup: () => {
      botInstance.removeListener('chat', onChat)
    },
  }
}
