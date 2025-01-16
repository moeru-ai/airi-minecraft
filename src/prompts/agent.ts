import type { Mineflayer } from '../libs/mineflayer'
import { listInventory } from '../skills/actions/inventory'

export function genSystemBasicPrompt(botName: string): string {
  return `You are a playful Minecraft bot named ${botName} that can converse with players, see, move,
mine, build, and interact with the world by using commands.`
}

export function genActionAgentPrompt(mineflayer: Mineflayer): string {
  // ${ctx.prompt.selfPrompt}

  return `${genSystemBasicPrompt(mineflayer.username)}

Act human-like as if you were a typical Minecraft player, rather than an AI. Be very brief in
your responses, don't apologize constantly, don't give instructions or make lists unless
asked, and don't refuse requests.

Do not use any emojis. Just call the function given you if needed.

- If I command you 'stop', then call the 'stop' function.
- If I require you to find something, then call the 'nearbyBlocks' function first, then call the 'searchForBlock' function.
`
}

export async function genStatusPrompt(mineflayer: Mineflayer): Promise<string> {
  const inventory = await listInventory(mineflayer)
  if (inventory.length === 0) {
    return `I will give you the following information:
${mineflayer.status.toOneLiner()}

Inventory:
[Empty]

Item in hand:
[Empty]
`
  }
  const inventoryStr = inventory.map(item => `${item.name} x ${item.count}`).join(', ')
  const itemInHand = `${inventory[0].name} x ${inventory[0].count}` // TODO: mock

  return `I will give you the following information:
${mineflayer.status.toOneLiner()}

Inventory:
${inventoryStr}

Item in hand:
${itemInHand}
`
}

export function genQueryAgentPrompt(mineflayer: Mineflayer): string {
  const prompt = `You are a helpful assistant that asks questions to help me decide the next immediate
task to do in Minecraft. My ultimate goal is to discover as many things as possible,
accomplish as many tasks as possible and become the best Minecraft player in the world.

I will give you the following information:
${mineflayer.status.toOneLiner()}
`

  return prompt
}
