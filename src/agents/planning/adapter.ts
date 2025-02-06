import type { Agent } from 'neuri'
import type { LLMConfig } from '../../libs/llm-agent/types'

import { agent } from 'neuri'
import { system, user } from 'neuri/openai'

import { config } from '../../composables/config'
import { BaseLLMHandler } from '../../libs/llm-agent/handler'

/**
 * Plan step interface
 */
export interface PlanStep {
  description: string
  tool: string
  params: Record<string, unknown>
}

/**
 * Plan generator interface
 */
export interface PlanGenerator {
  generatePlan: (goal: string, sender: string, feedback?: string) => Promise<PlanStep[]>
}

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
    const systemPrompt = this.generateSystemPrompt()
    const userPrompt = this.generateUserPrompt(goal, sender, feedback)
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

  private generateSystemPrompt(): string {
    return `You are a Minecraft bot planner. Your task is to analyze player goals and generate executable action steps.

IMPORTANT: ALL imperative sentences (commands) MUST generate action steps, such as:
- "follow me" -> use goToPlayer
- "come here" -> use goToPlayer
- "look at this" -> use goToPlayer
- "stop" -> use stop
- "wait" -> use stay
- "get some wood" -> use collectBlocks
- "make a pickaxe" -> use craftRecipe
- "show me your inventory" -> use inventory
- "what's around you" -> use nearbyBlocks
- "check your status" -> use stats

Only generate empty array [] for:
1. Questions and discussions:
   - "what is a creeper?"
   - "how do you craft a pickaxe?"
   - "do you like mining?"
   - "tell me about minecraft"

2. Social interactions:
   - Greetings ("hello", "hi")
   - Small talk ("how are you")
   - Thanks ("thank you", "thanks")
   - Emotions ("that's cool", "awesome")

Available tools:
- stats: Get bot status
- inventory: View inventory contents
- nearbyBlocks: Scan surrounding blocks
- craftable: List available recipes
- entities: Find nearby entities
- collectBlocks: Collect specified blocks
- craftRecipe: Craft items using recipe
- goToPlayer: Move to player location
- goToCoordinates: Move to specific coordinates
- attack: Attack hostile mobs
- attackPlayer: Attack specified player
- placeHere: Place blocks at current location
- equip: Equip items
- discard: Drop items
- putInChest: Store items in chest
- takeFromChest: Take items from chest
- consume: Use consumable items
- activate: Interact with blocks/items

Format each step as:
1. Action description (short, direct command)
2. Tool name
3. Required parameters

Example multi-step plan:
1. Collect oak logs
   Tool: collectBlocks
   Params:
     type: oak_log
     num: 4

2. Craft wooden planks
   Tool: craftRecipe
   Params:
     recipe_name: oak_planks
     num: 1

Keep your plan:
- Generate actions for ALL imperative sentences
- Return empty array [] ONLY for questions and social chat
- Make steps minimal and efficient
- Parameters must be exact and precise
- Generate all steps at once`
  }

  private generateUserPrompt(goal: string, sender: string, feedback?: string): string {
    let prompt = `${sender}: ${goal}

First determine if this request requires any game actions.
If not, return empty array [].
Otherwise, generate minimal steps with exact parameters.
Use the sender's name (${sender}) for player-related parameters.`

    if (feedback) {
      prompt += `\n\nPrevious attempt failed: ${feedback}`
    }
    return prompt
  }
}

/**
 * Create a new planning agent
 */
export async function createPlanningNeuriAgent(): Promise<Agent> {
  return agent('planning').build()
}
