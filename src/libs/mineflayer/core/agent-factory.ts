import type { ChatAgentConfig } from '../../../agents/chat/types'
import type { AgentConfig, AgentType, BaseAgent } from '../interfaces/agents'
import { ActionAgentImpl } from '../../../agents/action'
import { ChatAgentImpl } from '../../../agents/chat'
import { MemoryAgentImpl } from '../../../agents/memory'
import { type PlanningAgentConfig, PlanningAgentImpl } from '../../../agents/planning'

export class AgentFactory {
  static createAgent(config: AgentConfig): BaseAgent {
    switch (config.type) {
      case 'action':
        return new ActionAgentImpl(config)
      case 'memory':
        return new MemoryAgentImpl(config)
      case 'planning':
        return new PlanningAgentImpl(config as PlanningAgentConfig)
      case 'chat':
        return new ChatAgentImpl(config as ChatAgentConfig)
      default:
        throw new Error(`Unknown agent type: ${config.type satisfies never}`)
    }
  }
}

export class AgentRegistry {
  private static instance: AgentRegistry
  private agents: Map<string, BaseAgent>

  private constructor() {
    this.agents = new Map()
  }

  static getInstance(): AgentRegistry {
    if (!this.instance) {
      this.instance = new AgentRegistry()
    }
    return this.instance
  }

  has(id: string): boolean {
    return this.agents.has(id)
  }

  register(agent: BaseAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent with id ${agent.id} already exists`)
    }
    this.agents.set(agent.id, agent)
  }

  get<T extends BaseAgent>(id: string, type: AgentType): T {
    const agent = this.agents.get(id)
    if (!agent) {
      throw new Error(`Agent not found: ${id}`)
    }
    if (agent.type !== type) {
      throw new Error(`Agent ${id} is not of type ${type}`)
    }
    return agent as T
  }

  getAll(): BaseAgent[] {
    return Array.from(this.agents.values())
  }

  async destroy(): Promise<void> {
    await Promise.all(Array.from(this.agents.values()).map(agent => agent.destroy()))
    this.agents.clear()
  }
}
