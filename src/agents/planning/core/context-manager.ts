import type { Logger } from '../../../utils/logger'
import type { Plan } from '../../base-agent'
import type { PlanContext } from '../types'

/**
 * Manages plan contexts and their lifecycle
 */
export class ContextManager {
  private contexts: Map<string, PlanContext> = new Map()

  constructor(
    private readonly logger: Logger,
    private readonly maxRetries: number = 3,
  ) {}

  /**
   * Get or create a plan context
   */
  public getOrCreate(goal: string): PlanContext {
    let context = this.contexts.get(goal)
    if (!context) {
      context = this.createContext(goal)
      this.contexts.set(goal, context)
    }
    return context
  }

  /**
   * Update context for a plan
   */
  public updateContext(context: PlanContext, plan: Plan): void {
    context.lastUpdate = Date.now()
    context.currentStep = 0
    context.pendingSteps = plan.steps
  }

  /**
   * Check if retry is allowed for a context
   */
  public canRetry(context: PlanContext): boolean {
    return context.retryCount < this.maxRetries
  }

  /**
   * Increment retry count for a context
   */
  public incrementRetry(context: PlanContext): void {
    context.retryCount++
  }

  /**
   * End and clean up a context
   */
  public endContext(goal: string): void {
    this.contexts.delete(goal)
  }

  /**
   * Clear all contexts
   */
  public clear(): void {
    this.contexts.clear()
  }

  private createContext(goal: string): PlanContext {
    return {
      goal,
      currentStep: 0,
      startTime: Date.now(),
      lastUpdate: Date.now(),
      retryCount: 0,
      isGenerating: false,
      pendingSteps: [],
    }
  }
}
