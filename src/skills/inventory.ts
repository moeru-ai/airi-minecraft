import type { Bot } from 'mineflayer'
import type { SkillContext } from './base'
import * as world from '../composables/world'
import { log } from './base'
import { goToPosition } from './movement'

/**
 * Pick up nearby items
 */
export async function pickupNearbyItems(ctx: SkillContext): Promise<boolean> {
  const { bot } = ctx
  const distance = 8
  const getNearestItem = (bot: Bot) =>
    bot.nearestEntity(entity =>
      entity.name === 'item'
      && bot.entity.position.distanceTo(entity.position) < distance,
    )

  let nearestItem = getNearestItem(bot)
  let pickedUp = 0

  while (nearestItem) {
    await bot.pathfinder.goto(bot.pathfinder.goals.GoalFollow(nearestItem, 0.8), true)
    await new Promise(resolve => setTimeout(resolve, 200))

    const prev = nearestItem
    nearestItem = getNearestItem(bot)
    if (prev === nearestItem) {
      break
    }
    pickedUp++
  }

  log(ctx, `Picked up ${pickedUp} items.`)
  return true
}

/**
 * Equip an item
 */
export async function equip(ctx: SkillContext, itemName: string): Promise<boolean> {
  const { bot } = ctx
  const item = bot.inventory.slots.find(slot => slot && slot.name === itemName)
  if (!item) {
    log(ctx, `You do not have any ${itemName} to equip.`)
    return false
  }

  if (itemName.includes('leggings')) {
    await bot.equip(item, 'legs')
  }
  else if (itemName.includes('boots')) {
    await bot.equip(item, 'feet')
  }
  else if (itemName.includes('helmet')) {
    await bot.equip(item, 'head')
  }
  else if (itemName.includes('chestplate') || itemName.includes('elytra')) {
    await bot.equip(item, 'torso')
  }
  else if (itemName.includes('shield')) {
    await bot.equip(item, 'off-hand')
  }
  else {
    await bot.equip(item, 'hand')
  }

  log(ctx, `Equipped ${itemName}.`)
  return true
}

/**
 * Discard items
 */
export async function discard(ctx: SkillContext, itemName: string, num = -1): Promise<boolean> {
  const { bot } = ctx
  let discarded = 0

  while (true) {
    const item = bot.inventory.items().find(item => item.name === itemName)
    if (!item) {
      break
    }

    const toDiscard = num === -1 ? item.count : Math.min(num - discarded, item.count)
    await bot.toss(item.type, null, toDiscard)
    discarded += toDiscard

    if (num !== -1 && discarded >= num) {
      break
    }
  }

  if (discarded === 0) {
    log(ctx, `You do not have any ${itemName} to discard.`)
    return false
  }

  log(ctx, `Discarded ${discarded} ${itemName}.`)
  return true
}

/**
 * Put items in a chest
 */
export async function putInChest(ctx: SkillContext, itemName: string, num = -1): Promise<boolean> {
  const { bot } = ctx
  const chest = world.getNearestBlock(bot, 'chest', 32)
  if (!chest) {
    log(ctx, 'Could not find a chest nearby.')
    return false
  }

  const item = bot.inventory.items().find(item => item.name === itemName)
  if (!item) {
    log(ctx, `You do not have any ${itemName} to put in the chest.`)
    return false
  }

  const toPut = num === -1 ? item.count : Math.min(num, item.count)
  await goToPosition(ctx, chest.position.x, chest.position.y, chest.position.z, 2)

  const chestContainer = await bot.openContainer(chest)
  await chestContainer.deposit(item.type, null, toPut)
  await chestContainer.close()

  log(ctx, `Successfully put ${toPut} ${itemName} in the chest.`)
  return true
}

/**
 * Take items from a chest
 */
export async function takeFromChest(ctx: SkillContext, itemName: string, num = -1): Promise<boolean> {
  const { bot } = ctx
  const chest = world.getNearestBlock(bot, 'chest', 32)
  if (!chest) {
    log(ctx, 'Could not find a chest nearby.')
    return false
  }

  await goToPosition(ctx, chest.position.x, chest.position.y, chest.position.z, 2)
  const chestContainer = await bot.openContainer(chest)

  const item = chestContainer.containerItems().find(item => item.name === itemName)
  if (!item) {
    log(ctx, `Could not find any ${itemName} in the chest.`)
    await chestContainer.close()
    return false
  }

  const toTake = num === -1 ? item.count : Math.min(num, item.count)
  await chestContainer.withdraw(item.type, null, toTake)
  await chestContainer.close()

  log(ctx, `Successfully took ${toTake} ${itemName} from the chest.`)
  return true
}

/**
 * View contents of a chest
 */
export async function viewChest(ctx: SkillContext): Promise<boolean> {
  const { bot } = ctx
  const chest = world.getNearestBlock(bot, 'chest', 32)
  if (!chest) {
    log(ctx, 'Could not find a chest nearby.')
    return false
  }

  await goToPosition(ctx, chest.position.x, chest.position.y, chest.position.z, 2)
  const chestContainer = await bot.openContainer(chest)
  const items = chestContainer.containerItems()

  if (items.length === 0) {
    log(ctx, 'The chest is empty.')
  }
  else {
    log(ctx, 'The chest contains:')
    for (const item of items) {
      log(ctx, `${item.count} ${item.name}`)
    }
  }

  await chestContainer.close()
  return true
}

/**
 * Consume (eat/drink) an item
 */
export async function consume(ctx: SkillContext, itemName = ''): Promise<boolean> {
  const { bot } = ctx
  let item
  let name

  if (itemName) {
    item = bot.inventory.items().find(item => item.name === itemName)
    name = itemName
  }

  if (!item) {
    log(ctx, `You do not have any ${name} to eat.`)
    return false
  }

  await bot.equip(item, 'hand')
  await bot.consume()
  log(ctx, `Consumed ${item.name}.`)
  return true
}

/**
 * Give items to a player
 */
export async function giveToPlayer(
  ctx: SkillContext,
  itemType: string,
  username: string,
  num = 1,
): Promise<boolean> {
  const { bot } = ctx
  const player = bot.players[username]?.entity
  if (!player) {
    log(ctx, `Could not find ${username}.`)
    return false
  }

  await goToPosition(ctx, player.position.x, player.position.y, player.position.z, 3)

  if (bot.entity.position.y < player.position.y - 1) {
    await goToPosition(ctx, player.position.x, player.position.y, player.position.z, 1)
  }

  if (bot.entity.position.distanceTo(player.position) < 2) {
    const goal = bot.pathfinder.goals.GoalNear(player.position.x, player.position.y, player.position.z, 2)
    const invertedGoal = bot.pathfinder.goals.GoalInvert(goal)
    await bot.pathfinder.goto(invertedGoal)
  }

  await bot.lookAt(player.position)

  if (await discard(ctx, itemType, num)) {
    let given = false
    bot.once('playerCollect', (collector, collected) => {
      if (collector.username === username) {
        log(ctx, `${username} received ${itemType}.`)
        given = true
      }
    })

    const start = Date.now()
    while (!given && !ctx.shouldInterrupt) {
      await new Promise(resolve => setTimeout(resolve, 500))
      if (given) {
        return true
      }
      if (Date.now() - start > 3000) {
        break
      }
    }
  }

  log(ctx, `Failed to give ${itemType} to ${username}, it was never received.`)
  return false
}
