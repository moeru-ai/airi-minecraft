import type { Message } from 'neuri/openai'
import type { Buffer } from 'node:buffer'
import type { LLMGatewayInterface } from '../../libs/llm-agent/types'

/**
 * Chat session status
 */
export type ChatSessionStatus = 'active' | 'idle' | 'ended'

/**
 * Represents a chat message in the history
 */
export interface ChatHistory {
  sender: string
  message: string
  timestamp: number
}

/**
 * Represents the context of an active chat session
 */
export interface ChatContext {
  player: string
  startTime: number
  lastUpdate: number
  history: ChatHistory[]
  status: ChatSessionStatus
  metadata?: Record<string, unknown>
}

/**
 * Configuration for the Chat Agent
 */
export interface ChatAgentConfig {
  id: string
  type: 'chat'
  llmHandler: LLMGatewayInterface
  maxHistoryLength?: number
  idleTimeout?: number
  idleThreshold?: number
}

/**
 * Response from the Chat Agent
 */
export interface ChatResponse {
  content: string
  usage?: {
    total_tokens: number
    prompt_tokens: number
    completion_tokens: number
  }
}

/**
 * Options for generating chat responses
 */
export interface ChatOptions {
  temperature?: number
  maxTokens?: number
  route?: string
  metadata?: Record<string, unknown>
}

/**
 * Interface for chat message handlers
 */
export interface ChatMessageHandler {
  handleMessage: (message: string, sender: string) => Promise<string>
  handleVoiceInput: (audio: Buffer) => Promise<string>
}

/**
 * Interface for chat history management
 */
export interface ChatHistoryManager {
  addMessage: (sender: string, message: string) => void
  getHistory: () => Message[]
  clearHistory: () => void
}
