import type { NeuriContext } from 'neuri'
import type { ChatCompletion, Message } from 'neuri/openai'
import type { LLMConfig, LLMResponse } from './types'

import { useLogg } from '@guiiai/logg'

import { openaiConfig } from '../../composables/config'
import { toRetriable } from '../../utils/helper'

export abstract class BaseLLMHandler {
  protected logger = useLogg('llm-handler').useGlobalConfig()

  constructor(protected config: LLMConfig) {}

  protected async handleCompletion(
    context: NeuriContext,
    route: string,
    messages: Message[],
  ): Promise<LLMResponse> {
    const completion = await context.reroute(route, messages, {
      model: this.config.model ?? openaiConfig.model,
    }) as ChatCompletion | ChatCompletion & { error: { message: string } }

    if (!completion || 'error' in completion) {
      this.logger.withFields(context).error('Completion failed')
      throw new Error(completion?.error?.message ?? 'Unknown error')
    }

    const content = await completion.firstContent()
    this.logger.withFields({ usage: completion.usage, content }).log('Generated content')

    return {
      content,
      usage: completion.usage,
    }
  }

  protected createRetryHandler<T>(handler: (context: NeuriContext) => Promise<T>) {
    return toRetriable<NeuriContext, T>(
      this.config.retryLimit ?? 3,
      this.config.delayInterval ?? 1000,
      handler,
    )
  }
}
