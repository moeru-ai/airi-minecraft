import type { NeuriContext } from 'neuri'
import type { ChatCompletion, Message } from 'neuri/openai'
import type { LLMConfig, LLMResponse } from './types'

import { z } from 'zod'

import { config } from '../../composables/config'
import { toRetriable } from '../../utils/helper'
import { type Logger, useLogger } from '../../utils/logger'

/**
 * Base handler for LLM operations
 * Provides common functionality for handling completions and retries
 */
export abstract class BaseLLMHandler {
  protected logger: Logger

  constructor(protected config: LLMConfig) {
    this.logger = useLogger()
  }

  protected async handleCompletion<T extends z.ZodTypeAny>(
    context: NeuriContext,
    route: string,
    messages: Message[],
    schema?: T,
  ): Promise<z.infer<T> | LLMResponse> {
    this.logger.withFields({ route, messages }).log('Handling completion request')

    const completion = await context.reroute(route, messages, {
      model: this.config.model ?? config.openai.model,
    }) as ChatCompletion | ChatCompletion & { error: { message: string } }

    if (!completion || 'error' in completion) {
      this.logger.withFields(context).error('Completion failed')
      throw new LLMError(completion?.error?.message ?? 'Unknown error')
    }

    const content = await completion.firstContent()
    this.logger.withFields({ usage: completion.usage, content }).log('Generated content')

    if (schema) {
      try {
        // Special handling for boolean schema
        if (schema instanceof z.ZodBoolean) {
          const boolValue = content.toLowerCase().includes('true')
          return boolValue as z.infer<T>
        }

        // Normal JSON parsing for other schemas
        const parsed = schema.safeParse(JSON.parse(content))
        if (!parsed.success) {
          throw new LLMValidationError('Invalid response format', parsed.error)
        }
        return parsed.data
      }
      catch (error) {
        if (error instanceof LLMValidationError) {
          throw error
        }
        throw new LLMValidationError('Failed to parse response', error as z.ZodError)
      }
    }

    return { content, usage: completion.usage }
  }

  protected createRetryHandler<T>(handler: (context: NeuriContext) => Promise<T>) {
    return toRetriable<NeuriContext, T>(
      this.config.retryLimit ?? 3,
      this.config.delayInterval ?? 1000,
      handler,
      {
        onError: (err: unknown) => {
          if (err instanceof Error && err instanceof LLMError && err.message.includes('invalid request')) {
            throw err
          }
          this.logger.withError(err).error('Retrying after error')
        },
      },
    )
  }
}

class LLMError extends Error {
  constructor(message: string) {
    super(`[LLM] ${message}`)
  }
}

class LLMValidationError extends LLMError {
  constructor(message: string, public zodError: z.ZodError) {
    super(`${message}: ${zodError}`)
  }
}
