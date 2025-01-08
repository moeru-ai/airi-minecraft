import type { Mineflayer } from '../libs/mineflayer'
import * as world from '../composables/world'
import * as mc from '../utils/mcdata'
import { log } from './base'
import { collectBlock, placeBlock } from './blocks'
import { goToPosition } from './movement'

export async function craftRecipe(mineflayer: Mineflayer, itemName: string, num = 1): Promise<boolean> {
  let placedTable = false

  if (mc.getItemCraftingRecipes(itemName)?.length === 0) {
    log(mineflayer, `${itemName} is either not an item, or it does not have a crafting recipe!`)
    return false
  }

  // Get recipes that don't require a crafting table
  const itemId = mc.getItemId(itemName)
  if (itemId === null) {
    log(mineflayer, `Invalid item name: ${itemName}`)
    return false
  }

  let recipes = mineflayer.bot.recipesFor(itemId, null, 1, null)
  let craftingTable = null
  const craftingTableRange = 32

  if (!recipes || recipes.length === 0) {
    recipes = mineflayer.bot.recipesFor(itemId, null, 1, true)
    if (!recipes || recipes.length === 0) {
      log(mineflayer, `You do not have the resources to craft a ${itemName}.`)
      return false
    }

    // Look for crafting table
    craftingTable = world.getNearestBlock(mineflayer, 'crafting_table', craftingTableRange)
    if (!craftingTable) {
      // Try to place crafting table
      const inventory = world.getInventoryCounts(mineflayer)
      const hasTable = inventory.crafting_table > 0
      if (hasTable) {
        const pos = world.getNearestFreeSpace(mineflayer, 1, 6)
        if (pos) {
          await placeBlock(mineflayer, 'crafting_table', pos.x, pos.y, pos.z)
          craftingTable = world.getNearestBlock(mineflayer, 'crafting_table', craftingTableRange)
          if (craftingTable) {
            recipes = mineflayer.bot.recipesFor(itemId, null, 1, craftingTable)
            placedTable = true
          }
        }
      }
      else {
        log(mineflayer, `Crafting ${itemName} requires a crafting table.`)
        return false
      }
    }
    else {
      recipes = mineflayer.bot.recipesFor(itemId, null, 1, craftingTable)
    }
  }

  if (!recipes || recipes.length === 0) {
    log(mineflayer, `You do not have the resources to craft a ${itemName}. It requires: ${
      Object.entries(mc.getItemCraftingRecipes(itemName)?.[0] ?? {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    }.`)
    if (placedTable && craftingTable) {
      await collectBlock(mineflayer, 'crafting_table', 1)
    }
    return false
  }

  if (craftingTable && mineflayer.bot.entity.position.distanceTo(craftingTable.position) > 4) {
    await goToPosition(mineflayer, craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 4)
  }

  const recipe = recipes[0]
  // Check that the agent has sufficient items to use the recipe `num` times
  const inventory = world.getInventoryCounts(mineflayer) // Items in the agents inventory
  const requiredIngredients = mc.ingredientsFromPrismarineRecipe(recipe) // Items required to use the recipe once
  const craftLimit = mc.calculateLimitingResource(inventory, requiredIngredients)

  await mineflayer.bot.craft(recipe, Math.min(craftLimit.num, num), craftingTable ?? undefined)

  if (craftLimit.num < num) {
    log(mineflayer, `Not enough ${craftLimit.limitingResource} to craft ${num}, crafted ${craftLimit.num}. You now have ${world.getInventoryCounts(mineflayer)[itemName]} ${itemName}.`)
  }
  else {
    log(mineflayer, `Successfully crafted ${itemName}, you now have ${world.getInventoryCounts(mineflayer)[itemName]} ${itemName}.`)
  }

  if (placedTable && craftingTable) {
    await collectBlock(mineflayer, 'crafting_table', 1)
  }

  // Equip any armor the bot may have crafted
  mineflayer.bot.armorManager.equipAll()

  return true
}

export async function smeltItem(mineflayer: Mineflayer, itemName: string, num = 1): Promise<boolean> {
  if (!mc.isSmeltable(itemName)) {
    log(mineflayer, `Cannot smelt ${itemName}. Hint: make sure you are smelting the 'raw' item.`)
    return false
  }

  let placedFurnace = false
  const furnaceRange = 32
  let furnaceBlock = world.getNearestBlock(mineflayer, 'furnace', furnaceRange)

  if (!furnaceBlock) {
    // Try to place furnace
    const inventory = world.getInventoryCounts(mineflayer)
    const hasFurnace = inventory.furnace > 0
    if (hasFurnace) {
      const pos = world.getNearestFreeSpace(mineflayer, 1, furnaceRange)
      if (pos) {
        await placeBlock(mineflayer, 'furnace', pos.x, pos.y, pos.z)
        furnaceBlock = world.getNearestBlock(mineflayer, 'furnace', furnaceRange)
        placedFurnace = true
      }
    }
  }

  if (!furnaceBlock) {
    log(mineflayer, 'There is no furnace nearby and you have no furnace.')
    return false
  }

  if (mineflayer.bot.entity.position.distanceTo(furnaceBlock.position) > 4) {
    await goToPosition(mineflayer, furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 4)
  }

  await mineflayer.bot.lookAt(furnaceBlock.position)

  const furnace = await mineflayer.bot.openFurnace(furnaceBlock)

  // Check if the furnace is already smelting something
  const inputItem = furnace.inputItem()
  const itemId = mc.getItemId(itemName)
  if (itemId === null) {
    log(mineflayer, `Invalid item name: ${itemName}`)
    return false
  }

  if (inputItem && inputItem.type !== itemId && inputItem.count > 0) {
    log(mineflayer, `The furnace is currently smelting ${mc.getItemName(inputItem.type) ?? 'unknown'}.`)
    if (placedFurnace) {
      await collectBlock(mineflayer, 'furnace', 1)
    }
    return false
  }

  // Check if the bot has enough items to smelt
  const invCounts = world.getInventoryCounts(mineflayer)
  if (!invCounts[itemName] || invCounts[itemName] < num) {
    log(mineflayer, `You do not have enough ${itemName} to smelt.`)
    if (placedFurnace) {
      await collectBlock(mineflayer, 'furnace', 1)
    }
    return false
  }

  // Fuel the furnace
  if (!furnace.fuelItem()) {
    const fuel = mc.getSmeltingFuel(mineflayer.bot)
    if (!fuel) {
      log(mineflayer, `You have no fuel to smelt ${itemName}, you need coal, charcoal, or wood.`)
      if (placedFurnace) {
        await collectBlock(mineflayer, 'furnace', 1)
      }
      return false
    }

    log(mineflayer, `Using ${fuel.name} as fuel.`)
    const putFuel = Math.ceil(num / mc.getFuelSmeltOutput(fuel.name))

    if (fuel.count < putFuel) {
      log(mineflayer, `You don't have enough ${fuel.name} to smelt ${num} ${itemName}; you need ${putFuel}.`)
      if (placedFurnace) {
        await collectBlock(mineflayer, 'furnace', 1)
      }
      return false
    }

    await furnace.putFuel(fuel.type, null, putFuel)
    log(mineflayer, `Added ${putFuel} ${mc.getItemName(fuel.type) ?? 'unknown'} to furnace fuel.`)
  }

  // Put the items in the furnace
  await furnace.putInput(itemId, null, num)

  // Wait for the items to smelt
  let total = 0
  let collectedLast = true
  let smeltedItem = null
  await new Promise(resolve => setTimeout(resolve, 200))

  while (total < num) {
    await new Promise(resolve => setTimeout(resolve, 10000))
    let collected = false

    const outputItem = furnace.outputItem()
    if (outputItem) {
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
    if (mineflayer.shouldInterrupt) {
      break
    }
  }

  await mineflayer.bot.closeWindow(furnace)

  if (placedFurnace) {
    await collectBlock(mineflayer, 'furnace', 1)
  }

  if (total === 0) {
    log(mineflayer, `Failed to smelt ${itemName}.`)
    return false
  }

  if (total < num) {
    log(mineflayer, `Only smelted ${total} ${mc.getItemName(smeltedItem?.type ?? 0) ?? 'unknown'}.`)
    return false
  }

  log(mineflayer, `Successfully smelted ${itemName}, got ${total} ${mc.getItemName(smeltedItem?.type ?? 0) ?? 'unknown'}.`)
  return true
}

export async function clearNearestFurnace(mineflayer: Mineflayer): Promise<boolean> {
  const furnaceBlock = world.getNearestBlock(mineflayer, 'furnace', 32)
  if (!furnaceBlock) {
    log(mineflayer, 'No furnace nearby to clear.')
    return false
  }

  if (mineflayer.bot.entity.position.distanceTo(furnaceBlock.position) > 4) {
    await goToPosition(mineflayer, furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 4)
  }

  const furnace = await mineflayer.bot.openFurnace(furnaceBlock)

  // Take the items out of the furnace
  let smeltedItem, inputItem, fuelItem

  const outputItem = furnace.outputItem()
  if (outputItem) {
    smeltedItem = await furnace.takeOutput()
  }

  const furnaceInput = furnace.inputItem()
  if (furnaceInput) {
    inputItem = await furnace.takeInput()
  }

  const furnaceFuel = furnace.fuelItem()
  if (furnaceFuel) {
    fuelItem = await furnace.takeFuel()
  }

  const smeltedName = smeltedItem ? `${smeltedItem.count} ${smeltedItem.name}` : '0 smelted items'
  const inputName = inputItem ? `${inputItem.count} ${inputItem.name}` : '0 input items'
  const fuelName = fuelItem ? `${fuelItem.count} ${fuelItem.name}` : '0 fuel items'

  log(mineflayer, `Cleared furnace, received ${smeltedName}, ${inputName}, and ${fuelName}.`)
  return true
}
