export interface BotInternalEventHandlers {
  'time:sunrise': () => void
  'time:noon': () => void
  'time:sunset': () => void
  'time:midnight': () => void
}

export type BotInternalEvents = keyof BotInternalEventHandlers
export type BotInternalEventsHandler<K extends BotInternalEvents> = BotInternalEventHandlers[K]
