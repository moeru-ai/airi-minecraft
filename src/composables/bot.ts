import { Mineflayer, type MineflayerOptions } from '../libs/mineflayer'

let mineflayer: Mineflayer

export async function initBot(options: MineflayerOptions) {
  mineflayer = await Mineflayer.asyncBuild(options)
}

export function useBot() {
  return {
    bot: mineflayer,
  }
}
