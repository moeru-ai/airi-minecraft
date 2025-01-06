import type { Bot } from 'mineflayer'
import type { Entity } from 'prismarine-entity'
import * as world from '../composables/world'
import { log } from './base'

/**
 * Navigate to a specific position
 */
export async function goToPosition(
  bot: Bot,
  x: number,
  y: number,
  z: number,
  minDistance = 2,
): Promise<boolean> {
  if (x == null || y == null || z == null) {
    log(bot, `Missing coordinates, given x:${x} y:${y} z:${z}`)
    return false
  }

  if (bot.modes.isOn('cheat')) {
    bot.chat(`/tp @s ${x} ${y} ${z}`)
    log(bot, `Teleported to ${x}, ${y}, ${z}.`)
    return true
  }

  await bot.pathfinder.goto(bot.pathfinder.goals.GoalNear(x, y, z, minDistance))
  log(bot, `You have reached ${x}, ${y}, ${z}.`)
  return true
}

/**
 * Navigate to the nearest block of a specific type
 */
export async function goToNearestBlock(
  bot: Bot,
  blockType: string,
  minDistance = 2,
  range = 64,
): Promise<boolean> {
  const MAX_RANGE = 512
  if (range > MAX_RANGE) {
    log(bot, `Maximum search range capped at ${MAX_RANGE}.`)
    range = MAX_RANGE
  }

  const block = world.getNearestBlock(bot, blockType, range)
  if (!block) {
    log(bot, `Could not find any ${blockType} in ${range} blocks.`)
    return false
  }

  log(bot, `Found ${blockType} at ${block.position}.`)
  await goToPosition(bot, block.position.x, block.position.y, block.position.z, minDistance)
  return true
}

/**
 * Navigate to the nearest entity of a specific type
 */
export async function goToNearestEntity(
  bot: Bot,
  entityType: string,
  minDistance = 2,
  range = 64,
): Promise<boolean> {
  const entity = world.getNearestEntityWhere(
    bot,
    entity => entity.name === entityType,
    range,
  )

  if (!entity) {
    log(bot, `Could not find any ${entityType} in ${range} blocks.`)
    return false
  }

  const distance = bot.entity.position.distanceTo(entity.position)
  log(bot, `Found ${entityType} ${distance} blocks away.`)
  await goToPosition(
    bot,
    entity.position.x,
    entity.position.y,
    entity.position.z,
    minDistance,
  )
  return true
}

/**
 * Navigate to a specific player
 */
export async function goToPlayer(bot: Bot, username: string, distance = 3): Promise<boolean> {
  if (bot.modes.isOn('cheat')) {
    bot.chat(`/tp @s ${username}`)
    log(bot, `Teleported to ${username}.`)
    return true
  }

  bot.modes.pause('self_defense')
  bot.modes.pause('cowardice')

  const player = bot.players[username]?.entity
  if (!player) {
    log(bot, `Could not find ${username}.`)
    return false
  }

  await bot.pathfinder.goto(bot.pathfinder.goals.GoalFollow(player, distance), true)
  log(bot, `You have reached ${username}.`)
  return true
}

/**
 * Follow a player continuously
 */
export async function followPlayer(bot: Bot, username: string, distance = 4): Promise<boolean> {
  const player = bot.players[username]?.entity
  if (!player)
    return false

  bot.pathfinder.setGoal(bot.pathfinder.goals.GoalFollow(player, distance), true)
  log(bot, `You are now actively following player ${username}.`)

  while (!bot.interrupt_code) {
    await new Promise(resolve => setTimeout(resolve, 500))

    if (bot.modes.isOn('cheat')
      && bot.entity.position.distanceTo(player.position) > 100
      && player.isOnGround) {
      await goToPlayer(bot, username)
    }

    if (bot.modes.isOn('unstuck')) {
      const isNearby = bot.entity.position.distanceTo(player.position) <= distance + 1
      if (isNearby) {
        bot.modes.pause('unstuck')
      }
      else {
        bot.modes.unpause('unstuck')
      }
    }
  }
  return true
}

/**
 * Move away from current position
 */
export async function moveAway(bot: Bot, distance: number): Promise<boolean> {
  const pos = bot.entity.position
  const goal = bot.pathfinder.goals.GoalNear(pos.x, pos.y, pos.z, distance)
  const invertedGoal = bot.pathfinder.goals.GoalInvert(goal)

  if (bot.modes.isOn('cheat')) {
    const move = new bot.pathfinder.Movements(bot)
    const path = await bot.pathfinder.getPathTo(move, invertedGoal, 10000)
    const lastMove = path.path[path.path.length - 1]

    if (lastMove) {
      const x = Math.floor(lastMove.x)
      const y = Math.floor(lastMove.y)
      const z = Math.floor(lastMove.z)
      bot.chat(`/tp @s ${x} ${y} ${z}`)
      return true
    }
  }

  await bot.pathfinder.goto(invertedGoal)
  const newPos = bot.entity.position
  log(bot, `Moved away from nearest entity to ${newPos}.`)
  return true
}

/**
 * Move away from a specific entity
 */
export async function moveAwayFromEntity(
  bot: Bot,
  entity: Entity,
  distance = 16,
): Promise<boolean> {
  const goal = bot.pathfinder.goals.GoalFollow(entity, distance)
  const invertedGoal = bot.pathfinder.goals.GoalInvert(goal)
  await bot.pathfinder.goto(invertedGoal)
  return true
}

/**
 * Stay in current position
 */
export async function stay(bot: Bot, seconds = 30): Promise<boolean> {
  bot.modes.pause('self_preservation')
  bot.modes.pause('unstuck')
  bot.modes.pause('cowardice')
  bot.modes.pause('self_defense')
  bot.modes.pause('hunting')
  bot.modes.pause('torch_placing')
  bot.modes.pause('item_collecting')

  const start = Date.now()
  while (!bot.interrupt_code && (seconds === -1 || Date.now() - start < seconds * 1000)) {
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  log(bot, `Stayed for ${(Date.now() - start) / 1000} seconds.`)
  return true
}
/**
 * Sleep in the nearest bed within 32 blocks
 */
export async function goToBed(bot: Bot): Promise<boolean> {
  const beds: Vec3[] = bot.findBlocks({
    matching: (block: Block) => block.name.includes('bed'),
    maxDistance: 32,
    count: 1,
  })

  if (beds.length === 0) {
    log(bot, 'Could not find a bed to sleep in.')
    return false
  }

  const loc: Vec3 = beds[0]
  await goToPosition(bot, loc.x, loc.y, loc.z)

  const bed: Block | null = bot.blockAt(loc)
  await bot.sleep(bed)
  log(bot, 'You are in bed.')

  bot.modes.pause('unstuck')

  while (bot.isSleeping) {
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  log(bot, 'You have woken up.')
  return true
}
