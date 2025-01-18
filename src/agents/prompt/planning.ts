import type { Action } from '../../libs/mineflayer/action'

export function generatePlanningAgentSystemPrompt(availableActions: Action[]): string {
  const actionsList = availableActions
    .map(action => `- ${action.name}: ${action.description}`)
    .join('\n')

  return `You are a Minecraft bot planner. Your task is to create a plan to achieve a given goal.
Available actions:
${actionsList}

Respond with a Valid JSON array of steps, where each step has:
- action: The name of the action to perform
- params: Array of parameters for the action

DO NOT contains any \`\`\` or explation, otherwise agent will be interrupted.

Example response:
[
  {
    "action": "searchForBlock",
    "params": ["log", 64]
  },
  {
    "action": "collectBlocks",
    "params": ["log", 1]
    }
  ]`
}

export function generatePlanningAgentUserPrompt(goal: string, feedback?: string): string {
  let prompt = `Create a detailed plan to: ${goal}

Consider the following aspects:
1. Required materials and their quantities
2. Required tools and their availability
3. Necessary crafting steps
4. Block placement requirements
5. Current inventory status

Please generate steps that handle these requirements in the correct order.`

  if (feedback) {
    prompt += `\nPrevious attempt feedback: ${feedback}`
  }
  return prompt
}
