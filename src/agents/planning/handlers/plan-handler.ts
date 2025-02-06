import type { Logger } from '../../../utils/logger'
import type { ActionAgent, Plan } from '../../base-agent'
import type { ContextManager } from '../core/context-manager'
import type { LLMPlanGenerator } from '../core/plan-generator'

/**
 * Custom error types for Plan Handler
 */
export class PlanHandlerError extends Error {
  constructor(message: string) {
    super(`[PlanHandler] ${message}`)
  }
}

export class PlanExecutionError extends PlanHandlerError {
  constructor(message: string) {
    super(`Execution failed: ${message}`)
  }
}

export class PlanGenerationError extends PlanHandlerError {
  constructor(message: string) {
    super(`Generation failed: ${message}`)
  }
}

/**
 * Handles plan generation, execution and adjustment
 */
export class PlanHandler {
  constructor(
    private readonly logger: Logger,
    private readonly planGenerator: LLMPlanGenerator,
    private readonly contextManager: ContextManager,
    private readonly actionAgent: ActionAgent,
  ) {}

  /**
   * Create a new plan for a goal
   */
  public async createPlan(goal: string): Promise<Plan> {
    this.logger.withField('goal', goal).log('Creating plan')

    try {
      // Generate plan steps
      const steps = await this.planGenerator.generatePlan(goal, 'system')

      // If no steps are generated, return empty plan
      if (steps.length === 0) {
        this.logger.log('Goal does not require actions')
        return {
          goal,
          steps: [],
          status: 'completed',
          requiresAction: false,
        }
      }

      // Create new plan
      const plan: Plan = {
        goal,
        steps,
        status: 'pending',
        requiresAction: true,
      }

      return plan
    }
    catch (error) {
      this.logger.withError(error).error('Failed to create plan')
      throw new PlanGenerationError(error instanceof Error ? error.message : 'Unknown error')
    }
  }

  /**
   * Execute a plan
   */
  public async executePlan(plan: Plan): Promise<void> {
    if (!plan.requiresAction) {
      this.logger.log('Plan does not require actions, skipping execution')
      return
    }

    this.logger.withField('plan', plan).log('Executing plan')

    try {
      plan.status = 'in_progress'

      // Execute each step
      for (const step of plan.steps) {
        try {
          this.logger.withField('step', step).log('Executing step')
          await this.actionAgent.performAction(step)
        }
        catch (stepError) {
          this.logger.withError(stepError).error('Failed to execute step')
          plan.status = 'failed'
          throw new PlanExecutionError(stepError instanceof Error ? stepError.message : 'Unknown error')
        }
      }

      plan.status = 'completed'
    }
    catch (error) {
      this.logger.withError(error).error('Failed to execute plan')
      throw error
    }
  }

  /**
   * Adjust a plan based on feedback
   */
  public async adjustPlan(plan: Plan, feedback: string, sender: string): Promise<Plan> {
    this.logger.withFields({ plan, feedback }).log('Adjusting plan')

    try {
      // Get context for the plan
      const context = this.contextManager.getOrCreate(plan.goal)

      // Check if we can retry
      if (!this.contextManager.canRetry(context)) {
        throw new PlanHandlerError('Maximum retry attempts reached')
      }

      // Increment retry count
      this.contextManager.incrementRetry(context)

      // Generate new steps based on feedback
      const newSteps = await this.planGenerator.generatePlan(plan.goal, sender, feedback)

      // Create adjusted plan
      const adjustedPlan: Plan = {
        goal: plan.goal,
        steps: newSteps,
        status: 'pending',
        requiresAction: true,
      }

      // Update context with new plan
      this.contextManager.updateContext(context, adjustedPlan)

      return adjustedPlan
    }
    catch (error) {
      this.logger.withError(error).error('Failed to adjust plan')
      throw error
    }
  }
}
