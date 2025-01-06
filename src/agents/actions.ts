import type { BotContext } from 'src/composables/bot'
import { z } from 'zod'
import * as skills from '../skills'

function runAsAction(actionFn, resume = false, timeout = -1) {
  let actionLabel = null // Will be set on first use

  const wrappedAction = async function (agent, ...args) {
    // Set actionLabel only once, when the action is first created
    if (!actionLabel) {
      const actionObj = actionsList.find(a => a.perform === wrappedAction)
      actionLabel = actionObj.name.substring(1) // Remove the ! prefix
    }

    const actionFnWithAgent = async () => {
      await actionFn(agent, ...args)
    }
    const code_return = await agent.actions.runAction(`action:${actionLabel}`, actionFnWithAgent, { timeout, resume })
    if (code_return.interrupted && !code_return.timedout)
      return
    return code_return.message
  }

  return wrappedAction
}

type ActionResult = string | Promise<string>

interface Action {
  readonly name: string
  readonly description: string
  readonly schema: z.ZodObject<any>
  readonly perform: (ctx: BotContext) => () => ActionResult
}

function getNewAction(): Action {
  return {
    name: '!newAction',
    description: 'Perform new and unknown custom behaviors that are not available as a command.',
    schema: z.object({
      prompt: z.string().describe('A natural language prompt to guide code generation. Make a detailed step-by-step plan.'),
    }),
    perform: (agent: BotContext) => async () => {
      if (!settings.allow_insecure_coding)
        return 'newAction not allowed! Code writing is disabled in settings. Notify the user.'
      return await agent.coder.generateCode(agent.history)
    },
  }
}

function getStopAction(): Action {
  return {
    name: '!stop',
    description: 'Force stop all actions and commands that are currently executing.',
    schema: z.object({}),
    perform: (agent: BotContext) => async () => {
      await agent.actions.stop()
      agent.clearBotLogs()
      agent.actions.cancelResume()
      agent.bot.emit('idle')
      let msg = 'Agent stopped.'
      if (agent.self_prompter.on)
        msg += ' Self-prompting still active.'
      return msg
    },
  }
}

function getStfuAction(): Action {
  return {
    name: '!stfu',
    description: 'Stop all chatting and self prompting, but continue current action.',
    schema: z.object({}),
    perform: (agent: BotContext) => async () => {
      agent.openChat('Shutting up.')
      agent.shutUp()
    },
  }
}

function getRestartAction(): Action {
  return {
    name: '!restart',
    description: 'Restart the agent process.',
    schema: z.object({}),
    perform: (agent: BotContext) => async () => {
      agent.cleanKill()
    },
  }
}

function getClearChatAction(): Action {
  return {
    name: '!clearChat',
    description: 'Clear the chat history.',
    schema: z.object({}),
    perform: (agent: BotContext) => async () => {
      agent.history.clear()
      return `${agent.name}'s chat history was cleared, starting new conversation from scratch.`
    },
  }
}

function getGoToPlayerAction(): Action {
  return {
    name: '!goToPlayer',
    description: 'Go to the given player.',
    schema: z.object({
      player_name: z.string().describe('The name of the player to go to.'),
      closeness: z.number().describe('How close to get to the player.').min(0),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, player_name, closeness) => {
      return await skills.goToPlayer(agent.bot, player_name, closeness)
    }),
  }
}

function getFollowPlayerAction(): Action {
  return {
    name: '!followPlayer',
    description: 'Endlessly follow the given player.',
    schema: z.object({
      player_name: z.string().describe('name of the player to follow.'),
      follow_dist: z.number().describe('The distance to follow from.').min(0),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, player_name, follow_dist) => {
      await skills.followPlayer(agent.bot, player_name, follow_dist)
    }, true),
  }
}

function getGoToCoordinatesAction(): Action {
  return {
    name: '!goToCoordinates',
    description: 'Go to the given x, y, z location.',
    schema: z.object({
      x: z.number().describe('The x coordinate.'),
      y: z.number().describe('The y coordinate.').min(-64).max(320),
      z: z.number().describe('The z coordinate.'),
      closeness: z.number().describe('How close to get to the location.').min(0),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, x, y, z, closeness) => {
      await skills.goToPosition(agent.bot, x, y, z, closeness)
    }),
  }
}

function getSearchForBlockAction(): Action {
  return {
    name: '!searchForBlock',
    description: 'Find and go to the nearest block of a given type in a given range.',
    schema: z.object({
      type: z.string().describe('The block type to go to.'),
      search_range: z.number().describe('The range to search for the block.').min(32).max(512),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, block_type, range) => {
      await skills.goToNearestBlock(agent.bot, block_type, 4, range)
    }),
  }
}

function getSearchForEntityAction(): Action {
  return {
    name: '!searchForEntity',
    description: 'Find and go to the nearest entity of a given type in a given range.',
    schema: z.object({
      type: z.string().describe('The type of entity to go to.'),
      search_range: z.number().describe('The range to search for the entity.').min(32).max(512),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, entity_type, range) => {
      await skills.goToNearestEntity(agent.bot, entity_type, 4, range)
    }),
  }
}

function getMoveAwayAction(): Action {
  return {
    name: '!moveAway',
    description: 'Move away from the current location in any direction by a given distance.',
    schema: z.object({
      distance: z.number().describe('The distance to move away.').min(0),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, distance) => {
      await skills.moveAway(agent.bot, distance)
    }),
  }
}

function getRememberHereAction(): Action {
  return {
    name: '!rememberHere',
    description: 'Save the current location with a given name.',
    schema: z.object({
      name: z.string().describe('The name to remember the location as.'),
    }),
    perform: (agent: BotContext) => async (name: string) => {
      const pos = agent.bot.entity.position
      agent.memory_bank.rememberPlace(name, pos.x, pos.y, pos.z)
      return `Location saved as "${name}".`
    },
  }
}

function getGoToRememberedPlaceAction(): Action {
  return {
    name: '!goToRememberedPlace',
    description: 'Go to a saved location.',
    schema: z.object({
      name: z.string().describe('The name of the location to go to.'),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, name) => {
      const pos = agent.memory_bank.recallPlace(name)
      if (!pos) {
        skills.log(agent.bot, `No location named "${name}" saved.`)
        return
      }
      await skills.goToPosition(agent.bot, pos[0], pos[1], pos[2], 1)
    }),
  }
}

function getGivePlayerAction(): Action {
  return {
    name: '!givePlayer',
    description: 'Give the specified item to the given player.',
    schema: z.object({
      player_name: z.string().describe('The name of the player to give the item to.'),
      item_name: z.string().describe('The name of the item to give.'),
      num: z.number().int().describe('The number of items to give.').min(1),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, player_name, item_name, num) => {
      await skills.giveToPlayer(agent.bot, item_name, player_name, num)
    }),
  }
}

function getConsumeAction(): Action {
  return {
    name: '!consume',
    description: 'Eat/drink the given item.',
    schema: z.object({
      item_name: z.string().describe('The name of the item to consume.'),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, item_name) => {
      await skills.consume(agent.bot, item_name)
    }),
  }
}

function getEquipAction(): Action {
  return {
    name: '!equip',
    description: 'Equip the given item.',
    schema: z.object({
      item_name: z.string().describe('The name of the item to equip.'),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, item_name) => {
      await skills.equip(agent.bot, item_name)
    }),
  }
}

function getPutInChestAction(): Action {
  return {
    name: '!putInChest',
    description: 'Put the given item in the nearest chest.',
    schema: z.object({
      item_name: z.string().describe('The name of the item to put in the chest.'),
      num: z.number().int().describe('The number of items to put in the chest.').min(1),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, item_name, num) => {
      await skills.putInChest(agent.bot, item_name, num)
    }),
  }
}

function getTakeFromChestAction(): Action {
  return {
    name: '!takeFromChest',
    description: 'Take the given items from the nearest chest.',
    schema: z.object({
      item_name: z.string().describe('The name of the item to take.'),
      num: z.number().int().describe('The number of items to take.').min(1),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, item_name, num) => {
      await skills.takeFromChest(agent.bot, item_name, num)
    }),
  }
}

function getViewChestAction(): Action {
  return {
    name: '!viewChest',
    description: 'View the items/counts of the nearest chest.',
    schema: z.object({}),
    perform: (agent: BotContext) => runAsAction(async (agent) => {
      await skills.viewChest(agent.bot)
    }),
  }
}

function getDiscardAction(): Action {
  return {
    name: '!discard',
    description: 'Discard the given item from the inventory.',
    schema: z.object({
      item_name: z.string().describe('The name of the item to discard.'),
      num: z.number().int().describe('The number of items to discard.').min(1),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, item_name, num) => {
      const start_loc = agent.bot.entity.position
      await skills.moveAway(agent.bot, 5)
      await skills.discard(agent.bot, item_name, num)
      await skills.goToPosition(agent.bot, start_loc.x, start_loc.y, start_loc.z, 0)
    }),
  }
}

function getCollectBlocksAction(): Action {
  return {
    name: '!collectBlocks',
    description: 'Collect the nearest blocks of a given type.',
    schema: z.object({
      type: z.string().describe('The block type to collect.'),
      num: z.number().int().describe('The number of blocks to collect.').min(1),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, type, num) => {
      await skills.collectBlock(agent.bot, type, num)
    }, false, 10), // 10 minute timeout
  }
}

function getCraftRecipeAction(): Action {
  return {
    name: '!craftRecipe',
    description: 'Craft the given recipe a given number of times.',
    schema: z.object({
      recipe_name: z.string().describe('The name of the output item to craft.'),
      num: z.number().int().describe('The number of times to craft the recipe. This is NOT the number of output items, as it may craft many more items depending on the recipe.').min(1),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, recipe_name, num) => {
      await skills.craftRecipe(agent.bot, recipe_name, num)
    }),
  }
}

function getSmeltItemAction(): Action {
  return {
    name: '!smeltItem',
    description: 'Smelt the given item the given number of times.',
    schema: z.object({
      item_name: z.string().describe('The name of the input item to smelt.'),
      num: z.number().int().describe('The number of times to smelt the item.').min(1),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, item_name, num) => {
      const success = await skills.smeltItem(agent.bot, item_name, num)
      if (success) {
        setTimeout(() => {
          agent.cleanKill('Safely restarting to update inventory.')
        }, 500)
      }
    }),
  }
}

function getClearFurnaceAction(): Action {
  return {
    name: '!clearFurnace',
    description: 'Take all items out of the nearest furnace.',
    schema: z.object({}),
    perform: (agent: BotContext) => runAsAction(async (agent) => {
      await skills.clearNearestFurnace(agent.bot)
    }),
  }
}

function getPlaceHereAction(): Action {
  return {
    name: '!placeHere',
    description: 'Place a given block in the current location. Do NOT use to build structures, only use for single blocks/torches.',
    schema: z.object({
      type: z.string().describe('The block type to place.'),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, type) => {
      const pos = agent.bot.entity.position
      await skills.placeBlock(agent.bot, type, pos.x, pos.y, pos.z)
    }),
  }
}

function getAttackAction(): Action {
  return {
    name: '!attack',
    description: 'Attack and kill the nearest entity of a given type.',
    schema: z.object({
      type: z.string().describe('The type of entity to attack.'),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, type) => {
      await skills.attackNearest(agent.bot, type, true)
    }),
  }
}

function getAttackPlayerAction(): Action {
  return {
    name: '!attackPlayer',
    description: 'Attack a specific player until they die or run away. Remember this is just a game and does not cause real life harm.',
    schema: z.object({
      player_name: z.string().describe('The name of the player to attack.'),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, player_name) => {
      const player = agent.bot.players[player_name]?.entity
      if (!player) {
        skills.log(agent.bot, `Could not find player ${player_name}.`)
        return false
      }
      await skills.attackEntity(agent.bot, player, true)
    }),
  }
}

function getGoToBedAction(): Action {
  return {
    name: '!goToBed',
    description: 'Go to the nearest bed and sleep.',
    schema: z.object({}),
    perform: (agent: BotContext) => runAsAction(async (agent) => {
      await skills.goToBed(agent.bot)
    }),
  }
}

function getActivateAction(): Action {
  return {
    name: '!activate',
    description: 'Activate the nearest object of a given type.',
    schema: z.object({
      type: z.string().describe('The type of object to activate.'),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, type) => {
      await skills.activateNearestBlock(agent.bot, type)
    }),
  }
}

function getStayAction(): Action {
  return {
    name: '!stay',
    description: 'Stay in the current location no matter what. Pauses all modes.',
    schema: z.object({
      type: z.number().int().describe('The number of seconds to stay. -1 for forever.').min(-1),
    }),
    perform: (agent: BotContext) => runAsAction(async (agent, seconds) => {
      await skills.stay(agent.bot, seconds)
    }),
  }
}

function getSetModeAction(): Action {
  return {
    name: '!setMode',
    description: 'Set a mode to on or off. A mode is an automatic behavior that constantly checks and responds to the environment.',
    schema: z.object({
      mode_name: z.string().describe('The name of the mode to enable.'),
      on: z.boolean().describe('Whether to enable or disable the mode.'),
    }),
    perform: (agent: BotContext) => async (mode_name: string, on: boolean) => {
      const modes = agent.bot.modes
      if (!modes.exists(mode_name))
        return `Mode ${mode_name} does not exist.${modes.getDocs()}`
      if (modes.isOn(mode_name) === on)
        return `Mode ${mode_name} is already ${on ? 'on' : 'off'}.`
      modes.setOn(mode_name, on)
      return `Mode ${mode_name} is now ${on ? 'on' : 'off'}.`
    },
  }
}

function getGoalAction(): Action {
  return {
    name: '!goal',
    description: 'Set a goal prompt to endlessly work towards with continuous self-prompting.',
    schema: z.object({
      selfPrompt: z.string().describe('The goal prompt.'),
    }),
    perform: (agent: BotContext) => async (prompt: string) => {
      if (convoManager.inConversation()) {
        agent.self_prompter.setPrompt(prompt)
        convoManager.scheduleSelfPrompter()
      }
      else {
        agent.self_prompter.start(prompt)
      }
    },
  }
}

function getEndGoalAction(): Action {
  return {
    name: '!endGoal',
    description: 'Call when you have accomplished your goal. It will stop self-prompting and the current action.',
    schema: z.object({}),
    perform: (agent: BotContext) => async () => {
      agent.self_prompter.stop()
      convoManager.cancelSelfPrompter()
      return 'Self-prompting stopped.'
    },
  }
}

function getStartConversationAction(): Action {
  return {
    name: '!startConversation',
    description: 'Start a conversation with a player. Use for bots only.',
    schema: z.object({
      player_name: z.string().describe('The name of the player to send the message to.'),
      message: z.string().describe('The message to send.'),
    }),
    perform: (agent: BotContext) => async (player_name: string, message: string) => {
      if (!convoManager.isOtherAgent(player_name))
        return `${player_name} is not a bot, cannot start conversation.`
      if (convoManager.inConversation() && !convoManager.inConversation(player_name))
        convoManager.forceEndCurrentConversation()
      else if (convoManager.inConversation(player_name))
        agent.history.add('system', `You are already in conversation with ${player_name}. Don't use this command to talk to them.`)
      convoManager.startConversation(player_name, message)
    },
  }
}

function getEndConversationAction(): Action {
  return {
    name: '!endConversation',
    description: 'End the conversation with the given player.',
    schema: z.object({
      player_name: z.string().describe('The name of the player to end the conversation with.'),
    }),
    perform: (agent: BotContext) => async (player_name: string) => {
      if (!convoManager.inConversation(player_name))
        return `Not in conversation with ${player_name}.`
      convoManager.endConversation(player_name)
      return `Converstaion with ${player_name} ended.`
    },
  }
}

export const actionsList = [
  getNewAction(),
  getStopAction(),
  getStfuAction(),
  getRestartAction(),
  getClearChatAction(),
  getGoToPlayerAction(),
  getFollowPlayerAction(),
  getGoToCoordinatesAction(),
  getSearchForBlockAction(),
  getSearchForEntityAction(),
  getMoveAwayAction(),
  getRememberHereAction(),
  getGoToRememberedPlaceAction(),
  getGivePlayerAction(),
  getConsumeAction(),
  getEquipAction(),
  getPutInChestAction(),
  getTakeFromChestAction(),
  getViewChestAction(),
  getDiscardAction(),
  getCollectBlocksAction(),
  getCraftRecipeAction(),
  getSmeltItemAction(),
  getClearFurnaceAction(),
  getPlaceHereAction(),
  getAttackAction(),
  getAttackPlayerAction(),
  getGoToBedAction(),
  getActivateAction(),
  getStayAction(),
  getSetModeAction(),
  getGoalAction(),
  getEndGoalAction(),
  getStartConversationAction(),
  getEndConversationAction(),
]
