import type { Neuri } from 'neuri'
import type { Action } from '../../libs/mineflayer/action'
import { useLogg } from '@guiiai/logg'
import { system, user } from 'neuri/openai'
import { genPlanningAgentPrompt } from '../../utils/prompt'
import { toRetriable } from '../../utils/reliability'

const logger = useLogg('planning-llm').useGlobalConfig()

interface LLMPlanningConfig {
  agent: Neuri
  model?: string
  retryLimit?: number
  delayInterval?: number
}

export async function generatePlanWithLLM(
  goal: string,
  availableActions: Action[],
  config: LLMPlanningConfig,
  feedback?: string,
): Promise<Array<{ action: string, params: unknown[] }>> {
  const systemPrompt = genPlanningAgentPrompt(availableActions)
  const userPrompt = generateUserPrompt(goal, feedback)

  const messages = [
    system(systemPrompt),
    user(userPrompt),
  ]

  const content = await config.agent.handleStateless(messages, async (c) => {
    logger.log('Generating plan...')

    const handleCompletion = async (c: any): Promise<string> => {
      const completion = await c.reroute('action', c.messages, {
        model: config.model ?? 'openai/gpt-4o-mini',
      })

      if (!completion || 'error' in completion) {
        logger.withFields(c).error('Completion failed')
        throw new Error(completion?.error?.message ?? 'Unknown error')
      }

      const content = await completion.firstContent()
      logger.withFields({ usage: completion.usage, content }).log('Plan generated')
      return content
    }

    const retirableHandler = toRetriable<any, string>(
      config.retryLimit ?? 3,
      config.delayInterval ?? 1000,
      handleCompletion,
    )

    return await retirableHandler(c)
  })

  if (!content) {
    throw new Error('Failed to generate plan')
  }

  return parsePlanContent(content)
}

function generateUserPrompt(goal: string, feedback?: string): string {
  let prompt = `Create a plan to: ${goal}`
  if (feedback) {
    prompt += `\nPrevious attempt feedback: ${feedback}`
  }
  return prompt
}

function parsePlanContent(content: string): Array<{ action: string, params: unknown[] }> {
  try {
    // Find JSON array in the content
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
    logger.withError(error).error('Failed to parse plan')
    throw error
  }
}
