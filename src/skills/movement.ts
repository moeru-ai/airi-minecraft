import type { Entity } from 'prismarine-entity'
import type { Mineflayer } from '../libs/mineflayer'

import pathfinderModel from 'mineflayer-pathfinder'
import * as world from '../composables/world'
import { sleep } from '../utils/helper'
import { log } from './base'

const { goals, Movements } = pathfinderModel

export async function goToPosition(
  mineflayer: Mineflayer,
  x: number,
  y: number,
  z: number,
  minDistance = 2,
): Promise<boolean> {
  if (x == null || y == null || z == null) {
    log(mineflayer, `Missing coordinates, given x:${x} y:${y} z:${z}`)
    return false
  }

  if (mineflayer.allowCheats) {
    mineflayer.bot.chat(`/tp @s ${x} ${y} ${z}`)
    log(mineflayer, `Teleported to ${x}, ${y}, ${z}.`)
    return true
  }

  await mineflayer.bot.pathfinder.goto(new goals.GoalNear(x, y, z, minDistance))
  log(mineflayer, `You have reached ${x}, ${y}, ${z}.`)
  return true
}

export async function goToNearestBlock(
  mineflayer: Mineflayer,
  blockType: string,
  minDistance = 2,
  range = 64,
): Promise<boolean> {
  const MAX_RANGE = 512
  if (range > MAX_RANGE) {
    log(mineflayer, `Maximum search range capped at ${MAX_RANGE}.`)
    range = MAX_RANGE
  }

  const block = world.getNearestBlock(mineflayer, blockType, range)
  if (!block) {
    log(mineflayer, `Could not find any ${blockType} in ${range} blocks.`)
    return false
  }

  log(mineflayer, `Found ${blockType} at ${block.position}.`)
  await goToPosition(mineflayer, block.position.x, block.position.y, block.position.z, minDistance)
  return true
}

export async function goToNearestEntity(
  mineflayer: Mineflayer,
  entityType: string,
  minDistance = 2,
  range = 64,
): Promise<boolean> {
  const entity = world.getNearestEntityWhere(
    mineflayer,
    entity => entity.name === entityType,
    range,
  )

  if (!entity) {
    log(mineflayer, `Could not find any ${entityType} in ${range} blocks.`)
    return false
  }

  const distance = mineflayer.bot.entity.position.distanceTo(entity.position)
  log(mineflayer, `Found ${entityType} ${distance} blocks away.`)
  await goToPosition(
    mineflayer,
    entity.position.x,
    entity.position.y,
    entity.position.z,
    minDistance,
  )
  return true
}

export async function goToPlayer(
  mineflayer: Mineflayer,
  username: string,
  distance = 3,
): Promise<boolean> {
  if (mineflayer.allowCheats) {
    mineflayer.bot.chat(`/tp @s ${username}`)
    log(mineflayer, `Teleported to ${username}.`)
    return true
  }

  const player = mineflayer.bot.players[username]?.entity
  if (!player) {
    log(mineflayer, `Could not find ${username}.`)
    return false
  }

  await mineflayer.bot.pathfinder.goto(new goals.GoalFollow(player, distance))
  log(mineflayer, `You have reached ${username}.`)
  return true
}

export async function followPlayer(
  mineflayer: Mineflayer,
  username: string,
  distance = 4,
): Promise<boolean> {
  const player = mineflayer.bot.players[username]?.entity
  const movements = new Movements(mineflayer.bot)

  if (!player) {
    log(mineflayer, `Could not find ${username}.`)
    return false
  }

  log(mineflayer, `I am now following ${username}.`)

  return new Promise<boolean>((resolve) => {
    let isFollowing = true

    // Stop following when interrupted
    mineflayer.once('interrupt', () => {
      isFollowing = false
      resolve(true)
    })

    // Follow player at regular intervals
    const follow = async (): Promise<void> => {
      while (isFollowing) {
        const target = mineflayer.bot.players[username]?.entity
        if (!target) {
          log(mineflayer, 'I lost sight of you!')
          isFollowing = false
          resolve(false)
          return
        }

        const { x, y, z } = target.position
        mineflayer.bot.pathfinder.setMovements(movements)
        mineflayer.bot.pathfinder.setGoal(new goals.GoalNear(x, y, z, distance))
        // await sleep(500)
      }
    }

    follow()
  })
}

export async function moveAway(mineflayer: Mineflayer, distance: number): Promise<boolean> {
  const pos = mineflayer.bot.entity.position
  const goal = new goals.GoalNear(pos.x, pos.y, pos.z, distance)
  const invertedGoal = new goals.GoalInvert(goal)

  if (mineflayer.allowCheats) {
    const move = new Movements(mineflayer.bot)
    const path = await mineflayer.bot.pathfinder.getPathTo(move, invertedGoal, 10000)
    const lastMove = path.path[path.path.length - 1]

    if (lastMove) {
      const x = Math.floor(lastMove.x)
      const y = Math.floor(lastMove.y)
      const z = Math.floor(lastMove.z)
      mineflayer.bot.chat(`/tp @s ${x} ${y} ${z}`)
      return true
    }
  }

  await mineflayer.bot.pathfinder.goto(invertedGoal)
  const newPos = mineflayer.bot.entity.position
  log(mineflayer, `Moved away from nearest entity to ${newPos}.`)
  return true
}

export async function moveAwayFromEntity(
  mineflayer: Mineflayer,
  entity: Entity,
  distance = 16,
): Promise<boolean> {
  const goal = new goals.GoalFollow(entity, distance)
  const invertedGoal = new goals.GoalInvert(goal)
  await mineflayer.bot.pathfinder.goto(invertedGoal)
  return true
}

export async function stay(mineflayer: Mineflayer, seconds = 30): Promise<boolean> {
  const start = Date.now()
  const targetTime = seconds === -1 ? Infinity : start + seconds * 1000

  while (Date.now() < targetTime) {
    await sleep(500)
  }

  log(mineflayer, `Stayed for ${(Date.now() - start) / 1000} seconds.`)
  return true
}

export async function goToBed(mineflayer: Mineflayer): Promise<boolean> {
  const beds = mineflayer.bot.findBlocks({
    matching: block => block.name.includes('bed'),
    maxDistance: 32,
    count: 1,
  })

  if (beds.length === 0) {
    log(mineflayer, 'Could not find a bed to sleep in.')
    return false
  }

  const loc = beds[0]
  await goToPosition(mineflayer, loc.x, loc.y, loc.z)

  const bed = mineflayer.bot.blockAt(loc)
  if (!bed) {
    log(mineflayer, 'Could not find bed block.')
    return false
  }

  await mineflayer.bot.sleep(bed)
  log(mineflayer, 'You are in bed.')

  while (mineflayer.bot.isSleeping) {
    await sleep(500)
  }

  log(mineflayer, 'You have woken up.')
  return true
}
