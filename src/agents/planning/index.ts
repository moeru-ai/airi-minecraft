import type { Neuri } from 'neuri'
import type { Action } from '../../libs/mineflayer/action'
import type { ActionAgent, AgentConfig, MemoryAgent, Plan, PlanningAgent } from '../../libs/mineflayer/interfaces/agents'
import { AgentRegistry } from '../../libs/mineflayer/core/agent-factory'
import { AbstractAgent } from '../../libs/mineflayer/core/base-agent'
import { generatePlanWithLLM } from './llm'

interface PlanContext {
  goal: string
  currentStep: number
  startTime: number
  lastUpdate: number
  retryCount: number
}

interface PlanTemplate {
  goal: string
  conditions: string[]
  steps: Array<{
    action: string
    params: unknown[]
  }>
  requiresAction: boolean
}

export interface PlanningAgentConfig extends AgentConfig {
  llm: {
    agent: Neuri
    model?: string
  }
}

export class PlanningAgentImpl extends AbstractAgent implements PlanningAgent {
  public readonly type = 'planning' as const
  private currentPlan: Plan | null = null
  private context: PlanContext | null = null
  private actionAgent: ActionAgent | null = null
  private memoryAgent: MemoryAgent | null = null
  private planTemplates: Map<string, PlanTemplate>
  private llmConfig: PlanningAgentConfig['llm']

  constructor(config: PlanningAgentConfig) {
    super(config)
    this.planTemplates = new Map()
    this.llmConfig = config.llm
    this.initializePlanTemplates()
  }

  protected async initializeAgent(): Promise<void> {
    this.logger.log('Initializing planning agent')

    // Get agent references
    const registry = AgentRegistry.getInstance()
    this.actionAgent = registry.get<ActionAgent>('action-agent', 'action')
    this.memoryAgent = registry.get<MemoryAgent>('memory-agent', 'memory')

    // Set up event listeners
    this.on('message', async ({ sender, message }) => {
      await this.handleAgentMessage(sender, message)
    })

    this.on('interrupt', () => {
      this.handleInterrupt()
    })
  }

  protected async destroyAgent(): Promise<void> {
    this.currentPlan = null
    this.context = null
    this.actionAgent = null
    this.memoryAgent = null
    this.planTemplates.clear()
    this.removeAllListeners()
  }

  public async createPlan(goal: string): Promise<Plan> {
    if (!this.initialized) {
      throw new Error('Planning agent not initialized')
    }

    this.logger.withField('goal', goal).log('Creating plan')

    try {
      // Check memory for existing plan
      const cachedPlan = await this.loadCachedPlan(goal)
      if (cachedPlan) {
        this.logger.log('Using cached plan')
        return cachedPlan
      }

      // Get available actions from action agent
      const availableActions = this.actionAgent?.getAvailableActions() ?? []

      // Check if the goal requires actions
      const requirements = this.parseGoalRequirements(goal)
      const requiresAction = this.doesGoalRequireAction(requirements)

      // If no actions needed, return empty plan
      if (!requiresAction) {
        this.logger.log('Goal does not require actions')
        return {
          goal,
          steps: [],
          status: 'completed',
          requiresAction: false,
        }
      }

      // Create plan steps based on available actions and goal
      const steps = await this.generatePlanSteps(goal, availableActions)

      // Create new plan
      const plan: Plan = {
        goal,
        steps,
        status: 'pending',
        requiresAction: true,
      }

      // Cache the plan
      await this.cachePlan(plan)

      this.currentPlan = plan
      this.context = {
        goal,
        currentStep: 0,
        startTime: Date.now(),
        lastUpdate: Date.now(),
        retryCount: 0,
      }

      return plan
    }
    catch (error) {
      this.logger.withError(error).error('Failed to create plan')
      throw error
    }
  }

  public async executePlan(plan: Plan): Promise<void> {
    if (!this.initialized) {
      throw new Error('Planning agent not initialized')
    }

    if (!plan.requiresAction) {
      this.logger.log('Plan does not require actions, skipping execution')
      return
    }

    if (!this.actionAgent) {
      throw new Error('Action agent not available')
    }

    this.logger.withField('plan', plan).log('Executing plan')

    try {
      plan.status = 'in_progress'
      this.currentPlan = plan

      for (let i = 0; i < plan.steps.length; i++) {
        if (!this.context)
          break

        const step = plan.steps[i]
        this.context.currentStep = i

        try {
          this.logger.withFields({ step, index: i }).log('Executing plan step')
          await this.actionAgent.performAction(step.action, step.params)
          this.context.lastUpdate = Date.now()
        }
        catch (stepError) {
          this.logger.withError(stepError).error('Failed to execute plan step')

          // Attempt to adjust plan and retry
          if (this.context.retryCount < 3) {
            this.context.retryCount++
            const adjustedPlan = await this.adjustPlan(plan, stepError instanceof Error ? stepError.message : 'Unknown error')
            await this.executePlan(adjustedPlan)
            return
          }

          plan.status = 'failed'
          throw stepError
        }
      }

      plan.status = 'completed'
    }
    catch (error) {
      plan.status = 'failed'
      throw error
    }
    finally {
      this.context = null
    }
  }

  public async adjustPlan(plan: Plan, feedback: string): Promise<Plan> {
    if (!this.initialized) {
      throw new Error('Planning agent not initialized')
    }

    this.logger.withFields({ plan, feedback }).log('Adjusting plan')

    try {
      // If there's a current context, use it to adjust the plan
      if (this.context) {
        const currentStep = this.context.currentStep
        const availableActions = this.actionAgent?.getAvailableActions() ?? []

        // Generate new steps from the current point
        const newSteps = await this.generatePlanSteps(plan.goal, availableActions, feedback)

        // Create adjusted plan
        const adjustedPlan: Plan = {
          goal: plan.goal,
          steps: [
            ...plan.steps.slice(0, currentStep),
            ...newSteps,
          ],
          status: 'pending',
        }

        return adjustedPlan
      }

      // If no context, create a new plan
      return this.createPlan(plan.goal)
    }
    catch (error) {
      this.logger.withError(error).error('Failed to adjust plan')
      throw error
    }
  }

  private async generatePlanSteps(
    goal: string,
    availableActions: Action[],
    feedback?: string,
  ): Promise<Array<{ action: string, params: unknown[] }>> {
    // First, try to find a matching template
    const template = this.findMatchingTemplate(goal)
    if (template) {
      this.logger.log('Using plan template')
      return template.steps
    }

    // If no template matches, use LLM to generate plan
    this.logger.log('Generating plan using LLM')
    return await generatePlanWithLLM(goal, availableActions, {
      agent: this.llmConfig.agent,
      model: this.llmConfig.model,
    }, feedback)
  }

  private findMatchingTemplate(goal: string): PlanTemplate | undefined {
    for (const [pattern, template] of this.planTemplates.entries()) {
      if (goal.toLowerCase().includes(pattern.toLowerCase())) {
        return template
      }
    }
    return undefined
  }

  private parseGoalRequirements(goal: string): {
    needsItems: boolean
    items?: string[]
    needsMovement: boolean
    location?: { x?: number, y?: number, z?: number }
    needsInteraction: boolean
    target?: string
    needsCrafting: boolean
    needsCombat: boolean
  } {
    const requirements = {
      needsItems: false,
      needsMovement: false,
      needsInteraction: false,
      needsCrafting: false,
      needsCombat: false,
    }

    const goalLower = goal.toLowerCase()

    // Check for item-related actions
    if (goalLower.includes('collect') || goalLower.includes('get') || goalLower.includes('find')) {
      requirements.needsItems = true
      requirements.needsMovement = true
    }

    // Check for movement-related actions
    if (goalLower.includes('go to') || goalLower.includes('move to') || goalLower.includes('follow')) {
      requirements.needsMovement = true
    }

    // Check for interaction-related actions
    if (goalLower.includes('interact') || goalLower.includes('use') || goalLower.includes('open')) {
      requirements.needsInteraction = true
    }

    // Check for crafting-related actions
    if (goalLower.includes('craft') || goalLower.includes('make') || goalLower.includes('build')) {
      requirements.needsCrafting = true
      requirements.needsItems = true
    }

    // Check for combat-related actions
    if (goalLower.includes('attack') || goalLower.includes('fight') || goalLower.includes('kill')) {
      requirements.needsCombat = true
      requirements.needsMovement = true
    }

    return requirements
  }

  private generateGatheringSteps(items?: string[]): Array<{ action: string, params: unknown[] }> {
    const steps: Array<{ action: string, params: unknown[] }> = []

    if (items) {
      for (const item of items) {
        steps.push(
          { action: 'searchForBlock', params: [item, 64] },
          { action: 'collectBlocks', params: [item, 1] },
        )
      }
    }

    return steps
  }

  private generateMovementSteps(location?: { x?: number, y?: number, z?: number }): Array<{ action: string, params: unknown[] }> {
    if (location?.x !== undefined && location?.y !== undefined && location?.z !== undefined) {
      return [{
        action: 'goToCoordinates',
        params: [location.x, location.y, location.z, 1],
      }]
    }
    return []
  }

  private generateInteractionSteps(target?: string): Array<{ action: string, params: unknown[] }> {
    if (target) {
      return [{
        action: 'activate',
        params: [target],
      }]
    }
    return []
  }

  private generateRecoverySteps(feedback: string): Array<{ action: string, params: unknown[] }> {
    const steps: Array<{ action: string, params: unknown[] }> = []

    if (feedback.includes('not found')) {
      steps.push({ action: 'searchForBlock', params: ['any', 128] })
    }

    if (feedback.includes('inventory full')) {
      steps.push({ action: 'discard', params: ['cobblestone', 64] })
    }

    return steps
  }

  private async loadCachedPlan(goal: string): Promise<Plan | null> {
    if (!this.memoryAgent)
      return null

    const cachedPlan = this.memoryAgent.recall<Plan>(`plan:${goal}`)
    if (cachedPlan && this.isPlanValid(cachedPlan)) {
      return cachedPlan
    }
    return null
  }

  private async cachePlan(plan: Plan): Promise<void> {
    if (!this.memoryAgent)
      return

    this.memoryAgent.remember(`plan:${plan.goal}`, plan)
  }

  private isPlanValid(plan: Plan): boolean {
    // Add validation logic here
    return true
  }

  private initializePlanTemplates(): void {
    // Add common plan templates
    this.planTemplates.set('collect wood', {
      goal: 'collect wood',
      conditions: ['needs_axe', 'near_trees'],
      steps: [
        { action: 'searchForBlock', params: ['log', 64] },
        { action: 'collectBlocks', params: ['log', 1] },
      ],
      requiresAction: true,
    })

    this.planTemplates.set('find shelter', {
      goal: 'find shelter',
      conditions: ['is_night', 'unsafe'],
      steps: [
        { action: 'searchForBlock', params: ['bed', 64] },
        { action: 'goToBed', params: [] },
      ],
      requiresAction: true,
    })

    // Add templates for non-action goals
    this.planTemplates.set('hello', {
      goal: 'hello',
      conditions: [],
      steps: [],
      requiresAction: false,
    })

    this.planTemplates.set('how are you', {
      goal: 'how are you',
      conditions: [],
      steps: [],
      requiresAction: false,
    })
  }

  private async handleAgentMessage(sender: string, message: string): Promise<void> {
    if (sender === 'system') {
      if (message.includes('interrupt')) {
        this.handleInterrupt()
      }
    }
    else {
      const convo = this.conversationStore.getConvo(sender)
      if (convo.active.value) {
        // Process message and potentially adjust plan
        this.logger.withFields({ sender, message }).log('Processing agent message')
      }
    }
  }

  private handleInterrupt(): void {
    if (this.currentPlan) {
      this.currentPlan.status = 'failed'
      this.context = null
    }
  }

  private doesGoalRequireAction(requirements: ReturnType<typeof this.parseGoalRequirements>): boolean {
    // Check if any requirement indicates need for action
    return requirements.needsItems
      || requirements.needsMovement
      || requirements.needsInteraction
      || requirements.needsCrafting
      || requirements.needsCombat
  }
}
