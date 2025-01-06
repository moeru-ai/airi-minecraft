import type { Entity } from 'prismarine-entity'
import type { BotContext } from '../composables/bot'

// TODO: need to be refactored
interface ChatBotContext {
  fromUsername?: string
  fromEntity?: Entity
  fromMessage?: string

  isBot: () => boolean
  isCommand: () => boolean
}

export function newChatBotContext(ctx: BotContext, username: string, message: string): ChatBotContext {
  return {
    fromUsername: username,
    fromEntity: ctx.bot.entity,
    fromMessage: message,
    isBot: () => username === ctx.bot.username,
    isCommand: () => message.startsWith('#'),
  }
}

export function formBotChat(ctx: BotContext, cb: (username: string, message: string) => void) {
  return (username: string, message: string) => {
    if (ctx.bot.username === username)
      return
    cb(username, message)
  }
}
