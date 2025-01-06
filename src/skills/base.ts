import type { Bot } from 'mineflayer'

/**
 * Log a message to the bot's output
 */
export function log(bot: Bot, message: string): void {
  bot.chat(`${message}`)
}

/**
 * Type definition for a position in the world
 */
export interface Position {
  x: number
  y: number
  z: number
}

/**
 * Type definition for a block face direction
 */
export type BlockFace = 'top' | 'bottom' | 'north' | 'south' | 'east' | 'west' | 'side'
