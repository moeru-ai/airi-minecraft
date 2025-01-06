import type { Entity } from 'prismarine-entity'
import type { SkillContext } from './base'
import * as world from '../composables/world'
import * as mc from '../utils/mcdata'
import { log } from './base'

/**
 * Equip the item with highest attack damage
 */
async function equipHighestAttack(ctx: SkillContext): Promise<void> {
  const { bot } = ctx
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
export async function attackNearest(
  ctx: SkillContext,
  mobType: string,
  kill = true,
): Promise<boolean> {
  const { bot } = ctx
  const mob = world.getNearbyEntities(bot, 24).find(entity => entity.name === mobType)

  if (mob) {
    return await attackEntity(ctx, mob, kill)
  }

  log(ctx, `Could not find any ${mobType} to attack.`)
  return false
}

/**
 * Attack a specific entity
 */
export async function attackEntity(
  ctx: SkillContext,
  entity: Entity,
  kill = true,
): Promise<boolean> {
  const { bot } = ctx
  const pos = entity.position
  await equipHighestAttack(ctx)

  if (!kill) {
    if (bot.entity.position.distanceTo(pos) > 5) {
      await bot.pathfinder.goto(bot.pathfinder.goals.GoalNear(pos.x, pos.y, pos.z, 4))
    }
    await bot.attack(entity)
    return true
  }

  bot.pvp.attack(entity)
  while (world.getNearbyEntities(bot, 24).includes(entity)) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (ctx.shouldInterrupt) {
      bot.pvp.stop()
      return false
    }
  }

  log(ctx, `Successfully killed ${entity.name}.`)
  return true
}

/**
 * Defend against nearby hostile mobs
 */
export async function defendSelf(ctx: SkillContext, range = 9): Promise<boolean> {
  const { bot } = ctx
  let attacked = false
  let enemy = world.getNearestEntityWhere(bot, entity => mc.isHostile(entity), range)

  while (enemy) {
    await equipHighestAttack(ctx)

    if (bot.entity.position.distanceTo(enemy.position) >= 4
      && enemy.name !== 'creeper' && enemy.name !== 'phantom') {
      try {
        await bot.pathfinder.goto(bot.pathfinder.goals.GoalFollow(enemy, 3.5), true)
      }
      catch { /* might error if entity dies, ignore */ }
    }

    if (bot.entity.position.distanceTo(enemy.position) <= 2) {
      try {
        const invertedGoal = bot.pathfinder.goals.GoalInvert(
          bot.pathfinder.goals.GoalFollow(enemy, 2),
        )
        await bot.pathfinder.goto(invertedGoal, true)
      }
      catch { /* might error if entity dies, ignore */ }
    }

    bot.pvp.attack(enemy)
    attacked = true
    await new Promise(resolve => setTimeout(resolve, 500))
    enemy = world.getNearestEntityWhere(bot, entity => mc.isHostile(entity), range)

    if (ctx.shouldInterrupt) {
      bot.pvp.stop()
      return false
    }
  }

  bot.pvp.stop()
  if (attacked) {
    log(ctx, 'Successfully defended self.')
  }
  else {
    log(ctx, 'No enemies nearby to defend self from.')
  }
  return attacked
}
