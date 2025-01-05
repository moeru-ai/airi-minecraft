import type { Bot } from 'mineflayer'
import type { Item } from 'prismarine-item'
import type { Window } from 'prismarine-windows'
import type { ComponentLifecycle } from '../bot'
import { useLogg } from '@guiiai/logg'

const VALID_CHEST_TYPES = ['chest', 'ender_chest', 'trapped_chest'] as const
const VALID_FURNACE_TYPES = ['furnace', 'lit_furnace'] as const
const VALID_ENCHANT_TYPES = ['enchanting_table'] as const

interface ContainerContext {
  window: Window
  removeListeners: () => void
}

// Utility functions
function createItemUtils(bot: Bot) {
  const itemToString = (item: Item | null): string => {
    if (item)
      return `${item.name} x ${item.count}`
    return '(nothing)'
  }

  const findItemByName = (items: Item[], name: string): Item | null =>
    items.find(item => item?.name === name) || null

  const findItemByType = (items: Item[], type: number): Item | null =>
    items.find(item => item?.type === type) || null

  const listItems = (items = bot.inventory.items()): void => {
    const output = items.map(itemToString).join(', ')
    bot.chat(output || 'empty')
  }

  return {
    itemToString,
    findItemByName,
    findItemByType,
    listItems,
  }
}

// Container management
function createContainerManager(bot: Bot, logger: ReturnType<typeof useLogg>) {
  const setupContainerListeners = (
    window: Window,
    onChat: (username: string, message: string) => void,
    type = 'container',
  ): () => void => {
    const updateHandler = (slot: number, oldItem: Item, newItem: Item) => {
      bot.chat(`${type} update: ${itemToString(oldItem)} -> ${itemToString(newItem)} (slot: ${slot})`)
    }

    const closeHandler = () => {
      bot.chat(`${type} closed`)
    }

    window.on('updateSlot', updateHandler)
    window.on('close', closeHandler)
    bot.on('chat', onChat)

    return () => {
      window.removeListener('updateSlot', updateHandler)
      window.removeListener('close', closeHandler)
      bot.removeListener('chat', onChat)
    }
  }

  const findNearbyBlock = (types: readonly string[], maxDistance = 6): ReturnType<Bot['findBlock']> => {
    return bot.findBlock({
      matching: types
        .filter(name => bot.registry.blocksByName[name] !== undefined)
        .map(name => bot.registry.blocksByName[name].id),
      maxDistance,
    })
  }

  return {
    setupContainerListeners,
    findNearbyBlock,
  }
}

// Chest functions
function createChestManager(bot: Bot, logger: ReturnType<typeof useLogg>, utils: ReturnType<typeof createItemUtils>) {
  const { itemToString, findItemByName, listItems } = utils

  const handleChestCommands = async (window: Window, command: string[]): Promise<void> => {
    switch (true) {
      case /^close$/.test(command[0]): {
        window.close()
        break
      }
      case /^withdraw \d+ \w+$/.test(command.join(' ')): {
        const amount = Number.parseInt(command[1], 10)
        const name = command[2]
        const item = findItemByName(window.containerItems(), name)

        if (!item) {
          bot.chat(`unknown item ${name}`)
          return
        }

        try {
          await window.withdraw(item.type, null, amount)
          bot.chat(`withdrew ${amount} ${item.name}`)
        }
        catch (err) {
          bot.chat(`unable to withdraw ${amount} ${item.name}`)
        }
        break
      }
      case /^deposit \d+ \w+$/.test(command.join(' ')): {
        const amount = Number.parseInt(command[1], 10)
        const name = command[2]
        const item = findItemByName(window.items(), name)

        if (!item) {
          bot.chat(`unknown item ${name}`)
          return
        }

        try {
          await window.deposit(item.type, null, amount)
          bot.chat(`deposited ${amount} ${item.name}`)
        }
        catch (err) {
          bot.chat(`unable to deposit ${amount} ${item.name}`)
        }
        break
      }
    }
  }

  const openChest = async (minecart = false): Promise<ContainerContext | null> => {
    let target
    if (minecart) {
      target = Object.values(bot.entities)
        .find(e => e.entityType === bot.registry.entitiesByName.chest_minecart
          && bot.entity.position.distanceTo(e.position) < 3)

      if (!target) {
        bot.chat('no chest minecart found')
        return null
      }
    }
    else {
      target = bot.findBlock({
        matching: VALID_CHEST_TYPES.map(name => bot.registry.blocksByName[name].id),
        maxDistance: 6,
      })

      if (!target) {
        bot.chat('no chest found')
        return null
      }
    }

    try {
      const window = await bot.openContainer(target)
      const onChat = (username: string, message: string) => {
        if (username === bot.username)
          return
        handleChestCommands(window, message.split(' '))
      }

      const removeListeners = setupContainerListeners(window, onChat, 'chest')
      listItems(window.containerItems())

      return { window, removeListeners }
    }
    catch (err) {
      logger.error('Failed to open chest', err)
      bot.chat('Failed to open chest')
      return null
    }
  }

  return {
    openChest,
  }
}

// Furnace functions
function createFurnaceManager(bot: Bot, logger: ReturnType<typeof useLogg>, containerManager: ReturnType<typeof createContainerManager>) {
  const { findNearbyBlock } = containerManager

  const openFurnace = async (): Promise<void> => {
    const furnaceBlock = findNearbyBlock(VALID_FURNACE_TYPES)
    if (!furnaceBlock) {
      bot.chat('no furnace found')
      return
    }

    try {
      const furnace = await bot.openFurnace(furnaceBlock)
      let output = ''
      output += `input: ${itemToString(furnace.inputItem())}, `
      output += `fuel: ${itemToString(furnace.fuelItem())}, `
      output += `output: ${itemToString(furnace.outputItem())}`
      bot.chat(output)

      furnace.on('update', () => {
        logger.debug(`fuel: ${Math.round(furnace.fuel * 100)}% progress: ${Math.round(furnace.progress * 100)}%`)
      })

      // Setup furnace command handlers...
    }
    catch (err) {
      logger.error('Failed to open furnace', err)
      bot.chat('Failed to open furnace')
    }
  }

  return {
    openFurnace,
  }
}

export function createChestComponent(bot: Bot): ComponentLifecycle {
  const logger = useLogg('chest').useGlobalConfig()
  logger.log('Loading chest component')

  const utils = createItemUtils(bot)
  const containerManager = createContainerManager(bot, logger)
  const chestManager = createChestManager(bot, logger, utils)
  const furnaceManager = createFurnaceManager(bot, logger, containerManager)

  // Main chat handler
  const onChat = async (username: string, message: string): Promise<void> => {
    if (username === bot.username)
      return

    switch (true) {
      case /^list$/.test(message):
        utils.listItems()
        break
      case /^chest$/.test(message):
        await chestManager.openChest(false)
        break
      case /^chestminecart$/.test(message):
        await chestManager.openChest(true)
        break
      case /^furnace$/.test(message):
        await furnaceManager.openFurnace()
        break
    }
  }

  // Setup event listeners
  bot.on('chat', onChat)
  bot.on('experience', () => {
    bot.chat(`I am level ${bot.experience.level}`)
  })

  // Cleanup function
  return {
    cleanup: () => {
      bot.removeListener('chat', onChat)
      logger.log('Chest component cleaned up')
    },
  }
}
