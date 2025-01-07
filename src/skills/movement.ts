import type { Entity } from 'prismarine-entity'
import type { SkillContext } from './base'
import pathfinderModel from 'mineflayer-pathfinder'
import * as world from '../composables/world'
import { log } from './base'

const { goals, Movements } = pathfinderModel

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

  await bot.pathfinder.goto(new goals.GoalNear(x, y, z, minDistance))
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

  const worldCtx = world.createWorldContext(ctx.botCtx)
  const block = world.getNearestBlock(worldCtx, blockType, range)
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
  const worldCtx = world.createWorldContext(ctx.botCtx)
  const entity = world.getNearestEntityWhere(
    worldCtx,
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

  await bot.pathfinder.goto(new goals.GoalFollow(player, distance))
  log(ctx, `You have reached ${username}.`)
  return true
}

export async function followPlayer(
  ctx: SkillContext,
  username: string,
  distance = 4,
): Promise<boolean> {
  const { bot } = ctx
  const player = bot.players[username]?.entity
  if (!player) {
    log(ctx, `Could not find player ${username}`)
    return false
  }

  const movements = new Movements(bot)
  bot.pathfinder.setMovements(movements)
  bot.pathfinder.setGoal(new goals.GoalNear(player.position.x, player.position.y, player.position.z, distance))

  log(ctx, `Started following ${username}`)

  const followInterval = setInterval(() => {
    const target = bot.players[username]?.entity
    if (!target) {
      log(ctx, 'Lost sight of player')
      clearInterval(followInterval)
      return
    }

    const { x, y, z } = target.position
    bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, distance))
  }, 1000)

  while (!ctx.shouldInterrupt) {
    await new Promise(resolve => setTimeout(resolve, 500))

    if (ctx.allowCheats && bot.entity.position.distanceTo(player.position) > 100) {
      await goToPlayer(ctx, username)
    }
  }

  // TODO: need global status management
  // clearInterval(followInterval)
  // bot.pathfinder.stop()
  return true
}

/**
 * Move away from current position
 */
export async function moveAway(ctx: SkillContext, distance: number): Promise<boolean> {
  const { bot } = ctx
  const pos = bot.entity.position
  const goal = new goals.GoalNear(pos.x, pos.y, pos.z, distance)
  const invertedGoal = new goals.GoalInvert(goal)

  if (ctx.allowCheats) {
    const move = new Movements(bot)
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
  const goal = new goals.GoalFollow(entity, distance)
  const invertedGoal = new goals.GoalInvert(goal)
  await bot.pathfinder.goto(invertedGoal)
  return true
}

/**
 * Stay in current position
 */
export async function stay(ctx: SkillContext, seconds = 30): Promise<boolean> {
  const start = Date.now()
  const targetTime = seconds === -1 ? Infinity : start + seconds * 1000

  while (!ctx.shouldInterrupt && Date.now() < targetTime) {
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  log(ctx, `Stayed for ${(Date.now() - start) / 1000} seconds.`)
  return true
}
