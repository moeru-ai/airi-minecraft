import type { BlockFace, SkillContext } from './base'
import pathfinderModel, { type SafeBlock } from 'mineflayer-pathfinder'
import { Vec3 } from 'vec3'
import * as world from '../composables/world'
import * as mc from '../utils/mcdata'
import { log } from './base'
import { goToPosition } from './movement'

const { goals, Movements } = pathfinderModel

/**
 * Place a torch if needed
 */
async function autoLight(ctx: SkillContext): Promise<boolean> {
  const worldCtx = world.createWorldContext(ctx.botCtx)
  if (world.shouldPlaceTorch(worldCtx)) {
    try {
      const pos = world.getPosition(worldCtx)
      return await placeBlock(ctx, 'torch', pos.x, pos.y, pos.z, 'bottom', true)
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
  ctx: SkillContext,
  x: number,
  y: number,
  z: number,
): Promise<boolean> {
  validatePosition(x, y, z)

  const block = ctx.bot.blockAt(new Vec3(x, y, z))
  if (isUnbreakableBlock(block))
    return false

  if (ctx.allowCheats) {
    return breakWithCheats(ctx, x, y, z)
  }

  await moveIntoRange(ctx, block)

  if (ctx.isCreative) {
    return breakInCreative(ctx, block, x, y, z)
  }

  return breakInSurvival(ctx, block, x, y, z)
}

function validatePosition(x: number, y: number, z: number) {
  if (x == null || y == null || z == null) {
    throw new Error('Invalid position to break block at.')
  }
}

function isUnbreakableBlock(block: any): boolean {
  return block.name === 'air' || block.name === 'water' || block.name === 'lava'
}

async function breakWithCheats(ctx: SkillContext, x: number, y: number, z: number): Promise<boolean> {
  ctx.bot.chat(`/setblock ${Math.floor(x)} ${Math.floor(y)} ${Math.floor(z)} air`)
  log(ctx, `Used /setblock to break block at ${x}, ${y}, ${z}.`)
  return true
}

async function moveIntoRange(ctx: SkillContext, block: any) {
  if (ctx.bot.entity.position.distanceTo(block.position) > 4.5) {
    const pos = block.position
    const movements = new Movements(ctx.bot)
    movements.allowParkour = false
    movements.allowSprinting = false
    ctx.bot.pathfinder.setMovements(movements)
    await ctx.bot.pathfinder.goto(new goals.GoalNear(pos.x, pos.y, pos.z, 4))
  }
}

async function breakInCreative(ctx: SkillContext, block: any, x: number, y: number, z: number): Promise<boolean> {
  await ctx.bot.dig(block, true)
  log(ctx, `Broke ${block.name} at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`)
  return true
}

async function breakInSurvival(ctx: SkillContext, block: any, x: number, y: number, z: number): Promise<boolean> {
  await ctx.bot.tool.equipForBlock(block)

  const itemId = ctx.bot.heldItem?.type
  if (!block.canHarvest(itemId)) {
    log(ctx, `Don't have right tools to break ${block.name}.`)
    return false
  }

  await ctx.bot.dig(block, true)
  log(ctx, `Broke ${block.name} at x:${x.toFixed(1)}, y:${y.toFixed(1)}, z:${z.toFixed(1)}.`)
  return true
}

/**
 * Place a block at the specified position
 */
export async function placeBlock(
  ctx: SkillContext,
  blockType: string,
  x: number,
  y: number,
  z: number,
  placeOn: BlockFace = 'bottom',
  dontCheat = false,
): Promise<boolean> {
  if (!mc.getBlockId(blockType)) {
    log(ctx, `Invalid block type: ${blockType}.`)
    return false
  }

  const targetDest = new Vec3(Math.floor(x), Math.floor(y), Math.floor(z))

  if (ctx.allowCheats && !dontCheat) {
    return placeWithCheats(ctx, blockType, targetDest, placeOn)
  }

  return placeWithoutCheats(ctx, blockType, targetDest, placeOn)
}

function getBlockState(blockType: string, placeOn: BlockFace): string {
  const face = getInvertedFace(placeOn)
  let blockState = blockType

  if (blockType.includes('torch') && placeOn !== 'bottom') {
    blockState = handleTorchState(blockType, placeOn, face)
  }

  if (blockType.includes('button') || blockType === 'lever') {
    blockState = handleButtonLeverState(blockState, placeOn, face)
  }

  if (needsFacingState(blockType)) {
    blockState += `[facing=${face}]`
  }

  return blockState
}

function getInvertedFace(placeOn: BlockFace): string {
  const faceMap: Record<string, string> = {
    north: 'south',
    south: 'north',
    east: 'west',
    west: 'east',
  }
  return faceMap[placeOn] || placeOn
}

function handleTorchState(blockType: string, placeOn: BlockFace, face: string): string {
  let state = blockType.replace('torch', 'wall_torch')
  if (placeOn !== 'side' && placeOn !== 'top') {
    state += `[facing=${face}]`
  }
  return state
}

function handleButtonLeverState(blockState: string, placeOn: BlockFace, face: string): string {
  if (placeOn === 'top') {
    return `${blockState}[face=ceiling]`
  }
  if (placeOn === 'bottom') {
    return `${blockState}[face=floor]`
  }
  return `${blockState}[facing=${face}]`
}

function needsFacingState(blockType: string): boolean {
  return blockType === 'ladder'
    || blockType === 'repeater'
    || blockType === 'comparator'
    || blockType.includes('stairs')
}

async function placeWithCheats(
  ctx: SkillContext,
  blockType: string,
  targetDest: Vec3,
  placeOn: BlockFace,
): Promise<boolean> {
  const blockState = getBlockState(blockType, placeOn)

  ctx.bot.chat(`/setblock ${targetDest.x} ${targetDest.y} ${targetDest.z} ${blockState}`)

  if (blockType.includes('door')) {
    ctx.bot.chat(`/setblock ${targetDest.x} ${targetDest.y + 1} ${targetDest.z} ${blockState}[half=upper]`)
  }

  if (blockType.includes('bed')) {
    ctx.bot.chat(`/setblock ${targetDest.x} ${targetDest.y} ${targetDest.z - 1} ${blockState}[part=head]`)
  }

  log(ctx, `Used /setblock to place ${blockType} at ${targetDest}.`)
  return true
}

async function placeWithoutCheats(
  ctx: SkillContext,
  blockType: string,
  targetDest: Vec3,
  placeOn: BlockFace,
): Promise<boolean> {
  const itemName = blockType === 'redstone_wire' ? 'redstone' : blockType

  let block = ctx.bot.inventory.items().find(item => item.name === itemName)
  if (!block && ctx.isCreative) {
    await ctx.bot.creative.setInventorySlot(36, mc.makeItem(itemName, 1))
    block = ctx.bot.inventory.items().find(item => item.name === itemName)
  }

  if (!block) {
    log(ctx, `Don't have any ${blockType} to place.`)
    return false
  }

  const targetBlock = ctx.bot.blockAt(targetDest)
  if (targetBlock?.name === blockType) {
    log(ctx, `${blockType} already at ${targetBlock.position}.`)
    return false
  }

  const emptyBlocks = ['air', 'water', 'lava', 'grass', 'short_grass', 'tall_grass', 'snow', 'dead_bush', 'fern']
  if (!emptyBlocks.includes(targetBlock?.name ?? '')) {
    if (!await clearBlockSpace(ctx, targetBlock, blockType)) {
      return false
    }
  }

  const { buildOffBlock, faceVec } = findPlacementSpot(ctx, targetDest, placeOn, emptyBlocks)
  if (!buildOffBlock) {
    log(ctx, `Cannot place ${blockType} at ${targetBlock?.position}: nothing to place on.`)
    return false
  }

  if (!faceVec) {
    log(ctx, `Cannot place ${blockType} at ${targetBlock?.position}: no valid face to place on.`)
    return false
  }

  await moveIntoPosition(ctx, blockType, targetBlock)
  return await tryPlaceBlock(ctx, block, buildOffBlock, faceVec, blockType, targetDest)
}

async function clearBlockSpace(
  ctx: SkillContext,
  targetBlock: any,
  blockType: string,
): Promise<boolean> {
  const removed = await breakBlockAt(ctx, targetBlock.position.x, targetBlock.position.y, targetBlock.position.z,
  )
  if (!removed) {
    log(ctx, `Cannot place ${blockType} at ${targetBlock.position}: block in the way.`)
    return false
  }
  await new Promise(resolve => setTimeout(resolve, 200))
  return true
}

function findPlacementSpot(ctx: SkillContext, targetDest: Vec3, placeOn: BlockFace, emptyBlocks: string[]) {
  const dirMap = {
    top: new Vec3(0, 1, 0),
    bottom: new Vec3(0, -1, 0),
    north: new Vec3(0, 0, -1),
    south: new Vec3(0, 0, 1),
    east: new Vec3(1, 0, 0),
    west: new Vec3(-1, 0, 0),
  }

  const dirs = getPlacementDirections(placeOn, dirMap)

  for (const d of dirs) {
    const block = ctx.bot.blockAt(targetDest.plus(d))
    if (!emptyBlocks.includes(block?.name ?? '')) {
      return {
        buildOffBlock: block,
        faceVec: new Vec3(-d.x, -d.y, -d.z),
      }
    }
  }

  return { buildOffBlock: null, faceVec: null }
}

function getPlacementDirections(placeOn: BlockFace, dirMap: Record<string, Vec3>): Vec3[] {
  const dirs: Vec3[] = []
  if (placeOn === 'side') {
    dirs.push(dirMap.north, dirMap.south, dirMap.east, dirMap.west)
  }
  else if (dirMap[placeOn]) {
    dirs.push(dirMap[placeOn])
  }
  else {
    dirs.push(dirMap.bottom)
  }
  dirs.push(...Object.values(dirMap).filter(d => !dirs.includes(d)))
  return dirs
}

async function moveIntoPosition(ctx: SkillContext, blockType: string, targetBlock: any) {
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

  const pos = ctx.bot.entity.position
  const posAbove = pos.plus(new Vec3(0, 1, 0))

  if (!dontMoveFor.includes(blockType)
    && (pos.distanceTo(targetBlock.position) < 1
      || posAbove.distanceTo(targetBlock.position) < 1)) {
    await moveAwayFromBlock(ctx, targetBlock)
  }

  if (ctx.bot.entity.position.distanceTo(targetBlock.position) > 4.5) {
    await moveToBlock(ctx, targetBlock)
  }
}

async function moveAwayFromBlock(ctx: SkillContext, targetBlock: any) {
  const goal = new goals.GoalNear(
    targetBlock.position.x,
    targetBlock.position.y,
    targetBlock.position.z,
    2,
  )
  const invertedGoal = new goals.GoalInvert(goal)
  ctx.bot.pathfinder.setMovements(new Movements(ctx.bot))
  await ctx.bot.pathfinder.goto(invertedGoal)
}

async function moveToBlock(ctx: SkillContext, targetBlock: any) {
  const pos = targetBlock.position
  const movements = new Movements(ctx.bot)
  ctx.bot.pathfinder.setMovements(movements)
  await ctx.bot.pathfinder.goto(
    new goals.GoalNear(pos.x, pos.y, pos.z, 4),
  )
}

async function tryPlaceBlock(
  ctx: SkillContext,
  block: any,
  buildOffBlock: any,
  faceVec: Vec3,
  blockType: string,
  targetDest: Vec3,
): Promise<boolean> {
  await ctx.bot.equip(block, 'hand')
  await ctx.bot.lookAt(buildOffBlock.position)

  try {
    await ctx.bot.placeBlock(buildOffBlock, faceVec)
    log(ctx, `Placed ${blockType} at ${targetDest}.`)
    await new Promise(resolve => setTimeout(resolve, 200))
    return true
  }
  catch {
    log(ctx, `Failed to place ${blockType} at ${targetDest}.`)
    return false
  }
}

/**
 * Use a door at the specified position
 */
export async function useDoor(ctx: SkillContext, doorPos: Vec3 | null = null): Promise<boolean> {
  doorPos = doorPos || await findNearestDoor(ctx.bot)

  if (!doorPos) {
    log(ctx, 'Could not find a door to use.')
    return false
  }

  await goToPosition(ctx, doorPos.x, doorPos.y, doorPos.z, 1)
  while (ctx.bot.pathfinder.isMoving()) {
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return await operateDoor(ctx, doorPos)
}

async function findNearestDoor(bot: any): Promise<Vec3 | null> {
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
      return block.position
    }
  }
  return null
}

async function operateDoor(ctx: SkillContext, doorPos: Vec3): Promise<boolean> {
  const doorBlock = ctx.bot.blockAt(doorPos)
  await ctx.bot.lookAt(doorPos)

  if (!doorBlock) {
    log(ctx, `Cannot find door at ${doorPos}.`)
    return false
  }

  if (!doorBlock.getProperties().open) {
    await ctx.bot.activateBlock(doorBlock)
  }

  ctx.bot.setControlState('forward', true)
  await new Promise(resolve => setTimeout(resolve, 600))
  ctx.bot.setControlState('forward', false)
  await ctx.bot.activateBlock(doorBlock)

  log(ctx, `Used door at ${doorPos}.`)
  return true
}

export async function tillAndSow(
  ctx: SkillContext,
  x: number,
  y: number,
  z: number,
  seedType: string | null = null,
): Promise<boolean> {
  const pos = { x: Math.round(x), y: Math.round(y), z: Math.round(z) }

  const block = ctx.bot.blockAt(new Vec3(pos.x, pos.y, pos.z))

  if (!block) {
    log(ctx, `Cannot till, no block at ${pos}.`)
    return false
  }

  if (!canTillBlock(block)) {
    log(ctx, `Cannot till ${block.name}, must be grass_block or dirt.`)
    return false
  }

  const above = ctx.bot.blockAt(new Vec3(pos.x, pos.y + 1, pos.z))

  if (!above) {
    log(ctx, `Cannot till, no block above the block.`)
    return false
  }

  if (!isBlockClear(above)) {
    log(ctx, `Cannot till, there is ${above.name} above the block.`)
    return false
  }

  await moveIntoRange(ctx, block)

  if (!await tillBlock(ctx, block, pos)) {
    return false
  }

  if (seedType) {
    return await sowSeeds(ctx, block, seedType, pos)
  }

  return true
}

function canTillBlock(block: any): boolean {
  return block.name === 'grass_block' || block.name === 'dirt' || block.name === 'farmland'
}

function isBlockClear(block: any): boolean {
  return block.name === 'air'
}

async function tillBlock(ctx: SkillContext, block: any, pos: any): Promise<boolean> {
  if (block.name === 'farmland') {
    return true
  }

  const hoe = ctx.bot.inventory.items().find(item => item.name.includes('hoe'))
  if (!hoe) {
    log(ctx, 'Cannot till, no hoes.')
    return false
  }

  await ctx.bot.equip(hoe, 'hand')
  await ctx.bot.activateBlock(block)
  log(ctx, `Tilled block x:${pos.x.toFixed(1)}, y:${pos.y.toFixed(1)}, z:${pos.z.toFixed(1)}.`)
  return true
}

async function sowSeeds(ctx: SkillContext, block: any, seedType: string, pos: any): Promise<boolean> {
  seedType = fixSeedName(seedType)

  const seeds = ctx.bot.inventory.items().find(item => item.name === seedType)
  if (!seeds) {
    log(ctx, `No ${seedType} to plant.`)
    return false
  }

  await ctx.bot.equip(seeds, 'hand')
  await ctx.bot.placeBlock(block, new Vec3(0, -1, 0))
  log(ctx, `Planted ${seedType} at x:${pos.x.toFixed(1)}, y:${pos.y.toFixed(1)}, z:${pos.z.toFixed(1)}.`)
  return true
}

function fixSeedName(seedType: string): string {
  if (seedType.endsWith('seed') && !seedType.endsWith('seeds')) {
    return `${seedType}s` // Fix common mistake
  }
  return seedType
}

export async function activateNearestBlock(ctx: SkillContext, type: string): Promise<boolean> {
  const worldCtx = world.createWorldContext(ctx.botCtx)
  const block = world.getNearestBlock(worldCtx, type, 16)
  if (!block) {
    log(ctx, `Could not find any ${type} to activate.`)
    return false
  }

  await moveIntoRange(ctx, block)
  await ctx.bot.activateBlock(block)
  log(ctx, `Activated ${type} at x:${block.position.x.toFixed(1)}, y:${block.position.y.toFixed(1)}, z:${block.position.z.toFixed(1)}.`)
  return true
}

export async function collectBlock(
  ctx: SkillContext,
  blockType: string,
  num: number = 1,
  exclude: Vec3[] | null = null,
): Promise<boolean> {
  if (num < 1) {
    log(ctx, `Invalid number of blocks to collect: ${num}.`)
    return false
  }

  const blocktypes = getBlockTypes(blockType)
  let collected = 0

  for (let i = 0; i < num; i++) {
    const blocks = getValidBlocks(ctx, blocktypes, exclude)

    if (blocks.length === 0) {
      logNoBlocksMessage(ctx, blockType, collected)
      break
    }

    const block = blocks[0]
    if (!await canHarvestBlock(ctx, block, blockType)) {
      return false
    }

    if (!await tryCollectBlock(ctx, block, blockType)) {
      break
    }

    collected++

    if (ctx.shouldInterrupt) {
      break
    }
  }

  log(ctx, `Collected ${collected} ${blockType}.`)
  return collected > 0
}

function getBlockTypes(blockType: string): string[] {
  const blocktypes: string[] = [blockType]

  const ores = ['coal', 'diamond', 'emerald', 'iron', 'gold', 'lapis_lazuli', 'redstone']
  if (ores.includes(blockType)) {
    blocktypes.push(`${blockType}_ore`)
  }
  if (blockType.endsWith('ore')) {
    blocktypes.push(`deepslate_${blockType}`)
  }
  if (blockType === 'dirt') {
    blocktypes.push('grass_block')
  }

  return blocktypes
}

function getValidBlocks(ctx: SkillContext, blocktypes: string[], exclude: Vec3[] | null): any[] {
  const worldCtx = world.createWorldContext(ctx.botCtx)
  let blocks = world.getNearestBlocks(worldCtx, blocktypes, 64)

  if (exclude) {
    blocks = blocks.filter(
      block => !exclude.some(pos =>
        pos.x === block.position.x
        && pos.y === block.position.y
        && pos.z === block.position.z,
      ),
    )
  }

  const movements = new Movements(ctx.bot)
  movements.dontMineUnderFallingBlock = false
  return blocks.filter(block => movements.safeToBreak(block as SafeBlock))
}

function logNoBlocksMessage(ctx: SkillContext, blockType: string, collected: number): void {
  log(ctx, collected === 0
    ? `No ${blockType} nearby to collect.`
    : `No more ${blockType} nearby to collect.`)
}

async function canHarvestBlock(ctx: SkillContext, block: any, blockType: string): Promise<boolean> {
  await ctx.bot.tool.equipForBlock(block)
  const itemId = ctx.bot.heldItem ? ctx.bot.heldItem.type : null

  if (!block.canHarvest(itemId)) {
    log(ctx, `Don't have right tools to harvest ${blockType}.`)
    return false
  }
  return true
}

async function tryCollectBlock(ctx: SkillContext, block: any, blockType: string): Promise<boolean> {
  try {
    await ctx.bot.collectBlock.collect(block)
    await autoLight(ctx)
    return true
  }
  catch (err) {
    if (err instanceof Error && err.name === 'NoChests') {
      log(ctx, `Failed to collect ${blockType}: Inventory full, no place to deposit.`)
      return false
    }
    log(ctx, `Failed to collect ${blockType}: ${err}.`)
    return true
  }
}
