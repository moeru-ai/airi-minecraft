import type { Agent } from 'neuri'
import type { ChatHistory } from './types'

import { agent } from 'neuri'
import { system, user } from 'neuri/openai'

import { BaseLLMHandler } from '../../libs/llm-agent/handler'

/**
 * Creates a new Neuri agent for chat functionality
 */
export async function createChatNeuriAgent(): Promise<Agent> {
  return agent('chat').build()
}

/**
 * Generates the system prompt for the chat agent
 */
export function generateChatAgentPrompt(): string {
  return `You are an AI assistant in a Minecraft world. Your role is to:
1. Engage in natural conversations with players
2. Provide helpful information about the game
3. Assist with tasks and answer questions
4. Maintain context and remember previous interactions
5. Be friendly and supportive while staying in character

Please follow these guidelines:
- Keep responses concise and relevant
- Use appropriate Minecraft terminology
- Be helpful but don't give away too much (preserve game challenge)
- Maintain a consistent personality
- Remember the context of the conversation

Current capabilities:
- Chat with players
- Remember conversation history
- Process commands and requests
- Provide game-related information
- Assist with basic tasks

Limitations:
- Cannot directly modify the game world
- Cannot access player inventory directly
- Must rely on player reports for game state
- Cannot perform actions without player permission

Please respond naturally to continue the conversation.`
}

export class ChatLLMHandler extends BaseLLMHandler {
  public async generateResponse(
    message: string,
    history: ChatHistory[],
  ): Promise<string> {
    const systemPrompt = generateChatAgentPrompt()
    const chatHistory = this.formatChatHistory(history, this.config.maxContextLength ?? 10)
    const messages = [
      system(systemPrompt),
      ...chatHistory,
      user(message),
    ]

    const result = await this.config.agent.handleStateless(messages, async (context) => {
      this.logger.log('Generating response...')
      const retryHandler = this.createRetryHandler(
        async ctx => (await this.handleCompletion(ctx, 'chat', ctx.messages)).content,
      )
      return await retryHandler(context)
    })

    if (!result) {
      throw new Error('Failed to generate response')
    }

    return result
  }

  private formatChatHistory(
    history: ChatHistory[],
    maxLength: number,
  ): Array<{ role: 'user' | 'assistant', content: string }> {
    const recentHistory = history.slice(-maxLength)
    return recentHistory.map(entry => ({
      role: entry.sender === 'bot' ? 'assistant' : 'user',
      content: entry.message,
    }))
  }
}
