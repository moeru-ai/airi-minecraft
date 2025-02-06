import type { LLMConfig } from '../../../libs/llm-agent/types'
import type { PlanGenerator, PlanStep } from '../types'

import { system, user } from 'neuri/openai'

import { config } from '../../../composables/config'
import { BaseLLMHandler } from '../../../libs/llm-agent/handler'
import { generatePlanningAgentPrompt, generatePlanUserPrompt } from '../prompts'

/**
 * LLM-based plan generator implementation
 */
export class LLMPlanGenerator extends BaseLLMHandler implements PlanGenerator {
  constructor(llmConfig: LLMConfig) {
    super({
      ...llmConfig,
      model: config.openai.reasoningModel ?? llmConfig.model,
    })
  }

  public async generatePlan(
    goal: string,
    sender: string,
    feedback?: string,
  ): Promise<PlanStep[]> {
    const systemPrompt = generatePlanningAgentPrompt()
    const userPrompt = generatePlanUserPrompt(goal, sender, feedback)
    const messages = [system(systemPrompt), user(userPrompt)]

    const result = await this.config.agent.handleStateless(messages, async (context) => {
      this.logger.log('Generating plan...')
      const retryHandler = this.createRetryHandler(
        async (ctx) => {
          const completion = await this.handleCompletion(ctx, 'planning', ctx.messages)
          return completion.content
        },
      )
      return await retryHandler(context)
    })

    if (!result) {
      throw new Error('Failed to generate plan')
    }

    return this.parsePlanContent(result)
  }

  private parsePlanContent(content: string): PlanStep[] {
    // Handle empty array response
    if (content.trim() === '[]') {
      return []
    }

    // Split content into steps (numbered list)
    const steps = content.split(/\d+\./).filter(step => step.trim().length > 0)

    return steps.map((step) => {
      const lines = step.trim().split('\n')
      const description = lines[0].trim()

      // Extract tool name and parameters
      let tool = ''
      const params: Record<string, unknown> = {}

      for (const line of lines) {
        const trimmed = line.trim()

        // Extract tool name
        if (trimmed.startsWith('Tool:')) {
          tool = trimmed.split(':')[1].trim()
          continue
        }

        // Extract parameters
        if (trimmed === 'Params:') {
          let i = lines.indexOf(line) + 1
          while (i < lines.length) {
            const paramLine = lines[i].trim()
            if (paramLine === '')
              break

            const paramMatch = paramLine.match(/(\w+):\s*(.+)/)
            if (paramMatch) {
              const [, key, value] = paramMatch
              // Try to parse numbers and booleans
              if (value === 'true')
                params[key] = true
              else if (value === 'false')
                params[key] = false
              else if (/^\d+$/.test(value))
                params[key] = Number.parseInt(value)
              else if (/^\d*\.\d+$/.test(value))
                params[key] = Number.parseFloat(value)
              else params[key] = value.trim()
            }
            i++
          }
        }
      }

      return {
        description,
        tool,
        params,
      }
    })
  }
}
