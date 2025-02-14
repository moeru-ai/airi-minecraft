import type { Client } from '@proj-airi/server-sdk'
import type { Neuri } from 'neuri'
import type { Message } from 'neuri/openai'
import type { z } from 'zod'
import type { ActionAgent, ChatAgent, PlanningAgent } from '../../agents/base-agent'
import type { Mineflayer } from '../mineflayer'

export interface LLMConfig {
  agent: Neuri
  model?: string
  retryLimit?: number
  delayInterval?: number
  maxContextLength?: number
}

export interface LLMResponse {
  content: string
  usage: {
    total_tokens: number
    prompt_tokens: number
    completion_tokens: number
  }
}

export interface MineflayerWithAgents extends Mineflayer {
  planning: PlanningAgent
  action: ActionAgent
  chat: ChatAgent
  llm: LLMGatewayInterface
}

export interface LLMAgentOptions {
  agent: Neuri
  airiClient: Client
}

export interface LLMOptions {
  route?: string
  schema?: z.ZodTypeAny
  model?: string
  temperature?: number
  metadata?: Record<string, unknown>
}

export interface LLMGatewayInterface {
  execute: <T = string>(messages: Message[], options?: LLMOptions) => Promise<T>
  generateText: (prompt: string, options?: Omit<LLMOptions, 'schema'>) => Promise<string>
  generateStructured: <T extends z.ZodTypeAny>(schema: T, prompt: string, options?: Omit<LLMOptions, 'schema'>) => Promise<z.infer<T>>
  chat: (options: { route: string, messages: Message[], temperature?: number }) => Promise<LLMResponse>
}
