import type { Bot } from 'mineflayer'
import type { Entity } from 'prismarine-entity'
import * as mc from '../../../utils/mcdata.js'
import * as world from '../world.js'
import { log } from './base.js'

/**
 * Equip the item with highest attack damage
 */
async function equipHighestAttack(bot: Bot): Promise<void> {
  const weapons = bot.inventory.items().filter(item =>
    item.name.includes('sword')
    || (item.name.includes('axe') && !item.name.includes('pickaxe')),
  )

  if (weapons.length === 0) {
    const tools = bot.inventory.items().filter(item =>
      item.name.includes('pickaxe')
      || item.name.includes('shovel'),
    )
    if (tools.length === 0)
      return

    tools.sort((a, b) => b.attackDamage - a.attackDamage)
    const tool = tools[0]
    if (tool)
      await bot.equip(tool, 'hand')
    return
  }

  weapons.sort((a, b) => b.attackDamage - a.attackDamage)
  const weapon = weapons[0]
  if (weapon)
    await bot.equip(weapon, 'hand')
}

/**
 * Attack the nearest mob of the given type
 */
export async function attackNearest(bot: Bot, mobType: string, kill = true): Promise<boolean> {
  bot.modes.pause('cowardice')
  if (mobType === 'drowned' || mobType === 'cod' || mobType === 'salmon'
    || mobType === 'tropical_fish' || mobType === 'squid') {
    bot.modes.pause('self_preservation')
  }

  const mob = world.getNearbyEntities(bot, 24).find(entity => entity.name === mobType)
  if (mob) {
    return await attackEntity(bot, mob, kill)
  }
  log(bot, `Could not find any ${mobType} to attack.`)
  return false
}

/**
 * Attack a specific entity
 */
export async function attackEntity(bot: Bot, entity: Entity, kill = true): Promise<boolean> {
  const pos = entity.position
  await equipHighestAttack(bot)

  if (!kill) {
    if (bot.entity.position.distanceTo(pos) > 5) {
      await bot.pathfinder.goto(bot.pathfinder.goals.GoalNear(pos.x, pos.y, pos.z, 4))
    }
    await bot.attack(entity)
  }
  else {
    bot.pvp.attack(entity)
    while (world.getNearbyEntities(bot, 24).includes(entity)) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      if (bot.interrupt_code) {
        bot.pvp.stop()
        return false
      }
    }
    log(bot, `Successfully killed ${entity.name}.`)
    return true
  }
  return true
}

/**
 * Defend against nearby hostile mobs
 */
export async function defendSelf(bot: Bot, range = 9): Promise<boolean> {
  bot.modes.pause('self_defense')
  bot.modes.pause('cowardice')

  let attacked = false
  let enemy = world.getNearestEntityWhere(bot, entity => mc.isHostile(entity), range)

  while (enemy) {
    await equipHighestAttack(bot)

    if (bot.entity.position.distanceTo(enemy.position) >= 4
      && enemy.name !== 'creeper' && enemy.name !== 'phantom') {
      try {
        await bot.pathfinder.goto(bot.pathfinder.goals.GoalFollow(enemy, 3.5), true)
      }
      catch { /* might error if entity dies, ignore */ }
    }

    if (bot.entity.position.distanceTo(enemy.position) <= 2) {
      try {
        const inverted_goal = bot.pathfinder.goals.GoalInvert(
          bot.pathfinder.goals.GoalFollow(enemy, 2),
        )
        await bot.pathfinder.goto(inverted_goal, true)
      }
      catch { /* might error if entity dies, ignore */ }
    }

    bot.pvp.attack(enemy)
    attacked = true
    await new Promise(resolve => setTimeout(resolve, 500))
    enemy = world.getNearestEntityWhere(bot, entity => mc.isHostile(entity), range)

    if (bot.interrupt_code) {
      bot.pvp.stop()
      return false
    }
  }

  bot.pvp.stop()
  if (attacked) {
    log(bot, `Successfully defended self.`)
  }
  else {
    log(bot, `No enemies nearby to defend self from.`)
  }
  return attacked
}
