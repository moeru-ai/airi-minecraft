import { BaseLLMHandler } from '../../libs/llm/base'

export class ActionLLMHandler extends BaseLLMHandler {
  public async handleAction(messages: any[]): Promise<string> {
    const result = await this.config.agent.handleStateless(messages, async (context) => {
      this.logger.log('Processing action...')
      const retryHandler = this.createRetryHandler(
        async ctx => (await this.handleCompletion(ctx, 'action', ctx.messages)).content,
      )
      return await retryHandler(context)
    })

    if (!result) {
      throw new Error('Failed to process action')
    }

    return result
  }
}
