import type { Agent } from 'neuri'

import { agent } from 'neuri'

import { useLogger } from '../../utils/logger'

/**
 * Creates a new Neuri agent for chat functionality
 */
export async function createChatNeuriAgent(): Promise<Agent> {
  const logger = useLogger()
  logger.log('Initializing chat agent')

  // Create a basic chat agent without tools
  // All chat functionality is handled by the LLMGateway
  return agent('chat').build()
}
