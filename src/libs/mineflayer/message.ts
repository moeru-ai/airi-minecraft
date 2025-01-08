import type { Entity } from 'prismarine-entity'

// TODO: need to be refactored
interface ChatBotContext {
  fromUsername?: string
  fromEntity?: Entity
  fromMessage?: string

  isBot: () => boolean
  isCommand: () => boolean
}

export function newChatBotContext(entity: Entity, botUsername: string, username: string, message: string): ChatBotContext {
  return {
    fromUsername: username,
    fromEntity: entity,
    fromMessage: message,
    isBot: () => username === botUsername,
    isCommand: () => message.startsWith('#'),
  }
}

export function formBotChat(botUsername: string, cb: (username: string, message: string) => void) {
  return (username: string, message: string) => {
    if (botUsername === username)
      return

    cb(username, message)
  }
}
