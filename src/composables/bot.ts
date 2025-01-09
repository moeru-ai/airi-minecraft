import { Mineflayer, type MineflayerOptions } from '../libs/mineflayer'

let mineflayer: Mineflayer

export async function initBot(options: MineflayerOptions): Promise<{ bot: Mineflayer }> {
  mineflayer = await Mineflayer.asyncBuild(options)
  return { bot: mineflayer }
}

export function useBot() {
  if (!mineflayer) {
    throw new Error('Bot not initialized')
  }

  return {
    bot: mineflayer,
  }
}
