import type { Logger } from '../../../utils/logger'
import type { ChatContext, ChatHistory, ChatSessionStatus } from '../types'

import { assistant, user } from 'neuri/openai'

/**
 * Manages chat contexts and their lifecycle
 * Handles context creation, updates, and cleanup
 */
export class ContextManager {
  private contexts: Map<string, ChatContext> = new Map()

  constructor(
    private readonly logger: Logger,
    private readonly maxHistoryLength: number = 50,
    private readonly idleTimeout: number = 5 * 60 * 1000,
    private readonly idleThreshold: number = 2 * 60 * 1000,
  ) {}

  /**
   * Get or create a chat context for a player
   */
  public getOrCreate(player: string): ChatContext {
    let context = this.contexts.get(player)
    if (!context) {
      context = this.createContext(player)
      this.contexts.set(player, context)
    }
    return context
  }

  /**
   * Add a message to the context history
   */
  public addToHistory(context: ChatContext, sender: string, message: string): void {
    context.history.push({
      sender,
      message,
      timestamp: Date.now(),
    })

    if (context.history.length > this.maxHistoryLength) {
      context.history = context.history.slice(-this.maxHistoryLength)
    }
  }

  /**
   * Update context status based on idle time
   */
  public updateStatus(context: ChatContext): void {
    const now = Date.now()
    const idleTime = now - context.lastUpdate

    context.status = idleTime > this.idleTimeout
      ? 'ended'
      : idleTime > this.idleThreshold
        ? 'idle'
        : 'active'

    context.lastUpdate = now
  }

  /**
   * Check and handle idle contexts
   */
  public checkIdleContexts(): void {
    const now = Date.now()
    for (const [player, context] of this.contexts.entries()) {
      const idleTime = now - context.lastUpdate

      if (idleTime > this.idleTimeout) {
        this.logger.withField('player', player).log('Ending idle conversation')
        this.endContext(player)
      }
      else if (idleTime > this.idleThreshold && context.status === 'active') {
        context.status = 'idle'
        this.logger.withField('player', player).log('Conversation became idle')
      }
    }
  }

  /**
   * End and archive a chat context
   */
  public async endContext(player: string): Promise<void> {
    const context = this.contexts.get(player)
    if (context) {
      context.status = 'ended'
      await this.archiveContext(context)
      this.contexts.delete(player)
    }
  }

  /**
   * Get the status of a conversation
   */
  public getStatus(player: string): ChatSessionStatus {
    return this.contexts.get(player)?.status ?? 'ended'
  }

  /**
   * Format chat history for LLM input
   */
  public formatHistory(history: ChatHistory[], botId: string) {
    return history
      .slice(-this.maxHistoryLength)
      .map((entry) => {
        const content = `${entry.sender}: ${entry.message}`
        return entry.sender === botId
          ? assistant(content)
          : user(content)
      })
  }

  /**
   * Clear all contexts (used during cleanup)
   */
  public async clear(): Promise<void> {
    for (const [player] of this.contexts) {
      await this.endContext(player)
    }
    this.contexts.clear()
  }

  /**
   * Handle system interrupt by ending all active conversations
   */
  public async handleSystemInterrupt(): Promise<void> {
    for (const [player, context] of this.contexts.entries()) {
      if (context.status === 'active') {
        await this.endContext(player)
      }
    }
  }

  private createContext(player: string): ChatContext {
    return {
      player,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      history: [],
      status: 'active',
      metadata: {},
    }
  }

  private async archiveContext(context: ChatContext): Promise<void> {
    this.logger.withFields({
      player: context.player,
      messageCount: context.history.length,
      duration: Date.now() - context.startTime,
      status: context.status,
      metadata: context.metadata,
    }).log('Archiving chat history')
  }
}
