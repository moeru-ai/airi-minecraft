import type { Bot } from 'mineflayer'
import type { Block } from 'prismarine-block'
import type { Entity } from 'prismarine-entity'
import type { Item } from 'prismarine-item'
import type { Vec3 } from 'vec3'
import type { BotContext } from './bot'
import pf from 'mineflayer-pathfinder'
import * as mc from '../utils/mcdata'

interface WorldContext {
  bot: Bot
  botCtx: BotContext
}

export function createWorldContext(ctx: BotContext): WorldContext {
  return {
    bot: ctx.bot,
    botCtx: ctx,
  }
}

export function getNearestFreeSpace(ctx: WorldContext, size: number = 1, distance: number = 8): Vec3 | undefined {
  const emptyPositions = ctx.bot.findBlocks({
    matching: (block: Block) => block?.name === 'air',
    maxDistance: distance,
    count: 1000,
  })

  return emptyPositions.find((pos) => {
    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        const top = ctx.bot.blockAt(pos.offset(x, 0, z))
        const bottom = ctx.bot.blockAt(pos.offset(x, -1, z))
        if (!top || top.name !== 'air' || !bottom?.drops?.length || !bottom.diggable) {
          return false
        }
      }
    }
    return true
  })
}

export function getNearestBlocks(ctx: WorldContext, blockTypes: string[] | string | null = null, distance: number = 16, count: number = 10000): Block[] {
  const blockIds = blockTypes === null
    ? mc.getAllBlockIds(['air'])
    : (Array.isArray(blockTypes) ? blockTypes : [blockTypes]).map(mc.getBlockId).filter((id): id is number => id !== null)

  const positions = ctx.bot.findBlocks({ matching: blockIds, maxDistance: distance, count })

  return positions
    .map((pos) => {
      const block = ctx.bot.blockAt(pos)
      const dist = pos.distanceTo(ctx.bot.entity.position)
      return block ? { block, distance: dist } : null
    })
    .filter((item): item is { block: Block, distance: number } => item !== null)
    .sort((a, b) => a.distance - b.distance)
    .map(item => item.block)
}

export function getNearestBlock(ctx: WorldContext, blockType: string, distance: number = 16): Block | null {
  const blocks = getNearestBlocks(ctx, blockType, distance, 1)
  return blocks[0] || null
}

export function getNearbyEntities(ctx: WorldContext, maxDistance: number = 16): Entity[] {
  return Object.values(ctx.bot.entities)
    .filter((entity): entity is Entity =>
      entity !== null
      && entity.position.distanceTo(ctx.bot.entity.position) <= maxDistance,
    )
    .sort((a, b) =>
      a.position.distanceTo(ctx.bot.entity.position)
      - b.position.distanceTo(ctx.bot.entity.position),
    )
}

export function getNearestEntityWhere(ctx: WorldContext, predicate: (entity: Entity) => boolean, maxDistance: number = 16): Entity | null {
  return ctx.bot.nearestEntity(entity =>
    predicate(entity)
    && ctx.bot.entity.position.distanceTo(entity.position) < maxDistance,
  )
}

export function getNearbyPlayers(ctx: WorldContext, maxDistance: number = 16): Entity[] {
  return getNearbyEntities(ctx, maxDistance)
    .filter(entity =>
      entity.type === 'player'
      && entity.username !== ctx.bot.username,
    )
}

export function getInventoryStacks(ctx: WorldContext): Item[] {
  return ctx.bot.inventory.items().filter((item): item is Item => item !== null)
}

export function getInventoryCounts(ctx: WorldContext): Record<string, number> {
  return getInventoryStacks(ctx).reduce((counts, item) => {
    counts[item.name] = (counts[item.name] || 0) + item.count
    return counts
  }, {} as Record<string, number>)
}

export function getCraftableItems(ctx: WorldContext): string[] {
  const table = getNearestBlock(ctx, 'crafting_table')
    || getInventoryStacks(ctx).find(item => item.name === 'crafting_table')
  return mc.getAllItems()
    .filter(item => ctx.bot.recipesFor(item.id, null, 1, table as Block | null).length > 0)
    .map(item => item.name)
}

export function getPosition(ctx: WorldContext): Vec3 {
  return ctx.bot.entity.position
}

export function getNearbyEntityTypes(ctx: WorldContext): string[] {
  return [...new Set(
    getNearbyEntities(ctx, 16)
      .map(mob => mob.name)
      .filter((name): name is string => name !== undefined),
  )]
}

export function getNearbyPlayerNames(ctx: WorldContext): string[] {
  return [...new Set(
    getNearbyPlayers(ctx, 64)
      .map(player => player.username)
      .filter((name): name is string =>
        name !== undefined
        && name !== ctx.bot.username,
      ),
  )]
}

export function getNearbyBlockTypes(ctx: WorldContext, distance: number = 16): string[] {
  return [...new Set(
    getNearestBlocks(ctx, null, distance)
      .map(block => block.name),
  )]
}

export async function isClearPath(ctx: WorldContext, target: Entity): Promise<boolean> {
  const movements = new pf.Movements(ctx.bot)
  movements.canDig = false
  // movements.canPlaceOn = false // TODO: fix this

  const goal = new pf.goals.GoalNear(
    target.position.x,
    target.position.y,
    target.position.z,
    1,
  )

  const path = await ctx.bot.pathfinder.getPathTo(movements, goal, 100)
  return path.status === 'success'
}

export function shouldPlaceTorch(ctx: WorldContext): boolean {
  // if (!ctx.bot.modes.isOn('torch_placing') || ctx.bot.interrupt_code) {
  //   return false
  // }

  const pos = getPosition(ctx)
  const nearestTorch = getNearestBlock(ctx, 'torch', 6)
    || getNearestBlock(ctx, 'wall_torch', 6)

  if (nearestTorch) {
    return false
  }

  const block = ctx.bot.blockAt(pos)
  const hasTorch = ctx.bot.inventory.items().some(item => item?.name === 'torch')

  return Boolean(hasTorch && block?.name === 'air')
}

export function getBiomeName(ctx: WorldContext): string {
  const biomeId = ctx.bot.world.getBiome(ctx.bot.entity.position)
  return mc.getAllBiomes()[biomeId].name
}
