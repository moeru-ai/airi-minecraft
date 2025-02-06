import type { ChatHistory } from './types'

import { system, user } from 'neuri/openai'

import { BaseLLMHandler } from '../../libs/llm-agent/handler'
import { genChatAgentPrompt } from '../prompt/chat'

export class ChatLLMHandler extends BaseLLMHandler {
  public async generateResponse(
    message: string,
    history: ChatHistory[],
  ): Promise<string> {
    const systemPrompt = genChatAgentPrompt()
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
