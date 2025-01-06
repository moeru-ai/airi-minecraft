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

export const queriesList: Query[] = [
  {
    name: 'stats',
    description: 'Get your bot\'s location, health, hunger, and time of day.',
    schema: z.object({}),
    perform: (ctx: BotContext) => (): string => getStatusToString(ctx),
  },
  {
    name: 'inventory',
    description: 'Get your bot\'s inventory.',
    schema: z.object({}),
    perform: (ctx: BotContext) => (): string => {
      const { bot } = ctx
      const worldCtx = { bot, botCtx: ctx }
      const inventory = world.getInventoryCounts(worldCtx)
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
  },
  {
    name: 'nearbyBlocks',
    description: 'Get the blocks near the bot.',
    schema: z.object({}),
    perform: (ctx: BotContext) => (): string => {
      const worldCtx = { bot: ctx.bot, botCtx: ctx }
      const blocks = world.getNearbyBlockTypes(worldCtx)
      return pad(`NEARBY_BLOCKS${blocks.map((b: string) => `\n- ${b}`).join('') || ': none'}`)
    },
  },
  {
    name: 'craftable',
    description: 'Get the craftable items with the bot\'s inventory.',
    schema: z.object({}),
    perform: (ctx: BotContext) => (): string => {
      const worldCtx = { bot: ctx.bot, botCtx: ctx }
      const craftable = world.getCraftableItems(worldCtx)
      return pad(`CRAFTABLE_ITEMS${craftable.map((i: string) => `\n- ${i}`).join('') || ': none'}`)
    },
  },
  {
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
  },
]
