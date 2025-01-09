import type { Action } from '../action'

export type AgentType = 'action' | 'memory' | 'planning' | 'chat'

export interface AgentConfig {
  id: string
  type: AgentType
}

export interface BaseAgent {
  readonly id: string
  readonly type: AgentType
  init: () => Promise<void>
  destroy: () => Promise<void>
}

export interface ActionAgent extends BaseAgent {
  type: 'action'
  performAction: (name: string, params: unknown[]) => Promise<string>
  getAvailableActions: () => Action[]
}

export interface MemoryAgent extends BaseAgent {
  type: 'memory'
  remember: (key: string, value: unknown) => void
  recall: <T>(key: string) => T | undefined
  forget: (key: string) => void
  getMemorySnapshot: () => Record<string, unknown>
}

export interface Plan {
  goal: string
  steps: Array<{
    action: string
    params: unknown[]
  }>
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  requiresAction: boolean
}

export interface PlanningAgent extends BaseAgent {
  type: 'planning'
  createPlan: (goal: string) => Promise<Plan>
  executePlan: (plan: Plan) => Promise<void>
  adjustPlan: (plan: Plan, feedback: string) => Promise<Plan>
}

export interface ChatAgent extends BaseAgent {
  type: 'chat'
  processMessage: (message: string, sender: string) => Promise<string>
  startConversation: (player: string) => void
  endConversation: (player: string) => void
}
