import type { Buffer } from 'node:buffer'
import type { LLMGatewayInterface, MineflayerWithAgents } from '../../../libs/llm-agent/types'
import type { Logger } from '../../../utils/logger'
import type { ContextManager } from '../core/context-manager'
import type { ChatContext, ChatOptions } from '../types'

import { system, user } from 'neuri/openai'

import { generateStatusPrompt } from '../../../libs/llm-agent/prompt'
import { generateChatAgentPrompt } from '../adapter'

/**
 * Handles all message processing logic for the chat agent
 */
export class MessageHandler {
  constructor(
    private readonly logger: Logger,
    private readonly llmHandler: LLMGatewayInterface,
    private readonly contextManager: ContextManager,
    private readonly bot: MineflayerWithAgents,
    private readonly botId: string,
  ) {}

  /**
   * Process a text message from a player
   */
  public async processMessage(message: string, sender: string): Promise<string> {
    this.logger.withFields({ sender, message }).log('Processing message')

    try {
      const context = this.contextManager.getOrCreate(sender)
      this.contextManager.addToHistory(context, sender, message)
      this.contextManager.updateStatus(context)

      const response = await this.generateResponse(message, context)
      this.contextManager.addToHistory(context, this.botId, response)
      await this.sendResponse(response)

      return response
    }
    catch (error) {
      this.logger.withError(error).error('Failed to process message')
      const errorMessage = this.formatErrorMessage(error, 'Failed to process message')
      await this.sendErrorResponse(errorMessage)
      throw error
    }
  }

  /**
   * Process a voice input
   */
  public async processVoiceInput(_audio: Buffer): Promise<string> {
    this.logger.log('Processing voice input')

    try {
      // TODO: Implement voice transcription
      const transcription = 'Voice transcription not implemented'
      const statusPrompt = await generateStatusPrompt(this.bot)
      const context = this.contextManager.getOrCreate('voice')

      context.status = 'active'
      this.contextManager.addToHistory(context, 'system', statusPrompt)
      this.contextManager.addToHistory(context, 'voice', transcription)

      const response = await this.generateResponse(transcription, context, {
        route: 'voice',
        temperature: 0.7,
      })

      this.contextManager.addToHistory(context, this.botId, response)
      await this.sendResponse(response)

      return response
    }
    catch (error) {
      this.logger.withError(error).error('Failed to process voice input')
      const errorMessage = this.formatErrorMessage(error, 'Failed to process voice input')
      await this.sendErrorResponse(errorMessage)
      throw error
    }
  }

  /**
   * Process a message from another agent
   */
  public async handleAgentMessage(sender: string, message: string): Promise<void> {
    if (sender === 'system' && message.includes('interrupt')) {
      await this.contextManager.handleSystemInterrupt()
      return
    }

    // Handle messages from other agents
    const context = this.contextManager.getOrCreate(sender)
    if (context.status === 'active') {
      await this.processMessage(message, sender)
    }
  }

  private async generateResponse(message: string, context: ChatContext, options?: ChatOptions): Promise<string> {
    const systemPrompt = generateChatAgentPrompt()
    const messages = [
      system(systemPrompt),
      ...this.contextManager.formatHistory(context.history, this.botId),
      user(message),
    ]

    return await this.llmHandler.execute(messages, {
      route: options?.route ?? 'chat',
      temperature: options?.temperature,
      metadata: {
        ...options?.metadata,
        sessionStatus: context.status,
        sessionDuration: Date.now() - context.startTime,
      },
    })
  }

  private async sendResponse(response: string): Promise<void> {
    this.bot.bot.chat(response)
  }

  private async sendErrorResponse(message: string): Promise<void> {
    this.bot.bot.chat(`Sorry, I encountered an error: ${message}`)
  }

  private formatErrorMessage(error: unknown, defaultMessage: string): string {
    if (error instanceof Error) {
      return error.message
    }
    return defaultMessage
  }
}
