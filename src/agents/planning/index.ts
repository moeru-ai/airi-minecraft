import type { ActionAgent, MemoryAgent, Plan, PlanningAgent } from '../base-agent'
import type { PlanningAgentConfig } from './types'

import { ActionAgentImpl } from '../action'
import { AbstractAgent } from '../base-agent'
import { ContextManager } from './core/context-manager'
import { LLMPlanGenerator } from './core/plan-generator'
import { PlanHandler } from './handlers/plan-handler'

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
 * Planning agent implementation
 */
export class PlanningAgentImpl extends AbstractAgent implements PlanningAgent {
  public readonly type = 'planning' as const

  private contextManager: ContextManager
  private planGenerator: LLMPlanGenerator
  private planHandler!: PlanHandler
  private actionAgent: ActionAgent | null = null
  private memoryAgent: MemoryAgent | null = null

  constructor(config: PlanningAgentConfig) {
    super(config)

    // Initialize components
    this.contextManager = new ContextManager(this.logger)
    this.planGenerator = new LLMPlanGenerator({
      agent: config.llm.agent,
      model: config.llm.model,
    })
  }

  protected async initializeAgent(): Promise<void> {
    this.logger.log('Initializing planning agent')

    // Create action agent directly
    this.actionAgent = new ActionAgentImpl({
      id: 'action',
      type: 'action',
    })
    await this.actionAgent.init()

    // Initialize plan handler
    this.planHandler = new PlanHandler(
      this.logger,
      this.planGenerator,
      this.contextManager,
      this.actionAgent,
    )

    // Set event listener
    this.on('message', async ({ sender, message }) => {
      await this.handleAgentMessage(sender, message)
    })

    this.on('interrupt', () => {
      this.handleInterrupt()
    })
  }

  protected async destroyAgent(): Promise<void> {
    await this.actionAgent?.destroy()
    this.actionAgent = null
    this.memoryAgent = null
    this.contextManager.clear()
    this.removeAllListeners()
  }

  public async createPlan(goal: string): Promise<Plan> {
    if (!this.initialized) {
      throw new Error('Planning agent not initialized')
    }

    return this.planHandler.createPlan(goal)
  }

  public async executePlan(plan: Plan): Promise<void> {
    if (!this.initialized) {
      throw new Error('Planning agent not initialized')
    }

    return this.planHandler.executePlan(plan)
  }

  public async adjustPlan(plan: Plan, feedback: string, sender: string): Promise<Plan> {
    if (!this.initialized) {
      throw new Error('Planning agent not initialized')
    }

    return this.planHandler.adjustPlan(plan, feedback, sender)
  }

  private async handleAgentMessage(sender: string, message: string): Promise<void> {
    if (sender === 'system') {
      if (message.includes('interrupt')) {
        this.handleInterrupt()
      }
    }
  }

  private handleInterrupt(): void {
    // Nothing to do here
  }
}

export * from './core/plan-generator'
export * from './handlers/plan-handler'
export * from './types'
