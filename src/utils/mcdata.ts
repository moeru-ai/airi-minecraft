/**
 * @source https://github.com/kolbytn/mindcraft
 */
import type { Bot } from 'mineflayer'
import minecraftData from 'minecraft-data'
import { createBot } from 'mineflayer'
import armorManager from 'mineflayer-armor-manager'
import { loader as autoEat } from 'mineflayer-auto-eat'
import { plugin as collectblock } from 'mineflayer-collectblock'
import { pathfinder } from 'mineflayer-pathfinder'
import { plugin as pvp } from 'mineflayer-pvp'
import prismarine_items from 'prismarine-item'
import { botConfig } from '../composables/config'

const mc_version = botConfig.version!
const mcdata = minecraftData(mc_version)
const Item = prismarine_items(mc_version)

interface Recipe {
  inShape?: Array<Array<{ id: number, count: number }>>
  ingredients?: Array<{ id: number, count: number }>
}

export const WOOD_TYPES: string[] = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak']
export const MATCHING_WOOD_BLOCKS: string[] = [
  'log',
  'planks',
  'sign',
  'boat',
  'fence_gate',
  'door',
  'fence',
  'slab',
  'stairs',
  'button',
  'pressure_plate',
  'trapdoor',
]
export const WOOL_COLORS: string[] = [
  'white',
  'orange',
  'magenta',
  'light_blue',
  'yellow',
  'lime',
  'pink',
  'gray',
  'light_gray',
  'cyan',
  'purple',
  'blue',
  'brown',
  'green',
  'red',
  'black',
]

export function isHuntable(mob: { name?: string, metadata: any[] }): boolean {
  if (!mob || !mob.name)
    return false
  const animals = ['chicken', 'cow', 'llama', 'mooshroom', 'pig', 'rabbit', 'sheep']
  return animals.includes(mob.name.toLowerCase()) && !mob.metadata[16] // metadata 16 is not baby
}

export function isHostile(mob: { name?: string, type?: string }): boolean {
  if (!mob || !mob.name)
    return false
  return (mob.type === 'mob' || mob.type === 'hostile') && mob.name !== 'iron_golem' && mob.name !== 'snow_golem'
}

export function getItemId(itemName: string): number | null {
  const item = mcdata.itemsByName[itemName]
  if (item) {
    return item.id
  }
  return null
}

export function getItemName(itemId: number): string | null {
  const item = mcdata.items[itemId]
  if (item) {
    return item.name
  }
  return null
}

export function getBlockId(blockName: string): number | null {
  const block = mcdata.blocksByName[blockName]
  if (block) {
    return block.id
  }
  return null
}

export function getBlockName(blockId: number): string | null {
  const block = mcdata.blocks[blockId]
  if (block) {
    return block.name
  }
  return null
}

export function getAllItems(ignore: string[] = []): any[] {
  const items = []
  for (const itemId in mcdata.items) {
    const item = mcdata.items[itemId]
    if (!ignore.includes(item.name)) {
      items.push(item)
    }
  }
  return items
}

export function getAllItemIds(ignore: string[] = []): number[] {
  const items = getAllItems(ignore)
  const itemIds = []
  for (const item of items) {
    itemIds.push(item.id)
  }
  return itemIds
}

export function getAllBlocks(ignore: string[] = []): any[] {
  const blocks = []
  for (const blockId in mcdata.blocks) {
    const block = mcdata.blocks[blockId]
    if (!ignore.includes(block.name)) {
      blocks.push(block)
    }
  }
  return blocks
}

export function getAllBlockIds(ignore: string[] = []): number[] {
  const blocks = getAllBlocks(ignore)
  const blockIds = []
  for (const block of blocks) {
    blockIds.push(block.id)
  }
  return blockIds
}

export function getAllBiomes(): any {
  return mcdata.biomes
}

export function getItemCraftingRecipes(itemName: string): Record<string, number>[] | null {
  const itemId = getItemId(itemName)
  if (!itemId || !mcdata.recipes[itemId]) {
    return null
  }

  // todo: fix this
  const recipes: Record<string, number>[] = []
  for (const r of mcdata.recipes[itemId]) {
    const recipe: Record<string, number> = {}
    let ingredients = []
    if (r.ingredients) {
      ingredients = r.ingredients
    }
    else if (r.inShape) {
      ingredients = r.inShape.flat()
    }
    for (const ingredient of ingredients) {
      const ingredientName = getItemName(ingredient)
      if (ingredientName === null)
        continue
      if (!recipe[ingredientName])
        recipe[ingredientName] = 0
      recipe[ingredientName]++
    }
    recipes.push(recipe)
  }

  return recipes
}

export function isSmeltable(itemName: string): boolean {
  const misc_smeltables = ['beef', 'chicken', 'cod', 'mutton', 'porkchop', 'rabbit', 'salmon', 'tropical_fish', 'potato', 'kelp', 'sand', 'cobblestone', 'clay_ball']
  return itemName.includes('raw') || itemName.includes('log') || misc_smeltables.includes(itemName)
}

export function getSmeltingFuel(bot: Bot): any {
  let fuel = bot.inventory.items().find(i => i.name === 'coal' || i.name === 'charcoal')
  if (fuel)
    return fuel
  fuel = bot.inventory.items().find(i => i.name.includes('log') || i.name.includes('planks'))
  if (fuel)
    return fuel
  return bot.inventory.items().find(i => i.name === 'coal_block' || i.name === 'lava_bucket')
}

export function getFuelSmeltOutput(fuelName: string): number {
  if (fuelName === 'coal' || fuelName === 'charcoal')
    return 8
  if (fuelName.includes('log') || fuelName.includes('planks'))
    return 1.5
  if (fuelName === 'coal_block')
    return 80
  if (fuelName === 'lava_bucket')
    return 100
  return 0
}

export function getItemSmeltingIngredient(itemName: string): string | undefined {
  return {
    baked_potato: 'potato',
    steak: 'raw_beef',
    cooked_chicken: 'raw_chicken',
    cooked_cod: 'raw_cod',
    cooked_mutton: 'raw_mutton',
    cooked_porkchop: 'raw_porkchop',
    cooked_rabbit: 'raw_rabbit',
    cooked_salmon: 'raw_salmon',
    dried_kelp: 'kelp',
    iron_ingot: 'raw_iron',
    gold_ingot: 'raw_gold',
    copper_ingot: 'raw_copper',
    glass: 'sand',
  }[itemName]
}

export function getItemBlockSources(itemName: string): string[] {
  const itemId = getItemId(itemName)
  const sources: string[] = []
  for (const block of getAllBlocks()) {
    if (block.drops.includes(itemId)) {
      sources.push(block.name)
    }
  }
  return sources
}

export function getItemAnimalSource(itemName: string): string | undefined {
  return {
    raw_beef: 'cow',
    raw_chicken: 'chicken',
    raw_cod: 'cod',
    raw_mutton: 'sheep',
    raw_porkchop: 'pig',
    raw_rabbit: 'rabbit',
    raw_salmon: 'salmon',
    leather: 'cow',
    wool: 'sheep',
  }[itemName]
}

export function getBlockTool(blockName: string): string | null {
  const block = mcdata.blocksByName[blockName]
  if (!block || !block.harvestTools) {
    return null
  }
  return getItemName(Object.keys(block.harvestTools)[0]) // Double check first tool is always simplest
}

export function makeItem(name: string, amount: number = 1): any {
  return new Item(getItemId(name), amount)
}

export function ingredientsFromPrismarineRecipe(recipe: Recipe): Record<string, number> {
  const requiredIngredients: Record<string, number> = {}
  if (recipe.inShape) {
    for (const ingredient of recipe.inShape.flat()) {
      if (ingredient.id < 0)
        continue // prismarine-recipe uses id -1 as an empty crafting slot
      const ingredientName = getItemName(ingredient.id)
      if (ingredientName) {
        requiredIngredients[ingredientName] ??= 0
        requiredIngredients[ingredientName] += ingredient.count
      }
    }
  }
  if (recipe.ingredients) {
    for (const ingredient of recipe.ingredients) {
      if (ingredient.id < 0)
        continue
      const ingredientName = getItemName(ingredient.id)
      if (ingredientName) {
        requiredIngredients[ingredientName] ??= 0
        requiredIngredients[ingredientName] -= ingredient.count
      }
      // Yes, the `-=` is intended.
      // prismarine-recipe uses positive numbers for the shaped ingredients but negative for unshaped.
      // Why this is the case is beyond my understanding.
    }
  }
  return requiredIngredients
}

export function calculateLimitingResource<T extends string>(
  availableItems: Record<T, number>,
  requiredItems: Record<T, number>,
  discrete: boolean = true,
): { num: number, limitingResource: T | null } {
  let limitingResource: T | null = null
  let num = Infinity
  for (const itemType in requiredItems) {
    if (availableItems[itemType] < requiredItems[itemType] * num) {
      limitingResource = itemType
      num = availableItems[itemType] / requiredItems[itemType]
    }
  }
  if (discrete)
    num = Math.floor(num)
  return { num, limitingResource }
}
