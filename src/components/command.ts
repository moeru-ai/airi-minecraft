import type { BotContext, ComponentLifecycle } from '@/composables/bot'
import { commands } from '@/composables/command'
import { formBotChat } from '@/middlewares/chat'
import { parseCommand } from '@/middlewares/command'
import { useLogg } from '@guiiai/logg'

const logger = useLogg('command').useGlobalConfig()

export function createCommandComponent(ctx: BotContext): ComponentLifecycle {
  const onChat = formBotChat(ctx, (sender, message) => {
    const { isCommand, command, args } = parseCommand(sender, message)

    if (!isCommand)
      return

    // Remove the # prefix from command
    const cleanCommand = command.slice(1)

    logger.withFields({ sender, command: cleanCommand, args }).log('Command received')

    const handler = commands.get(cleanCommand)
    if (handler) {
      handler({ sender, isCommand, command: cleanCommand, args })
      return
    }

    // Built-in commands
    switch (cleanCommand) {
      case 'help': {
        const commandList = Array.from(commands.keys()).concat(['help'])
        ctx.bot.chat(`Available commands: ${commandList.map(cmd => `#${cmd}`).join(', ')}`)
        break
      }
      default:
        ctx.bot.chat(`Unknown command: ${cleanCommand}`)
    }
  })

  ctx.bot.on('chat', onChat)

  return {
    cleanup: () => {
      ctx.bot.removeListener('chat', onChat)
    },
  }
}
