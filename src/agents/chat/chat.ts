import type { Buffer } from 'node:buffer'
import type { MineflayerWithAgents } from '../../libs/llm-agent/types'
import type { ChatAgent } from '../base-agent'
import type { ChatAgentConfig, ChatMessageHandler, ChatSessionStatus } from './types'

import { useBot } from '../../composables/bot'
import { AbstractAgent } from '../base-agent'
import { ContextManager } from './core/context-manager'
import { MessageHandler } from './handlers/message-handler'
import { ConversationService } from './services/conversation-service'

/**
 * Custom error types for Chat Agent
 */
export class ChatAgentError extends Error {
  constructor(message: string) {
    super(`[ChatAgent] ${message}`)
  }
}

export class ChatNotInitializedError extends ChatAgentError {
  constructor() {
    super('Chat agent not initialized')
  }
}

export class ChatContextNotFoundError extends ChatAgentError {
  constructor(player: string) {
    super(`Chat context not found for player: ${player}`)
  }
}

/**
 * Implementation of the Chat Agent using a modular architecture
 */
export class ChatAgentImpl extends AbstractAgent implements ChatAgent, ChatMessageHandler {
  public readonly type = 'chat' as const

  private contextManager: ContextManager
  private messageHandler: MessageHandler
  private conversationService: ConversationService
  private bot: MineflayerWithAgents

  constructor(config: ChatAgentConfig) {
    super(config)
    this.bot = useBot().bot as MineflayerWithAgents

    // Initialize components
    this.contextManager = new ContextManager(
      this.logger,
      config.maxHistoryLength,
      config.idleTimeout,
      config.idleThreshold,
    )

    this.messageHandler = new MessageHandler(
      this.logger,
      config.llmHandler,
      this.contextManager,
      this.bot,
      this.id,
    )

    this.conversationService = new ConversationService(
      this.logger,
      this.contextManager,
    )
  }

  protected async initializeAgent(): Promise<void> {
    this.logger.log('Initializing chat agent')

    // Initialize conversation service
    await this.conversationService.init()

    // Set up message handling
    this.on('message', async ({ sender, message }) => {
      await this.messageHandler.handleAgentMessage(sender, message)
    })
  }

  protected async destroyAgent(): Promise<void> {
    await this.conversationService.destroy()
    this.removeAllListeners()
  }

  public async processMessage(message: string, sender: string): Promise<string> {
    return this.messageHandler.processMessage(message, sender)
  }

  public async handleMessage(message: string, sender: string): Promise<string> {
    return this.processMessage(message, sender)
  }

  public async handleVoiceInput(audio: Buffer): Promise<string> {
    return this.messageHandler.processVoiceInput(audio)
  }

  public startConversation(player: string): void {
    this.conversationService.startConversation(player)
  }

  public async endConversation(player: string): Promise<void> {
    await this.conversationService.endConversation(player)
  }

  public getConversationStatus(player: string): ChatSessionStatus {
    return this.conversationService.getStatus(player)
  }
}
