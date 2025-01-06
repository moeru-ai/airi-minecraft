export interface Agent {
  name: string
  history: {
    add: (name: string, message: string) => void
  }
  lastSender?: string
  isIdle: () => boolean
  handleMessage: (sender: string, message: string) => void
  openChat: (message: string) => void
  self_prompter: {
    on: boolean
    stop: () => Promise<void>
    stopLoop: () => Promise<void>
    start: () => Promise<void>
    promptShouldRespondToBot: (message: string) => Promise<boolean>
  }
  actions: {
    currentActionLabel: string
  }
  prompter: {
    promptShouldRespondToBot: (message: string) => Promise<boolean>
  }
  shut_up: boolean
  in_game: boolean
  cleanKill: (message: string) => void
  clearBotLogs: () => void
  bot: {
    interrupt_code: boolean
    output: string
    emit: (event: string) => void
  }
  coder: {
    generating: boolean
  }
  requestInterrupt: () => void
}
