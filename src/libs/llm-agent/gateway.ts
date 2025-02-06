import type { NeuriContext } from 'neuri'
import type { Message } from 'neuri/openai'
import type { z } from 'zod'
import type { LLMConfig, LLMGatewayInterface, LLMOptions, LLMResponse } from './types'

import { config } from '../../composables/config'
import { BaseLLMHandler } from './handler'

/**
 * Gateway for LLM operations, providing a unified interface for all LLM interactions
 * Handles retries, error handling, and response parsing
 */
export class LLMGateway extends BaseLLMHandler implements LLMGatewayInterface {
  constructor(config: LLMConfig) {
    super(config)
  }

  async execute<T = string>(
    messages: Message[],
    options?: LLMOptions,
  ): Promise<T> {
    const response = await this.handleCompletion(
      this.createContext(messages, options),
      options?.route ?? 'default',
      messages,
      options?.schema,
    )

    if (options?.schema) {
      return response as z.infer<typeof options.schema>
    }

    // Always return LLMResponse for non-schema responses
    return response as T
  }

  async generateText(
    prompt: string,
    options?: Omit<LLMOptions, 'schema'>,
  ): Promise<string> {
    const response = await this.execute<LLMResponse>([{ role: 'user', content: prompt }], options)
    return response.content
  }

  async generateStructured<T extends z.ZodTypeAny>(
    schema: T,
    prompt: string,
    options?: Omit<LLMOptions, 'schema'>,
  ): Promise<z.infer<T>> {
    return this.execute(
      [{ role: 'user', content: prompt }],
      { ...options, schema },
    )
  }

  async chat(options: { route: string, messages: Message[], temperature?: number }): Promise<LLMResponse> {
    return this.execute(options.messages, {
      route: options.route,
      temperature: options.temperature,
    })
  }

  private createContext(messages: Message[], _options?: LLMOptions): NeuriContext {
    return {
      messages,
      message: messages[messages.length - 1],
      reroute: async (route: string, messages: Message[], opts: any) => {
        // Use the agent from config to handle the request
        const completion = await this.config.agent.handleStateless(messages, async (ctx) => {
          this.logger.log('Rerouting request...')
          const retryHandler = this.createRetryHandler(async (context) => {
            const result = await context.reroute(route, messages, {
              model: opts?.model ?? this.config.model ?? config.openai.model,
              temperature: opts?.temperature,
              ...opts,
            })

            if (!result || 'error' in result) {
              throw new Error((result?.error as Error)?.message ?? 'Failed to get completion')
            }

            return result
          })
          return await retryHandler(ctx)
        })

        if (!completion) {
          throw new Error('Failed to get completion')
        }

        return completion
      },
    }
  }
}
