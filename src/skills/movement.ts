import type { Entity } from 'prismarine-entity'
import type { SkillContext } from './base'
import * as world from '../composables/world'
import { log } from './base'

/**
 * Navigate to a specific position
 */
export async function goToPosition(
  ctx: SkillContext,
  x: number,
  y: number,
  z: number,
  minDistance = 2,
): Promise<boolean> {
  const { bot } = ctx
  if (x == null || y == null || z == null) {
    log(ctx, `Missing coordinates, given x:${x} y:${y} z:${z}`)
    return false
  }

  if (ctx.allowCheats) {
    bot.chat(`/tp @s ${x} ${y} ${z}`)
    log(ctx, `Teleported to ${x}, ${y}, ${z}.`)
    return true
  }

  await bot.pathfinder.goto(bot.pathfinder.goals.GoalNear(x, y, z, minDistance))
  log(ctx, `You have reached ${x}, ${y}, ${z}.`)
  return true
}

/**
 * Navigate to the nearest block of a specific type
 */
export async function goToNearestBlock(
  ctx: SkillContext,
  blockType: string,
  minDistance = 2,
  range = 64,
): Promise<boolean> {
  const MAX_RANGE = 512
  if (range > MAX_RANGE) {
    log(ctx, `Maximum search range capped at ${MAX_RANGE}.`)
    range = MAX_RANGE
  }

  const block = world.getNearestBlock(ctx.bot, blockType, range)
  if (!block) {
    log(ctx, `Could not find any ${blockType} in ${range} blocks.`)
    return false
  }

  log(ctx, `Found ${blockType} at ${block.position}.`)
  await goToPosition(ctx, block.position.x, block.position.y, block.position.z, minDistance)
  return true
}

/**
 * Navigate to the nearest entity of a specific type
 */
export async function goToNearestEntity(
  ctx: SkillContext,
  entityType: string,
  minDistance = 2,
  range = 64,
): Promise<boolean> {
  const { bot } = ctx
  const entity = world.getNearestEntityWhere(
    bot,
    entity => entity.name === entityType,
    range,
  )

  if (!entity) {
    log(ctx, `Could not find any ${entityType} in ${range} blocks.`)
    return false
  }

  const distance = bot.entity.position.distanceTo(entity.position)
  log(ctx, `Found ${entityType} ${distance} blocks away.`)
  await goToPosition(
    ctx,
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
export async function goToPlayer(
  ctx: SkillContext,
  username: string,
  distance = 3,
): Promise<boolean> {
  const { bot } = ctx
  if (ctx.allowCheats) {
    bot.chat(`/tp @s ${username}`)
    log(ctx, `Teleported to ${username}.`)
    return true
  }

  const player = bot.players[username]?.entity
  if (!player) {
    log(ctx, `Could not find ${username}.`)
    return false
  }

  await bot.pathfinder.goto(bot.pathfinder.goals.GoalFollow(player, distance), true)
  log(ctx, `You have reached ${username}.`)
  return true
}

/**
 * Follow a player continuously
 */
export async function followPlayer(
  ctx: SkillContext,
  username: string,
  distance = 4,
): Promise<boolean> {
  const { bot } = ctx
  const player = bot.players[username]?.entity
  if (!player)
    return false

  bot.pathfinder.setGoal(bot.pathfinder.goals.GoalFollow(player, distance), true)
  log(ctx, `You are now actively following player ${username}.`)

  while (!ctx.shouldInterrupt) {
    await new Promise(resolve => setTimeout(resolve, 500))

    if (ctx.allowCheats
      && bot.entity.position.distanceTo(player.position) > 100
      && player.isOnGround) {
      await goToPlayer(ctx, username)
    }
  }
  return true
}

/**
 * Move away from current position
 */
export async function moveAway(ctx: SkillContext, distance: number): Promise<boolean> {
  const { bot } = ctx
  const pos = bot.entity.position
  const goal = bot.pathfinder.goals.GoalNear(pos.x, pos.y, pos.z, distance)
  const invertedGoal = bot.pathfinder.goals.GoalInvert(goal)

  if (ctx.allowCheats) {
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
  log(ctx, `Moved away from nearest entity to ${newPos}.`)
  return true
}

/**
 * Move away from a specific entity
 */
export async function moveAwayFromEntity(
  ctx: SkillContext,
  entity: Entity,
  distance = 16,
): Promise<boolean> {
  const { bot } = ctx
  const goal = bot.pathfinder.goals.GoalFollow(entity, distance)
  const invertedGoal = bot.pathfinder.goals.GoalInvert(goal)
  await bot.pathfinder.goto(invertedGoal)
  return true
}

/**
 * Stay in current position
 */
export async function stay(ctx: SkillContext, seconds = 30): Promise<boolean> {
  const start = Date.now()
  while (!ctx.shouldInterrupt && (seconds === -1 || Date.now() - start < seconds * 1000)) {
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  log(ctx, `Stayed for ${(Date.now() - start) / 1000} seconds.`)
  return true
}
