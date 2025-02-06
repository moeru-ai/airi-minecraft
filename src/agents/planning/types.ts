import type { Neuri } from 'neuri'
import type { AgentConfig, Plan } from '../base-agent'

/**
 * Plan step interface
 */
export interface PlanStep {
  description: string
  tool: string
  params: Record<string, unknown>
}

/**
 * Plan context interface
 */
export interface PlanContext {
  goal: string
  currentStep: number
  startTime: number
  lastUpdate: number
  retryCount: number
  isGenerating: boolean
  pendingSteps: PlanStep[]
}

/**
 * Planning agent configuration
 */
export interface PlanningAgentConfig extends AgentConfig {
  llm: {
    agent: Neuri
    model?: string
  }
}

/**
 * Plan executor interface
 */
export interface PlanExecutor {
  executePlan: (plan: Plan) => Promise<void>
}

/**
 * Plan cache interface
 */
export interface PlanCache {
  get: (key: string) => Promise<Plan | null>
  set: (key: string, plan: Plan) => Promise<void>
}

/**
 * Plan adjuster interface
 */
export interface PlanAdjuster {
  adjustPlan: (plan: Plan, feedback: string, sender: string) => Promise<Plan>
}

/**
 * Plan generator interface
 */
export interface PlanGenerator {
  generatePlan: (goal: string, sender: string, feedback?: string) => Promise<PlanStep[]>
}
