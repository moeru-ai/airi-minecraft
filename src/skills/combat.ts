import type { Entity } from 'prismarine-entity'
import type { Item } from 'prismarine-item'
import type { SkillContext } from './base'
import pathfinderModel from 'mineflayer-pathfinder'
import * as world from '../composables/world'
import * as mc from '../utils/mcdata'
import { log } from './base'

const { goals } = pathfinderModel

interface WeaponItem extends Item {
  attackDamage: number
}

async function equipHighestAttack(ctx: SkillContext): Promise<void> {
  const { bot } = ctx
  const weapons = bot.inventory.items().filter(item =>
    item.name.includes('sword')
    || (item.name.includes('axe') && !item.name.includes('pickaxe')),
  ) as WeaponItem[]

  if (weapons.length === 0) {
    const tools = bot.inventory.items().filter(item =>
      item.name.includes('pickaxe')
      || item.name.includes('shovel'),
    ) as WeaponItem[]

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

export async function attackNearest(
  ctx: SkillContext,
  mobType: string,
  kill = true,
): Promise<boolean> {
  const worldCtx = world.createWorldContext(ctx.botCtx)
  const mob = world.getNearbyEntities(worldCtx, 24).find(entity => entity.name === mobType)

  if (mob) {
    return await attackEntity(ctx, mob, kill)
  }

  log(ctx, `Could not find any ${mobType} to attack.`)
  return false
}

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
      const goal = new goals.GoalNear(pos.x, pos.y, pos.z, 4)
      await bot.pathfinder.goto(goal)
    }
    await bot.attack(entity)
    return true
  }

  bot.pvp.attack(entity)
  const worldCtx = world.createWorldContext(ctx.botCtx)
  while (world.getNearbyEntities(worldCtx, 24).includes(entity)) {
    await new Promise(resolve => setTimeout(resolve, 1000))
    if (ctx.shouldInterrupt) {
      bot.pvp.stop()
      return false
    }
  }

  log(ctx, `Successfully killed ${entity.name}.`)
  return true
}

export async function defendSelf(ctx: SkillContext, range = 9): Promise<boolean> {
  const { bot } = ctx
  let attacked = false
  const worldCtx = world.createWorldContext(ctx.botCtx)
  let enemy = world.getNearestEntityWhere(worldCtx, entity => mc.isHostile(entity), range)

  while (enemy) {
    await equipHighestAttack(ctx)

    if (bot.entity.position.distanceTo(enemy.position) >= 4
      && enemy.name !== 'creeper' && enemy.name !== 'phantom') {
      try {
        const goal = new goals.GoalFollow(enemy, 3.5)
        await bot.pathfinder.goto(goal)
      }
      catch { /* might error if entity dies, ignore */ }
    }

    if (bot.entity.position.distanceTo(enemy.position) <= 2) {
      try {
        const followGoal = new goals.GoalFollow(enemy, 2)
        const invertedGoal = new goals.GoalInvert(followGoal)
        await bot.pathfinder.goto(invertedGoal)
      }
      catch { /* might error if entity dies, ignore */ }
    }

    bot.pvp.attack(enemy)
    attacked = true
    await new Promise(resolve => setTimeout(resolve, 500))
    enemy = world.getNearestEntityWhere(worldCtx, entity => mc.isHostile(entity), range)

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
