import type { Entity } from 'prismarine-entity'
import type { Context } from 'src/bot'

// TODO: need to be refactored
interface ChatContext {
  fromUsername?: string
  fromEntity?: Entity
  fromMessage?: string

  isBot: () => boolean
  isCommand: () => boolean
}

export function newChatContext(ctx: Context, username: string, message: string): ChatContext {
  return {
    fromUsername: username,
    fromEntity: ctx.bot.entity,
    fromMessage: message,
    isBot: () => username === ctx.bot.username,
    isCommand: () => message.startsWith('#'),
  }
}

export function formBotChat(ctx: Context, cb: (username: string, message: string) => void) {
  return (username: string, message: string) => {
    if (ctx.bot.username === username)
      return
    cb(username, message)
  }
}
