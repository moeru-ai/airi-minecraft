import type { LLMConfig, LLMResponse } from './types'

import { useLogg } from '@guiiai/logg'

import { toRetriable } from '../../utils/reliability'

export abstract class BaseLLMHandler {
  protected logger = useLogg('llm-handler').useGlobalConfig()

  constructor(protected config: LLMConfig) {}

  protected async handleCompletion(
    context: any,
    route: string,
    messages: any[],
  ): Promise<LLMResponse> {
    const completion = await context.reroute(route, messages, {
      model: this.config.model ?? 'openai/gpt-4-mini',
    })

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

  protected createRetryHandler<T>(handler: (context: any) => Promise<T>) {
    return toRetriable<any, T>(
      this.config.retryLimit ?? 3,
      this.config.delayInterval ?? 1000,
      handler,
    )
  }
}
