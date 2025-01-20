import type { Action } from '../../libs/mineflayer/action'

export function generatePlanningAgentSystemPrompt(availableActions: Action[]): string {
  const actionsList = availableActions
    .map((action) => {
      const params = Object.keys(action.schema.shape)
        .map(name => `    - ${name}`)
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
1. Follow player
   Tool: followPlayer
   Params:
     player: luoling8192
     follow_dist: 3

Keep steps:
- Short and direct
- Action-focused
- Parameters precise
- Generate all steps at once`
}

export function generatePlanningAgentUserPrompt(goal: string, sender: string, feedback?: string): string {
  let prompt = `${sender}: ${goal}

Generate minimal steps with exact parameters.
Use the sender's name (${sender}) for player-related parameters.`

  if (feedback) {
    prompt += `\n\nPrevious attempt failed: ${feedback}`
  }
  return prompt
}
