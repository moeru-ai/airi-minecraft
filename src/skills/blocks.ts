import type { Bot } from 'mineflayer'
import type { BlockFace } from './base'
import Vec3 from 'vec3'
import * as world from '../composables/world'
import * as mc from '../utils/mcdata'
import { log } from './base'
import { goToPosition } from './movement'

export async function collectBlock(
  bot: Bot,
  blockType: string,
  num: number = 1,
  exclude: typeof Vec3[] | null = null,
): Promise<boolean> {
  if (num < 1) {
    log(bot, `Invalid number of blocks to collect: ${num}.`)
    return false
  }

  const blocktypes: string[] = [blockType]
  if (blockType === 'coal' || blockType === 'diamond' || blockType === 'emerald'
    || blockType === 'iron' || blockType === 'gold' || blockType === 'lapis_lazuli'
    || blockType === 'redstone') {
    blocktypes.push(`${blockType}_ore`)
  }
  if (blockType.endsWith('ore')) {
    blocktypes.push(`deepslate_${blockType}`)
  }
  if (blockType === 'dirt') {
    blocktypes.push('grass_block')
  }

  let collected = 0

  for (let i = 0; i < num; i++) {
    let blocks = world.getNearestBlocks(bot, blocktypes, 64)
    if (exclude) {
      blocks = blocks.filter(
        block => !exclude.some(pos =>
          pos.x === block.position.x
          && pos.y === block.position.y
          && pos.z === block.position.z,
        ),
      )
    }

    const movements = new bot.pathfinder.Movements(bot)
    movements.dontMineUnderFallingBlock = false
    blocks = blocks.filter(block => movements.safeToBreak(block))

    if (blocks.length === 0) {
      log(bot, collected === 0
        ? `No ${blockType} nearby to collect.`
        : `No more ${blockType} nearby to collect.`)
      break
    }

    const block = blocks[0]
    await bot.tool.equipForBlock(block)
    const itemId = bot.heldItem ? bot.heldItem.type : null

    if (!block.canHarvest(itemId)) {
      log(bot, `Don't have right tools to harvest ${blockType}.`)
      return false
    }

    try {
      await bot.collectBlock.collect(block)
      collected++
      await autoLight(bot)
    }
    catch (err) {
      if (err.name === 'NoChests') {
        log(bot, `Failed to collect ${blockType}: Inventory full, no place to deposit.`)
        break
      }
      log(bot, `Failed to collect ${blockType}: ${err}.`)
      continue
    }

    if (bot.interrupt_code) {
      break
    }
  }

  log(bot, `Collected ${collected} ${blockType}.`)
  return collected > 0
}

/**
 * Place a torch if needed
 */
async function autoLight(bot: Bot): Promise<boolean> {
  if (world.shouldPlaceTorch(bot)) {
    try {
      const pos = world.getPosition(bot)
      return await placeBlock(bot, 'torch', pos.x, pos.y, pos.z, 'bottom', true)
    }
    catch {
      return false
    }
  }
  return false
}

/**
 * Break a block at the specified position
 */
export async function breakBlockAt(
  bot: Bot,
  x: number,
  y: number,
  z: number,
): Promise<boolean> {
  if (x == null || y == null || z == null) {
    throw new Error('Invalid position to break block at.')
  }

  const block = bot.blockAt(new Vec3(x, y, z))
  if (block.name === 'air' || block.name === 'water' || block.name === 'lava') {
    return false
  }

  if (bot.modes.isOn('cheat')) {
    bot.chat(`/setblock ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} air`)
    log(bot, `Used /setblock to break block at ${x}, ${y}, ${z}.`)
    return true
  }

  if (bot.entity.position.distanceTo(block.position) > 4.5) {
    const pos = block.position
    const movements = new bot.pathfinder.Movements(bot)
    movements.allowParkour = false
    movements.allowSprinting = false
    bot.pathfinder.setMovements(movements)
    await bot.pathfinder.goto(bot.pathfinder.goals.GoalNear(pos.x, pos.y, pos.z, 4))
  }

  if (bot.game.gameMode !== 'creative') {
    await bot.tool.equipForBlock(block)
    const itemId = bot.heldItem?.type
    if (!block.canHarvest(itemId)) {
      log(bot, `Don't have right tools to break ${block.name}.`)
      return false
    }
  }

  await bot.dig(block, true)
  log(bot, `Broke ${block.name} at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`)
  return true
}

/**
 * Place a block at the specified position
 */
export async function placeBlock(
  bot: Bot,
  blockType: string,
  x: number,
  y: number,
  z: number,
  placeOn: BlockFace = 'bottom',
  dontCheat = false,
): Promise<boolean> {
  if (!mc.getBlockId(blockType)) {
    log(bot, `Invalid block type: ${blockType}.`)
    return false
  }

  const targetDest = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z))

  if (bot.modes.isOn('cheat') && !dontCheat) {
    // Invert the facing direction
    const face = placeOn === 'north'
      ? 'south'
      : placeOn === 'south'
        ? 'north'
        : placeOn === 'east'
          ? 'west'
          : placeOn === 'west'
            ? 'east'
            : placeOn

    let blockState = blockType
    if (blockType.includes('torch') && placeOn !== 'bottom') {
      blockState = blockType.replace('torch', 'wall_torch')
      if (placeOn !== 'side' && placeOn !== 'top') {
        blockState += `[facing=${face}]`
      }
    }

    if (blockType.includes('button') || blockType === 'lever') {
      if (placeOn === 'top') {
        blockState += '[face=ceiling]'
      }
      else if (placeOn === 'bottom') {
        blockState += '[face=floor]'
      }
      else {
        blockState += `[facing=${face}]`
      }
    }

    if (blockType === 'ladder' || blockType === 'repeater' || blockType === 'comparator') {
      blockState += `[facing=${face}]`
    }

    if (blockType.includes('stairs')) {
      blockState += `[facing=${face}]`
    }

    bot.chat(`/setblock ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} ${blockState}`)

    if (blockType.includes('door')) {
      bot.chat(`/setblock ${Math.floor(x)} ${Math.floor(y + 1)} ${Math.floor(z)} ${blockState}[half=upper]`)
    }

    if (blockType.includes('bed')) {
      bot.chat(`/setblock ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z - 1)} ${blockState}[part=head]`)
    }

    log(bot, `Used /setblock to place ${blockType} at ${targetDest}.`)
    return true
  }

  let itemName = blockType
  if (itemName === 'redstone_wire') {
    itemName = 'redstone'
  }

  let block = bot.inventory.items().find(item => item.name === itemName)
  if (!block && bot.game.gameMode === 'creative') {
    await bot.creative.setInventorySlot(36, mc.makeItem(itemName, 1))
    block = bot.inventory.items().find(item => item.name === itemName)
  }

  if (!block) {
    log(bot, `Don't have any ${blockType} to place.`)
    return false
  }

  const targetBlock = bot.blockAt(targetDest)
  if (targetBlock.name === blockType) {
    log(bot, `${blockType} already at ${targetBlock.position}.`)
    return false
  }

  const emptyBlocks = ['air', 'water', 'lava', 'grass', 'short_grass', 'tall_grass', 'snow', 'dead_bush', 'fern']
  if (!emptyBlocks.includes(targetBlock.name)) {
    log(bot, `${blockType} in the way at ${targetBlock.position}.`)
    const removed = await breakBlockAt(bot, x, y, z)
    if (!removed) {
      log(bot, `Cannot place ${blockType} at ${targetBlock.position}: block in the way.`)
      return false
    }
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  const dirMap = {
    top: new Vec3(0, 1, 0),
    bottom: new Vec3(0, -1, 0),
    north: new Vec3(0, 0, -1),
    south: new Vec3(0, 0, 1),
    east: new Vec3(1, 0, 0),
    west: new Vec3(-1, 0, 0),
  }

  const dirs = []
  if (placeOn === 'side') {
    dirs.push(dirMap.north, dirMap.south, dirMap.east, dirMap.west)
  }
  else if (dirMap[placeOn]) {
    dirs.push(dirMap[placeOn])
  }
  else {
    dirs.push(dirMap.bottom)
    log(bot, `Unknown placeOn value "${placeOn}". Defaulting to bottom.`)
  }
  dirs.push(...Object.values(dirMap).filter(d => !dirs.includes(d)))

  let buildOffBlock = null
  let faceVec = null

  for (const d of dirs) {
    const block = bot.blockAt(targetDest.plus(d))
    if (!emptyBlocks.includes(block.name)) {
      buildOffBlock = block
      faceVec = new Vec3(-d.x, -d.y, -d.z)
      break
    }
  }

  if (!buildOffBlock) {
    log(bot, `Cannot place ${blockType} at ${targetBlock.position}: nothing to place on.`)
    return false
  }

  const pos = bot.entity.position
  const posAbove = pos.plus(new Vec3(0, 1, 0))
  const dontMoveFor = [
    'torch',
    'redstone_torch',
    'redstone_wire',
    'lever',
    'button',
    'rail',
    'detector_rail',
    'powered_rail',
    'activator_rail',
    'tripwire_hook',
    'tripwire',
    'water_bucket',
  ]

  if (!dontMoveFor.includes(blockType)
    && (pos.distanceTo(targetBlock.position) < 1
      || posAbove.distanceTo(targetBlock.position) < 1)) {
    const goal = bot.pathfinder.goals.GoalNear(targetBlock.position.x, targetBlock.position.y, targetBlock.position.z, 2)
    const invertedGoal = bot.pathfinder.goals.GoalInvert(goal)
    bot.pathfinder.setMovements(new bot.pathfinder.Movements(bot))
    await bot.pathfinder.goto(invertedGoal)
  }

  if (bot.entity.position.distanceTo(targetBlock.position) > 4.5) {
    const pos = targetBlock.position
    const movements = new bot.pathfinder.Movements(bot)
    bot.pathfinder.setMovements(movements)
    await bot.pathfinder.goto(bot.pathfinder.goals.GoalNear(pos.x, pos.y, pos.z, 4))
  }

  await bot.equip(block, 'hand')
  await bot.lookAt(buildOffBlock.position)

  try {
    await bot.placeBlock(buildOffBlock, faceVec)
    log(bot, `Placed ${blockType} at ${targetDest}.`)
    await new Promise(resolve => setTimeout(resolve, 200))
    return true
  }
  catch {
    log(bot, `Failed to place ${blockType} at ${targetDest}.`)
    return false
  }
}

/**
 * Use a door at the specified position
 */
export async function useDoor(bot: Bot, doorPos: Vec3 | null = null): Promise<boolean> {
  if (!doorPos) {
    const doorTypes = [
      'oak_door',
      'spruce_door',
      'birch_door',
      'jungle_door',
      'acacia_door',
      'dark_oak_door',
      'mangrove_door',
      'cherry_door',
      'bamboo_door',
      'crimson_door',
      'warped_door',
    ]

    for (const doorType of doorTypes) {
      const block = world.getNearestBlock(bot, doorType, 16)
      if (block) {
        doorPos = block.position
        break
      }
    }
  }

  if (!doorPos) {
    log(bot, 'Could not find a door to use.')
    return false
  }

  await goToPosition(bot, doorPos.x, doorPos.y, doorPos.z, 1)
  while (bot.pathfinder.isMoving()) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  const doorBlock = bot.blockAt(doorPos)
  await bot.lookAt(doorPos)

  if (!doorBlock._properties.open) {
    await bot.activateBlock(doorBlock)
  }

  bot.setControlState('forward', true)
  await new Promise(resolve => setTimeout(resolve, 600))
  bot.setControlState('forward', false)
  await bot.activateBlock(doorBlock)

  log(bot, `Used door at ${doorPos}.`)
  return true
}

/**
 * Till and sow a block at the specified position
 */
export async function tillAndSow(
  bot: Bot,
  x: number,
  y: number,
  z: number,
  seedType: string | null = null,
): Promise<boolean> {
  x = Math.round(x)
  y = Math.round(y)
  z = Math.round(z)

  const block = bot.blockAt(new Vec3(x, y, z))
  if (block.name !== 'grass_block' && block.name !== 'dirt' && block.name !== 'farmland') {
    log(bot, `Cannot till ${block.name}, must be grass_block or dirt.`)
    return false
  }

  const above = bot.blockAt(new Vec3(x, y + 1, z))
  if (above.name !== 'air') {
    log(bot, `Cannot till, there is ${above.name} above the block.`)
    return false
  }

  if (bot.entity.position.distanceTo(block.position) > 4.5) {
    await goToPosition(bot, block.position.x, block.position.y, block.position.z, 4)
  }

  if (block.name !== 'farmland') {
    const hoe = bot.inventory.items().find(item => item.name.includes('hoe'))
    if (!hoe) {
      log(bot, 'Cannot till, no hoes.')
      return false
    }
    await bot.equip(hoe, 'hand')
    await bot.activateBlock(block)
    log(bot, `Tilled block x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`)
  }

  if (seedType) {
    if (seedType.endsWith('seed') && !seedType.endsWith('seeds')) {
      seedType += 's' // Fix common mistake
    }

    const seeds = bot.inventory.items().find(item => item.name === seedType)
    if (!seeds) {
      log(bot, `No ${seedType} to plant.`)
      return false
    }

    await bot.equip(seeds, 'hand')
    await bot.placeBlock(block, new Vec3(0, -1, 0))
    log(bot, `Planted ${seedType} at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`)
  }

  return true
}

/**
 * Activate the nearest block of a specific type
 */
export async function activateNearestBlock(bot: Bot, type: string): Promise<boolean> {
  const block = world.getNearestBlock(bot, type, 16)
  if (!block) {
    log(bot, `Could not find any ${type} to activate.`)
    return false
  }

  if (bot.entity.position.distanceTo(block.position) > 4.5) {
    await goToPosition(bot, block.position.x, block.position.y, block.position.z, 4)
  }

  await bot.activateBlock(block)
  log(bot, `Activated ${type} at x:${block.position.x.toFixed(1)}, y:${block.position.y.toFixed(1)}, z:${block.position.z.toFixed(1)}.`)
  return true
}
