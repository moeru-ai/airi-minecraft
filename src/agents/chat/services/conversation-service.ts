import type { Logger } from '../../../utils/logger'
import type { ContextManager } from '../core/context-manager'
import type { ChatSessionStatus } from '../types'

/**
 * Custom error types for Conversation Service
 */
export class ConversationError extends Error {
  constructor(message: string) {
    super(`[Conversation] ${message}`)
  }
}

export class ConversationNotInitializedError extends ConversationError {
  constructor() {
    super('Conversation service not initialized')
  }
}

export class ConversationNotFoundError extends ConversationError {
  constructor(player: string) {
    super(`Conversation not found for player: ${player}`)
  }
}

/**
 * Manages conversation lifecycle and state transitions
 */
export class ConversationService {
  private initialized = false

  constructor(
    private readonly logger: Logger,
    private readonly contextManager: ContextManager,
  ) {}

  /**
   * Initialize the conversation service
   */
  public async init(): Promise<void> {
    this.logger.log('Initializing conversation service')

    // Start idle check interval
    setInterval(() => {
      this.contextManager.checkIdleContexts()
    }, 60 * 1000)

    this.initialized = true
  }

  /**
   * Clean up the conversation service
   */
  public async destroy(): Promise<void> {
    this.logger.log('Destroying conversation service')
    await this.contextManager.clear()
    this.initialized = false
  }

  /**
   * Start a new conversation or resume an existing one
   */
  public startConversation(player: string): void {
    this.checkInitialized()
    this.logger.withField('player', player).log('Starting conversation')

    const context = this.contextManager.getOrCreate(player)
    context.startTime = Date.now()
    context.lastUpdate = Date.now()
    context.status = 'active'
  }

  /**
   * End an active conversation
   */
  public async endConversation(player: string): Promise<void> {
    this.checkInitialized()
    this.logger.withField('player', player).log('Ending conversation')
    await this.contextManager.endContext(player)
  }

  /**
   * Get the current status of a conversation
   */
  public getStatus(player: string): ChatSessionStatus {
    this.checkInitialized()
    return this.contextManager.getStatus(player)
  }

  private checkInitialized(): void {
    if (!this.initialized) {
      throw new ConversationNotInitializedError()
    }
  }
}
