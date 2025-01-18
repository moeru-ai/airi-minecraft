import type { Mineflayer } from '../../libs/mineflayer'
import type { Action } from '../../libs/mineflayer/action'
import type { ActionAgent, AgentConfig } from '../../libs/mineflayer/base-agent'
import type { PlanStep } from '../planning/llm-handler'

import { z } from 'zod'

import { useBot } from '../../composables/bot'
import { AbstractAgent } from '../../libs/mineflayer/base-agent'
import { ActionManager } from '../../manager/action'
import { actionsList } from './tools'

interface ActionState {
  executing: boolean
  label: string
  startTime: number
}

interface ActionTemplate {
  description: string
  tool: string
  parameterExtractors: {
    [key: string]: (step: PlanStep) => unknown
  }
  conditions?: Array<(step: PlanStep) => boolean>
}

/**
 * ActionAgentImpl implements the ActionAgent interface to handle action execution
 * Manages action lifecycle, state tracking and error handling
 */
export class ActionAgentImpl extends AbstractAgent implements ActionAgent {
  public readonly type = 'action' as const
  private actions: Map<string, Action>
  private actionTemplates: Map<string, ActionTemplate[]>
  private actionManager: ActionManager
  private mineflayer: Mineflayer
  private currentActionState: ActionState

  constructor(config: AgentConfig) {
    super(config)
    this.actions = new Map()
    this.actionTemplates = new Map()
    this.mineflayer = useBot().bot
    this.actionManager = new ActionManager(this.mineflayer)
    this.currentActionState = {
      executing: false,
      label: '',
      startTime: 0,
    }
    this.initializeActionTemplates()
  }

  protected async initializeAgent(): Promise<void> {
    this.logger.log('Initializing action agent')
    actionsList.forEach(action => this.actions.set(action.name, action))

    // Set up event listeners
    this.on('message', async ({ sender, message }) => {
      await this.handleAgentMessage(sender, message)
    })
  }

  private initializeActionTemplates(): void {
    // 搜索方块的模板
    this.addActionTemplate('searchForBlock', {
      description: 'Search for a specific block type',
      tool: 'searchForBlock',
      parameterExtractors: {
        blockType: (step) => {
          // 从描述中提取方块类型
          const match = step.description.match(/(?:search for|find|locate) (?:a |an |the )?(\w+)/i)
          return match?.[1] || 'log'
        },
        range: (step) => {
          // 从描述中提取搜索范围
          const match = step.description.match(/within (\d+) blocks/i)
          return match ? Number.parseInt(match[1]) : 64
        },
      },
      conditions: [
        step => step.description.toLowerCase().includes('search')
          || step.description.toLowerCase().includes('find')
          || step.description.toLowerCase().includes('locate'),
      ],
    })

    // 收集方块的模板
    this.addActionTemplate('collectBlocks', {
      description: 'Collect blocks of a specific type',
      tool: 'collectBlocks',
      parameterExtractors: {
        blockType: (step) => {
          // 从描述中提取方块类型
          const match = step.description.match(/collect (?:some )?(\w+)/i)
          return match?.[1] || 'log'
        },
        count: (step) => {
          // 从描述中提取数量
          const match = step.description.match(/collect (\d+)/i)
          return match ? Number.parseInt(match[1]) : 1
        },
      },
      conditions: [
        step => step.description.toLowerCase().includes('collect')
          || step.description.toLowerCase().includes('gather')
          || step.description.toLowerCase().includes('mine'),
      ],
    })

    // 移动的模板
    this.addActionTemplate('moveAway', {
      description: 'Move away from current position',
      tool: 'moveAway',
      parameterExtractors: {
        distance: (step) => {
          // 从描述中提取距离
          const match = step.description.match(/move (?:away |back |forward )?(\d+)/i)
          return match ? Number.parseInt(match[1]) : 5
        },
      },
      conditions: [
        step => step.description.toLowerCase().includes('move away')
          || step.description.toLowerCase().includes('step back'),
      ],
    })

    // 装备物品的模板
    this.addActionTemplate('equip', {
      description: 'Equip a specific item',
      tool: 'equip',
      parameterExtractors: {
        item: (step) => {
          // 从描述中提取物品名称
          const match = step.description.match(/equip (?:the )?(\w+)/i)
          return match?.[1] || ''
        },
      },
      conditions: [
        step => step.description.toLowerCase().includes('equip')
          || step.description.toLowerCase().includes('hold')
          || step.description.toLowerCase().includes('use'),
      ],
    })
  }

  private addActionTemplate(actionName: string, template: ActionTemplate): void {
    const templates = this.actionTemplates.get(actionName) || []
    templates.push(template)
    this.actionTemplates.set(actionName, templates)
  }

  private findMatchingTemplate(step: PlanStep): ActionTemplate | null {
    const templates = this.actionTemplates.get(step.tool) || []
    return templates.find(template =>
      template.conditions?.every(condition => condition(step)) ?? true,
    ) || null
  }

  /**
   * Extract parameters from step description and reasoning using templates
   */
  private async extractParameters(step: PlanStep, action: Action): Promise<unknown[]> {
    // First try to use a template if available
    const template = this.findMatchingTemplate(step)
    if (template) {
      this.logger.log('Using action template for parameter extraction')
      const shape = action.schema.shape as Record<string, z.ZodTypeAny>
      return Object.keys(shape).map((key) => {
        const extractor = template.parameterExtractors[key]
        return extractor ? extractor(step) : this.getDefaultValue(shape[key])
      })
    }

    // Fallback to default values if no template matches
    this.logger.log('No matching template found, using default values')
    const shape = action.schema.shape as Record<string, z.ZodTypeAny>
    return Object.values(shape).map(field => this.getDefaultValue(field))
  }

  private getDefaultValue(field: z.ZodTypeAny): unknown {
    if (field instanceof z.ZodString)
      return ''
    if (field instanceof z.ZodNumber)
      return 0
    if (field instanceof z.ZodBoolean)
      return false
    if (field instanceof z.ZodArray)
      return []
    return null
  }

  protected async destroyAgent(): Promise<void> {
    this.actions.clear()
    this.removeAllListeners()
  }

  public async performAction(step: PlanStep): Promise<string> {
    if (!this.initialized) {
      throw new Error('Action agent not initialized')
    }

    const action = this.actions.get(step.tool)
    if (!action) {
      throw new Error(`Unknown action: ${step.tool}`)
    }

    this.logger.withFields({
      action: step.tool,
      description: step.description,
      reasoning: step.reasoning,
    }).log('Performing action')

    // Extract parameters from the step description and reasoning
    const params = await this.extractParameters(step, action)

    // Update action state
    this.updateActionState(true, step.description)

    try {
      // Execute action with extracted parameters
      const result = await action.perform(this.mineflayer)(...params)
      return this.formatActionOutput({
        message: result,
        timedout: false,
        interrupted: false,
      })
    }
    catch (error) {
      this.logger.withError(error).error('Action failed')
      throw error
    }
    finally {
      this.updateActionState(false)
    }
  }

  public getAvailableActions(): Action[] {
    return Array.from(this.actions.values())
  }

  private async handleAgentMessage(sender: string, message: string): Promise<void> {
    if (sender === 'system' && message.includes('interrupt') && this.currentActionState.executing) {
      // Handle interruption
      this.logger.log('Received interrupt request')
      // Additional interrupt handling logic here
    }
  }

  private updateActionState(executing: boolean, label = ''): void {
    this.currentActionState = {
      executing,
      label,
      startTime: executing ? Date.now() : this.currentActionState.startTime,
    }
  }

  private formatActionOutput(result: { message: string | null, timedout: boolean, interrupted: boolean }): string {
    if (result.timedout) {
      return 'Action timed out'
    }
    if (result.interrupted) {
      return 'Action was interrupted'
    }
    return result.message || 'Action completed successfully'
  }
}
