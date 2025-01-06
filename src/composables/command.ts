import type { CommandContext } from '../middlewares/command'

export const commands = new Map<string, (ctx: CommandContext) => void>()

export function registerCommand(command: string, handler: (ctx: CommandContext) => void) {
  if (commands.has(command))
    throw new Error(`Command ${command} already registered`)

  commands.set(command, handler)
}
