import type { Bot } from 'mineflayer'
import type { ComponentLifecycle } from '../bot'
import { useLogg } from '@guiiai/logg'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'

interface Context {
  fromUsername?: string
  fromEntity?: any
  fromMessage?: string

  isBot: () => boolean
  isCommand: () => boolean
}

function newContext(botInstance: Bot, message: string, sender: string, entity: any): Context {
  return {
    isBot: () => sender === botInstance.username,
    isCommand: () => message.startsWith('#'),
  }
}

export function createFollowComponent(botInstance: Bot): ComponentLifecycle {
  const RANGE_GOAL = 2 // get within this radius of the player

  const logger = useLogg('follow').useGlobalConfig()
  logger.log('Loading follow plugin')

  botInstance.loadPlugin(pathfinder)

  let defaultMove: Movements
  let following: string | null = null

  const followPlayer = () => {
    if (!following)
      return

    const target = botInstance.players[following]?.entity
    if (!target) {
      botInstance.chat('I lost sight of you!')
      following = null
      return
    }

    const { x: playerX, y: playerY, z: playerZ } = target.position

    botInstance.pathfinder.setMovements(defaultMove)
    botInstance.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
  }

  const onChat = (username: string, message: string) => {
    if (username === botInstance.username)
      return

    if (message === 'follow') {
      following = username
      logger.withFields({ username }).log('Starting to follow player')
      followPlayer()
    }
    else if (message === 'stop') {
      following = null
      logger.log('Stopping follow')
      botInstance.pathfinder.stop()
    }
  }

  botInstance.once('spawn', () => {
    logger.log('Spawning bot')
    defaultMove = new Movements(botInstance)
    botInstance.on('chat', onChat)

    // Continuously update path to follow player
    const followInterval = setInterval(() => {
      if (following)
        followPlayer()
    }, 1000)

    botInstance.once('end', () => {
      clearInterval(followInterval)
    })
  })

  return {
    cleanup: () => {
      botInstance.removeListener('chat', onChat)
    },
  }
}
