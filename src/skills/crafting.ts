import type { SkillContext } from './base'
import * as world from '../composables/world'
import { createWorldContext } from '../composables/world'
import * as mc from '../utils/mcdata'
import { log } from './base'
import { collectBlock, placeBlock } from './blocks'
import { goToPosition } from './movement'

export async function craftRecipe(ctx: SkillContext, itemName: string, num = 1): Promise<boolean> {
  let placedTable = false

  if (mc.getItemCraftingRecipes(itemName)?.length === 0) {
    log(ctx, `${itemName} is either not an item, or it does not have a crafting recipe!`)
    return false
  }

  // Get recipes that don't require a crafting table
  const itemId = mc.getItemId(itemName)
  if (itemId === null) {
    log(ctx, `Invalid item name: ${itemName}`)
    return false
  }

  let recipes = ctx.bot.recipesFor(itemId, null, 1, null)
  let craftingTable = null
  const craftingTableRange = 32

  if (!recipes || recipes.length === 0) {
    recipes = ctx.bot.recipesFor(itemId, null, 1, true)
    if (!recipes || recipes.length === 0) {
      log(ctx, `You do not have the resources to craft a ${itemName}.`)
      return false
    }

    // Look for crafting table
    const worldCtx = createWorldContext(ctx.botCtx)
    craftingTable = world.getNearestBlock(worldCtx, 'crafting_table', craftingTableRange)
    if (!craftingTable) {
      // Try to place crafting table
      const inventory = world.getInventoryCounts(worldCtx)
      const hasTable = inventory.crafting_table > 0
      if (hasTable) {
        const pos = world.getNearestFreeSpace(worldCtx, 1, 6)
        if (pos) {
          await placeBlock(ctx, 'crafting_table', pos.x, pos.y, pos.z)
          craftingTable = world.getNearestBlock(worldCtx, 'crafting_table', craftingTableRange)
          if (craftingTable) {
            recipes = ctx.bot.recipesFor(itemId, null, 1, craftingTable)
            placedTable = true
          }
        }
      }
      else {
        log(ctx, `Crafting ${itemName} requires a crafting table.`)
        return false
      }
    }
    else {
      recipes = ctx.bot.recipesFor(itemId, null, 1, craftingTable)
    }
  }

  if (!recipes || recipes.length === 0) {
    log(ctx, `You do not have the resources to craft a ${itemName}. It requires: ${
      Object.entries(mc.getItemCraftingRecipes(itemName)?.[0] ?? {})
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ')
    }.`)
    if (placedTable && craftingTable) {
      await collectBlock(ctx, 'crafting_table', 1)
    }
    return false
  }

  if (craftingTable && ctx.bot.entity.position.distanceTo(craftingTable.position) > 4) {
    await goToPosition(ctx, craftingTable.position.x, craftingTable.position.y, craftingTable.position.z, 4)
  }

  const recipe = recipes[0]
  // Check that the agent has sufficient items to use the recipe `num` times
  const worldCtx = createWorldContext(ctx.botCtx)
  const inventory = world.getInventoryCounts(worldCtx) // Items in the agents inventory
  const requiredIngredients = mc.ingredientsFromPrismarineRecipe(recipe) // Items required to use the recipe once
  const craftLimit = mc.calculateLimitingResource(inventory, requiredIngredients)

  await ctx.bot.craft(recipe, Math.min(craftLimit.num, num), craftingTable ?? undefined)

  if (craftLimit.num < num) {
    log(ctx, `Not enough ${craftLimit.limitingResource} to craft ${num}, crafted ${craftLimit.num}. You now have ${world.getInventoryCounts(worldCtx)[itemName]} ${itemName}.`)
  }
  else {
    log(ctx, `Successfully crafted ${itemName}, you now have ${world.getInventoryCounts(worldCtx)[itemName]} ${itemName}.`)
  }

  if (placedTable && craftingTable) {
    await collectBlock(ctx, 'crafting_table', 1)
  }

  // Equip any armor the bot may have crafted
  ctx.bot.armorManager.equipAll()

  return true
}

export async function smeltItem(ctx: SkillContext, itemName: string, num = 1): Promise<boolean> {
  if (!mc.isSmeltable(itemName)) {
    log(ctx, `Cannot smelt ${itemName}. Hint: make sure you are smelting the 'raw' item.`)
    return false
  }

  let placedFurnace = false
  const furnaceRange = 32
  const worldCtx = createWorldContext(ctx.botCtx)
  let furnaceBlock = world.getNearestBlock(worldCtx, 'furnace', furnaceRange)

  if (!furnaceBlock) {
    // Try to place furnace
    const inventory = world.getInventoryCounts(worldCtx)
    const hasFurnace = inventory.furnace > 0
    if (hasFurnace) {
      const pos = world.getNearestFreeSpace(worldCtx, 1, furnaceRange)
      if (pos) {
        await placeBlock(ctx, 'furnace', pos.x, pos.y, pos.z)
        furnaceBlock = world.getNearestBlock(worldCtx, 'furnace', furnaceRange)
        placedFurnace = true
      }
    }
  }

  if (!furnaceBlock) {
    log(ctx, 'There is no furnace nearby and you have no furnace.')
    return false
  }

  if (ctx.bot.entity.position.distanceTo(furnaceBlock.position) > 4) {
    await goToPosition(ctx, furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 4)
  }

  await ctx.bot.lookAt(furnaceBlock.position)

  const furnace = await ctx.bot.openFurnace(furnaceBlock)

  // Check if the furnace is already smelting something
  const inputItem = furnace.inputItem()
  const itemId = mc.getItemId(itemName)
  if (itemId === null) {
    log(ctx, `Invalid item name: ${itemName}`)
    return false
  }

  if (inputItem && inputItem.type !== itemId && inputItem.count > 0) {
    log(ctx, `The furnace is currently smelting ${mc.getItemName(inputItem.type) ?? 'unknown'}.`)
    if (placedFurnace) {
      await collectBlock(ctx, 'furnace', 1)
    }
    return false
  }

  // Check if the bot has enough items to smelt
  const invCounts = world.getInventoryCounts(worldCtx)
  if (!invCounts[itemName] || invCounts[itemName] < num) {
    log(ctx, `You do not have enough ${itemName} to smelt.`)
    if (placedFurnace) {
      await collectBlock(ctx, 'furnace', 1)
    }
    return false
  }

  // Fuel the furnace
  if (!furnace.fuelItem()) {
    const fuel = mc.getSmeltingFuel(ctx.bot)
    if (!fuel) {
      log(ctx, `You have no fuel to smelt ${itemName}, you need coal, charcoal, or wood.`)
      if (placedFurnace) {
        await collectBlock(ctx, 'furnace', 1)
      }
      return false
    }

    log(ctx, `Using ${fuel.name} as fuel.`)
    const putFuel = Math.ceil(num / mc.getFuelSmeltOutput(fuel.name))

    if (fuel.count < putFuel) {
      log(ctx, `You don't have enough ${fuel.name} to smelt ${num} ${itemName}; you need ${putFuel}.`)
      if (placedFurnace) {
        await collectBlock(ctx, 'furnace', 1)
      }
      return false
    }

    await furnace.putFuel(fuel.type, null, putFuel)
    log(ctx, `Added ${putFuel} ${mc.getItemName(fuel.type) ?? 'unknown'} to furnace fuel.`)
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
    if (ctx.shouldInterrupt) {
      break
    }
  }

  await ctx.bot.closeWindow(furnace)

  if (placedFurnace) {
    await collectBlock(ctx, 'furnace', 1)
  }

  if (total === 0) {
    log(ctx, `Failed to smelt ${itemName}.`)
    return false
  }

  if (total < num) {
    log(ctx, `Only smelted ${total} ${mc.getItemName(smeltedItem?.type ?? 0) ?? 'unknown'}.`)
    return false
  }

  log(ctx, `Successfully smelted ${itemName}, got ${total} ${mc.getItemName(smeltedItem?.type ?? 0) ?? 'unknown'}.`)
  return true
}

export async function clearNearestFurnace(ctx: SkillContext): Promise<boolean> {
  const worldCtx = createWorldContext(ctx.botCtx)
  const furnaceBlock = world.getNearestBlock(worldCtx, 'furnace', 32)
  if (!furnaceBlock) {
    log(ctx, 'No furnace nearby to clear.')
    return false
  }

  if (ctx.bot.entity.position.distanceTo(furnaceBlock.position) > 4) {
    await goToPosition(ctx, furnaceBlock.position.x, furnaceBlock.position.y, furnaceBlock.position.z, 4)
  }

  const furnace = await ctx.bot.openFurnace(furnaceBlock)

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

  log(ctx, `Cleared furnace, received ${smeltedName}, ${inputName}, and ${fuelName}.`)
  return true
}
