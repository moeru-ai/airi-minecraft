import type { Buffer } from 'node:buffer'
import type { Plan } from '../../../agents/base-agent'
import type { LLMGatewayInterface, MineflayerWithAgents } from '../../../libs/llm-agent/types'
import type { Logger } from '../../../utils/logger'
import type { ContextManager } from '../core/context-manager'
import type { ChatContext, ChatOptions } from '../types'

import { system, user } from 'neuri/openai'

import { generateChatAgentPrompt } from '../prompts'

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

      // Try to create a plan for the message
      const plan = await this.bot.planning.createPlan(message)

      // If plan has valid steps (not empty array), execute them
      if (plan.steps && plan.steps.length > 0 && plan.steps[0].tool) {
        return await this.handleActionRequest(message, context, plan)
      }

      // If no actions needed or empty plan, generate a conversational response
      const response = await this.generateResponse(message, context, {
        route: 'chat',
        temperature: 0.7,
      })
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
   * Handle action request
   */
  private async handleActionRequest(message: string, context: ChatContext, plan: Plan): Promise<string> {
    try {
      // Skip if plan has no valid steps
      if (!plan.steps || plan.steps.length === 0 || !plan.steps[0].tool) {
        return await this.generateResponse(message, context, {
          route: 'chat',
          temperature: 0.7,
        })
      }

      // Replace 'system' with actual player name in plan steps
      plan.steps = plan.steps.map((step) => {
        if (step.params && 'player_name' in step.params) {
          step.params.player_name = context.player
        }
        return step
      })

      // Execute the plan using Action Agent
      const results = []
      for (const step of plan.steps) {
        this.logger.withFields({ step }).log('Executing action step')
        const result = await this.bot.action.performAction(step)
        this.logger.withFields({ step, result }).log('Action step result')
        results.push(result)
      }

      // Record the action to memory
      this.bot.memory.addAction({
        type: 'plan',
        name: message,
        data: {
          plan,
          results,
          context: {
            player: context.player,
            sessionId: context.startTime.toString(),
          },
        },
        timestamp: Date.now(),
      })

      // Generate a response based on the executed plan and results
      this.logger.withFields({ plan, results }).log('Generating response for action results')
      const response = await this.generateResponse(message, context, {
        route: 'chat',
        temperature: 0.7,
        metadata: { plan, results },
      })

      this.contextManager.addToHistory(context, this.botId, response)
      await this.sendResponse(response)

      return response
    }
    catch (error) {
      this.logger.withError(error).error('Failed to execute action')
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
      const context = this.contextManager.getOrCreate('voice')

      context.status = 'active'
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

    const response = await this.llmHandler.chat({
      route: options?.route ?? 'chat',
      messages,
      temperature: options?.temperature,
    })

    return response.content
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
