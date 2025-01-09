import type { Action } from '../../libs/mineflayer/action'
import type { ActionAgent, AgentConfig } from '../../libs/mineflayer/interfaces/agents'
import { AbstractAgent } from '../../libs/mineflayer/core/base-agent'
import { actionsList } from '../actions'

export class ActionAgentImpl extends AbstractAgent implements ActionAgent {
  public readonly type = 'action' as const
  private actions: Map<string, Action>

  constructor(config: AgentConfig) {
    super(config)
    this.actions = new Map()
  }

  protected async initializeAgent(): Promise<void> {
    this.logger.log('Initializing action agent')
    actionsList.forEach(action => this.actions.set(action.name, action))

    // Set up event listeners
    this.on('message', async ({ sender, message }) => {
      await this.handleAgentMessage(sender, message)
    })
  }

  protected async destroyAgent(): Promise<void> {
    this.actions.clear()
    this.removeAllListeners()
  }

  public async performAction(name: string, params: unknown[]): Promise<string> {
    if (!this.initialized) {
      throw new Error('Action agent not initialized')
    }

    const action = this.actions.get(name)
    if (!action) {
      throw new Error(`Action not found: ${name}`)
    }

    try {
      this.logger.withFields({ name, params }).log('Performing action')
      return await this.actionManager.runAction(
        name,
        async () => {
          const fn = action.perform
          return await fn(...params)
        },
        { timeout: 60, resume: false },
      )
    }
    catch (error) {
      this.logger.withFields({ name, params, error }).error('Failed to perform action')
      throw error
    }
  }

  public getAvailableActions(): Action[] {
    return Array.from(this.actions.values())
  }

  private async handleAgentMessage(sender: string, message: string): Promise<void> {
    // Handle messages from other agents or system
    if (sender === 'system') {
      // Handle system messages
      if (message.includes('interrupt')) {
        await this.actionManager.stop()
      }
    }
    else {
      // Handle agent messages
      const convo = this.conversationStore.getConvo(sender)
      if (convo.active.value) {
        // Process message and potentially perform actions
        this.logger.withFields({ sender, message }).log('Processing agent message')
      }
    }
  }
}
