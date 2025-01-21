import type { Message } from 'neuri/openai'
import type { Action } from '../../libs/mineflayer'
import type { AgentConfig, MemoryAgent } from '../../libs/mineflayer/base-agent'

import { useLogg } from '@guiiai/logg'

import { Memory } from '../../libs/mineflayer/memory'

const logger = useLogg('memory-agent').useGlobalConfig()

export class MemoryAgentImpl implements MemoryAgent {
  public readonly type = 'memory' as const
  public readonly id: string
  private memory: Map<string, unknown>
  private initialized: boolean
  private memoryInstance: Memory

  constructor(config: AgentConfig) {
    this.id = config.id
    this.memory = new Map()
    this.initialized = false
    this.memoryInstance = new Memory()
  }

  async init(): Promise<void> {
    if (this.initialized) {
      return
    }

    logger.log('Initializing memory agent')
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

    logger.withFields({ key, value }).log('Storing memory')
    this.memory.set(key, value)
  }

  recall<T>(key: string): T | undefined {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    const value = this.memory.get(key) as T | undefined
    logger.withFields({ key, value }).log('Recalling memory')
    return value
  }

  forget(key: string): void {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    logger.withFields({ key }).log('Forgetting memory')
    this.memory.delete(key)
  }

  getMemorySnapshot(): Record<string, unknown> {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    return Object.fromEntries(this.memory.entries())
  }

  addChatMessage(message: Message): void {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    this.memoryInstance.chatHistory.push(message)
    logger.withFields({ message }).log('Adding chat message to memory')
  }

  addAction(action: Action): void {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    this.memoryInstance.actions.push(action)
    logger.withFields({ action }).log('Adding action to memory')
  }

  getChatHistory(): Message[] {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    return this.memoryInstance.chatHistory
  }

  getActions(): Action[] {
    if (!this.initialized) {
      throw new Error('Memory agent not initialized')
    }

    return this.memoryInstance.actions
  }
}
