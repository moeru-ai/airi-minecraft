import type { Agent } from 'neuri'
import type { Action } from '../../libs/mineflayer/action'

import { agent } from 'neuri'
import { system, user } from 'neuri/openai'

import { BaseLLMHandler } from '../../libs/llm/base'
import { generatePlanningAgentSystemPrompt, generatePlanningAgentUserPrompt } from '../prompt/planning'

export async function createPlanningNeuriAgent(): Promise<Agent> {
  return agent('planning').build()
}

export class PlanningLLMHandler extends BaseLLMHandler {
  public async generatePlan(
    goal: string,
    availableActions: Action[],
    feedback?: string,
  ): Promise<Array<{ action: string, params: unknown[] }>> {
    const systemPrompt = generatePlanningAgentSystemPrompt(availableActions)
    const userPrompt = generatePlanningAgentUserPrompt(goal, feedback)
    const messages = [system(systemPrompt), user(userPrompt)]

    const result = await this.config.agent.handleStateless(messages, async (context) => {
      this.logger.log('Generating plan...')
      const retryHandler = this.createRetryHandler(
        async ctx => (await this.handleCompletion(ctx, 'planning', ctx.messages)).content,
      )
      return await retryHandler(context)
    })

    if (!result) {
      throw new Error('Failed to generate plan')
    }

    return this.parsePlanContent(result)
  }

  private parsePlanContent(content: string): Array<{ action: string, params: unknown[] }> {
    try {
      const match = content.match(/\[[\s\S]*\]/)
      if (!match) {
        throw new Error('No plan found in response')
      }

      const plan = JSON.parse(match[0])
      if (!Array.isArray(plan)) {
        throw new TypeError('Invalid plan format')
      }

      return plan.map(step => ({
        action: step.action,
        params: step.params,
      }))
    }
    catch (error) {
      this.logger.withError(error).error('Failed to parse plan')
      throw error
    }
  }
}
