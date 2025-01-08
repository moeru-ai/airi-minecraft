import { Mineflayer, type MineflayerOptions } from '../libs/mineflayer'

let mineflayer: Mineflayer

export function initBot(options: MineflayerOptions) {
  mineflayer = new Mineflayer(options)
}

export function useBot() {
  return {
    bot: mineflayer,
  }
}
