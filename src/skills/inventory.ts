import type { Bot } from 'mineflayer'
import type { Mineflayer } from '../libs/mineflayer'
import pathfinderModel from 'mineflayer-pathfinder'
import * as world from '../composables/world'
import { log } from './base'
import { goToPosition } from './movement'

const { goals } = pathfinderModel

export async function pickupNearbyItems(mineflayer: Mineflayer): Promise<boolean> {
  const distance = 8
  const getNearestItem = (bot: Bot) =>
    bot.nearestEntity(entity =>
      entity.name === 'item'
      && bot.entity.position.distanceTo(entity.position) < distance,
    )

  let nearestItem = getNearestItem(mineflayer.bot)
  let pickedUp = 0

  while (nearestItem) {
    await mineflayer.bot.pathfinder.goto(new goals.GoalFollow(nearestItem, 0.8))
    await new Promise(resolve => setTimeout(resolve, 200))

    const prev = nearestItem
    nearestItem = getNearestItem(mineflayer.bot)
    if (prev === nearestItem) {
      break
    }
    pickedUp++
  }

  log(mineflayer, `Picked up ${pickedUp} items.`)
  return true
}

export async function equip(mineflayer: Mineflayer, itemName: string): Promise<boolean> {
  const item = mineflayer.bot.inventory.slots.find(slot => slot && slot.name === itemName)
  if (!item) {
    log(mineflayer, `You do not have any ${itemName} to equip.`)
    return false
  }

  if (itemName.includes('leggings')) {
    await mineflayer.bot.equip(item, 'legs')
  }
  else if (itemName.includes('boots')) {
    await mineflayer.bot.equip(item, 'feet')
  }
  else if (itemName.includes('helmet')) {
    await mineflayer.bot.equip(item, 'head')
  }
  else if (itemName.includes('chestplate') || itemName.includes('elytra')) {
    await mineflayer.bot.equip(item, 'torso')
  }
  else if (itemName.includes('shield')) {
    await mineflayer.bot.equip(item, 'off-hand')
  }
  else {
    await mineflayer.bot.equip(item, 'hand')
  }

  log(mineflayer, `Equipped ${itemName}.`)
  return true
}

export async function discard(mineflayer: Mineflayer, itemName: string, num = -1): Promise<boolean> {
  let discarded = 0

  while (true) {
    const item = mineflayer.bot.inventory.items().find(item => item.name === itemName)
    if (!item) {
      break
    }

    const toDiscard = num === -1 ? item.count : Math.min(num - discarded, item.count)
    await mineflayer.bot.toss(item.type, null, toDiscard)
    discarded += toDiscard

    if (num !== -1 && discarded >= num) {
      break
    }
  }

  if (discarded === 0) {
    log(mineflayer, `You do not have any ${itemName} to discard.`)
    return false
  }

  log(mineflayer, `Discarded ${discarded} ${itemName}.`)
  return true
}

export async function putInChest(mineflayer: Mineflayer, itemName: string, num = -1): Promise<boolean> {
  const chest = world.getNearestBlock(mineflayer, 'chest', 32)
  if (!chest) {
    log(mineflayer, 'Could not find a chest nearby.')
    return false
  }

  const item = mineflayer.bot.inventory.items().find(item => item.name === itemName)
  if (!item) {
    log(mineflayer, `You do not have any ${itemName} to put in the chest.`)
    return false
  }

  const toPut = num === -1 ? item.count : Math.min(num, item.count)
  await goToPosition(mineflayer, chest.position.x, chest.position.y, chest.position.z, 2)

  const chestContainer = await mineflayer.bot.openContainer(chest)
  await chestContainer.deposit(item.type, null, toPut)
  await chestContainer.close()

  log(mineflayer, `Successfully put ${toPut} ${itemName} in the chest.`)
  return true
}

export async function takeFromChest(mineflayer: Mineflayer, itemName: string, num = -1): Promise<boolean> {
  const chest = world.getNearestBlock(mineflayer, 'chest', 32)
  if (!chest) {
    log(mineflayer, 'Could not find a chest nearby.')
    return false
  }

  await goToPosition(mineflayer, chest.position.x, chest.position.y, chest.position.z, 2)
  const chestContainer = await mineflayer.bot.openContainer(chest)

  const item = chestContainer.containerItems().find(item => item.name === itemName)
  if (!item) {
    log(mineflayer, `Could not find any ${itemName} in the chest.`)
    await chestContainer.close()
    return false
  }

  const toTake = num === -1 ? item.count : Math.min(num, item.count)
  await chestContainer.withdraw(item.type, null, toTake)
  await chestContainer.close()

  log(mineflayer, `Successfully took ${toTake} ${itemName} from the chest.`)
  return true
}

export async function viewChest(mineflayer: Mineflayer): Promise<boolean> {
  const chest = world.getNearestBlock(mineflayer, 'chest', 32)
  if (!chest) {
    log(mineflayer, 'Could not find a chest nearby.')
    return false
  }

  await goToPosition(mineflayer, chest.position.x, chest.position.y, chest.position.z, 2)
  const chestContainer = await mineflayer.bot.openContainer(chest)
  const items = chestContainer.containerItems()

  if (items.length === 0) {
    log(mineflayer, 'The chest is empty.')
  }
  else {
    log(mineflayer, 'The chest contains:')
    for (const item of items) {
      log(mineflayer, `${item.count} ${item.name}`)
    }
  }

  await chestContainer.close()
  return true
}

export async function consume(mineflayer: Mineflayer, itemName = ''): Promise<boolean> {
  let item
  let name

  if (itemName) {
    item = mineflayer.bot.inventory.items().find(item => item.name === itemName)
    name = itemName
  }

  if (!item) {
    log(mineflayer, `You do not have any ${name} to eat.`)
    return false
  }

  await mineflayer.bot.equip(item, 'hand')
  await mineflayer.bot.consume()
  log(mineflayer, `Consumed ${item.name}.`)
  return true
}

export async function giveToPlayer(
  mineflayer: Mineflayer,
  itemType: string,
  username: string,
  num = 1,
): Promise<boolean> {
  const player = mineflayer.bot.players[username]?.entity
  if (!player) {
    log(mineflayer, `Could not find ${username}.`)
    return false
  }

  await goToPosition(mineflayer, player.position.x, player.position.y, player.position.z, 3)

  if (mineflayer.bot.entity.position.y < player.position.y - 1) {
    await goToPosition(mineflayer, player.position.x, player.position.y, player.position.z, 1)
  }

  if (mineflayer.bot.entity.position.distanceTo(player.position) < 2) {
    const goal = new goals.GoalNear(player.position.x, player.position.y, player.position.z, 2)
    const invertedGoal = new goals.GoalInvert(goal)
    await mineflayer.bot.pathfinder.goto(invertedGoal)
  }

  await mineflayer.bot.lookAt(player.position)

  if (await discard(mineflayer, itemType, num)) {
    let given = false
    mineflayer.bot.once('playerCollect', (collector, _collected) => {
      if (collector.username === username) {
        log(mineflayer, `${username} received ${itemType}.`)
        given = true
      }
    })

    const start = Date.now()
    // eslint-disable-next-line no-unmodified-loop-condition -- ?
    while (!given && !mineflayer.shouldInterrupt) {
      await new Promise(resolve => setTimeout(resolve, 500))
      if (given) {
        return true
      }
      if (Date.now() - start > 3000) {
        break
      }
    }
  }

  log(mineflayer, `Failed to give ${itemType} to ${username}, it was never received.`)
  return false
}
