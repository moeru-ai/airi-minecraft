import type { Mineflayer } from '../../libs/mineflayer'
import type { Action } from '../../libs/mineflayer/action'
import type { ActionAgent, AgentConfig } from '../../libs/mineflayer/base-agent'

import { useBot } from '../../composables/bot'
import { AbstractAgent } from '../../libs/mineflayer/base-agent'
import { ActionManager } from '../../manager/action'
import { actionsList } from './tools'

interface ActionState {
  executing: boolean
  label: string
  startTime: number
}

/**
 * ActionAgentImpl implements the ActionAgent interface to handle action execution
 * Manages action lifecycle, state tracking and error handling
 */
export class ActionAgentImpl extends AbstractAgent implements ActionAgent {
  public readonly type = 'action' as const
  private actions: Map<string, Action>
  private actionManager: ActionManager
  private mineflayer: Mineflayer
  private currentActionState: ActionState

  constructor(config: AgentConfig) {
    super(config)
    this.actions = new Map()
    this.mineflayer = useBot().bot
    this.actionManager = new ActionManager(this.mineflayer)
    this.currentActionState = {
      executing: false,
      label: '',
      startTime: 0,
    }
  }

  protected async initializeAgent(): Promise<void> {
    this.logger.log('Initializing action agent')
    actionsList.forEach(action => this.actions.set(action.name, action))

    // Set up event listeners
    // todo: nothing to call here
    this.on('message', async ({ sender, message }) => {
      await this.handleAgentMessage(sender, message)
    })
  }

  protected async destroyAgent(): Promise<void> {
    await this.actionManager.stop()
    this.actionManager.cancelResume()
    this.actions.clear()
    this.removeAllListeners()
    this.currentActionState = {
      executing: false,
      label: '',
      startTime: 0,
    }
  }

  public async performAction(
    name: string,
    params: unknown[],
    options: { timeout?: number, resume?: boolean } = {},
  ): Promise<string> {
    if (!this.initialized) {
      throw new Error('Action agent not initialized')
    }

    const action = this.actions.get(name)
    if (!action) {
      throw new Error(`Action not found: ${name}`)
    }

    try {
      this.updateActionState(true, name)
      this.logger.withFields({ name, params }).log('Performing action')

      const result = await this.actionManager.runAction(
        name,
        async () => {
          const fn = action.perform(this.mineflayer)
          return await fn(...params)
        },
        {
          timeout: options.timeout ?? 60,
          resume: options.resume ?? false,
        },
      )

      if (!result.success) {
        throw new Error(result.message ?? 'Action failed')
      }

      return this.formatActionOutput({
        message: result.message,
        timedout: result.timedout,
        interrupted: false,
      })
    }
    catch (error) {
      this.logger.withFields({ name, params, error }).error('Failed to perform action')
      throw error
    }
    finally {
      this.updateActionState(false)
    }
  }

  public async resumeAction(name: string, params: unknown[]): Promise<string> {
    const action = this.actions.get(name)
    if (!action) {
      throw new Error(`Action not found: ${name}`)
    }

    try {
      this.updateActionState(true, name)
      const result = await this.actionManager.resumeAction(
        name,
        async () => {
          const fn = action.perform(this.mineflayer)
          return await fn(...params)
        },
        60,
      )

      if (!result.success) {
        throw new Error(result.message ?? 'Action failed')
      }

      return this.formatActionOutput({
        message: result.message,
        timedout: result.timedout,
        interrupted: false,
      })
    }
    catch (error) {
      this.logger.withFields({ name, params, error }).error('Failed to resume action')
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
    if (sender === 'system') {
      if (message.includes('interrupt')) {
        await this.actionManager.stop()
      }
    }
    else {
      this.logger.withFields({ sender, message }).log('Processing agent message')
    }
  }

  private updateActionState(executing: boolean, label = ''): void {
    this.currentActionState = {
      executing,
      label,
      startTime: executing ? Date.now() : 0,
    }
    this.emit('actionStateChanged', this.currentActionState)
  }

  private formatActionOutput(result: { message: string | null, timedout: boolean, interrupted: boolean }): string {
    if (result.timedout) {
      return `Action timed out: ${result.message}`
    }
    if (result.interrupted) {
      return 'Action was interrupted'
    }
    return result.message ?? ''
  }
}
