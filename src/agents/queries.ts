import type { BotContext } from '../composables/bot'
import { z } from 'zod'
import { getStatusToString } from '../components/status'
import * as world from '../composables/world'

// Core types
type QueryResult = string | Promise<string>

interface Query {
  readonly name: string
  readonly description: string
  readonly schema: z.ZodObject<any>
  readonly perform: (ctx: BotContext) => () => QueryResult
}

// Utils
const pad = (str: string): string => `\n${str}\n`

function formatInventoryItem(item: string, count: number): string {
  return count > 0 ? `\n- ${item}: ${count}` : ''
}

function formatWearingItem(slot: string, item: string | undefined): string {
  return item ? `\n${slot}: ${item}` : ''
}

// Query implementations
function createStatsQuery(): Query {
  return {
    name: 'stats',
    description: 'Get your bot\'s location, health, hunger, and time of day.',
    schema: z.object({}),
    perform: (ctx: BotContext) => (): string => getStatusToString(ctx),
  }
}

function createInventoryQuery(): Query {
  return {
    name: 'inventory',
    description: 'Get your bot\'s inventory.',
    schema: z.object({}),
    perform: (ctx: BotContext) => (): string => {
      const { bot } = ctx
      const inventory = world.getInventoryCounts({ bot, botCtx: ctx })
      const items = Object.entries(inventory)
        .map(([item, count]) => formatInventoryItem(item, count))
        .join('')

      const wearing = [
        formatWearingItem('Head', bot.inventory.slots[5]?.name),
        formatWearingItem('Torso', bot.inventory.slots[6]?.name),
        formatWearingItem('Legs', bot.inventory.slots[7]?.name),
        formatWearingItem('Feet', bot.inventory.slots[8]?.name),
      ].filter(Boolean).join('')

      return pad(`INVENTORY${items || ': Nothing'}
${bot.game.gameMode === 'creative' ? '\n(You have infinite items in creative mode. You do not need to gather resources!!)' : ''}
WEARING: ${wearing || 'Nothing'}`)
    },
  }
}

function createNearbyBlocksQuery(): Query {
  return {
    name: 'nearbyBlocks',
    description: 'Get the blocks near the bot.',
    schema: z.object({}),
    perform: (ctx: BotContext) => (): string => {
      const blocks = world.getNearbyBlockTypes({ bot: ctx.bot, botCtx: ctx })
      return pad(`NEARBY_BLOCKS${blocks.map(b => `\n- ${b}`).join('') || ': none'}`)
    },
  }
}

function createCraftableQuery(): Query {
  return {
    name: 'craftable',
    description: 'Get the craftable items with the bot\'s inventory.',
    schema: z.object({}),
    perform: (ctx: BotContext) => (): string => {
      const craftable = world.getCraftableItems({ bot: ctx.bot, botCtx: ctx })
      return pad(`CRAFTABLE_ITEMS${craftable.map(i => `\n- ${i}`).join('') || ': none'}`)
    },
  }
}

function createEntitiesQuery(): Query {
  return {
    name: 'entities',
    description: 'Get the nearby players and entities.',
    schema: z.object({}),
    perform: (ctx: BotContext) => (): string => {
      const { bot } = ctx
      const worldCtx = { bot, botCtx: ctx }
      const players = world.getNearbyPlayerNames(worldCtx)
      const entities = world.getNearbyEntityTypes(worldCtx)
        .filter((e: string) => e !== 'player' && e !== 'item')

      const result = [
        ...players.map((p: string) => `- Human player: ${p}`),
        ...entities.map((e: string) => `- entities: ${e}`),
      ]

      return pad(`NEARBY_ENTITIES${result.length ? `\n${result.join('\n')}` : ': none'}`)
    },
  }
}

// Export query list
export const queryList: readonly Query[] = [
  createStatsQuery(),
  // createInventoryQuery(),
  // createNearbyBlocksQuery(),
  // createCraftableQuery(),
  // createEntitiesQuery(),
] as const
