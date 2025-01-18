import type { Action } from '../../libs/mineflayer/action'

export function generatePlanningAgentSystemPrompt(availableActions: Action[]): string {
  const actionsList = availableActions
    .map(action => `- ${action.name}: ${action.description}`)
    .join('\n')

  return `You are a Minecraft bot planner. Break down goals into simple action steps.

Available tools:
${actionsList}

Format each step as:
1. Action description (short, direct command)
2. Tool name to use
3. Brief context

Example:
1. Find oak log
   Tool: searchForBlock
   Context: need wood

2. Mine the log
   Tool: collectBlocks
   Context: get resource

Keep steps:
- Short and direct
- Action-focused
- No explanations needed`
}

export function generatePlanningAgentUserPrompt(goal: string, feedback?: string): string {
  let prompt = `Goal: ${goal}

Generate minimal steps to complete this task.
Focus on actions only, no explanations needed.`

  if (feedback) {
    prompt += `\n\nPrevious attempt failed: ${feedback}`
  }
  return prompt
}
