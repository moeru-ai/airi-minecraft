import type { Neuri } from 'neuri'

export interface LLMConfig {
  agent: Neuri
  model?: string
  retryLimit?: number
  delayInterval?: number
  maxContextLength?: number
}

export interface LLMResponse {
  content: string
  usage?: any
}
