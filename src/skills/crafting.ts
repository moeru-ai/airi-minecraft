import type { Bot } from 'mineflayer'
import * as world from '../composables/world'
import * as mc from '../utils/mcdata'
import { log } from './base'
import { collectBlock } from './blocks'
import { goToPosition } from './movement'

/**
 * Craft items from a recipe
 */
export async function craftRecipe(bot: Bot, itemName: string, num = 1): Promise<boolean> {
  let placedTable = false

  if (mc.getItemCraftingRecipes(itemName).length === 0) {
    log(bot, `${itemName} is either not an item, or it does not have a crafting recipe!`)
    return false
  }

  // Get recipes that don't require a crafting table
  let recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, null)
  let craftingTable = null
  const craftingTableRange = 32

  if (!recipes || recipes.length === 0) {
    recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, true)
    if (!recipes || recipes.length === 0) {
      log(bot, `You do not have the resources to craft a ${itemName}.`)
      return false
    }

    // Look for crafting table
    craftingTable = world.getNearestBlock(bot, 'crafting_table', craftingTableRange)
    if (!craftingTable) {
      // Try to place crafting table
      const hasTable = world.getInventoryCounts(bot).crafting_table > 0
      if (hasTable) {
        const pos = world.getNearestFreeSpace(bot, 1, 6)
        await placeBlock(bot, 'crafting_table', pos.x, pos.y, pos.z)
        craftingTable = world.getNearestBlock(bot, 'crafting_table', craftingTableRange)
        if (craftingTable) {
          recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, craftingTable)
          placedTable = true
        }
      }
      else {
        log(bot, `Crafting ${itemName} requires a crafting table.`)
        return false
      }
    }
    else {
      recipes = bot.recipesFor(mc.getItemId(itemName), null, 1, craftingTable)
    }
  }

  if (!recipes || recipes.length === 0) {
    log(bot, `You do not have the resources to craft a ${itemName}. It requires: ${
      Object.entries(mc.getItemCraftingRecipes(itemName)[0])
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    }.`)
    if (placedTable) {
      await collectBlock(bot, 'crafting_table', 1)
    }
    return false
  }

  if (craftingTable && bot.entity.position.distanceTo(craftingTable.position) > 4) {
    await goToPosition(bot, craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 4)
  }

  const recipe = recipes[0]
  // Check that the agent has sufficient items to use the recipe `num` times
  const inventory = world.getInventoryCounts(bot) // Items in the agents inventory
  const requiredIngredients = mc.ingredientsFromPrismarineRecipe(recipe) // Items required to use the recipe once
  const craftLimit = mc.calculateLimitingResource(inventory, requiredIngredients)

  await bot.craft(recipe, Math.min(craftLimit.num, num), craftingTable)

  if (craftLimit.num < num) {
    log(bot, `Not enough ${craftLimit.limitingResource} to craft ${num}, crafted ${craftLimit.num}. You now have ${world.getInventoryCounts(bot)[itemName]} ${itemName}.`)
  }
  else {
    log(bot, `Successfully crafted ${itemName}, you now have ${world.getInventoryCounts(bot)[itemName]} ${itemName}.`)
  }

  if (placedTable) {
    await collectBlock(bot, 'crafting_table', 1)
  }

  // Equip any armor the bot may have crafted
  bot.armorManager.equipAll()

  return true
}

/**
 * Smelt items in a furnace
 */
export async function smeltItem(bot: Bot, itemName: string, num = 1): Promise<boolean> {
  if (!mc.isSmeltable(itemName)) {
    log(bot, `Cannot smelt ${itemName}. Hint: make sure you are smelting the 'raw' item.`)
    return false
  }

  let placedFurnace = false
  const furnaceRange = 32
  let furnaceBlock = world.getNearestBlock(bot, 'furnace', furnaceRange)

  if (!furnaceBlock) {
    // Try to place furnace
    const hasFurnace = world.getInventoryCounts(bot).furnace > 0
    if (hasFurnace) {
      const pos = world.getNearestFreeSpace(bot, 1, furnaceRange)
      await placeBlock(bot, 'furnace', pos.x, pos.y, pos.z)
      furnaceBlock = world.getNearestBlock(bot, 'furnace', furnaceRange)
      placedFurnace = true
    }
  }

  if (!furnaceBlock) {
    log(bot, 'There is no furnace nearby and you have no furnace.')
    return false
  }

  if (bot.entity.position.distanceTo(furnaceBlock.position) > 4) {
    await goToPosition(bot, furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 4)
  }

  bot.modes.pause('unstuck')
  await bot.lookAt(furnaceBlock.position)

  const furnace = await bot.openFurnace(furnaceBlock)

  // Check if the furnace is already smelting something
  const inputItem = furnace.inputItem()
  if (inputItem && inputItem.type !== mc.getItemId(itemName) && inputItem.count > 0) {
    log(bot, `The furnace is currently smelting ${mc.getItemName(inputItem.type)}.`)
    if (placedFurnace) {
      await collectBlock(bot, 'furnace', 1)
    }
    return false
  }

  // Check if the bot has enough items to smelt
  const invCounts = world.getInventoryCounts(bot)
  if (!invCounts[itemName] || invCounts[itemName] < num) {
    log(bot, `You do not have enough ${itemName} to smelt.`)
    if (placedFurnace) {
      await collectBlock(bot, 'furnace', 1)
    }
    return false
  }

  // Fuel the furnace
  if (!furnace.fuelItem()) {
    const fuel = mc.getSmeltingFuel(bot)
    if (!fuel) {
      log(bot, `You have no fuel to smelt ${itemName}, you need coal, charcoal, or wood.`)
      if (placedFurnace) {
        await collectBlock(bot, 'furnace', 1)
      }
      return false
    }

    log(bot, `Using ${fuel.name} as fuel.`)
    const putFuel = Math.ceil(num / mc.getFuelSmeltOutput(fuel.name))

    if (fuel.count < putFuel) {
      log(bot, `You don't have enough ${fuel.name} to smelt ${num} ${itemName}; you need ${putFuel}.`)
      if (placedFurnace) {
        await collectBlock(bot, 'furnace', 1)
      }
      return false
    }

    await furnace.putFuel(fuel.type, null, putFuel)
    log(bot, `Added ${putFuel} ${mc.getItemName(fuel.type)} to furnace fuel.`)
  }

  // Put the items in the furnace
  await furnace.putInput(mc.getItemId(itemName), null, num)

  // Wait for the items to smelt
  let total = 0
  let collectedLast = true
  let smeltedItem = null
  await new Promise(resolve => setTimeout(resolve, 200))

  while (total < num) {
    await new Promise(resolve => setTimeout(resolve, 10000))
    let collected = false

    if (furnace.outputItem()) {
      smeltedItem = await furnace.takeOutput()
      if (smeltedItem) {
        total += smeltedItem.count
        collected = true
      }
    }

    if (!collected && !collectedLast) {
      break // If nothing was collected this time or last time
    }

    collectedLast = collected
    if (bot.interrupt_code) {
      break
    }
  }

  await bot.closeWindow(furnace)

  if (placedFurnace) {
    await collectBlock(bot, 'furnace', 1)
  }

  if (total === 0) {
    log(bot, `Failed to smelt ${itemName}.`)
    return false
  }

  if (total < num) {
    log(bot, `Only smelted ${total} ${mc.getItemName(smeltedItem.type)}.`)
    return false
  }

  log(bot, `Successfully smelted ${itemName}, got ${total} ${mc.getItemName(smeltedItem.type)}.`)
  return true
}

/**
 * Clear the nearest furnace
 */
export async function clearNearestFurnace(bot: Bot): Promise<boolean> {
  const furnaceBlock = world.getNearestBlock(bot, 'furnace', 32)
  if (!furnaceBlock) {
    log(bot, 'No furnace nearby to clear.')
    return false
  }

  if (bot.entity.position.distanceTo(furnaceBlock.position) > 4) {
    await goToPosition(bot, furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 4)
  }

  const furnace = await bot.openFurnace(furnaceBlock)

  // Take the items out of the furnace
  let smeltedItem, inputItem, fuelItem

  if (furnace.outputItem()) {
    smeltedItem = await furnace.takeOutput()
  }

  if (furnace.inputItem()) {
    inputItem = await furnace.takeInput()
  }

  if (furnace.fuelItem()) {
    fuelItem = await furnace.takeFuel()
  }

  const smeltedName = smeltedItem ? `${smeltedItem.count} ${smeltedItem.name}` : '0 smelted items'
  const inputName = inputItem ? `${inputItem.count} ${inputItem.name}` : '0 input items'
  const fuelName = fuelItem ? `${fuelItem.count} ${fuelItem.name}` : '0 fuel items'

  log(bot, `Cleared furnace, received ${smeltedName}, ${inputName}, and ${fuelName}.`)
  return true
}
