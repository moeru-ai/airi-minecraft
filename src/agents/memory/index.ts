import type { AgentConfig, MemoryAgent } from '../base-agent'

import { Memory } from '../../libs/mineflayer/memory'
import { type Logger, useLogger } from '../../utils/logger'

export interface MemoryAction {
  type: string
  name: string
  data: Record<string, unknown>
  timestamp: number
}

export class MemoryAgentImpl implements MemoryAgent {
  public readonly type = 'memory' as const
  public readonly id: string
  private memory: Map<string, unknown>
  private initialized: boolean
  private memoryInstance: Memory
  private logger: Logger

  constructor(config: AgentConfig) {
    this.id = config.id
    this.memory = new Map()
    this.initialized = false
    this.memoryInstance = new Memory()
    this.logger = useLogger()
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.logger.log('Initializing memory agent')
    this.initialized = true
  }

  async destroy(): Promise<void> {
    this.memory.clear()
    this.initialized = false
  }

  remember(key: string, value: unknown): void {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    this.logger.withFields({ key, value }).log('Storing memory')
    this.memory.set(key, value)
  }

  recall<T>(key: string): T | undefined {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    return this.memory.get(key) as T
  }

  forget(key: string): void {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    this.memory.delete(key)
  }

  getMemorySnapshot(): Record<string, unknown> {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    return Object.fromEntries(this.memory.entries())
  }

  addAction(action: MemoryAction): void {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    this.memoryInstance.addAction(action)
    this.logger.withFields({ action }).log('Action recorded')
  }

  getActions(): MemoryAction[] {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    return this.memoryInstance.getActions()
  }
}
