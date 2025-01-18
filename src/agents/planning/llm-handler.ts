import type { Agent } from 'neuri'
import type { Action } from '../../libs/mineflayer/action'

import { agent } from 'neuri'
import { system, user } from 'neuri/openai'

import { BaseLLMHandler } from '../../libs/llm/base'
import { generatePlanningAgentSystemPrompt, generatePlanningAgentUserPrompt } from '../prompt/planning'

export async function createPlanningNeuriAgent(): Promise<Agent> {
  return agent('planning').build()
}

export interface PlanStep {
  description: string
  tool: string
  reasoning: string
}

export class PlanningLLMHandler extends BaseLLMHandler {
  public async generatePlan(
    goal: string,
    availableActions: Action[],
    feedback?: string,
  ): Promise<PlanStep[]> {
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

  private parsePlanContent(content: string): PlanStep[] {
    // Split content into steps (numbered list)
    const steps = content.split(/\d+\./).filter(step => step.trim().length > 0)

    return steps.map((step) => {
      const lines = step.trim().split('\n')
      const description = lines[0]

      // Extract tool name from the content (usually in single quotes)
      const toolMatch = step.match(/'([^']+)'/)
      const tool = toolMatch ? toolMatch[1] : ''

      // Everything else is considered reasoning
      const reasoning = lines.slice(1).join('\n').trim()

      return {
        description,
        tool,
        reasoning,
      }
    })
  }
}
