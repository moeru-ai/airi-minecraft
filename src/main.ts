import mineflayer from 'mineflayer'
import { goals, Movements, pathfinder } from 'mineflayer-pathfinder'

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  await sleep(5000)

  const bot = mineflayer.createBot({
    host: '10.0.0.100', // minecraft 服务器的 IP 地址
    username: 'airi', // minecraft 用户名
    // password: '12345678', // minecraft 密码, 如果你玩的是不需要正版验证的服务器，请注释掉。
    port: 56304, // 默认使用 25565，如果你的服务器端口不是这个请取消注释并填写。
    // version: false,             // 如果需要指定re使用一个版本或快照时，请取消注释并手动填写（如："1.8.9" 或 "1.16.5"），否则会自动设置。
    // auth: 'mojang'              // 如果需要使用微软账号登录时，请取消注释，然后将值设置为 'microsoft'，否则会自动设置为 'mojang'。
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username)
      return
    bot.chat(message)
  })

  // 记录错误和被踢出服务器的原因:
  bot.on('kicked', console.log)
  bot.on('error', console.log)

  bot.loadPlugin(pathfinder)

  const RANGE_GOAL = 1
  bot.once('spawn', () => {
    const defaultMove = new Movements(bot)

    bot.on('chat', (username, message) => {
      if (username === bot.username)
        return
      if (message !== 'come')
        return
      const target = bot.players[username]?.entity
      if (!target) {
        bot.chat('I don\'t see you !')
        return
      }
      const { x: playerX, y: playerY, z: playerZ } = target.position

      bot.pathfinder.setMovements(defaultMove)
      bot.pathfinder.setGoal(new goals.GoalNear(playerX, playerY, playerZ, RANGE_GOAL))
    })
  })

  /** TP */
  let target: Entity = null

  bot.on('chat', (username, message) => {
    if (username === bot.username)
      return
    target = bot.players[username].entity
    let entity
    switch (message) {
      case 'forward':
        bot.setControlState('forward', true)
        break
      case 'back':
        bot.setControlState('back', true)
        break
      case 'left':
        bot.setControlState('left', true)
        break
      case 'right':
        bot.setControlState('right', true)
        break
      case 'sprint':
        bot.setControlState('sprint', true)
        break
      case 'stop':
        bot.clearControlStates()
        break
      case 'jump':
        bot.setControlState('jump', true)
        bot.setControlState('jump', false)
        break
      case 'jump a lot':
        bot.setControlState('jump', true)
        break
      case 'stop jumping':
        bot.setControlState('jump', false)
        break
      case 'attack':
        entity = bot.nearestEntity()
        if (entity) {
          bot.attack(entity, true)
        }
        else {
          bot.chat('no nearby entities')
        }
        break
      case 'mount':
        entity = bot.nearestEntity((entity) => { return entity.name === 'minecart' })
        if (entity) {
          bot.mount(entity)
        }
        else {
          bot.chat('no nearby objects')
        }
        break
      case 'dismount':
        bot.dismount()
        break
      case 'move vehicle forward':
        bot.moveVehicle(0.0, 1.0)
        break
      case 'move vehicle backward':
        bot.moveVehicle(0.0, -1.0)
        break
      case 'move vehicle left':
        bot.moveVehicle(1.0, 0.0)
        break
      case 'move vehicle right':
        bot.moveVehicle(-1.0, 0.0)
        break
      case 'tp':
        bot.entity.position.y += 10
        break
      case 'pos':
        bot.chat(bot.entity.position.toString())
        break
      case 'yp':
        bot.chat(`Yaw ${bot.entity.yaw}, pitch: ${bot.entity.pitch}`)
        break
    }
  })

  bot.once('spawn', () => {
  // keep your eyes on the target, so creepy!
    setInterval(watchTarget, 50)

    function watchTarget() {
      if (!target)
        return
      bot.lookAt(target.position.offset(0, target.height, 0))
    }
  })

  bot.on('mount', () => {
    bot.chat(`mounted ${bot.vehicle.displayName}`)
  })

  bot.on('dismount', (vehicle) => {
    bot.chat(`dismounted ${vehicle.displayName}`)
  })

  /**
   * Chest
   */
  bot.on('experience', () => {
    bot.chat(`I am level ${bot.experience.level}`)
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username)
      return
    switch (true) {
      case /^list$/.test(message):
        sayItems()
        break
      case /^chest$/.test(message):
        watchChest(false, ['chest', 'ender_chest', 'trapped_chest'])
        break
      case /^furnace$/.test(message):
        watchFurnace()
        break
      case /^dispenser$/.test(message):
        watchChest(false, ['dispenser'])
        break
      case /^enchant$/.test(message):
        watchEnchantmentTable()
        break
      case /^chestminecart$/.test(message):
        watchChest(true)
        break
      case /^invsee \w+( \d)?$/.test(message): {
        // invsee Herobrine [or]
        // invsee Herobrine 1
        const command = message.split(' ')
        useInvsee(command[0], command[1])
        break
      }
    }
  })

  function sayItems(items = bot.inventory.items()) {
    const output = items.map(itemToString).join(', ')
    if (output) {
      bot.chat(output)
    }
    else {
      bot.chat('empty')
    }
  }

  async function watchChest(minecart, blocks = []) {
    let chestToOpen
    if (minecart) {
      chestToOpen = Object.keys(bot.entities)
        .map(id => bot.entities[id])
        .find(e => e.entityType === bot.registry.entitiesByName.chest_minecart
          && e.objectData.intField === 1
          && bot.entity.position.distanceTo(e.position) < 3)
      if (!chestToOpen) {
        bot.chat('no chest minecart found')
        return
      }
    }
    else {
      chestToOpen = bot.findBlock({
        matching: blocks.map(name => bot.registry.blocksByName[name].id),
        maxDistance: 6,
      })
      if (!chestToOpen) {
        bot.chat('no chest found')
        return
      }
    }
    const chest = await bot.openContainer(chestToOpen)
    sayItems(chest.containerItems())
    chest.on('updateSlot', (slot, oldItem, newItem) => {
      bot.chat(`chest update: ${itemToString(oldItem)} -> ${itemToString(newItem)} (slot: ${slot})`)
    })
    chest.on('close', () => {
      bot.chat('chest closed')
    })

    bot.on('chat', onChat)

    function onChat(username, message) {
      if (username === bot.username)
        return
      const command = message.split(' ')
      switch (true) {
        case /^close$/.test(message):
          closeChest()
          break
        case /^withdraw \d+ \w+$/.test(message):
          // withdraw amount name
          // ex: withdraw 16 stick
          withdrawItem(command[2], command[1])
          break
        case /^deposit \d+ \w+$/.test(message):
          // deposit amount name
          // ex: deposit 16 stick
          depositItem(command[2], command[1])
          break
      }
    }

    function closeChest() {
      chest.close()
      bot.removeListener('chat', onChat)
    }

    async function withdrawItem(name, amount) {
      const item = itemByName(chest.containerItems(), name)
      if (item) {
        try {
          await chest.withdraw(item.type, null, amount)
          bot.chat(`withdrew ${amount} ${item.name}`)
        }
        catch (err) {
          bot.chat(`unable to withdraw ${amount} ${item.name}`)
        }
      }
      else {
        bot.chat(`unknown item ${name}`)
      }
    }

    async function depositItem(name, amount) {
      const item = itemByName(chest.items(), name)
      if (item) {
        try {
          await chest.deposit(item.type, null, amount)
          bot.chat(`deposited ${amount} ${item.name}`)
        }
        catch (err) {
          bot.chat(`unable to deposit ${amount} ${item.name}`)
        }
      }
      else {
        bot.chat(`unknown item ${name}`)
      }
    }
  }

  async function watchFurnace() {
    const furnaceBlock = bot.findBlock({
      matching: ['furnace', 'lit_furnace'].filter(name => bot.registry.blocksByName[name] !== undefined).map(name => bot.registry.blocksByName[name].id),
      maxDistance: 6,
    })
    if (!furnaceBlock) {
      bot.chat('no furnace found')
      return
    }
    const furnace = await bot.openFurnace(furnaceBlock)
    let output = ''
    output += `input: ${itemToString(furnace.inputItem())}, `
    output += `fuel: ${itemToString(furnace.fuelItem())}, `
    output += `output: ${itemToString(furnace.outputItem())}`
    bot.chat(output)

    furnace.on('updateSlot', (slot, oldItem, newItem) => {
      bot.chat(`furnace update: ${itemToString(oldItem)} -> ${itemToString(newItem)} (slot: ${slot})`)
    })
    furnace.on('close', () => {
      bot.chat('furnace closed')
    })
    furnace.on('update', () => {
      console.log(`fuel: ${Math.round(furnace.fuel * 100)}% progress: ${Math.round(furnace.progress * 100)}%`)
    })

    bot.on('chat', onChat)

    function onChat(username, message) {
      if (username === bot.username)
        return
      const command = message.split(' ')
      switch (true) {
        case /^close$/.test(message):
          closeFurnace()
          break
        case /^(input|fuel) \d+ \w+$/.test(message):
          // input amount name
          // ex: input 32 coal
          putInFurnace(command[0], command[2], command[1])
          break
        case /^take (input|fuel|output)$/.test(message):
          // take what
          // ex: take output
          takeFromFurnace(command[0])
          break
      }

      function closeFurnace() {
        furnace.close()
        bot.removeListener('chat', onChat)
      }

      async function putInFurnace(where, name, amount) {
        const item = itemByName(furnace.items(), name)
        if (item) {
          const fn = {
            input: furnace.putInput,
            fuel: furnace.putFuel,
          }[where]
          try {
            await fn.call(furnace, item.type, null, amount)
            bot.chat(`put ${amount} ${item.name}`)
          }
          catch (err) {
            bot.chat(`unable to put ${amount} ${item.name}`)
          }
        }
        else {
          bot.chat(`unknown item ${name}`)
        }
      }

      async function takeFromFurnace(what) {
        const fn = {
          input: furnace.takeInput,
          fuel: furnace.takeFuel,
          output: furnace.takeOutput,
        }[what]
        try {
          const item = await fn.call(furnace)
          bot.chat(`took ${item.name}`)
        }
        catch (err) {
          bot.chat('unable to take')
        }
      }
    }
  }

  async function watchEnchantmentTable() {
    const enchantTableBlock = bot.findBlock({
      matching: ['enchanting_table'].map(name => bot.registry.blocksByName[name].id),
      maxDistance: 6,
    })
    if (!enchantTableBlock) {
      bot.chat('no enchantment table found')
      return
    }
    const table = await bot.openEnchantmentTable(enchantTableBlock)
    bot.chat(itemToString(table.targetItem()))

    table.on('updateSlot', (slot, oldItem, newItem) => {
      bot.chat(`enchantment table update: ${itemToString(oldItem)} -> ${itemToString(newItem)} (slot: ${slot})`)
    })
    table.on('close', () => {
      bot.chat('enchantment table closed')
    })
    table.on('ready', () => {
      bot.chat(`ready to enchant. choices are ${table.enchantments.map(o => o.level).join(', ')}`)
    })

    bot.on('chat', onChat)

    function onChat(username, message) {
      if (username === bot.username)
        return
      const command = message.split(' ')
      switch (true) {
        case /^close$/.test(message):
          closeEnchantmentTable()
          break
        case /^put \w+$/.test(message):
          // put name
          // ex: put diamondsword
          putItem(command[1])
          break
        case /^add lapis$/.test(message):
          addLapis()
          break
        case /^enchant \d+$/.test(message):
          // enchant choice
          // ex: enchant 2
          enchantItem(command[1])
          break
        case /^take$/.test(message):
          takeEnchantedItem()
          break
      }

      function closeEnchantmentTable() {
        table.close()
      }

      async function putItem(name) {
        const item = itemByName(table.window.items(), name)
        if (item) {
          try {
            await table.putTargetItem(item)
            bot.chat(`I put ${itemToString(item)}`)
          }
          catch (err) {
            bot.chat(`error putting ${itemToString(item)}`)
          }
        }
        else {
          bot.chat(`unknown item ${name}`)
        }
      }

      async function addLapis() {
        const item = itemByType(table.window.items(), ['dye', 'purple_dye', 'lapis_lazuli'].filter(name => bot.registry.itemByName[name] !== undefined)
          .map(name => bot.registry.itemByName[name].id))
        if (item) {
          try {
            await table.putLapis(item)
            bot.chat(`I put ${itemToString(item)}`)
          }
          catch (err) {
            bot.chat(`error putting ${itemToString(item)}`)
          }
        }
        else {
          bot.chat('I don\'t have any lapis')
        }
      }

      async function enchantItem(choice) {
        choice = Number.parseInt(choice, 10)
        try {
          const item = await table.enchant(choice)
          bot.chat(`enchanted ${itemToString(item)}`)
        }
        catch (err) {
          bot.chat('error enchanting')
        }
      }

      async function takeEnchantedItem() {
        try {
          const item = await table.takeTargetItem()
          bot.chat(`got ${itemToString(item)}`)
        }
        catch (err) {
          bot.chat('error getting item')
        }
      }
    }
  }

  function useInvsee(username, showEquipment) {
    bot.once('windowOpen', (window) => {
      const count = window.containerItems().length
      const what = showEquipment ? 'equipment' : 'inventory items'
      if (count) {
        bot.chat(`${username}'s ${what}:`)
        sayItems(window.containerItems())
      }
      else {
        bot.chat(`${username} has no ${what}`)
      }
    })
    if (showEquipment) {
      // any extra parameter triggers the easter egg
      // and shows the other player's equipment
      bot.chat(`/invsee ${username} 1`)
    }
    else {
      bot.chat(`/invsee ${username}`)
    }
  }

  function itemToString(item) {
    if (item) {
      return `${item.name} x ${item.count}`
    }
    else {
      return '(nothing)'
    }
  }

  function itemByType(items, type) {
    let item
    let i
    for (i = 0; i < items.length; ++i) {
      item = items[i]
      if (item && item.type === type)
        return item
    }
    return null
  }

  function itemByName(items, name) {
    let item
    let i
    for (i = 0; i < items.length; ++i) {
      item = items[i]
      if (item && item.name === name)
        return item
    }
    return null
  }
}

main().catch(console.error)
