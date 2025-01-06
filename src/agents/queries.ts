import type { Bot } from 'mineflayer'
import { z } from 'zod'

// Core types
type QueryResult = string | Promise<string>

// BotContext management
let ctx: QueryBotContext

export function initQueryBotContext(BotContext: QueryBotContext): void {
  ctx = BotContext
}

interface QueryBotContext {
  world: {
    getBiomeName: (bot: Bot) => string
    getNearbyPlayerNames: (bot: Bot) => string[]
    getInventoryCounts: (bot: Bot) => Record<string, number>
    getNearbyBlockTypes: (bot: Bot) => string[]
    getCraftableItems: (bot: Bot) => string[]
    getNearbyEntityTypes: (bot: Bot) => string[]
  }
  convoManager: {
    getInGameAgents: () => string[]
  }
}

interface QueryAgentBotContext {
  bot: Bot
  name: string
  actions: {
    currentActionLabel: string
  }
  isIdle: () => boolean
  memory_bank: {
    getKeys: () => string[]
  }
}

export function createQueryAgentBotContext(bot: Bot): QueryAgentBotContext {
  return {
    bot,
    name: bot.username,
    actions: {
      currentActionLabel: bot.actions.currentActionLabel,
    },
    isIdle: () => bot.actions.isIdle(),
    memory_bank: {
      getKeys: () => bot.memory_bank.getKeys(),
    },
  }
}

interface Query {
  readonly name: string
  readonly description: string
  readonly schema: z.ZodObject<any>
  readonly perform: (agent: QueryAgentBotContext) => () => QueryResult
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
    name: '!stats',
    description: 'Get your bot\'s location, health, hunger, and time of day.',
    schema: z.object({}),
    perform: (agent: QueryAgentBotContext) => (): string => {
      const { bot } = agent
      const pos = bot.entity.position
      const weather = bot.rainState > 0 ? 'Rain' : bot.thunderState > 0 ? 'Thunderstorm' : 'Clear'
      const timeOfDay = bot.time.timeOfDay < 6000
        ? 'Morning'
        : bot.time.timeOfDay < 12000 ? 'Afternoon' : 'Night'
      const action = agent.isIdle() ? 'Idle' : agent.actions.currentActionLabel

      const players = ctx.world.getNearbyPlayerNames(bot)
        .filter(p => !ctx.convoManager.getInGameAgents().includes(p))
      const bots = ctx.convoManager.getInGameAgents()
        .filter(b => b !== agent.name)

      return pad(`STATS
- Position: x: ${pos.x.toFixed(2)}, y: ${pos.y.toFixed(2)}, z: ${pos.z.toFixed(2)}
- Gamemode: ${bot.game.gameMode}
- Health: ${Math.round(bot.health)} / 20
- Hunger: ${Math.round(bot.food)} / 20
- Biome: ${ctx.world.getBiomeName(bot)}
- Weather: ${weather}
- Time: ${timeOfDay}
- Current Action: ${action}
- Nearby Human Players: ${players.length > 0 ? players.join(', ') : 'None.'}
- Nearby Bot Players: ${bots.length > 0 ? bots.join(', ') : 'None.'}
${bot.modes.getMiniDocs()}`)
    },
  }
}

function createInventoryQuery(): Query {
  return {
    name: '!inventory',
    description: 'Get your bot\'s inventory.',
    schema: z.object({}),
    perform: (agent: QueryAgentBotContext) => (): string => {
      const { bot } = agent
      const inventory = ctx.world.getInventoryCounts(bot)
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
${agent.bot.game.gameMode === 'creative' ? '\n(You have infinite items in creative mode. You do not need to gather resources!!)' : ''}
WEARING: ${wearing || 'Nothing'}`)
    },
  }
}

function createNearbyBlocksQuery(): Query {
  return {
    name: '!nearbyBlocks',
    description: 'Get the blocks near the bot.',
    schema: z.object({}),
    perform: (agent: QueryAgentBotContext) => (): string => {
      const blocks = ctx.world.getNearbyBlockTypes(agent.bot)
      return pad(`NEARBY_BLOCKS${blocks.map(b => `\n- ${b}`).join('') || ': none'}`)
    },
  }
}

function createCraftableQuery(): Query {
  return {
    name: '!craftable',
    description: 'Get the craftable items with the bot\'s inventory.',
    schema: z.object({}),
    perform: (agent: QueryAgentBotContext) => (): string => {
      const craftable = ctx.world.getCraftableItems(agent.bot)
      return pad(`CRAFTABLE_ITEMS${craftable.map(i => `\n- ${i}`).join('') || ': none'}`)
    },
  }
}

function createEntitiesQuery(): Query {
  return {
    name: '!entities',
    description: 'Get the nearby players and entities.',
    schema: z.object({}),
    perform: (agent: QueryAgentBotContext) => (): string => {
      const { bot } = agent
      const players = ctx.world.getNearbyPlayerNames(bot)
        .filter(p => !ctx.convoManager.getInGameAgents().includes(p))
      const bots = ctx.convoManager.getInGameAgents()
        .filter(b => b !== agent.name)
      const entities = ctx.world.getNearbyEntityTypes(bot)
        .filter(e => e !== 'player' && e !== 'item')

      const result = [
        ...players.map(p => `- Human player: ${p}`),
        ...bots.map(b => `- Bot player: ${b}`),
        ...entities.map(e => `- entities: ${e}`),
      ]

      return pad(`NEARBY_ENTITIES${result.length ? `\n${result.join('\n')}` : ': none'}`)
    },
  }
}

function createModesQuery(): Query {
  return {
    name: '!modes',
    description: 'Get all available modes and their docs and see which are on/off.',
    schema: z.object({}),
    perform: (agent: QueryAgentBotContext) => (): string => agent.bot.modes.getDocs(),
  }
}

function createSavedPlacesQuery(): Query {
  return {
    name: '!savedPlaces',
    description: 'List all saved locations.',
    schema: z.object({}),
    perform: (agent: QueryAgentBotContext) => (): string =>
      `Saved place names: ${agent.memory_bank.getKeys()}`,
  }
}

// Export query list
export const queryList: readonly Query[] = [
  createStatsQuery(),
  createInventoryQuery(),
  createNearbyBlocksQuery(),
  createCraftableQuery(),
  createEntitiesQuery(),
  createModesQuery(),
  createSavedPlacesQuery(),
] as const
