import type { Action } from '../../libs/mineflayer/action'

export function generatePlanningAgentSystemPrompt(availableActions: Action[]): string {
  const actionsList = availableActions
    .map((action) => {
      const params = Object.entries(action.schema.shape as Record<string, any>)
        .map(([name, type]) => `    - ${name}: ${type._def.typeName}`)
        .join('\n')
      return `- ${action.name}: ${action.description}\n  Parameters:\n${params}`
    })
    .join('\n\n')

  return `You are a Minecraft bot planner. Break down goals into simple action steps.

Available tools:
${actionsList}

Format each step as:
1. Action description (short, direct command)
2. Tool name
3. Required parameters

Example:
1. Find oak log
   Tool: searchForBlock
   Params:
     blockType: oak_log
     range: 64

2. Mine the log
   Tool: collectBlocks
   Params:
     blockType: oak_log
     count: 1

Keep steps:
- Short and direct
- Action-focused
- Parameters precise`
}

export function generatePlanningAgentUserPrompt(goal: string, feedback?: string): string {
  let prompt = `Goal: ${goal}

Generate minimal steps with exact parameters.`

  if (feedback) {
    prompt += `\n\nPrevious attempt failed: ${feedback}`
  }
  return prompt
}
